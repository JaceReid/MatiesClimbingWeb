// All D1 access for gear booking. Handlers should not build SQL themselves.

import { BOOKING_WINDOW_DAYS } from "./config.js";
import { addDays, dateRange } from "./dates.js";

/* ------------------------------------------------------------------ items */

const ITEM_COLUMNS = `id, name, description, quantity, max_per_booking,
                      price_per_day, deposit_note, sort_order, active`;

export async function loadItems(db, { includeInactive = false } = {}) {
  const sql = `SELECT ${ITEM_COLUMNS}
               FROM gear_items
               ${includeInactive ? "" : "WHERE active = 1"}
               ORDER BY sort_order, id`;
  const { results } = await db.prepare(sql).all();
  return results || [];
}

export async function loadItem(db, id) {
  return db.prepare(`SELECT ${ITEM_COLUMNS} FROM gear_items WHERE id = ?`).bind(id).first();
}

export async function updateItem(db, id, { quantity, active }) {
  const sets = [];
  const binds = [];
  if (quantity !== undefined) {
    sets.push("quantity = ?");
    binds.push(quantity);
  }
  if (active !== undefined) {
    sets.push("active = ?");
    binds.push(active ? 1 : 0);
  }
  if (!sets.length) return loadItem(db, id);
  binds.push(id);
  await db.prepare(`UPDATE gear_items SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  return loadItem(db, id);
}

/* ----------------------------------------------------------- availability */

/**
 * Units committed per (item, day) across a date window.
 *
 * The `commitments` CTE pre-filters to bookings that actually overlap the
 * window. Joining booking_items directly and putting the date test on a second
 * LEFT JOIN would let non-overlapping line items survive as NULL-booking rows
 * and silently inflate the SUM.
 *
 * CROSS JOIN days before the LEFT JOIN guarantees a row for every (item, day),
 * including days with nothing booked, so the caller never fills gaps.
 */
export async function loadCommitments(db, from, to) {
  const { results } = await db
    .prepare(
      `WITH RECURSIVE days(d) AS (
         SELECT ?1
         UNION ALL
         SELECT date(d, '+1 day') FROM days WHERE d < ?2
       ),
       commitments AS (
         SELECT bi.item_id AS item_id, bi.qty AS qty,
                b.start_date AS s, b.end_date AS e
         FROM booking_items bi
         JOIN bookings b ON b.id = bi.booking_id
         WHERE b.status = 'confirmed'
           AND b.start_date <= ?2
           AND b.end_date   >= ?1
       )
       SELECT g.id AS item_id, days.d AS day, COALESCE(SUM(c.qty), 0) AS committed
       FROM gear_items g
       CROSS JOIN days
       LEFT JOIN commitments c
              ON c.item_id = g.id AND c.s <= days.d AND c.e >= days.d
       WHERE g.active = 1
       GROUP BY g.id, g.sort_order, days.d
       ORDER BY g.sort_order, g.id, days.d`
    )
    .bind(from, to)
    .all();
  return results || [];
}

/**
 * Pivot items + commitments into the dense payload the UI renders from.
 * `free[i]` is units available on `days[i]`, clamped at 0 so an admin lowering
 * a quantity below existing bookings can never produce a negative.
 */
export function buildAvailability(items, commitments, days) {
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const free = new Map(items.map((it) => [it.id, new Array(days.length).fill(it.quantity)]));

  for (const row of commitments) {
    const arr = free.get(row.item_id);
    const i = dayIndex.get(row.day);
    if (arr && i !== undefined) arr[i] = Math.max(0, arr[i] - row.committed);
  }

  return items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description,
    quantity: it.quantity,
    maxPerBooking: Math.min(it.max_per_booking, it.quantity),
    pricePerDay: it.price_per_day,
    depositNote: it.deposit_note,
    free: free.get(it.id),
  }));
}

/** The window the server is willing to accept bookings in. */
export function bookingWindow(today) {
  const end = addDays(today, BOOKING_WINDOW_DAYS - 1);
  return { start: today, end, days: dateRange(today, BOOKING_WINDOW_DAYS) };
}

/* --------------------------------------------------------------- bookings */

/** Phone is the only identifier collected, so the per-person cap keys on it. */
export async function countActiveForPhone(db, phone, today) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
       WHERE phone = ? AND status = 'confirmed' AND end_date >= ?`
    )
    .bind(phone, today)
    .first();
  return row?.n ?? 0;
}

/**
 * Successful bookings from this IP in the last hour and day.
 * Rolling windows, so SQLite's UTC datetime('now') is the right clock here.
 */
export async function countRecentForIp(db, ipHash) {
  if (!ipHash) return { hour: 0, day: 0 };
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN created_at > datetime('now','-1 hour') THEN 1 ELSE 0 END), 0) AS hour,
         COALESCE(SUM(CASE WHEN created_at > datetime('now','-1 day')  THEN 1 ELSE 0 END), 0) AS day
       FROM bookings WHERE ip_hash = ?`
    )
    .bind(ipHash)
    .first();
  return { hour: row?.hour ?? 0, day: row?.day ?? 0 };
}

/**
 * Create a booking. The BEFORE INSERT trigger on booking_items enforces
 * capacity inside each statement, and batch() runs the lot in one implicit
 * transaction, so an over-booking rolls back the bookings row too.
 *
 * Throws on conflict; callers use isUnavailableError() to classify.
 */
export async function insertBooking(db, booking, items) {
  await db.batch([
    db
      .prepare(
        `INSERT INTO bookings
           (id, ref, name, phone, total_cost,
            start_date, end_date, notes, status, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
      )
      .bind(
        booking.id,
        booking.ref,
        booking.name,
        booking.phone,
        booking.totalCost,
        booking.startDate,
        booking.endDate,
        booking.notes,
        booking.ipHash
      ),
    ...items.map((it) =>
      db
        .prepare(
          `INSERT INTO booking_items (booking_id, item_id, qty, price_per_day)
           VALUES (?, ?, ?, ?)`
        )
        .bind(booking.id, it.id, it.qty, it.pricePerDay ?? 0)
    ),
  ]);
}

/**
 * Apply an admin edit.
 *
 * The capacity trigger only fires on INSERT, so any UPDATE that could increase
 * usage (longer dates, bigger qty, restoring a cancellation) would slip past
 * it. Deleting the line items first and re-inserting them re-arms the trigger,
 * and because the booking then has no items of its own it cannot collide with
 * itself. On ABORT the batch rolls back the DELETE and UPDATE as well, leaving
 * the booking exactly as it was.
 */
export async function editBooking(db, id, { startDate, endDate, status, items, totalCost }) {
  await db.batch([
    db.prepare(`DELETE FROM booking_items WHERE booking_id = ?`).bind(id),
    db
      .prepare(
        `UPDATE bookings
            SET start_date = ?, end_date = ?, status = ?, total_cost = ?,
                edited_at = datetime('now')
          WHERE id = ?`
      )
      .bind(startDate, endDate, status, totalCost, id),
    ...items.map((it) =>
      db
        .prepare(
          `INSERT INTO booking_items (booking_id, item_id, qty, price_per_day)
           VALUES (?, ?, ?, ?)`
        )
        .bind(id, it.id, it.qty, it.pricePerDay ?? 0)
    ),
  ]);
}

export function isUnavailableError(err) {
  const msg = String(err?.cause?.message ?? err?.message ?? err);
  return msg.includes("gear_unavailable") || msg.includes("SQLITE_CONSTRAINT");
}

export async function loadBooking(db, id) {
  const booking = await db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(id).first();
  if (!booking) return null;
  booking.items = await loadBookingItems(db, id);
  return booking;
}

export async function loadBookingItems(db, bookingId) {
  const { results } = await db
    .prepare(
      `SELECT bi.item_id AS id, bi.qty AS qty, g.name AS name,
              bi.price_per_day AS pricePerDay, g.deposit_note AS depositNote
       FROM booking_items bi
       JOIN gear_items g ON g.id = bi.item_id
       WHERE bi.booking_id = ?
       ORDER BY g.sort_order, g.id`
    )
    .bind(bookingId)
    .all();
  return results || [];
}

export async function setBookingStatus(db, id, status) {
  const stamp =
    status === "cancelled" ? "cancelled_at" : status === "returned" ? "returned_at" : null;
  const sql = stamp
    ? `UPDATE bookings SET status = ?, ${stamp} = datetime('now') WHERE id = ?`
    : `UPDATE bookings SET status = ? WHERE id = ?`;
  return db.prepare(sql).bind(status, id).run();
}

export async function deleteBooking(db, id) {
  // booking_items goes with it via ON DELETE CASCADE.
  return db.prepare(`DELETE FROM bookings WHERE id = ?`).bind(id).run();
}

/* ------------------------------------------------------------------ admin */

export async function listBookings(db, { status = "confirmed", today, all = false } = {}) {
  const where = [];
  const binds = [];
  if (status !== "any") {
    where.push("status = ?");
    binds.push(status);
  }
  if (!all && today) {
    where.push("end_date >= ?");
    binds.push(today);
  }
  const { results } = await db
    .prepare(
      `SELECT * FROM bookings
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY start_date, created_at DESC
       LIMIT 500`
    )
    .bind(...binds)
    .all();

  const bookings = results || [];
  if (!bookings.length) return bookings;

  // One extra query for all line items, then group in JS - avoids N+1.
  const { results: itemRows } = await db
    .prepare(
      `SELECT bi.booking_id, bi.item_id AS id, bi.qty, bi.price_per_day, g.name
       FROM booking_items bi
       JOIN gear_items g ON g.id = bi.item_id
       ORDER BY g.sort_order, g.id`
    )
    .all();

  const byBooking = new Map();
  for (const row of itemRows || []) {
    if (!byBooking.has(row.booking_id)) byBooking.set(row.booking_id, []);
    byBooking
      .get(row.booking_id)
      .push({ id: row.id, qty: row.qty, name: row.name, pricePerDay: row.price_per_day });
  }
  for (const b of bookings) b.items = byBooking.get(b.id) || [];
  return bookings;
}

/**
 * The three things worth opening the admin page for.
 */
export async function loadWarnings(db, today, windowEnd) {
  const unnotified = await db
    .prepare(
      `SELECT id, ref, name, phone, start_date, end_date FROM bookings
       WHERE notified = 0 AND status = 'confirmed' ORDER BY created_at DESC LIMIT 50`
    )
    .all();

  const overdue = await db
    .prepare(
      `SELECT id, ref, name, phone, start_date, end_date FROM bookings
       WHERE status = 'confirmed' AND end_date < ? ORDER BY end_date LIMIT 50`
    )
    .bind(today)
    .all();

  // Days where existing bookings exceed current stock - fires when a quantity
  // is lowered after bookings already exist.
  const commitments = await loadCommitments(db, today, windowEnd);
  const items = await loadItems(db, { includeInactive: true });
  const qty = new Map(items.map((i) => [i.id, i.quantity]));
  const overcommitted = commitments
    .filter((c) => c.committed > (qty.get(c.item_id) ?? 0))
    .map((c) => ({
      itemId: c.item_id,
      day: c.day,
      committed: c.committed,
      quantity: qty.get(c.item_id) ?? 0,
    }));

  return {
    unnotified: unnotified.results || [],
    overdue: overdue.results || [],
    overcommitted,
  };
}

/**
 * How many units of `itemId` would be committed on each day of a range if the
 * given booking were ignored. Used to warn an admin before they lower stock.
 */
export async function peakCommitted(db, itemId, from, to, excludeBookingId = null) {
  const { results } = await db
    .prepare(
      `WITH RECURSIVE days(d) AS (
         SELECT ?2 UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < ?3
       )
       SELECT days.d AS day, COALESCE(SUM(bi.qty), 0) AS committed
       FROM days
       LEFT JOIN bookings b
              ON b.status = 'confirmed'
             AND b.start_date <= days.d AND b.end_date >= days.d
             AND (?4 IS NULL OR b.id != ?4)
       LEFT JOIN booking_items bi
              ON bi.booking_id = b.id AND bi.item_id = ?1
       GROUP BY days.d
       ORDER BY days.d`
    )
    .bind(itemId, from, to, excludeBookingId)
    .all();
  return results || [];
}

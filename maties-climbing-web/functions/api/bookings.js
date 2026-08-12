// POST /api/bookings - create a gear booking.
//
// Order of operations matters here:
//   validate -> abuse checks -> friendly pre-flight -> atomic insert -> notify
// The pre-flight availability check exists only to produce a specific error
// message. The actual guarantee that gear isn't double-booked comes from the
// capacity trigger firing inside insertBooking()'s batch.

import {
  MAX_ACTIVE_BOOKINGS_PER_PERSON,
  RATE_LIMIT_PER_IP_PER_DAY,
  RATE_LIMIT_PER_IP_PER_HOUR,
} from "../../lib/gear/config.js";
import { daysBetweenInclusive, formatShort, todayLocal } from "../../lib/gear/dates.js";
import {
  badRequest,
  clientIp,
  created,
  hashIp,
  json,
  originMismatch,
  readJson,
  unavailable,
} from "../../lib/gear/http.js";
import { bookingMessage, sendWhatsApp } from "../../lib/gear/notify.js";
import { bookingTotal, depositNotes } from "../../lib/gear/pricing.js";
import {
  bookingWindow,
  buildAvailability,
  countActiveForPhone,
  countRecentForIp,
  insertBooking,
  isUnavailableError,
  loadCommitments,
  loadItems,
} from "../../lib/gear/queries.js";
import { makeRef, validateBookingCore, validateItems } from "../../lib/gear/validate.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (originMismatch(request)) {
    return json(403, { ok: false, error: "forbidden" });
  }
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return json(415, { ok: false, error: "unsupported_media_type" });
  }

  const parsed = await readJson(request);
  if (parsed.error) {
    return badRequest(
      parsed.error === "too_large" ? "That request was too large." : "Malformed request."
    );
  }
  const body = parsed.value || {};

  // Honeypot. Answer exactly like a success so a bot learns nothing, but write
  // nothing to the database.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return created({
      ref: makeRef(),
      startDate: body.startDate,
      endDate: body.endDate,
      days: 1,
      totalCost: 0,
      depositNotes: [],
      items: [],
    });
  }

  const today = todayLocal();
  const window = bookingWindow(today);

  const core = validateBookingCore(body, { window });
  if (core.fields) return badRequest("Please check the highlighted fields.", core.fields);

  const catalogue = await loadItems(db);
  const parsedItems = validateItems(body.items, catalogue);
  if (parsedItems.fields) return badRequest("Please check your gear selection.", parsedItems.fields);

  const value = core.value;
  const items = parsedItems.value;

  // ---- abuse checks -------------------------------------------------------
  // Both of these are read-then-write and so can be raced. That's accepted:
  // the worst case is one extra booking slipping past a heuristic, not gear
  // being double-booked.

  const ipHash = await hashIp(clientIp(request), env.IP_SALT);
  const recent = await countRecentForIp(db, ipHash);
  if (recent.hour >= RATE_LIMIT_PER_IP_PER_HOUR || recent.day >= RATE_LIMIT_PER_IP_PER_DAY) {
    return json(429, {
      ok: false,
      error: "rate_limited",
      message: "Too many bookings from this connection. Try again later.",
    });
  }

  const active = await countActiveForPhone(db, value.phone, today);
  if (active >= MAX_ACTIVE_BOOKINGS_PER_PERSON) {
    return badRequest("You already have gear booked. Ask the committee if you need more.", {
      phone: "There's already an active booking on this number.",
    });
  }

  // ---- friendly pre-flight ------------------------------------------------
  const conflict = await findConflict(db, window, items, value.startDate, value.endDate);
  if (conflict) return unavailable(conflict.message, [conflict.itemId]);

  // ---- the write ----------------------------------------------------------
  // Price is computed server-side from the catalogue and frozen onto the
  // booking, so a later rate change doesn't retroactively alter what someone
  // was quoted.
  const days = daysBetweenInclusive(value.startDate, value.endDate);
  const totalCost = bookingTotal(items, days);

  const booking = {
    id: crypto.randomUUID(),
    ref: makeRef(),
    ...value,
    totalCost,
    ipHash,
  };

  try {
    await insertBooking(db, booking, items);
  } catch (err) {
    if (isUnavailableError(err)) {
      // Lost a race between the pre-flight check and the insert. The trigger
      // caught it and rolled the whole batch back.
      return unavailable(
        "Someone just booked that gear. We've refreshed availability - please pick again."
      );
    }
    throw err;
  }

  // ---- notify -------------------------------------------------------------
  // After the commit, outside the response path. A CallMeBot outage leaves
  // notified = 0 and shows up on the admin page; it never fails a booking.
  context.waitUntil(
    sendWhatsApp(env, bookingMessage(booking, items, days))
      .then((res) =>
        res.ok
          ? db.prepare(`UPDATE bookings SET notified = 1 WHERE id = ?`).bind(booking.id).run()
          : null
      )
      .catch((err) => console.error("WhatsApp notify failed:", err))
  );

  return created({
    ref: booking.ref,
    startDate: booking.startDate,
    endDate: booking.endDate,
    days,
    totalCost,
    depositNotes: depositNotes(items),
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      pricePerDay: i.pricePerDay,
    })),
  });
}

/**
 * Find the first item/day in the requested range that can't be satisfied, so
 * we can say which item and which day rather than just "unavailable".
 */
async function findConflict(db, window, items, startDate, endDate) {
  const catalogue = await loadItems(db);
  const commitments = await loadCommitments(db, window.start, window.end);
  const availability = buildAvailability(catalogue, commitments, window.days);
  const byId = new Map(availability.map((a) => [a.id, a]));

  const from = window.days.indexOf(startDate);
  const to = window.days.indexOf(endDate);
  if (from === -1 || to === -1) return null; // outside the window; already validated

  for (const wanted of items) {
    const avail = byId.get(wanted.id);
    if (!avail) continue;
    for (let i = from; i <= to; i++) {
      if (avail.free[i] < wanted.qty) {
        const day = formatShort(window.days[i]);
        return {
          itemId: wanted.id,
          message:
            avail.free[i] === 0
              ? `${avail.name} is fully booked on ${day}.`
              : `Only ${avail.free[i]} ${avail.name} left on ${day}.`,
        };
      }
    }
  }
  return null;
}

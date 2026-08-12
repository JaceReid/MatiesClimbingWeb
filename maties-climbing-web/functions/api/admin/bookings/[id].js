// Single booking: read, edit, status change, delete.
//
//   GET    /api/admin/bookings/:id            -> booking + items
//   PATCH  /api/admin/bookings/:id            -> { startDate, endDate, status, items }
//   POST   /api/admin/bookings/:id            -> { action: 'cancel' | 'return' | 'restore' }
//   DELETE /api/admin/bookings/:id            -> { ref }  (must match, hard delete)

import { daysBetweenInclusive, todayLocal } from "../../../../lib/gear/dates.js";
import { bookingTotal } from "../../../../lib/gear/pricing.js";
import {
  badRequest,
  json,
  notFound,
  ok,
  readJson,
  unavailable,
} from "../../../../lib/gear/http.js";
import {
  deleteBooking,
  editBooking,
  isUnavailableError,
  loadBooking,
  loadItems,
  setBookingStatus,
} from "../../../../lib/gear/queries.js";
import { validateBookingCore, validateItems } from "../../../../lib/gear/validate.js";

export async function onRequestGet({ params, env }) {
  const booking = await loadBooking(env.DB, params.id);
  return booking ? ok({ booking }) : notFound("No booking with that id.");
}

export async function onRequestPatch({ params, request, env }) {
  const db = env.DB;
  const existing = await loadBooking(db, params.id);
  if (!existing) return notFound("No booking with that id.");

  const parsed = await readJson(request);
  if (parsed.error) return badRequest("Malformed request.");
  const body = parsed.value || {};

  // Admin edits skip the public booking window on purpose: extending an
  // overdue rental or blocking gear for a long trip both need dates the
  // public form would refuse. Length and ordering rules still apply.
  const core = validateBookingCore(
    { startDate: body.startDate, endDate: body.endDate },
    { window: null, requireContact: false }
  );
  if (core.fields) return badRequest("Please check the dates.", core.fields);

  const catalogue = await loadItems(db, { includeInactive: true });
  const items = validateItems(body.items, catalogue);
  if (items.fields) return badRequest("Please check the gear selection.", items.fields);

  const status = ["confirmed", "cancelled", "returned"].includes(body.status)
    ? body.status
    : existing.status;

  // Re-price from the current catalogue: an admin edit is a re-quote, and the
  // dates may have changed the number of days.
  const days = daysBetweenInclusive(core.value.startDate, core.value.endDate);

  try {
    await editBooking(db, params.id, {
      startDate: core.value.startDate,
      endDate: core.value.endDate,
      status,
      items: items.value,
      totalCost: bookingTotal(items.value, days),
    });
  } catch (err) {
    if (isUnavailableError(err)) {
      // The batch rolled back, so `existing` is still accurate.
      return unavailable(
        "That change would over-book gear. The booking has been left unchanged."
      );
    }
    throw err;
  }

  return ok({ booking: await loadBooking(db, params.id) });
}

export async function onRequestPost({ params, request, env }) {
  const db = env.DB;
  const existing = await loadBooking(db, params.id);
  if (!existing) return notFound("No booking with that id.");

  const parsed = await readJson(request);
  if (parsed.error) return badRequest("Malformed request.");
  const action = parsed.value?.action;

  if (action === "cancel" || action === "return") {
    // Both only ever free capacity, so a plain UPDATE is safe here.
    await setBookingStatus(db, params.id, action === "cancel" ? "cancelled" : "returned");
    return ok({ booking: await loadBooking(db, params.id) });
  }

  if (action === "restore") {
    // Restoring consumes capacity again, so it has to go through the
    // delete-and-reinsert path to re-arm the trigger. It correctly fails if
    // the slot was taken while this booking was cancelled.
    try {
      // A restore is not a re-quote: carry the original prices and total over
      // untouched, so someone isn't charged a new rate for a booking they made
      // months ago.
      await editBooking(db, params.id, {
        startDate: existing.start_date,
        endDate: existing.end_date,
        status: "confirmed",
        totalCost: existing.total_cost,
        items: existing.items.map((i) => ({
          id: i.id,
          qty: i.qty,
          pricePerDay: i.pricePerDay,
        })),
      });
    } catch (err) {
      if (isUnavailableError(err)) {
        return unavailable(
          "That gear has since been booked by someone else, so this booking can't be restored."
        );
      }
      throw err;
    }
    return ok({ booking: await loadBooking(db, params.id) });
  }

  return badRequest("Unknown action.", { action: "Expected cancel, return or restore." });
}

export async function onRequestDelete({ params, request, env }) {
  const existing = await loadBooking(env.DB, params.id);
  if (!existing) return notFound("No booking with that id.");

  // Typing the ref is the confirmation step - this is unrecoverable except via
  // D1 Time Travel.
  const parsed = await readJson(request);
  if (parsed.value?.ref !== existing.ref) {
    return badRequest("Type the booking reference to confirm deletion.", {
      ref: `Expected ${existing.ref}.`,
    });
  }

  await deleteBooking(env.DB, params.id);
  return json(200, { ok: true, deleted: existing.ref, today: todayLocal() });
}

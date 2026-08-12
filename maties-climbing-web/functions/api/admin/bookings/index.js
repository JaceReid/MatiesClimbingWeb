// GET /api/admin/bookings?status=confirmed|cancelled|returned|any&all=1
//
// Returns bookings with their line items, plus the warnings block that makes
// the page worth opening: gear that should be back, bookings whose WhatsApp
// never landed, and days where stock is over-committed.

import { todayLocal } from "../../../../lib/gear/dates.js";
import { json } from "../../../../lib/gear/http.js";
import { bookingWindow, listBookings, loadItems, loadWarnings } from "../../../../lib/gear/queries.js";

const STATUSES = new Set(["confirmed", "cancelled", "returned", "any"]);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = STATUSES.has(url.searchParams.get("status"))
    ? url.searchParams.get("status")
    : "confirmed";
  const all = url.searchParams.get("all") === "1";

  const today = todayLocal();
  const window = bookingWindow(today);

  const [bookings, warnings, items] = await Promise.all([
    listBookings(env.DB, { status, today, all }),
    loadWarnings(env.DB, today, window.end),
    loadItems(env.DB, { includeInactive: true }),
  ]);

  return json(200, { ok: true, today, status, bookings, warnings, items });
}

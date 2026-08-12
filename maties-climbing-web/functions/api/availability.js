// GET /api/availability
//
// Deliberately takes no parameters. The server owns the booking window, so a
// client can't probe outside it and can't disagree with us about what "today"
// is in Stellenbosch.

import { MAX_BOOKING_DAYS, MAX_TOTAL_UNITS, MAX_DISTINCT_ITEMS } from "../../lib/gear/config.js";
import { todayLocal } from "../../lib/gear/dates.js";
import { json } from "../../lib/gear/http.js";
import {
  bookingWindow,
  buildAvailability,
  loadCommitments,
  loadItems,
} from "../../lib/gear/queries.js";

export async function onRequestGet({ env }) {
  const today = todayLocal();
  const window = bookingWindow(today);

  const [items, commitments] = await Promise.all([
    loadItems(env.DB),
    loadCommitments(env.DB, window.start, window.end),
  ]);

  return json(200, {
    ok: true,
    today,
    windowStart: window.start,
    windowEnd: window.end,
    days: window.days,
    maxDays: MAX_BOOKING_DAYS,
    maxTotalUnits: MAX_TOTAL_UNITS,
    maxDistinctItems: MAX_DISTINCT_ITEMS,
    currency: "R",
    items: buildAvailability(items, commitments, window.days),
  });
}

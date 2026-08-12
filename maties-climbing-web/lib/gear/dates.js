// Calendar dates, done carefully.
//
// Three separate clocks want to give us the wrong answer:
//   - Workers run in UTC
//   - SQLite's date('now') is UTC
//   - the visitor's browser is whatever their phone says
// Between 00:00 and 02:00 SAST all of the first two report *yesterday*. So the
// server derives "today" from an explicit timezone, and the client is never
// allowed to compute a calendar date at all - it only renders what we send.
//
// Everything except todayLocal() treats dates as UTC-anchored calendar labels,
// never as instants, so no offset or DST logic can leak in.

import { TIMEZONE } from "./config.js";

/** Today's date in Stellenbosch as 'YYYY-MM-DD'. */
export function todayLocal(now = new Date()) {
  // 'en-CA' formats as YYYY-MM-DD. Workers ships full ICU, so timeZone works.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
}

/** Shift an ISO date by n whole days. */
export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count: 8th to 10th is 3. */
export function daysBetweenInclusive(a, b) {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / 86400000) + 1;
}

/** True for a real calendar date. Rejects '2026-02-30' and '2026-13-01'. */
export function isIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Build the inclusive list of dates from `start`, `length` long. */
export function dateRange(start, length) {
  return Array.from({ length }, (_, i) => addDays(start, i));
}

/** '2026-08-09' -> 'Sat 9 Aug', for WhatsApp messages and error copy. */
export function formatShort(iso) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
}

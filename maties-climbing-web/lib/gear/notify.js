// WhatsApp notification via CallMeBot.
//
// CallMeBot is a free community service with no SLA. It is called from
// context.waitUntil() *after* the booking has committed, so an outage can
// never fail a booking - it just leaves bookings.notified = 0, which the admin
// page surfaces as a badge.
//
// Setup: message the CallMeBot WhatsApp number once from the phone that should
// receive alerts to get an API key, then set CALLMEBOT_PHONE and
// CALLMEBOT_APIKEY as Pages secrets. The key is bound to that one number, so
// it must be reissued when the gear officer changes.

import { CALLMEBOT_TIMEOUT_MS } from "./config.js";
import { formatShort } from "./dates.js";
import { depositNotes, formatRand } from "./pricing.js";

export async function sendWhatsApp(env, text) {
  if (!env.CALLMEBOT_PHONE || !env.CALLMEBOT_APIKEY) {
    return { ok: false, reason: "not_configured" };
  }

  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.searchParams.set("phone", env.CALLMEBOT_PHONE);
  url.searchParams.set("text", text); // URLSearchParams encodes newlines as %0A
  url.searchParams.set("apikey", env.CALLMEBOT_APIKEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLMEBOT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    // CallMeBot responds with HTML, not JSON. The status code is the only
    // thing worth reading.
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, reason: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function bookingMessage(booking, items, days) {
  const dates =
    booking.startDate === booking.endDate
      ? formatShort(booking.startDate)
      : `${formatShort(booking.startDate)} to ${formatShort(booking.endDate)}`;

  const deposits = depositNotes(items);

  return [
    `New gear booking ${booking.ref}`,
    booking.name,
    booking.phone,
    `${dates} (${days} day${days === 1 ? "" : "s"})`,
    items.map((i) => `${i.qty} x ${i.name}`).join(", "),
    `Total: ${formatRand(booking.totalCost)}`,
    // Deposits are agreed at the cupboard, so this is a reminder to collect
    // one, not an amount.
    deposits.length ? `Deposit: ${deposits.map((d) => d.name).join(", ")}` : null,
    booking.notes ? `Note: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

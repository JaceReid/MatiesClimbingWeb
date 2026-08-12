// Server-side validation. The client is trusted for nothing here - every rule
// the UI enforces is re-checked, because the UI is just a suggestion.

import {
  MAX_BOOKING_DAYS,
  MAX_DISTINCT_ITEMS,
  MAX_TOTAL_UNITS,
  REF_ALPHABET,
} from "./config.js";
import { daysBetweenInclusive, isIsoDate } from "./dates.js";

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Normalise a SA mobile number to +27XXXXXXXXX, or null if it isn't one. */
export function normalisePhone(raw) {
  const digits = str(raw).replace(/[\s()\-.]/g, "");
  const m = /^(?:\+?27|0)(\d{9})$/.exec(digits);
  return m ? `+27${m[1]}` : null;
}

/**
 * Validate the contact + date portion of a booking.
 * Returns { fields } on failure, { value } on success.
 *
 * `window` is null for admin edits, which are deliberately allowed outside the
 * public two-week window (extending an overdue booking, blocking a long trip).
 */
export function validateBookingCore(body, { window, requireContact = true } = {}) {
  const fields = {};
  const value = {};

  if (requireContact) {
    const name = str(body.name);
    if (name.length < 2 || name.length > 80) {
      fields.name = "Enter your name (2-80 characters).";
    } else if (/https?:/i.test(name)) {
      fields.name = "Enter your name, not a link.";
    } else {
      value.name = name;
    }

    // Phone is the only identifier collected, so it doubles as the identity the
    // per-person booking cap keys on. Normalising here is what makes that work.
    const phone = normalisePhone(body.phone);
    if (!phone) {
      fields.phone = "Enter a South African number like 082 123 4567.";
    } else {
      value.phone = phone;
    }

    const notes = str(body.notes);
    if (notes.length > 500) {
      fields.notes = "Keep notes under 500 characters.";
    } else {
      value.notes = notes || null;
    }
  }

  const { startDate, endDate } = body;
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    fields.dates = "Pick a start and end date.";
  } else if (endDate < startDate) {
    fields.dates = "The end date is before the start date.";
  } else if (daysBetweenInclusive(startDate, endDate) > MAX_BOOKING_DAYS) {
    fields.dates = `Bookings can be at most ${MAX_BOOKING_DAYS} days.`;
  } else if (window && startDate < window.start) {
    fields.dates = "That start date is in the past.";
  } else if (window && endDate > window.end) {
    fields.dates = `You can only book up to ${window.end}.`;
  } else {
    value.startDate = startDate;
    value.endDate = endDate;
  }

  return Object.keys(fields).length ? { fields } : { value };
}

/**
 * Validate the requested line items against live inventory.
 * `catalogue` is the rows from loadItems() - never trust names or quantities
 * that arrived in the request body.
 */
export function validateItems(rawItems, catalogue) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { fields: { items: "Pick at least one item." } };
  }
  if (rawItems.length > MAX_DISTINCT_ITEMS) {
    return { fields: { items: `Pick at most ${MAX_DISTINCT_ITEMS} different items.` } };
  }

  const byId = new Map(catalogue.map((i) => [i.id, i]));
  const seen = new Set();
  const items = [];
  let total = 0;

  for (const raw of rawItems) {
    const id = str(raw?.id);
    const item = byId.get(id);
    if (!item || !item.active) {
      return { fields: { items: "That gear isn't available to book." } };
    }
    if (seen.has(id)) {
      return { fields: { items: "The same item was listed twice." } };
    }
    seen.add(id);

    const qty = Number(raw?.qty);
    const max = Math.min(item.max_per_booking, item.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > max) {
      return { fields: { items: `You can book 1 to ${max} of ${item.name}.` } };
    }

    total += qty;
    // Price comes from the catalogue row, never from the request body.
    items.push({
      id,
      qty,
      name: item.name,
      pricePerDay: item.price_per_day,
      depositNote: item.deposit_note,
    });
  }

  if (total > MAX_TOTAL_UNITS) {
    return { fields: { items: `That's more than ${MAX_TOTAL_UNITS} items in total.` } };
  }
  return { value: items };
}

/**
 * Validate a gear item coming from the admin page.
 *
 * `partial` is true for PATCH, where only the supplied keys are checked - this
 * is what lets the quantity stepper send just { quantity } without having to
 * round-trip every other field.
 */
export function validateGearItem(body, { partial = false } = {}) {
  const fields = {};
  const value = {};

  const has = (key) => body[key] !== undefined;
  const required = (key) => !partial || has(key);

  if (required("name")) {
    const name = str(body.name);
    if (name.length < 2 || name.length > 60) {
      fields.name = "Name must be 2-60 characters.";
    } else {
      value.name = name;
    }
  }

  if (has("description")) {
    const description = str(body.description);
    if (description.length > 200) fields.description = "Keep it under 200 characters.";
    else value.description = description || null;
  }

  if (has("depositNote")) {
    const note = str(body.depositNote);
    if (note.length > 200) fields.depositNote = "Keep it under 200 characters.";
    else value.depositNote = note || null;
  }

  const wholeNumber = (key, label, { min = 0, max = 9999 }) => {
    if (!required(key)) return;
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < min || n > max) {
      fields[key] = `${label} must be a whole number between ${min} and ${max}.`;
    } else {
      value[key] = n;
    }
  };

  wholeNumber("quantity", "Quantity", { min: 0, max: 999 });
  wholeNumber("pricePerDay", "Price", { min: 0, max: 9999 });
  wholeNumber("maxPerBooking", "Max per booking", { min: 1, max: 999 });
  if (has("sortOrder")) wholeNumber("sortOrder", "Sort order", { min: 0, max: 9999 });

  if (has("active")) value.active = !!body.active;

  return Object.keys(fields).length ? { fields } : { value };
}

/**
 * Turn a gear name into a URL-safe id. Ids are permanent once bookings
 * reference them, so this only runs when creating an item.
 */
export function slugify(name) {
  return str(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Booking reference: short, unambiguous, safe to read aloud. */
export function makeRef() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const body = [...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
  return `MC-${body}`;
}

// PATCH /api/admin/items/:id
//
// Edits name, description, price, quantity, max per booking, deposit note and
// active. The id itself is not editable: booking history references it.
//
// Lowering a quantity below what's already booked is allowed but never
// silently cancels anything - the response reports which days are now
// over-committed so the admin knows who to phone.

import { todayLocal } from "../../../../lib/gear/dates.js";
import { badRequest, notFound, ok, readJson } from "../../../../lib/gear/http.js";
import { bookingWindow, loadItem, peakCommitted, updateItem } from "../../../../lib/gear/queries.js";
import { validateGearItem } from "../../../../lib/gear/validate.js";

export async function onRequestGet({ params, env }) {
  const item = await loadItem(env.DB, params.id);
  return item ? ok({ item }) : notFound("No such gear.");
}

export async function onRequestPatch({ params, request, env }) {
  const item = await loadItem(env.DB, params.id);
  if (!item) return notFound("No such gear.");

  const parsed = await readJson(request);
  if (parsed.error) return badRequest("Malformed request.");

  const checked = validateGearItem(parsed.value || {}, { partial: true });
  if (checked.fields) return badRequest("Please check the highlighted fields.", checked.fields);

  const updated = await updateItem(env.DB, params.id, checked.value);

  const window = bookingWindow(todayLocal());
  const committed = await peakCommitted(env.DB, params.id, window.start, window.end);
  const overcommitted = committed
    .filter((c) => c.committed > updated.quantity)
    .map((c) => ({ day: c.day, committed: c.committed, quantity: updated.quantity }));

  return ok({ item: updated, overcommitted });
}

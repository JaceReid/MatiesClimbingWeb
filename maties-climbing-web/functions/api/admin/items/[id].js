// PATCH /api/admin/items/:id -> { quantity?, active? }
//
// Lets the gear officer adjust stock from a phone when a pad delaminates,
// without a redeploy or a wrangler command.
//
// Lowering a quantity below what's already booked is allowed but never
// silently cancels anything: the response reports which days are now
// over-committed so the admin knows who to phone.

import { todayLocal } from "../../../../lib/gear/dates.js";
import { badRequest, notFound, ok } from "../../../../lib/gear/http.js";
import { bookingWindow, loadItem, peakCommitted, updateItem } from "../../../../lib/gear/queries.js";

export async function onRequestGet({ params, env }) {
  const item = await loadItem(env.DB, params.id);
  return item ? ok({ item }) : notFound("No such gear.");
}

export async function onRequestPatch({ params, request, env }) {
  const item = await loadItem(env.DB, params.id);
  if (!item) return notFound("No such gear.");

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Malformed request.");
  }

  const patch = {};
  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 0 || q > 999) {
      return badRequest("Quantity must be a whole number.", { quantity: "0 to 999." });
    }
    patch.quantity = q;
  }
  if (body.active !== undefined) patch.active = !!body.active;

  const updated = await updateItem(env.DB, params.id, patch);

  const window = bookingWindow(todayLocal());
  const committed = await peakCommitted(env.DB, params.id, window.start, window.end);
  const overcommitted = committed
    .filter((c) => c.committed > updated.quantity)
    .map((c) => ({ day: c.day, committed: c.committed, quantity: updated.quantity }));

  return ok({ item: updated, overcommitted });
}

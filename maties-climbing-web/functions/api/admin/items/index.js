// GET  /api/admin/items - full inventory, including deactivated gear.
// POST /api/admin/items - add a new gear type.

import { badRequest, created, json, ok, readJson } from "../../../../lib/gear/http.js";
import { createItem, loadItems } from "../../../../lib/gear/queries.js";
import { slugify, validateGearItem } from "../../../../lib/gear/validate.js";

export async function onRequestGet({ env }) {
  return ok({ items: await loadItems(env.DB, { includeInactive: true }) });
}

export async function onRequestPost({ request, env }) {
  const parsed = await readJson(request);
  if (parsed.error) return badRequest("Malformed request.");

  const body = parsed.value || {};
  const checked = validateGearItem(body);
  if (checked.fields) return badRequest("Please check the highlighted fields.", checked.fields);

  // The id is derived from the name and is permanent - booking history points
  // at it, so it is never editable afterwards.
  const id = slugify(body.name);
  if (!id) return badRequest("That name can't be used.", { name: "Use some letters or numbers." });

  const result = await createItem(env.DB, id, checked.value);
  if (result.error === "duplicate") {
    return json(409, {
      ok: false,
      error: "duplicate",
      message: `There's already gear called "${body.name}".`,
      fields: { name: "Pick a different name." },
    });
  }

  return created({ item: result.item });
}

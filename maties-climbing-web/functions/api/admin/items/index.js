// GET /api/admin/items - full inventory, including deactivated gear.

import { ok } from "../../../../lib/gear/http.js";
import { loadItems } from "../../../../lib/gear/queries.js";

export async function onRequestGet({ env }) {
  return ok({ items: await loadItems(env.DB, { includeInactive: true }) });
}

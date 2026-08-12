// Auth for the whole /api/admin/* subtree, so no individual handler can
// forget it.
//
// The token travels in the Authorization header, never a query string - query
// strings end up in browser history, Referer headers on outbound links, and
// Cloudflare's own request logs.

import { json } from "../../../lib/gear/http.js";

function timingSafeEqual(a, b) {
  const ea = new TextEncoder().encode(a ?? "");
  const eb = new TextEncoder().encode(b ?? "");
  if (ea.length !== eb.length) return false;
  // crypto.subtle.timingSafeEqual is a Workers extension, not standard, so
  // fall back to a constant-time loop where it's missing.
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(ea, eb);
  }
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env } = context;

  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!env.ADMIN_TOKEN) {
    console.error("ADMIN_TOKEN secret is not set; refusing all admin requests.");
    return json(401, { ok: false, error: "unauthorized" });
  }
  if (!timingSafeEqual(token, env.ADMIN_TOKEN)) {
    return json(401, { ok: false, error: "unauthorized", message: "Wrong or missing admin token." });
  }

  return context.next();
}

// Response helpers shared by every gear endpoint.

import { MAX_BODY_BYTES } from "./config.js";

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

export const ok = (body) => json(200, { ok: true, ...body });
export const created = (body) => json(201, { ok: true, ...body });

export function badRequest(message, fields) {
  return json(400, { ok: false, error: "validation", message, fields });
}

export function unavailable(message, items = []) {
  return json(409, { ok: false, error: "unavailable", message, items });
}

export function notFound(message = "Not found") {
  return json(404, { ok: false, error: "not_found", message });
}

export function serverError() {
  // Deliberately opaque - a SQL error must never reach a visitor.
  return json(500, {
    ok: false,
    error: "server",
    message: "Something went wrong on our side. Please try again.",
  });
}

/**
 * Parse a JSON body with a hard size cap.
 *
 * content-length is a claim, not a fact, so we also cap the bytes we actually
 * read rather than trusting the header alone.
 */
export async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return { error: "too_large" };

  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) return { error: "too_large" };

  try {
    return { value: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { error: "malformed" };
  }
}

/**
 * Reject cross-origin writes when the browser tells us where it came from.
 * Absent Origin (curl, same-origin form posts) is allowed through - the real
 * protections are the honeypot and rate limit, this just makes drive-by abuse
 * from another site more annoying.
 */
export function originMismatch(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

/** Salted, truncated IP hash. We never store a raw address. */
export async function hashIp(ip, salt) {
  if (!ip) return null;
  const data = new TextEncoder().encode(`${salt || "unsalted"}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const clientIp = (request) =>
  request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";

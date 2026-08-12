// Applies to every /api/* route.
//
// Its whole job is to make sure a thrown error becomes an opaque 500 rather
// than a stack trace or a SQL fragment, and that no API response is ever
// cached.

import { serverError } from "../../lib/gear/http.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.DB) {
    // Almost always means wrangler.toml isn't being read - Pages build system
    // v1 ignores it entirely, and the binding silently comes through undefined.
    console.error("D1 binding `DB` is missing. Check wrangler.toml and the Pages build system version.");
    return serverError();
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "GET, POST, PATCH, DELETE" } });
  }

  try {
    const response = await context.next();
    // context.next() can return a 404 Response for an unmatched route; leave
    // it alone but keep it uncacheable.
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    console.error("Unhandled error in /api:", err?.stack || err);
    return serverError();
  }
}

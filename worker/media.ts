/** Serve private R2 objects only after a valid session. Never expose r2.dev URLs. */

export async function servePrivateObject(
  env: Env,
  pathname: string,
): Promise<Response> {
  const raw = pathname.slice("/api/media/".length);
  let key = "";
  try {
    key = decodeURIComponent(raw);
  } catch {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const object = await env.MOMENTS_BUCKET.get(key);
  if (!object) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("content-disposition", "inline");
  return new Response(object.body, { headers });
}

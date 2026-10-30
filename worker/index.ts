import {
  clearSessionCookie,
  hasValidSession,
  issueSessionCookie,
  verifyAccessName,
} from "./auth.ts";
import { servePrivateObject } from "./media.ts";
import { listMoments } from "./moments.ts";
import {
  clearFailures,
  clientKey,
  isRateLimited,
  recordFailure,
} from "./rate-limit.ts";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/session" && request.method === "GET") {
      const ok = await hasValidSession(env, request);
      return json({ ok }, ok ? 200 : 401);
    }

    if (url.pathname === "/api/session" && request.method === "POST") {
      return createSession(request, env);
    }

    if (url.pathname === "/api/session" && request.method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "set-cookie": clearSessionCookie(request),
        },
      });
    }

    if (url.pathname === "/api/moments" && request.method === "GET") {
      if (!(await hasValidSession(env, request))) {
        return json({ error: "未登录" }, 401);
      }
      try {
        const items = await listMoments(env);
        return json({ items });
      } catch {
        return json({ error: "相册暂时无法加载" }, 503);
      }
    }

    if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
      if (!(await hasValidSession(env, request))) {
        return json({ error: "未登录" }, 401);
      }
      return servePrivateObject(env, url.pathname);
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function createSession(request: Request, env: Env): Promise<Response> {
  const key = clientKey(request);
  if (isRateLimited(key)) {
    return json({ ok: false, error: "试得太多次了，请稍后再试" }, 429);
  }

  let name = "";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name === "string") {
      name = body.name;
    }
  } catch {
    recordFailure(key);
    return json({ ok: false, error: "名字不对哦" }, 400);
  }

  const matched = await verifyAccessName(env, name);
  if (!matched) {
    recordFailure(key);
    return json({ ok: false, error: "名字不对哦" }, 401);
  }

  clearFailures(key);
  const cookie = await issueSessionCookie(env, request);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": cookie,
    },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

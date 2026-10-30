import {
  hashAccessName,
  hmacHex,
  normalizeName,
  timingSafeEqualString,
} from "./crypto.ts";

const COOKIE_NAME = "sm_session";
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;
const SESSION_VERSION = "v1";

export { COOKIE_NAME };

export async function verifyAccessName(
  env: Env,
  name: string,
): Promise<boolean> {
  const normalized = normalizeName(name);
  if (!normalized || !env.ACCESS_SALT || !env.ACCESS_NAME_HASH) {
    return false;
  }
  const digest = await hashAccessName(env.ACCESS_SALT, normalized);
  return timingSafeEqualString(digest, env.ACCESS_NAME_HASH.trim().toLowerCase());
}

export async function issueSessionCookie(
  env: Env,
  request: Request,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${SESSION_VERSION}.${exp}.${nonce}`;
  const signature = await hmacHex(env.SESSION_SECRET, payload);
  const value = `${payload}.${signature}`;
  return serializeCookie(value, request, SESSION_TTL_SECONDS);
}

export async function hasValidSession(
  env: Env,
  request: Request,
): Promise<boolean> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token || !env.SESSION_SECRET) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== SESSION_VERSION) {
    return false;
  }
  const [version, expRaw, nonce, signature] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return false;
  }
  if (!nonce || !signature) {
    return false;
  }
  const expected = await hmacHex(env.SESSION_SECRET, `${version}.${exp}.${nonce}`);
  return timingSafeEqualString(signature, expected);
}

export function clearSessionCookie(request: Request): string {
  return serializeCookie("", request, 0);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return rest.join("=");
    }
  }
  return null;
}

function serializeCookie(
  value: string,
  request: Request,
  maxAge: number,
): string {
  const url = new URL(request.url);
  const secure =
    url.protocol === "https:" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

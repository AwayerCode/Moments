/**
 * Per-isolate failure throttle for v1. Enough to blunt casual guessing
 * on a single Worker isolate; not a global distributed limiter.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function clientKey(request: Request): string {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  return ip;
}

export function isRateLimited(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) {
    return false;
  }
  if (now >= bucket.resetAt) {
    buckets.delete(key);
    return false;
  }
  return bucket.count >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  existing.count += 1;
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}

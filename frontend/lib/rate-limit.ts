import "server-only";

// Minimal in-memory limiter for unauthenticated writes. Serverless instances
// each keep their own window, so this blunts naive scripted abuse rather than
// guaranteeing a global ceiling; the anonymous $100 cap and contact requirement
// do the rest. Signed-in users are bounded by their tier instead.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Returns true when the caller is still within `limit` hits per `windowMs`. */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

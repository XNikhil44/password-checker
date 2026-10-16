// Small helpers shared by the API routes.
// NOTE: the rate limiter is in-memory, so it is best-effort on serverless
// (each warm instance keeps its own counters). For strict limits use Upstash/Vercel KV.
const buckets = new Map();

function clientIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.socket?.remoteAddress || "unknown";
}

function rateLimit(req, res, name, limit, windowMs) {
  const now = Date.now();
  const key = `${name}:${clientIp(req)}`;
  let b = buckets.get(key);
  if (!b || b.reset < now) b = { count: 0, reset: now + windowMs };
  b.count++;
  buckets.set(key, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - b.count));
  if (b.count > limit) {
    res.setHeader("Retry-After", Math.ceil((b.reset - now) / 1000));
    send(res, 429, { error: "Too many requests. Please wait a moment and try again." });
    return false;
  }
  return true;
}

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(+v) ? +v : min));

module.exports = { rateLimit, send, clamp, clientIp };

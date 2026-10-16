// GET /api/breach?prefix=ABCDE
// k-anonymity proxy for Have I Been Pwned. The client sends only the first 5 hex chars of the
// SHA-1 hash. This server never receives the password or the full hash.
const { rateLimit, send } = require('../lib/security');

const cache = new Map(); // prefix -> { at, body }
const TTL = 60 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  if (!rateLimit(req, res, 'breach', 60, 60 * 1000)) return;

  const prefix = String(req.query.prefix || '').toUpperCase();
  if (!/^[0-9A-F]{5}$/.test(prefix)) return send(res, 400, { error: 'prefix must be 5 hex characters' });

  const hit = cache.get(prefix);
  if (hit && Date.now() - hit.at < TTL) return respond(res, hit.body);

  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'password-checker-app' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return send(res, 502, { error: 'Breach database unavailable' });

    // Drop padding rows (count 0) to keep the response small.
    const body = (await r.text())
      .split('\n').map(l => l.trim())
      .filter(l => l && !l.endsWith(':0'))
      .join('\n');

    cache.set(prefix, { at: Date.now(), body });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    respond(res, body);
  } catch {
    send(res, 504, { error: 'Breach database timed out' });
  }
};

function respond(res, body) {
  res.status(200)
    .setHeader('Content-Type', 'text/plain; charset=utf-8')
    .setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    .send(body);
}

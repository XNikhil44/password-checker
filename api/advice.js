// POST /api/advice
// Asks Gemini for personalised advice. IMPORTANT: it receives only anonymous statistics
// (length, character classes, flags, entropy). The password itself is never sent to this
// server or to Google.
const { rateLimit, send, clamp } = require('../lib/security');
const { generateJson } = require('../lib/gemini');

const LEVELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent', 'Compromised'];

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    assessment: { type: 'STRING' },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
    passphrase_method: { type: 'STRING' },
  },
  required: ['headline', 'assessment', 'tips', 'passphrase_method'],
};

const SYSTEM = `You are a concise, practical password-security advisor.
You are given ONLY anonymous statistics about a password. You never see the password, so never ask for it and never guess it.
Reply as JSON with these fields:
- "headline": max 8 words.
- "assessment": 2 sentences in plain language.
- "tips": 2 to 4 short, specific, actionable strings based on the statistics.
- "passphrase_method": one or two sentences on how to build a memorable random passphrase, for example 4 to 6 unrelated words chosen with dice or a password manager.
Never output example passwords. If breachCount is above 0, say clearly that the password must be retired everywhere it is used. Recommend a password manager and multi-factor authentication where relevant.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.GEMINI_API_KEY) return send(res, 503, { error: 'AI advice is not configured on this server.' });
  if (!rateLimit(req, res, 'advice', 8, 60 * 1000)) return;

  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const stats = {
    length: clamp(b.length, 0, 256),
    entropyBits: Math.round(clamp(b.bits, 0, 400)),
    rating: LEVELS.includes(b.level) ? b.level : 'Unknown',
    hasLowercase: b.lower === true,
    hasUppercase: b.upper === true,
    hasDigits: b.digit === true,
    hasSymbols: b.symbol === true,
    isCommonPassword: b.common === true,
    hasKeyboardOrAlphabetSequence: b.sequence === true,
    hasRepeatedCharacters: b.repeat === true,
    breachCount: b.breachCount === null || b.breachCount === undefined ? 'unknown' : clamp(b.breachCount, 0, 1e10),
  };
  if (stats.length < 1) return send(res, 400, { error: 'Missing password statistics' });

  try {
    const out = await generateJson({
      system: SYSTEM,
      prompt: `Anonymous password statistics:\n${JSON.stringify(stats, null, 2)}`,
      schema: SCHEMA,
    });
    send(res, 200, {
      headline: String(out.headline || '').slice(0, 120),
      assessment: String(out.assessment || '').slice(0, 600),
      tips: (Array.isArray(out.tips) ? out.tips : []).slice(0, 4).map(t => String(t).slice(0, 240)),
      passphrase_method: String(out.passphrase_method || '').slice(0, 400),
    });
  } catch (e) {
    const quota = e.status === 429;
    send(res, quota ? 429 : 502, {
      error: quota ? 'The AI free quota is used up for now. Try again in a minute.' : 'AI advice is temporarily unavailable.',
    });
  }
};

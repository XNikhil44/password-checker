// Minimal Gemini REST client with model fallback. The API key stays on the server.
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRY_STATUS = [404, 429, 500, 503];

function modelList() {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  return [...new Set([primary, 'gemini-3.1-flash-lite', 'gemini-2.5-flash'])];
}

async function generateJson({ system, prompt, schema }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error('GEMINI_API_KEY is not set');
    e.code = 'NO_KEY';
    throw e;
  }

  let lastErr;
  for (const model of modelList()) {
    try {
      const r = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!r.ok) {
        const err = new Error(`Gemini ${model} responded ${r.status}`);
        err.status = r.status;
        if (RETRY_STATUS.includes(r.status)) { lastErr = err; continue; } // try the next model
        throw err;
      }

      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      return JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim());
    } catch (e) {
      lastErr = e;
      if (e.name === 'TimeoutError' || e instanceof SyntaxError) continue;
      if (e.status && !RETRY_STATUS.includes(e.status)) throw e;
    }
  }
  throw lastErr || new Error('Gemini request failed');
}

module.exports = { generateJson };

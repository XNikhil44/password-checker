# Password Check (full stack)

Password strength checker with breach detection and Gemini-powered advice, deployable free on Vercel.

```
public/index.html     Frontend (strength analysis runs in the browser)
api/breach.js         GET  /api/breach?prefix=ABCDE   HIBP k-anonymity proxy (cached, rate limited)
api/advice.js         POST /api/advice                Gemini advice from anonymous stats only
api/health.js         GET  /api/health                Tells the UI whether AI is configured
lib/gemini.js         Gemini REST client with model fallback
lib/security.js       Rate limiting and helpers
vercel.json           Security headers (CSP, HSTS) and function settings
```

## Privacy design
- The password is never sent to the server or to Gemini.
- Breach check: the browser sends only the first 5 characters of the SHA-1 hash. The server fetches the matching list from Have I Been Pwned (with padding) and the browser does the final comparison.
- Gemini receives only anonymous statistics (length, character types, entropy, rating, breach count). This matters because Google may use free-tier prompts to improve its products.

## 1. Get the code on GitHub
Create a new repository and upload everything in this folder. `.env` files are git-ignored. Never commit your API key.

## 2. Deploy on Vercel (free Hobby plan)
1. Go to https://vercel.com/new and import the repository.
2. Framework Preset: **Other**. Leave build command and output directory empty.
3. Open **Environment Variables** and add:
   - `GEMINI_API_KEY` = your key from https://aistudio.google.com/apikey
   - `GEMINI_MODEL` = `gemini-3.5-flash` (optional; fallbacks to `gemini-3.1-flash-lite` and `gemini-2.5-flash` are built in)
4. Click **Deploy**. You get `https://your-project.vercel.app`.

If you add or change an environment variable later, redeploy so it takes effect.

## Run locally
```bash
npm i -g vercel
cp .env.example .env.local   # then put your key in .env.local
vercel dev
```
Open http://localhost:3000.

## Notes
- Without `GEMINI_API_KEY` the app still works; the AI panel is simply hidden.
- The rate limiter is in-memory, so it is best effort on serverless. For strict limits, use Upstash Redis or Vercel KV.
- Free-tier Gemini quotas are small. The advice button is manual (not automatic) to protect your quota.
- Model names change over time. If you see AI errors, check https://ai.google.dev/gemini-api/docs/models and update `GEMINI_MODEL`.

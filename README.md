# Liffy
Bot-icon landing page + RAG chatbot. Knowledge base in `kb.json`; unanswered questions fall back to Gemini general knowledge. Visitor city/country are counted (aggregates only) via Vercel geo headers.

## Setup
1. Get a free key at https://aistudio.google.com/apikey
2. `cp .env.example .env.local` and fill `GEMINI_API_KEY`
3. `npm install && npm run embed` (creates `embeddings.json`; commit it)
4. Push to GitHub, import the repo in Vercel
5. Vercel > Storage: connect Upstash Redis (free plan)
6. Vercel > Settings > Environment Variables: add GEMINI_API_KEY, STATS_KEY (optionally GEMINI_CHAT_MODEL, MATCH_THRESHOLD), then redeploy
7. Stats: https://YOUR-APP.vercel.app/api/stats?key=STATS_KEY

Never commit `.env*` files. Without `embeddings.json` the app uses keyword matching instead of embeddings.

## Rate limiting
Per visitor (hashed IP): 8/min and 60/day. Globally: 300 LLM fallback calls/day, so bots cannot burn your Gemini quota. Inputs are capped (500 chars, 6 history turns) and cross-origin requests are rejected. Tune with the RL_* variables. Needs Upstash Redis connected; without it limiting is skipped. For an extra edge layer, add a rate-limit rule for /api/chat in Vercel > Firewall.

## Bot protection (Cloudflare Turnstile)
1. Cloudflare dashboard > Turnstile > Add widget (Managed mode, add your Vercel domain). Copy the site key and secret key.
2. Put the SITE key in `index.html` (`SITEKEY`). Set `TURNSTILE_SECRET` and `SESSION_SECRET` in Vercel environment variables, then redeploy.
3. Visitors pass the check once (usually invisible) and get a 1-hour signed cookie. /api/chat rejects requests without it.
Test keys for development: site `1x00000000000000000AA`, secret `1x0000000000000000000000000000000AA`.

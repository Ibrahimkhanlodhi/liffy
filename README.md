# 🤖 Liffy

> A tiny bot with a big brain-ish. One friendly icon, zero clutter, and answers to pretty much anything.

Open the page and you'll find a bouncy little robot floating in a cartoon sky. Tap it, ask a question, and Liffy answers. That's the whole interface. The cleverness is all behind the curtain.

---

## 🧠 So what *is* Liffy, exactly?

Liffy is a **RAG chatbot**. RAG means *Retrieval-Augmented Generation*, which is a fancy way of saying:

> "Look it up in my notebook first. If it's not there, think about it."

1. **The notebook** is `kb.json`: 120 hand-written question-and-answer pairs about science, space, the human body, geography, history, math, computers, the internet, security and AI (plus a little small talk).
2. **Retrieval:** when you ask something, Liffy turns your question into an *embedding* (a list of numbers that captures its meaning) and finds the closest question in the notebook. "Who found penicillin?" will match "Who discovered penicillin?" even though the words differ.
3. **Confident match?** Liffy replies with the notebook's answer. It's fast, free and consistent. The chat tags it **Source: knowledge base**.
4. **No good match?** Liffy asks a free AI model (general knowledge) and tags the reply **Source: general knowledge**. So it can answer questions the notebook never imagined.

```
 you ──► exact match? ──yes──► notebook answer
            │ no
            ▼
   embed question ──► close enough? ──yes──► notebook answer
                           │ no
                           ▼
          Groq ► OpenRouter ► Gemini  (first one that answers)
```

Liffy is **not** one giant AI. It's a small, honest notebook with a clever assistant on call.

---

## ✨ What's inside

| Power | How |
|---|---|
| 📚 Knowledge base | `kb.json`, matched with Gemini embeddings |
| 🌍 Any-question mode | Free LLMs: Groq (default `openai/gpt-oss-120b`), then OpenRouter, then Gemini |
| 🛟 Never-break fallbacks | If embeddings fail, keyword matching steps in. If one model fails, the next tries |
| 🎨 Cartoon landing page | Drifting clouds, bubbles, swaying hills, a night mode, and a wiggling bot |
| 📱 Mobile friendly | Full-screen chat on phones, keyboard-aware, notch-safe |
| 🌆 Visitor stats | Counts which **countries and cities** use it (aggregates only, no IPs, no questions) |
| 🚦 Rate limiting | 8 messages/minute and 60/day per visitor, plus a daily cap on LLM calls |
| 🛡️ Bot check | Cloudflare Turnstile, usually invisible |

---

## 🗂️ The map

```
liffy/
├─ index.html        the page: sky, bot icon, chat
├─ kb.json           the notebook (questions + answers)
├─ embeddings.json   the notebook's meaning-numbers (made by `npm run embed`)
├─ vercel.json       tells Vercel to ship the two files above
├─ api/
│  ├─ chat.js        the brain: match, fall back, rate-limit, count visitors
│  ├─ verify.js      checks the Turnstile bot test, hands out a 1-hour pass
│  └─ stats.js       your private stats page
├─ lib/
│  ├─ gemini.js      embeddings + Gemini chat
│  ├─ llm.js         the free-model relay race
│  ├─ session.js     signs/verifies the 1-hour pass cookie
│  └─ env.js         reads env vars safely (ignores stray comments and spaces)
└─ scripts/embed.js  builds embeddings.json
```

---

## 🚀 Setup

You'll need Node 20+, Git, and free accounts at Google AI Studio, Groq, GitHub, Vercel and Cloudflare.

**1. Install**
```bash
npm install
```

**2. Keys**: copy `.env.example` to `.env.local` and fill in the values. Put *only* the value after `=`: no quotes, no spaces, no comments.
- `GEMINI_API_KEY` from https://aistudio.google.com/apikey
- `GROQ_API_KEY` from https://console.groq.com/keys

**3. Teach Liffy to "read" its notebook**
```bash
npm run embed
```
Safe to re-run. It saves progress and skips finished entries. Hit a rate limit? Wait a bit and run it again.

**4. Push to GitHub** (never commit `.env.local`, since `.gitignore` already blocks it)
```bash
git init && git add . && git commit -m "Liffy"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/liffy.git
git push -u origin main
```

**5. Deploy on Vercel**: import the repo, leave the framework as "Other", deploy.

**6. Plug in the extras**
- Vercel → **Storage** → connect **Upstash Redis** (free). It powers rate limits and visitor stats.
- Cloudflare → **Turnstile** → add a Managed widget for your Vercel domain. Put the **site key** in `index.html` (`SITEKEY`) and the **secret key** in Vercel as `TURNSTILE_SECRET`.
- Vercel → **Settings → Environment Variables**: add `GEMINI_API_KEY`, `GROQ_API_KEY`, `STATS_KEY`, `TURNSTILE_SECRET`, `SESSION_SECRET` (any long random strings for the last two: `openssl rand -hex 32`).
- **Redeploy.** New variables only apply to new deployments.

**7. Peek at the stats**
`https://YOUR-APP.vercel.app/api/stats?key=YOUR_STATS_KEY`

---

## 📖 Teaching Liffy new things

Add pairs to the **end** of `kb.json`:
```json
["What is the capital of Japan?", "The capital of Japan is Tokyo."]
```
Then:
```bash
npm run embed
git add kb.json embeddings.json && git commit -m "More knowledge" && git push
```
Short, specific answers match best. If `kb.json` and `embeddings.json` ever get out of sync, Liffy safely falls back to keyword matching until you re-embed.

---

## 🔧 When Liffy gets grumpy

Open Vercel → your project → **Logs** and ask Liffy something. The log line tells you what's wrong.

| You see | Likely cause | Fix |
|---|---|---|
| `groq ... 401` | Wrong or comment-polluted key | Re-paste the key alone, redeploy |
| `model_not_found` | Groq retired the model | Set `GROQ_MODEL` to one from `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"` |
| `gemini generate 404` | Bad `GEMINI_CHAT_MODEL` | Delete the variable (default is `gemini-flash-latest`) |
| `ENOENT ... kb.json` | Data files weren't bundled | Make sure `vercel.json` is committed |
| `429` while embedding | Free-tier quota | Wait, or enable billing, then re-run `npm run embed` |
| "Quick security check" loop | Turnstile key/domain mismatch | Check the site key and hostname |
| Everything says "unavailable" | No working LLM key | Check the logs for the provider error |

---

## 🔒 Privacy and good manners

- Liffy only stores **counts** (per country, per city). No IP addresses, no question text.
- IPs are hashed (with `RL_SALT`) just for rate limiting.
- Free AI tiers may log prompts, so don't ask Liffy for secrets. Add a short privacy note on your page, especially if visitors are in the EU.
- Never paste real keys into chats, screenshots or Git. If you do, revoke and replace them immediately.

---

## 🎛️ Tuning knobs (all optional)

`MATCH_THRESHOLD` (default 0.78, lower = matches more loosely) · `RL_PER_MIN` · `RL_PER_DAY` · `RL_LLM_GLOBAL_PER_DAY` · `LLM_ORDER` · `GROQ_MODEL` · `OPENROUTER_API_KEY` · `OPENROUTER_MODEL`

---

Made with curiosity, free tiers and an unreasonable number of clouds. ☁️

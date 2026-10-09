import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { embed, generate } from "../lib/gemini.js";
import { valid } from "../lib/session.js";

const load = f => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const KB = load("kb.json");
let VECS = null;
try { VECS = load("embeddings.json"); } catch {}
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// ---- rate limiting (per hashed IP + global cap on paid/quota-limited LLM calls) ----
const N = (k, d) => Number(process.env[k] || d);
const limiters = redis && {
  minute: new Ratelimit({ redis, prefix: "rl:min", limiter: Ratelimit.slidingWindow(N("RL_PER_MIN", 8), "1 m") }),
  day: new Ratelimit({ redis, prefix: "rl:day", limiter: Ratelimit.slidingWindow(N("RL_PER_DAY", 60), "1 d") }),
  llm: new Ratelimit({ redis, prefix: "rl:llm", limiter: Ratelimit.fixedWindow(N("RL_LLM_GLOBAL_PER_DAY", 300), "1 d") })
};
const clientId = req => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.headers["x-real-ip"] || "unknown";
  return createHash("sha256").update(ip + (process.env.RL_SALT || "")).digest("hex").slice(0, 32); // raw IP never stored
};
const tooMany = (res, reset, msg) => {
  res.setHeader("Retry-After", Math.max(1, Math.ceil((reset - Date.now()) / 1000)));
  return res.status(429).json({ answer: msg });
};

const words = t => (t.toLowerCase().match(/[a-z0-9]+/g) || []);
function keywordMatch(msg) { // fallback if embeddings are unavailable
  const q = words(msg).filter(w => w.length > 2); if (!q.length) return null;
  let best = null, bs = 0;
  for (const [i, [question]] of KB.entries()) {
    const set = new Set(words(question));
    const s = q.filter(w => set.has(w)).length / q.length;
    if (s > bs) { bs = s; best = i; }
  }
  return bs >= 0.6 ? best : null;
}
async function vectorMatch(msg) {
  const qv = await embed(msg, "RETRIEVAL_QUERY");
  let best = -1, bs = 0;
  VECS.forEach((v, i) => { const s = v.reduce((a, x, k) => a + x * qv[k], 0); if (s > bs) { bs = s; best = i; } });
  return bs >= Number(process.env.MATCH_THRESHOLD || 0.78) ? best : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  // same-origin only (blocks casual cross-site abuse; curl can still spoof, hence the limits below)
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).end();

  // bot check: require a Turnstile-verified session (skipped if TURNSTILE_SECRET is not set, e.g. local dev)
  if (process.env.TURNSTILE_SECRET && !valid(req.headers.cookie))
    return res.status(401).json({ needVerify: true, answer: "Please complete the quick security check." });

  // validate and cap input size
  let { message, history } = req.body || {};
  if (typeof message !== "string" || !message.trim()) return res.status(400).json({ answer: "Please type a question." });
  message = message.trim().slice(0, 500);
  history = (Array.isArray(history) ? history : []).slice(-6)
    .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));

  if (limiters) {
    try {
      const id = clientId(req);
      const [a, b] = await Promise.all([limiters.minute.limit(id), limiters.day.limit(id)]);
      if (!a.success) return tooMany(res, a.reset, "You're sending messages too fast. Please wait a moment.");
      if (!b.success) return tooMany(res, b.reset, "Daily limit reached. Please come back tomorrow.");
    } catch {} // if Redis is down, fail open rather than break the chat
  }
  const country = req.headers["x-vercel-ip-country"] || "Unknown";
  const city = decodeURIComponent(req.headers["x-vercel-ip-city"] || "Unknown");

  let idx = null;
  try { idx = VECS ? await vectorMatch(message) : keywordMatch(message); }
  catch { idx = keywordMatch(message); }

  let answer, source;
  if (idx !== null) { answer = KB[idx][1]; source = "knowledge base"; }
  else {
    source = "general knowledge";
    try {
      if (limiters) { const g = await limiters.llm.limit("global"); if (!g.success) return tooMany(res, g.reset, "I can only answer from my knowledge base right now. Try a science or tech question."); } answer = await generate(history, message) || "I'm not sure about that."; }
    catch { answer = "I couldn't find that in my knowledge base, and general knowledge is unavailable right now."; }
  }
  try { // aggregate counters only: no IP, no question text
    if (redis) await Promise.all([
      redis.hincrby("stats:countries", country, 1),
      redis.hincrby("stats:cities", `${city}, ${country}`, 1),
      redis.hincrby("stats:source", source, 1)
    ]);
  } catch {}
  res.json({ answer, source });
}

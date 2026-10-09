// General-knowledge answers from free providers, tried in order until one works.
// Default order: Groq -> OpenRouter -> Gemini (only providers whose API key is set are used).
import { generate as gemini } from "./gemini.js";

const SYSTEM = "You are Liffy, a friendly assistant. Answer any question from general knowledge, concisely (max 4 sentences). Say so if you are unsure, and politely decline harmful requests.";

async function openaiCompat(url, key, model, history, message) {
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 400, temperature: 0.5,
      messages: [{ role: "system", content: SYSTEM }, ...history, { role: "user", content: message }]
    })
  });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return (await r.json()).choices?.[0]?.message?.content || "";
}

const providers = {
  groq: (h, m) => openaiCompat("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY,
    process.env.GROQ_MODEL || "llama-3.3-70b-versatile", h, m),
  openrouter: (h, m) => openaiCompat("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY,
    process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free", h, m),
  gemini
};
const keyVar = { groq: "GROQ_API_KEY", openrouter: "OPENROUTER_API_KEY", gemini: "GEMINI_API_KEY" };

export async function generate(history, message) {
  const order = (process.env.LLM_ORDER || "groq,openrouter,gemini").split(",").map(s => s.trim())
    .filter(p => providers[p] && process.env[keyVar[p]]);
  for (const p of order) {
    try { const text = await providers[p](history, message); if (text) return text; } catch {}
  }
  throw new Error("no provider available");
}

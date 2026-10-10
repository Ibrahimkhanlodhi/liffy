import { env } from "./env.js";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const headers = () => ({ "x-goog-api-key": env("GEMINI_API_KEY"), "content-type": "application/json" });
const norm = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };

export async function embed(text, taskType = "RETRIEVAL_QUERY") {
  const r = await fetch(BASE + "gemini-embedding-001:embedContent", {
    method: "POST", headers: headers(),
    body: JSON.stringify({ content: { parts: [{ text }] }, taskType, outputDimensionality: 768 })
  });
  if (!r.ok) throw new Error("embed " + r.status);
  return norm((await r.json()).embedding.values);
}

export async function generate(history, message) {
  const model = env("GEMINI_CHAT_MODEL", "gemini-flash-latest");
  const contents = [...history, { role: "user", content: message }].map(m => ({
    role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }]
  }));
  const r = await fetch(`${BASE}${model}:generateContent`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are Liffy, a friendly assistant. Answer from general knowledge, concisely (max 4 sentences). Say so if unsure." }] },
      contents
    })
  });
  if (!r.ok) throw new Error("generate " + r.status);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
}

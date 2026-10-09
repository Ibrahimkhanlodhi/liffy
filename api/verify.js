import { sign } from "../lib/session.js";

// Receives a Cloudflare Turnstile token, checks it with Cloudflare, then sets a 1-hour signed session cookie.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.TURNSTILE_SECRET || !process.env.SESSION_SECRET) return res.status(500).json({ ok: false });
  const { token } = req.body || {};
  if (typeof token !== "string" || !token) return res.status(400).json({ ok: false });

  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (ip) body.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const d = await r.json();
    if (!d.success) return res.status(403).json({ ok: false });
  } catch { return res.status(502).json({ ok: false }); }

  res.setHeader("Set-Cookie", `liffy_s=${sign(3600)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`);
  res.json({ ok: true });
}

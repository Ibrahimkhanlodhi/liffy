import { createHmac, timingSafeEqual } from "node:crypto";
const mac = p => createHmac("sha256", process.env.SESSION_SECRET || "").update(p).digest("hex");

export function sign(ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${mac(String(exp))}`;
}
export function valid(cookieHeader) {
  const m = /(?:^|;\s*)liffy_s=([^;]+)/.exec(cookieHeader || "");
  if (!m || !process.env.SESSION_SECRET) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(sig), b = Buffer.from(mac(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

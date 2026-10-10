export const env = (name, fallback = "") =>
  (process.env[name] ?? "")
    .split("#")[0]
    .trim()
    .replace(/^["']|["']$/g, "") || fallback;

// Run: npm run embed  (safe to re-run; progress is saved and finished entries are skipped)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { embed } from "../lib/gemini.js";

const kb = JSON.parse(readFileSync("kb.json", "utf8"));
const CACHE = ".embed-cache.json";
const key = t => createHash("sha1").update(t).digest("hex");
const text = ([q, a]) => `${q}\n${a}`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// First run after adding entries: reuse an existing embeddings.json (new entries were appended to the end)
if (!existsSync(CACHE) && existsSync("embeddings.json")) {
  JSON.parse(readFileSync("embeddings.json", "utf8")).forEach((v, i) => { if (v && kb[i]) cache[key(text(kb[i]))] = v; });
}

let done = 0;
for (const item of kb) {
  const k = key(text(item));
  if (!cache[k]) {
    try {
      cache[k] = await embed(text(item), "RETRIEVAL_DOCUMENT");
      writeFileSync(CACHE, JSON.stringify(cache));
      await new Promise(r => setTimeout(r, 1500)); // stay under free-tier rate limits
    } catch (e) {
      console.log(`Stopped at ${done}/${kb.length}: ${e.message}. Wait a while (or enable billing) and run again; progress is saved.`);
      process.exit(1);
    }
  }
  done++; console.log(`ready ${done}/${kb.length}`);
}
writeFileSync("embeddings.json", JSON.stringify(kb.map(item => cache[key(text(item))])));
console.log("Done: embeddings.json written. Commit it.");

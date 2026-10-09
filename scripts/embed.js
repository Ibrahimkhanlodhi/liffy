// Run once (and whenever kb.json changes): npm run embed
import { readFileSync, writeFileSync } from "node:fs";
import { embed } from "../lib/gemini.js";
const kb = JSON.parse(readFileSync("kb.json", "utf8"));
const out = [];
for (const [i, [q, a]] of kb.entries()) {
  out.push(await embed(`${q}\n${a}`, "RETRIEVAL_DOCUMENT"));
  console.log(`embedded ${i + 1}/${kb.length}`);
  await new Promise(r => setTimeout(r, 1500)); // stay under free-tier rate limits
}
writeFileSync("embeddings.json", JSON.stringify(out));

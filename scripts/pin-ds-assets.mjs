// Retain immutable asset bytes so a new deployment cannot repaint signed history.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "public/ds";
const integrity = JSON.parse(readFileSync(`${dir}/integrity.json`, "utf8"));
const runtime = JSON.parse(readFileSync("public/runtime/frame.json", "utf8"));
const id = createHash("sha256").update(JSON.stringify({ integrity, runtime })).digest("hex");
const base = `/ds/versions/${id}`;
mkdirSync(`public${base}`, { recursive: true });
for (const [name, expected] of Object.entries(integrity)) {
  const bytes = readFileSync(`${dir}/${name}`);
  if (`sha384-${createHash("sha384").update(bytes).digest("base64")}` !== expected) throw new Error(`stale integrity: ${name}`);
  writeFileSync(`public${base}/${name}`, bytes);
}
writeFileSync(`public${base}/integrity.json`, JSON.stringify(integrity, null, 2) + "\n");
writeFileSync(`${dir}/assets.json`, JSON.stringify({ base, integrity, runtime }, null, 2) + "\n");

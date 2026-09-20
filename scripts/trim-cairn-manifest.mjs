// Keeps the Cairn manifest small: the assistant only lives inside the dashboard, and free LLM tiers
// cap tokens per minute. Runs after `cairn build` (see the prebuild script in package.json).
import fs from "node:fs";

const file = new URL("../.cairn/ui-manifest.json", import.meta.url);
if (!fs.existsSync(file)) process.exit(0);
const m = JSON.parse(fs.readFileSync(file, "utf8"));
const before = fs.statSync(file).size;
m.pages = m.pages
  .filter((p) => p.route.startsWith("/dashboard"))
  .map(({ inAppCopy, dataShapes, ...p }) => ({
    ...p,
    // Drop generated ids the model could not describe ("a-258", low confidence): they only say "purpose unknown".
    elements: (p.elements ?? []).filter((e) => !(/^[a-z]+-\d+$/.test(e.id) && e.confidence < 0.5)),
  }));
m.dead = [];
fs.writeFileSync(file, JSON.stringify(m));
console.log(`cairn manifest trimmed: ${before} -> ${fs.statSync(file).size} bytes, ${m.pages.length} dashboard pages`);

// Generates the Open Peeps avatars used on the landing page into public/peeps/*.svg.
// Run with:  npm run peeps
// Art: Open Peeps by Pablo Stanley (CC0 1.0). Rendered with DiceBear (MIT). Output is committed,
// so the site needs neither package at runtime.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { PEEP_OPTIONS, BACKGROUNDS, POOLS, SKIP } from "./peeps-config.mjs";

const require = createRequire(import.meta.url);
const { createAvatar } = await import(require.resolve("@dicebear/core"));
const openPeeps = await import(require.resolve("@dicebear/open-peeps"));

// seed -> file name (lowercase seed)
const CAST = ["Priya", "Rahul", "Amit", "Sneha", "Mia", "Noah", "Zoe", "Maya", "Ella", "Asha", "Vikas", "Finn", "Tess", "Cy", "Wes", "Rosa", "Dev", "Ivy", "Hana", "Neha", "Jon", "Ada", "Lars", "Aria"];

const out = path.join(process.cwd(), "public", "peeps");
fs.mkdirSync(out, { recursive: true });
CAST.forEach((seed, i) => {
  const svg = createAvatar(openPeeps, { seed, backgroundColor: [BACKGROUNDS[i % BACKGROUNDS.length]], ...PEEP_OPTIONS }).toString();
  fs.writeFileSync(path.join(out, `${seed.toLowerCase()}.svg`), svg);
});
console.log(`wrote ${CAST.length} named avatars to public/peeps`);

// Gender pools: f-1.., m-1.., n-1.. (numbered without gaps). app/lib/avatars.ts picks from these.
const sizes = {};
for (const [k, pool] of Object.entries(POOLS)) {
  let n = 0;
  for (let i = 1; i <= pool.count; i++) {
    if (SKIP[k].includes(i)) continue;
    n++;
    const svg = createAvatar(openPeeps, { seed: `${k}-${i}`, backgroundColor: [BACKGROUNDS[i % BACKGROUNDS.length]], ...pool.options }).toString();
    fs.writeFileSync(path.join(out, `${k}-${n}.svg`), svg);
  }
  sizes[k] = n;
}
console.log("pool sizes (keep app/lib/avatars.ts in sync):", JSON.stringify(sizes));

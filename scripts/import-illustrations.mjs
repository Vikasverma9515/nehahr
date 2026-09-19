// Optimises the Open Peeps character illustrations (openpeeps.com, CC0 1.0, by Pablo Stanley)
// into public/peeps/illus/. Point it at a folder of downloaded peep-*.svg files:
//   node scripts/import-illustrations.mjs /path/to/peeps-src
import fs from "node:fs";
import path from "node:path";
import { optimize } from "svgo";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/import-illustrations.mjs <folder with peep-*.svg>");
const out = path.join(process.cwd(), "public", "peeps", "illus");
fs.mkdirSync(out, { recursive: true });

let before = 0, after = 0, n = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".svg"))) {
  // peep-standing-4.svg -> standing-4.svg | peep-sitting-2.svg -> sitting-2.svg | peep-46.svg -> bust-46.svg
  const name = f.replace(/^peep-/, "").replace(/^(\d)/, "bust-$1");
  const raw = fs.readFileSync(path.join(src, f), "utf8");
  const res = optimize(raw, {
    multipass: true,
    floatPrecision: 1,
    plugins: ["preset-default", "removeDimensions"],
  });
  fs.writeFileSync(path.join(out, name), res.data);
  before += raw.length; after += res.data.length; n++;
}
console.log(`${n} illustrations: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);

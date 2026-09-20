// Keeps the Cairn manifest small: the assistant only lives inside the dashboard, and free LLM tiers
// cap tokens per minute. Runs after `cairn build` (see the prebuild script in package.json).
import fs from "node:fs";
import { generateSkillsMarkdown, manifestToSkills } from "@cairnvibe/core";

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
// Feature and workflow skills for the signed-in app only; the public landing, login and feedback pages are not the assistant's job.
m.skills = (m.skills ?? []).filter((k) => k.id.startsWith("feature-dashboard") || k.id.startsWith("workflow-"));
fs.writeFileSync(file, JSON.stringify(m));
// The agent's skills are derived from this trimmed manifest, so write the readable copy from it too.
fs.writeFileSync(new URL("../.cairn/SKILLS.md", import.meta.url), generateSkillsMarkdown(manifestToSkills(m)));
console.log(`cairn manifest trimmed: ${before} -> ${fs.statSync(file).size} bytes, ${m.pages.length} dashboard pages`);

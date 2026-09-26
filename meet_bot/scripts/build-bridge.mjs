// Bundle the in-page bridge (with livekit-client) into one script that
// Playwright injects before Google Meet's own code runs.
import { build } from "esbuild";

await build({
  entryPoints: ["src/bridge/bridge.ts"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outfile: "dist/bridge.js",
  minify: true,
  logLevel: "warning",
});
console.log("built dist/bridge.js");

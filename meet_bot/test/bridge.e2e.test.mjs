// End-to-end test of the media bridge against a real LiveKit server.
//
//   livekit-server --dev --bind 127.0.0.1 --node-ip 127.0.0.1
//   LIVEKIT_URL=ws://127.0.0.1:7880 npm test
//
// Skipped when LIVEKIT_URL isn't set. Checks that:
//   - Meet sees Neha's fake camera + microphone devices,
//   - Neha's voice (440 Hz from the peer) comes out of the "microphone" Meet gets,
//   - the canvas camera produces 1280x720 frames,
//   - meeting audio (880 Hz over RTCPeerConnection) reaches the LiveKit room.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";

const URL_ = process.env.LIVEKIT_URL;
const KEY = process.env.LIVEKIT_API_KEY || "devkey";
const SECRET = process.env.LIVEKIT_API_SECRET || "secret";

function token(identity, room, attributes = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = b64({
    iss: KEY, sub: identity, nbf: now - 10, exp: now + 600, attributes,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
  });
  const head = b64({ alg: "HS256", typ: "JWT" });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

async function bundle(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", write: false, target: "chrome120" });
  return out.outputFiles[0].text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("bridge carries audio both ways and serves a camera", { skip: !URL_, timeout: 90_000 }, async () => {
  const room = `bridge-test-${Date.now()}`;
  const peerJs = await bundle("test/peer.ts");
  const meetingJs = await bundle("test/meeting.ts");
  const server = createServer((req, res) => {
    const js = req.url.startsWith("/peer.js") ? peerJs : req.url.startsWith("/meeting.js") ? meetingJs : null;
    if (js) {
      res.writeHead(200, { "Content-Type": "text/javascript" }).end(js);
    } else {
      const src = req.url.startsWith("/peer") ? "/peer.js" : "/meeting.js";
      res.writeHead(200, { "Content-Type": "text/html" }).end(`<!doctype html><script type="module" src="${src}"></script>`);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
  });
  try {
    const peer = await browser.newPage();
    peer.on("console", (m) => console.log("peer:", m.text()));
    peer.on("pageerror", (e) => console.error("peer page error:", e));
    await peer.goto(`${base}/peer#url=${encodeURIComponent(URL_)}&token=${token("agent-neha", room)}`);
    await peer.waitForFunction(() => window.peerResult?.connected, null, { timeout: 20_000 });

    const ctx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await ctx.addInitScript({
      content: `window.__NEHA_CONFIG = ${JSON.stringify({ livekitUrl: URL_, token: token("meet-bridge", room), botName: "Neha" })};`,
    });
    await ctx.addInitScript({ content: readFileSync("dist/bridge.js", "utf8") });
    const meeting = await ctx.newPage();
    meeting.on("pageerror", (e) => console.error("meeting page error:", e));
    await meeting.goto(`${base}/meeting`);

    await meeting.waitForFunction(() => window.__nehaBridge?.status().livekit === "connected", null, { timeout: 20_000 });
    await sleep(6000);

    const bridge = await meeting.evaluate(() => window.__nehaBridge.status());
    const meet = await meeting.evaluate(() => window.meetingResult);
    const heard = await peer.evaluate(() => window.peerResult);
    console.log({ bridge, meet, heard });

    assert.ok(meet.devices.some((d) => d.startsWith("audioinput:Neha")), "fake mic listed");
    assert.ok(meet.devices.some((d) => d.startsWith("videoinput:Neha")), "fake camera listed");
    assert.equal(meet.videoWidth, 1280, "canvas camera is 1280 wide");
    assert.ok(meet.videoFrames > 20, "camera keeps producing frames");
    assert.ok(bridge.agentAudioTracks >= 1, "bridge subscribed to Neha's audio");
    assert.ok(Math.abs(meet.micHz - 440) < 20, `Meet's mic carries Neha's 440 Hz voice (got ${meet.micHz})`);
    assert.equal(bridge.meetAudioTracks, 1, "bridge captured the meeting's audio, and not LiveKit's own");
    assert.ok(Math.abs(heard.heardHz - 880) < 20, `LiveKit room hears the meeting's 880 Hz (got ${heard.heardHz})`);
  } finally {
    await browser.close();
    server.close();
  }
});

import { chromium, type Browser, type Page } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MEET } from "./selectors.js";

export type BotJob = {
  id: string;
  callId: string;
  meetUrl: string;
  livekitUrl: string;
  token: string;
  botName: string;
  maxMinutes: number;
  lobbyMinutes: number;
};

export type BotEvent =
  | "launching"
  | "waiting_in_lobby"
  | "in_call"
  | "left"
  | "denied"
  | "failed";

export type Reporter = (event: BotEvent, detail?: string) => Promise<void>;

const here = dirname(fileURLToPath(import.meta.url));
const BRIDGE = readFileSync(join(here, "bridge.js"), "utf8");

const CHROME_ARGS = [
  "--use-fake-ui-for-media-stream",          // auto-accept camera / mic prompts
  "--autoplay-policy=no-user-gesture-required",
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--window-size=1280,800",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MeetBot {
  private browser?: Browser;
  private page?: Page;
  private stopping = false;

  constructor(private job: BotJob, private report: Reporter) {}

  async run(): Promise<void> {
    const job = this.job;
    try {
      await this.report("launching");
      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        args: CHROME_ARGS,
        executablePath: process.env.CHROME_PATH || undefined,
      });
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
        permissions: ["microphone", "camera"],
        userAgent:
          process.env.BOT_USER_AGENT ||
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        // A signed-in Google profile (Playwright storage state) avoids the guest lobby.
        storageState: process.env.BOT_STORAGE_STATE || undefined,
      });
      await context.addInitScript({
        content: `window.__NEHA_CONFIG = ${JSON.stringify({
          livekitUrl: job.livekitUrl,
          token: job.token,
          botName: job.botName,
        })};`,
      });
      await context.addInitScript({ content: BRIDGE });

      const page = (this.page = await context.newPage());
      const url = new URL(job.meetUrl);
      url.searchParams.set("hl", "en");
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });

      await this.waitForBridge();
      const admitted = await this.join();
      if (!admitted) return;

      await this.report("in_call");
      await this.enableCaptions();
      await this.watch();
    } catch (e) {
      await this.report("failed", e instanceof Error ? e.message : String(e));
    } finally {
      await this.cleanup();
    }
  }

  /** Leave on request (API DELETE or shutdown). */
  async stop(): Promise<void> {
    this.stopping = true;
  }

  private async waitForBridge() {
    const page = this.page!;
    for (let i = 0; i < 40; i++) {
      const s = await page.evaluate(() => window.__nehaBridge?.status()).catch(() => undefined);
      if (s?.livekit === "connected") return;
      if (s?.livekit === "failed") throw new Error(`LiveKit connect failed: ${s.livekitError}`);
      await sleep(500);
    }
    throw new Error("Media bridge did not connect to LiveKit within 20s");
  }

  private async clickByName(patterns: readonly RegExp[]): Promise<boolean> {
    const page = this.page!;
    for (const name of patterns) {
      const btn = page.getByRole("button", { name }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => undefined);
        return true;
      }
    }
    return false;
  }

  private async anyText(patterns: readonly RegExp[]): Promise<string | null> {
    const page = this.page!;
    for (const p of patterns) {
      if (await page.getByText(p).first().isVisible().catch(() => false)) return p.source;
    }
    return null;
  }

  private async inCall(): Promise<boolean> {
    const page = this.page!;
    for (const sel of MEET.inCall) {
      if (await page.locator(sel).first().isVisible().catch(() => false)) return true;
    }
    return false;
  }

  private async join(): Promise<boolean> {
    const page = this.page!;
    const job = this.job;
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await this.clickByName(MEET.dismissButtons);

    for (const sel of MEET.nameInput) {
      const input = page.locator(sel).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(job.botName);
        break;
      }
    }
    // Make sure Meet uses our fake camera and microphone.
    for (const sel of [MEET.turnOnMic, MEET.turnOnCam]) {
      const b = page.locator(sel).first();
      if (await b.isVisible().catch(() => false)) await b.click().catch(() => undefined);
    }

    if (!(await this.clickByName(MEET.joinButtons))) {
      throw new Error("Could not find Meet's join button (UI changed or the link is wrong)");
    }
    await this.report("waiting_in_lobby");

    const deadline = Date.now() + job.lobbyMinutes * 60_000;
    while (Date.now() < deadline && !this.stopping) {
      if (await this.inCall()) return true;
      const denied = await this.anyText(MEET.deniedText);
      if (denied) {
        await this.report("denied", denied);
        return false;
      }
      await sleep(2000);
    }
    await this.report("denied", "Nobody admitted the bot from the lobby");
    return false;
  }

  private async enableCaptions() {
    const page = this.page!;
    const btn = page.locator(MEET.captionsOn).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }

  private async watch() {
    const page = this.page!;
    const job = this.job;
    const end = Date.now() + job.maxMinutes * 60_000;
    let aloneSince: number | null = null;
    let lastCaption = "";

    while (!this.stopping && Date.now() < end) {
      await sleep(3000);
      if (!(await this.inCall())) {
        await this.report("left", (await this.anyText(MEET.deniedText)) || "Left the call");
        return;
      }
      const status = await page.evaluate(() => window.__nehaBridge?.status()).catch(() => undefined);
      if (status?.roomEnded) {
        // The agent finished and closed its room: time to go.
        await this.leave("Neha ended the session");
        return;
      }
      if (await this.anyText(MEET.aloneText)) {
        aloneSince ??= Date.now();
        if (Date.now() - aloneSince > 2 * 60_000) {
          await this.leave("Alone in the meeting for 2 minutes");
          return;
        }
      } else {
        aloneSince = null;
      }
      lastCaption = await this.forwardCaptions(lastCaption);
    }
    await this.leave(this.stopping ? "Stopped" : "Reached the time limit");
  }

  /** Forward the newest caption line (with the speaker's name) to the agent. */
  private async forwardCaptions(last: string): Promise<string> {
    const page = this.page!;
    const text = await page
      .locator(MEET.captionsRegion)
      .first()
      .innerText({ timeout: 500 })
      .catch(() => "");
    const line = text.split("\n").filter(Boolean).slice(-2).join(": ");
    if (line && line !== last) {
      const [speaker, ...rest] = line.split(": ");
      await page
        .evaluate(([s, t]) => window.__nehaBridge?.sendCaption(s, t), [speaker, rest.join(": ")])
        .catch(() => undefined);
    }
    return line || last;
  }

  private async leave(reason: string) {
    const page = this.page!;
    for (const sel of MEET.inCall) {
      const b = page.locator(sel).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click().catch(() => undefined);
        break;
      }
    }
    await this.report("left", reason);
  }

  private async cleanup() {
    await this.page?.evaluate(() => window.__nehaBridge?.leave()).catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
  }
}

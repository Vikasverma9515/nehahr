/**
 * HTTP API for launching Meet bots. The backend calls it; nothing else should.
 *
 *   POST   /bots        { call_id, meet_url, livekit_url, token, bot_name?, max_minutes? }
 *   GET    /bots/:id
 *   DELETE /bots/:id    ask the bot to leave
 *   GET    /health
 *
 * Auth: "Authorization: Bearer $MEET_BOT_SECRET".
 * Events are posted back to $BACKEND_API_URL/api/agent/calls/{call_id}/bot-event.
 */
import express from "express";
import { randomUUID } from "node:crypto";
import { MeetBot, type BotEvent } from "./bot.js";

const PORT = Number(process.env.PORT || 8090);
const SECRET = process.env.MEET_BOT_SECRET || "";
const BACKEND = (process.env.BACKEND_API_URL || "http://localhost:8000").replace(/\/$/, "");
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";
const MAX_BOTS = Number(process.env.MAX_BOTS || 4);

type Entry = { bot: MeetBot; callId: string; events: { event: BotEvent; detail?: string; at: string }[]; done: boolean };
const bots = new Map<string, Entry>();

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, active: [...bots.values()].filter((b) => !b.done).length, max: MAX_BOTS });
});

app.use((req, res, next) => {
  if (!SECRET || req.headers.authorization !== `Bearer ${SECRET}`) {
    res.status(401).json({ detail: "unauthorized" });
    return;
  }
  next();
});

async function postEvent(callId: string, event: BotEvent, detail?: string) {
  try {
    await fetch(`${BACKEND}/api/agent/calls/${callId}/bot-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
      body: JSON.stringify({ event, detail }),
    });
  } catch (e) {
    console.warn(`[bot] could not report ${event} for ${callId}:`, e);
  }
}

app.post("/bots", (req, res) => {
  const b = req.body || {};
  for (const k of ["call_id", "meet_url", "livekit_url", "token"]) {
    if (!b[k]) {
      res.status(400).json({ detail: `${k} is required` });
      return;
    }
  }
  if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(b.meet_url)) {
    res.status(400).json({ detail: "meet_url must be a https://meet.google.com/... link" });
    return;
  }
  const active = [...bots.values()].filter((x) => !x.done).length;
  if (active >= MAX_BOTS) {
    res.status(429).json({ detail: "All bot slots are busy" });
    return;
  }

  const id = randomUUID();
  const entry = { callId: b.call_id, events: [], done: false } as unknown as Entry;
  entry.bot = new MeetBot(
    {
      id,
      callId: b.call_id,
      meetUrl: b.meet_url,
      livekitUrl: b.livekit_url,
      token: b.token,
      botName: b.bot_name || "Neha (AI recruiter)",
      maxMinutes: Math.min(Number(b.max_minutes || 75), 180),
      lobbyMinutes: Math.min(Number(b.lobby_minutes || 10), 30),
    },
    async (event, detail) => {
      entry.events.push({ event, detail, at: new Date().toISOString() });
      console.log(`[bot ${id}] ${event}${detail ? `: ${detail}` : ""}`);
      await postEvent(b.call_id, event, detail);
    },
  );
  bots.set(id, entry);
  void entry.bot.run().finally(() => {
    entry.done = true;
    setTimeout(() => bots.delete(id), 60 * 60_000);
  });
  res.status(202).json({ bot_id: id });
});

app.get("/bots/:id", (req, res) => {
  const e = bots.get(req.params.id);
  if (!e) {
    res.status(404).json({ detail: "not found" });
    return;
  }
  res.json({ bot_id: req.params.id, call_id: e.callId, done: e.done, events: e.events });
});

app.delete("/bots/:id", async (req, res) => {
  const e = bots.get(req.params.id);
  if (!e) {
    res.status(404).json({ detail: "not found" });
    return;
  }
  await e.bot.stop();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`meet bot service on :${PORT} (max ${MAX_BOTS} concurrent)`));

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    await Promise.all([...bots.values()].filter((b) => !b.done).map((b) => b.bot.stop()));
    setTimeout(() => process.exit(0), 5000);
  });
}

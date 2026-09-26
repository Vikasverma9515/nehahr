# Neha Meet bot

Puts Neha into a Google Meet as a real participant, with her voice and (optionally) her Tavus
face, by running Meet in a browser we control and bridging it to the LiveKit room where the
voice agent lives.

```
Google Meet  ◄──►  Chrome (Playwright, Xvfb)  ◄── bridge.js ──►  LiveKit room  ◄──►  Neha agent (+ Tavus)
```

- **Into Meet:** `getUserMedia` is replaced before Meet loads. Meet's "camera" is a canvas showing
  the Tavus video (or a name card until it arrives); its "microphone" carries Neha's voice.
- **Out of Meet:** remote audio from Meet's `RTCPeerConnection`s is mixed and published to the
  LiveKit room as one track, so the agent hears everyone. LiveKit's own tracks are filtered out so
  Neha never hears herself.
- **Who's talking:** Meet captions are turned on and each new line (speaker + text) is sent to the
  agent on the `meet.captions` data topic.
- **Leaving:** when the agent ends its room, when the bot is removed, after 2 minutes alone, or at
  the time limit.

Built from scratch on Playwright (Apache-2.0). The join flow follows the approach of the
open-source [screenapp meeting-bot](https://github.com/screenappai/meeting-bot) (MIT) and
[Vexa](https://github.com/vexa-ai/vexa) (Apache-2.0); neither can speak into a meeting, which is
what the bridge adds.

## API

The backend is the only caller (`MEET_BOT_URL`, `MEET_BOT_SECRET`).

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/bots` | `call_id, meet_url, livekit_url, token, bot_name?, max_minutes?, lobby_minutes?` |
| `GET` | `/bots/:id` | status and event log |
| `DELETE` | `/bots/:id` | leave now |
| `GET` | `/health` | active / max bots |

Events (`launching`, `waiting_in_lobby`, `in_call`, `left`, `denied`, `failed`) are posted to
`$BACKEND_API_URL/api/agent/calls/{call_id}/bot-event` with `X-Internal-Key`.

## Getting admitted

A guest bot waits in Meet's lobby until someone admits it. To skip the lobby, give the bot a
Google Workspace account, add that account to the interview's calendar event (the backend does
this when `MEET_BOT_EMAIL` is set), and pass its signed-in browser state:

```bash
npx playwright codegen --save-storage=bot-state.json https://accounts.google.com
# sign in as the bot account, close the window, then
BOT_STORAGE_STATE=/secrets/bot-state.json
```

## Run

```bash
npm install
npm run build
MEET_BOT_SECRET=... BACKEND_API_URL=http://localhost:8000 INTERNAL_API_KEY=... HEADLESS=false npm start
```

Docker: `docker build -t neha-meet-bot . && docker run -p 8090:8090 --env-file .env neha-meet-bot`.
Each bot is a full Chrome: budget about 1 vCPU and 1.5 GB RAM per concurrent meeting (`MAX_BOTS`).

## Tests

```bash
livekit-server --dev --bind 0.0.0.0     # any LiveKit server
LIVEKIT_URL=ws://127.0.0.1:7880 npm test
```

The end-to-end test runs the real bridge in Chromium against a stand-in meeting page and a
stand-in agent: it checks Meet sees Neha's devices, Neha's voice (440 Hz) reaches Meet's
microphone, the camera produces frames, and the meeting's audio (880 Hz, over a real
`RTCPeerConnection`) reaches the LiveKit room exactly once.

Meet's own UI can't be tested in CI; run a nightly smoke test against a real test meeting
(`POST /bots` with a Meet link you control) and alert on `failed` / `denied` events.

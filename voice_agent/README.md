# Neha voice agent

Real-time voice for Neha on [LiveKit Agents](https://github.com/livekit/agents). One worker handles
every channel:

| Channel | How the candidate connects |
| --- | --- |
| `phone` | The agent dials out through a LiveKit SIP trunk (Twilio Elastic SIP behind it) |
| `playground` | A recruiter talks to Neha from **Dashboard → Playground** |
| `room` | The candidate joins our own interview room at `/interview/<token>` |
| `meet` | The Meet bot (`meet_bot/`) bridges a Google Meet into the room |
| `inbound` | A candidate rings the Neha number (SIP dispatch rule) |

## Pipeline

- **Turn taking:** Silero VAD + LiveKit's end-of-turn model, 0.3–2.5 s endpointing, preemptive
  generation (Neha starts thinking on the interim transcript).
- **Barge-in:** talking over Neha stops her within ~200 ms; coughs and "mm-hm" resume her sentence.
- **STT:** Deepgram Nova-3 `multi` (English + Hindi code-switching), streaming.
- **LLM:** Claude Haiku 4.5, streamed straight into TTS. Anthropic API when `ANTHROPIC_API_KEY`
  is set, otherwise Bedrock with `AWS_BEARER_TOKEN_BEDROCK`.
- **TTS:** Cartesia Sonic 3 (default), ElevenLabs Flash v2.5 or Deepgram Aura 2.
- **Data capture:** tools (`record_candidate_details`, `confirm_slot`, ...) instead of JSON replies.
- **Phone extras:** answering-machine detection with a short voicemail, busy / no-answer
  statuses, warm transfer to `HR_TRANSFER_NUMBER`, callbacks at a time the candidate picks.
- **Face:** Tavus avatar on video channels when `TAVUS_API_KEY` + `TAVUS_FACE_ID` are set.
- **Latency:** every turn's end-of-turn delay, LLM first token and TTS first byte are streamed to
  the playground and saved on the call (`calls.latency_metrics`).

At the end of a call the agent posts the transcript and captured fields to
`POST /api/agent/calls/{id}/complete`; the backend scores, books and moves the candidate
exactly like the old Twilio loop.

## Run it

```bash
cd voice_agent
pip install -e ".[dev]"
python -m neha_agent.main download-files   # model weights, once
python -m neha_agent.main dev              # connects to LIVEKIT_URL and waits for dispatches
```

Then set `VOICE_RUNTIME=livekit` on the backend so phone calls go through the agent, or open the
Playground in the dashboard.

### Environment

| Variable | Needed for |
| --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Everything |
| `BACKEND_API_URL`, `INTERNAL_API_KEY` | Loading call context and saving results |
| `DEEPGRAM_API_KEY` | Speech to text (and Deepgram TTS) |
| `ANTHROPIC_API_KEY` or `AWS_BEARER_TOKEN_BEDROCK` | Claude |
| `TTS_PROVIDER` + `CARTESIA_API_KEY` / `ELEVENLABS_API_KEY` | Voice |
| `TAVUS_API_KEY`, `TAVUS_FACE_ID`, `TAVUS_PAL_ID` | Video face |
| `HR_TRANSFER_NUMBER` | Warm transfer on phone calls |

### Phone setup (once)

1. In Twilio, create an Elastic SIP trunk with a termination URI and a credential list, and
   attach your phone number to it. Set its Origination URI to your LiveKit project's SIP URI.
2. Create the LiveKit side (outbound trunk, inbound trunk, inbound dispatch rule):

   ```bash
   python scripts/setup_sip.py --number +918035551234 \
       --twilio-termination neha.pstn.twilio.com --username neha --password '...'
   ```

3. Put the printed outbound trunk id in the backend's `LIVEKIT_SIP_TRUNK_ID` and set
   `VOICE_RUNTIME=livekit`.

Inbound calls land in an `inbound-*` room with the agent. Neha looks the caller up by number,
answers status questions from their record, and files reschedule / withdraw / question
requests for HR (`candidate_requests`).

## Tests

```bash
pytest -q
```

Tests drive real `AgentSession`s with a scripted LLM (`tests/fake_llm.py`), so they run offline
and check that each call type calls the right tools and records the right data.

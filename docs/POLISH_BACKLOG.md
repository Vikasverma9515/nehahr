# Polish Backlog

Non-blocking improvements to tackle after the main phases. Mostly quality-of-life features for HR and robustness fixes.

---

## Screening Call Polish (Option A from Phase 3 review)

### 1. Auto-recover empty calls
**Problem:** Occasionally a call ends without saving transcript/extracted data (race condition between Twilio status webhook and our cleanup path). Currently requires manual `python scripts/recover_call.py --latest`.

**Fix:** Background worker that runs every 5 minutes:
- Queries for calls with `recording_url IS NOT NULL` AND `transcript IS NULL` AND `created_at > now() - 1 hour`
- Runs the recovery pipeline automatically
- Emails HR if recovery fails

**Files to change:** new `backend/app/workers/call_recovery.py`, add to FastAPI lifespan

**Effort:** Small (1-2 hours)

---

### 2. Re-score button on candidate page
**Problem:** If we tune the scoring rubric later (e.g. adjust weights, add new criteria), existing candidates stay with old scores. HR has to manually re-run recovery script.

**Fix:** Button on candidate detail page "Re-score with latest rubric"
- Reads the extracted data from the latest screening call
- Calls `score_candidate()` again
- Updates the candidate row with new score, breakdown, reason
- Clears stale disqualification_reason if now qualified

**Files to change:**
- `app/actions/candidates.ts` — add `rescoreCandidateAction`
- `app/components/stage-actions.tsx` — add `RescoreButton` component
- `backend/app/routers/candidates.py` — add `POST /api/candidates/{id}/rescore` endpoint
- OR do it entirely via Supabase from the server action (no backend round-trip needed)

**Effort:** Small (1 hour)

---

### 3. Timeline view on candidate page
**Problem:** HR can see the current state but not the history of what happened and when. Useful for audit trails and understanding why a candidate is where they are.

**Fix:** Add a "Timeline" card to the candidate detail page showing chronological events:
- 2026-04-11 14:23 — Added by HR (new → new)
- 2026-04-11 14:45 — Screening call initiated (new → screening)
- 2026-04-11 14:53 — Screening call completed, scored 78/100 (screening → screened)
- 2026-04-11 15:10 — Shortlisted by HR (screened → shortlisted)
- ...

**Data source:**
- Each call is an event (from calls table)
- Each stage change is an event (need to track stage_history table OR use Supabase logical replication)
- For MVP, just derive from calls + interviews timestamps

**Files to change:**
- new `app/components/candidate-timeline.tsx`
- add to `app/(dashboard)/dashboard/candidates/[id]/page.tsx`

**Effort:** Small-medium (2-3 hours)

---

### 4. Resume dropped calls
**Problem:** If a call drops mid-way (candidate hangs up by mistake, network issue), we start fresh on the next call. Annoying for HR to repeat questions already asked.

**Fix:** Persist conversation state per candidate. On next call:
- Check if there's an in-progress screening for this candidate
- Look at which questions were already answered from extracted_data
- Start the next call from where we left off ("Hi, we got disconnected earlier. I just need to ask a few more questions about...")

**Complexity:** This is non-trivial because:
- Need to track conversation phase in DB (not just extracted fields)
- Need to handle "the candidate changed their mind about CTC" — do we overwrite?
- This is where LangGraph's checkpointing would genuinely help

**Files to change:**
- Schema: add `calls.conversation_state JSONB`
- `backend/app/services/ai_conversation.py` — serialize/restore state
- `backend/app/services/call_handler.py` — check for in-progress call on start

**Effort:** Medium-large (half day) — this is the one case where LangGraph might be worth it

---

### 5. Screening call cost tracker
**Problem:** Each call costs Bedrock tokens + Deepgram STT/TTS minutes. Useful to know the per-call cost for budgeting, especially at scale.

**Fix:** Track usage on each call record:
- `calls.bedrock_input_tokens`
- `calls.bedrock_output_tokens`
- `calls.deepgram_stt_seconds`
- `calls.deepgram_tts_chars`
- `calls.estimated_cost_usd` (computed)

**Display:**
- On call detail page: small cost card
- On analytics page: total cost this month, avg cost per call, cost breakdown by service

**Pricing (as of 2025-2026):**
- Claude Sonnet (Bedrock): ~$3/1M input tokens, ~$15/1M output tokens
- Deepgram Nova-2 STT: ~$0.0043/minute
- Deepgram Aura TTS: ~$0.015/1K characters

**Files to change:**
- Bedrock call wrapper — capture token counts from response
- Deepgram STT — count audio seconds forwarded
- Deepgram TTS — count characters synthesized
- `calls` table — add columns
- Dashboard analytics page — new section

**Effort:** Medium (3-4 hours)

---

## Other Polish Ideas (not yet discussed)

### 6. Toast notifications for actions
Shortlist/Reject/Override buttons just reload the page. Nicer UX: show a toast "Candidate shortlisted" in the top-right, update the badge without full page reload.

### 7. Bulk actions on candidates list
Select multiple candidates, bulk shortlist/reject/delete. Useful when HR processes a batch of applications.

### 8. Export candidate data to CSV
Download a CSV of candidates with all their extracted fields + scores. For reporting to stakeholders.

### 9. Candidate search improvements
Currently searches name/email/phone. Add search by: location, CTC range, notice period, qualification status.

### 10. Call quality dashboard
Per-call metrics: latency to first Neha response, avg turn gap, TTS errors, STT confidence score. Helps debug bad calls.

### 11. Interviewer feedback form (Phase 5 prerequisite)
When an interview is completed, HR needs to input feedback. Right now the interviews table has a `feedback` JSONB column but no UI to populate it.

### 12. Scoring rubric editor in Settings
Let HR adjust scoring weights without editing code. Store weights in `companies.settings` or a dedicated config table.

### 13. Reject reason templates
Pre-written rejection reasons HR can pick from instead of the AI's auto-generated one.

### 14. Call transcript search
Full-text search across all call transcripts. "Show me all candidates who mentioned React" etc.
- Supabase supports pg_trgm for fuzzy search, or full-text indexing via tsvector

### 15. Candidate notes field
Free-form notes HR can add to a candidate, visible across the team.

---

## When to tackle these

Most of these are **after Phase 4 (Scheduling Call)** — that's the next real feature. Come back here when:
- Phase 4 is done and we want to polish
- Specific pain points show up (e.g. dropped calls become common → tackle #4)
- Demo feedback suggests specific gaps (e.g. "where's the timeline?" → tackle #3)

## Priority if we had to pick 3 now

1. **#1 Auto-recover empty calls** — removes manual overhead, no new UX needed
2. **#3 Timeline view** — cheap win, huge UX improvement for HR
3. **#2 Re-score button** — future-proofs the scoring as we tune the rubric

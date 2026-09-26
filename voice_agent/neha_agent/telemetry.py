"""Per-turn latency: how long from the candidate going quiet to Neha's first audio.

LiveKit emits one metrics event per component per turn; they share a
``speech_id``. We group them into rows like:

    {"speech_id": "...", "eou_ms": 310, "transcription_ms": 120, "llm_ttft_ms": 420,
     "tts_ttfb_ms": 140, "total_ms": 870}

``total_ms`` = end-of-utterance delay + LLM time to first token + TTS time to first byte,
which is the silence the candidate actually hears.
"""

from __future__ import annotations


class LatencyTracker:
    def __init__(self) -> None:
        self._turns: dict[str, dict] = {}
        self._order: list[str] = []

    def add(self, m) -> dict | None:
        """Record one metrics event; returns the turn row when it's complete."""
        speech_id = getattr(m, "speech_id", None)
        if not speech_id:
            return None
        row = self._turns.get(speech_id)
        if row is None:
            row = self._turns[speech_id] = {"speech_id": speech_id}
            self._order.append(speech_id)

        kind = getattr(m, "type", "")
        if kind == "eou_metrics":
            row["eou_ms"] = round(m.end_of_utterance_delay * 1000)
            row["transcription_ms"] = round(m.transcription_delay * 1000)
        elif kind == "llm_metrics":
            row.setdefault("llm_ttft_ms", round(m.ttft * 1000))
        elif kind == "tts_metrics":
            row.setdefault("tts_ttfb_ms", round(m.ttfb * 1000))

        if all(k in row for k in ("eou_ms", "llm_ttft_ms", "tts_ttfb_ms")) and "total_ms" not in row:
            row["total_ms"] = row["eou_ms"] + row["llm_ttft_ms"] + row["tts_ttfb_ms"]
            return row
        return None

    def rows(self) -> list[dict]:
        return [self._turns[s] for s in self._order if "total_ms" in self._turns[s]]

    def summary(self) -> dict:
        totals = sorted(r["total_ms"] for r in self.rows())
        if not totals:
            return {}

        def pct(p: float) -> int:
            return totals[min(len(totals) - 1, int(round(p * (len(totals) - 1))))]

        return {"turns": len(totals), "p50_ms": pct(0.5), "p95_ms": pct(0.95), "max_ms": totals[-1]}

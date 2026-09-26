"""Interview availability across one or more interviewers (a panel).

Each interviewer can be on Google or Microsoft 365. A slot is offered only
when it sits inside every panel member's working hours and clashes with
nobody's busy blocks. Per-day caps (``max_interviews_per_day``) spread
interview load fairly.

``pick_slots`` is pure (no network) so it is easy to test.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services import db

Block = tuple[datetime, datetime]


def _label(dt: datetime) -> str:
    from app.services.calendar_service import _format_slot_label
    return _format_slot_label(dt)


def _time_only(dt: datetime) -> str:
    from app.services.calendar_service import _format_time_only
    return _format_time_only(dt)


def pick_slots(
    *,
    members: list[dict],
    busy: list[Block],
    tz: ZoneInfo,
    duration_minutes: int,
    num_slots: int,
    days_ahead: int,
    now: datetime | None = None,
) -> list[dict]:
    """Choose up to two slots a day (morning + afternoon) free for every member.

    members: [{"timezone": "Asia/Kolkata", "working_hours_start": 9, "working_hours_end": 18}, ...]
    busy: everyone's busy blocks (any timezone).
    tz: the timezone slots are labelled in (the lead interviewer's).
    """
    now = now or datetime.now(tz)
    duration = timedelta(minutes=duration_minutes)

    def inside_hours(start: datetime) -> bool:
        end = start + duration
        for m in members:
            mtz = ZoneInfo(m.get("timezone") or "Asia/Kolkata")
            s, e = start.astimezone(mtz), end.astimezone(mtz)
            ws, we = m.get("working_hours_start", 9), m.get("working_hours_end", 18)
            if s.date() != e.date() or s.hour < ws or (e.hour, e.minute) > (we, 0) or s.weekday() >= 5:
                return False
        return True

    def free(start: datetime) -> bool:
        end = start + duration
        return not any(start < b_end and end > b_start for b_start, b_end in busy)

    lead_start = min(m.get("working_hours_start", 9) for m in members)
    lead_end = max(m.get("working_hours_end", 18) for m in members)
    windows = [("morning", lead_start, min(12, lead_end)), ("afternoon", max(13, lead_start), lead_end)]

    slots: list[dict] = []
    day = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    for _ in range(days_ahead):
        if len(slots) >= num_slots:
            break
        for period, w_start, w_end in windows:
            if len(slots) >= num_slots or w_end <= w_start:
                continue
            t = day.replace(hour=w_start)
            limit = day.replace(hour=w_end)
            while t + duration <= limit:
                if inside_hours(t) and free(t):
                    slots.append({
                        "start": t.isoformat(),
                        "end": (t + duration).isoformat(),
                        "label": _label(t),
                        "day": t.strftime("%A, %B %-d"),
                        "time": _time_only(t),
                        "period": period,
                    })
                    break
                t += timedelta(minutes=30)
        day += timedelta(days=1)
    return slots


def _daily_cap_blocks(member: dict, start: datetime, end: datetime) -> list[Block]:
    """Treat days where the interviewer already hit their cap as fully busy."""
    cap = member.get("max_interviews_per_day")
    if not cap:
        return []
    rows = db.get_supabase().table("interviews").select("scheduled_at").eq(
        "interviewer_id", member["id"]).eq("status", "scheduled").gte(
        "scheduled_at", start.isoformat()).lte("scheduled_at", end.isoformat()).execute().data or []
    tz = ZoneInfo(member.get("timezone") or "Asia/Kolkata")
    per_day: dict = {}
    for r in rows:
        d = datetime.fromisoformat(r["scheduled_at"].replace("Z", "+00:00")).astimezone(tz).date()
        per_day[d] = per_day.get(d, 0) + 1
    blocks = []
    for d, n in per_day.items():
        if n >= cap:
            s = datetime(d.year, d.month, d.day, tzinfo=tz)
            blocks.append((s, s + timedelta(days=1)))
    return blocks


async def member_busy(member: dict, start: datetime, end: datetime) -> list[Block] | None:
    if member.get("calendar_provider") == "microsoft":
        from app.services import microsoft_calendar
        return await microsoft_calendar.busy(member, start, end)
    from app.services import calendar_service
    return await calendar_service.google_busy(member, start, end)


async def find_slots(interviewer_ids: list[str], duration_minutes: int = 60, num_slots: int = 10,
                     days_ahead: int = 7) -> list[dict]:
    """Slots every interviewer in the list can do. The first id is the lead."""
    if not interviewer_ids:
        return []
    rows = db.get_supabase().table("interviewers").select(
        "id, email, timezone, working_hours_start, working_hours_end, calendar_provider, max_interviews_per_day"
    ).in_("id", interviewer_ids).execute().data or []
    by_id = {r["id"]: r for r in rows}
    members = [by_id[i] for i in interviewer_ids if i in by_id]
    if len(members) != len(interviewer_ids):
        return []
    tz = ZoneInfo(members[0].get("timezone") or "Asia/Kolkata")
    start = datetime.now(timezone.utc)
    end = start + timedelta(days=days_ahead + 2)

    busy: list[Block] = []
    for m in members:
        blocks = await member_busy(m, start, end)
        if blocks is None:
            print(f"[AVAILABILITY] No calendar access for {m.get('email')}; skipping panel search")
            return []
        busy.extend(blocks)
        busy.extend(_daily_cap_blocks(m, start, end))
    return pick_slots(members=members, busy=busy, tz=tz, duration_minutes=duration_minutes,
                      num_slots=num_slots, days_ahead=days_ahead)

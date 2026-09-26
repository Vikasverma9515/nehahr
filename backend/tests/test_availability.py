"""Panel availability."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.services.availability import pick_slots

IST = ZoneInfo("Asia/Kolkata")
UK = ZoneInfo("Europe/London")
# A Friday, so "tomorrow" is the weekend and the first slots land on Monday.
NOW = datetime(2026, 9, 25, 16, 0, tzinfo=IST)
MONDAY = datetime(2026, 9, 28, tzinfo=IST)


def at(day: datetime, h: int, m: int = 0, tz=IST):
    return day.replace(hour=h, minute=m, tzinfo=tz)


def test_single_member_morning_and_afternoon_skipping_weekend():
    slots = pick_slots(members=[{"timezone": "Asia/Kolkata", "working_hours_start": 9, "working_hours_end": 18}],
                       busy=[], tz=IST, duration_minutes=60, num_slots=2, days_ahead=7, now=NOW)
    assert [s["start"][:16] for s in slots] == ["2026-09-28T09:00", "2026-09-28T13:00"]


def test_panel_avoids_everyones_busy_blocks():
    members = [{"timezone": "Asia/Kolkata", "working_hours_start": 9, "working_hours_end": 18}] * 2
    busy = [(at(MONDAY, 9), at(MONDAY, 10)),        # lead busy first thing
            (at(MONDAY, 10), at(MONDAY, 10, 30))]   # second person right after
    slots = pick_slots(members=members, busy=busy, tz=IST, duration_minutes=60, num_slots=1, days_ahead=7, now=NOW)
    assert slots[0]["start"][:16] == "2026-09-28T10:30"
    # A 60-minute slot can't start at 11:30 (runs past noon), so a later clash moves it to the afternoon.
    busy.append((at(MONDAY, 10, 30), at(MONDAY, 11, 30)))
    slots = pick_slots(members=members, busy=busy, tz=IST, duration_minutes=60, num_slots=1, days_ahead=7, now=NOW)
    assert slots[0]["start"][:16] == "2026-09-28T13:00"


def test_panel_respects_each_members_working_hours_across_timezones():
    # London interviewer works 09:00-17:00 BST = 13:30-21:30 IST, so the only overlap
    # with an Indian 09:00-18:00 day is 13:30-18:00 IST.
    members = [{"timezone": "Asia/Kolkata", "working_hours_start": 9, "working_hours_end": 18},
               {"timezone": "Europe/London", "working_hours_start": 9, "working_hours_end": 17}]
    slots = pick_slots(members=members, busy=[], tz=IST, duration_minutes=60, num_slots=2, days_ahead=7, now=NOW)
    starts = [datetime.fromisoformat(s["start"]) for s in slots]
    for s in starts:
        uk = s.astimezone(UK)
        assert 9 <= uk.hour and (uk + timedelta(hours=1)).hour <= 17
        assert 9 <= s.hour and (s + timedelta(hours=1)).hour <= 18
    assert starts and starts[0].strftime("%H:%M") == "13:30"   # = 09:00 in London


def test_no_slots_when_calendars_fully_booked():
    members = [{"timezone": "Asia/Kolkata", "working_hours_start": 9, "working_hours_end": 18}]
    busy = [(NOW, NOW + timedelta(days=30))]
    assert pick_slots(members=members, busy=busy, tz=IST, duration_minutes=60, num_slots=5, days_ahead=7, now=NOW) == []

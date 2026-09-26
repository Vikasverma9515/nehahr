"""Per-job must-haves and the generator prompt."""

from app.routers.jobs import GENERATE_PROMPT
from app.services.scoring import check_must_haves

MUST = {"max_notice_days": 60, "min_experience_years": 3, "max_expected_ctc_lpa": 30,
        "locations": ["Pune", "Mumbai"], "allow_relocation": True, "work_models": ["hybrid", "office"]}


def test_passes_when_everything_fits():
    extracted = {"notice_period_days": 30, "expected_ctc": {"min": 20, "max": 25},
                 "current_location": "Pune, MH", "work_model_preference": "hybrid"}
    assert check_must_haves({"experience_years": 5}, extracted, MUST) == []


def test_each_rule_can_fail():
    extracted = {"notice_period_days": 90, "expected_ctc": {"fixed": 28, "variable": 5},
                 "current_location": "Delhi", "open_to_relocation": False, "work_model_preference": "remote"}
    failures = check_must_haves({"experience_years": 2}, extracted, MUST)
    assert len(failures) == 5
    assert any("notice period 90" in f for f in failures)
    assert any("33 LPA" in f for f in failures)


def test_relocation_saves_location_rule():
    extracted = {"current_location": "Delhi", "open_to_relocation": True}
    assert check_must_haves({}, extracted, MUST) == []


def test_missing_answers_are_not_failures():
    assert check_must_haves({}, {}, MUST) == []


def test_generate_prompt_formats():
    text = GENERATE_PROMPT.format(title="t", role_type="r", work_model="w", location="l",
                                  salary="s", skills="k", description="d")
    assert '"questions": [{"text": str' in text

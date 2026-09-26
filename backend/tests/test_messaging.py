"""WhatsApp / SMS."""

import asyncio

import pytest

from app.config import settings
from app.services import messaging


class Store:
    def __init__(self):
        self.rows = {}

    def table(self, name):
        store = self

        class Q:
            def __init__(self):
                self.op = None
            def insert(self, row):
                store.rows.setdefault(name, []).append(row)
                self.op = row
                return self
            def update(self, row):
                store.rows.setdefault(name + ":update", []).append(row)
                return self
            def select(self, *a, **k): return self
            def eq(self, *a): return self
            def order(self, *a, **k): return self
            def limit(self, *a): return self
            def execute(self):
                data = [self.op] if self.op else [{"direction": "inbound", "body": "hi"}]
                return type("R", (), {"data": data})()
        return Q()


@pytest.fixture
def env(monkeypatch):
    store = Store()
    sent = []
    monkeypatch.setattr(messaging.db, "get_supabase", lambda: store)
    monkeypatch.setattr(messaging.db, "get_candidate", lambda cid: {
        "id": cid, "name": "Priya Sharma", "phone": "9876543210", "stage": "scheduled",
        "jobs": {"title": "Backend Engineer"}, "messaging_opt_out": False})

    class Msgs:
        def create(self, **kw):
            sent.append(kw)
            return type("M", (), {"sid": "SM1"})()

    monkeypatch.setattr(messaging, "_twilio", lambda: type("C", (), {"messages": Msgs()})())
    monkeypatch.setattr(settings, "twilio_whatsapp_number", "+14155238886")
    monkeypatch.setattr(settings, "twilio_wa_templates", "")
    return store, sent


def test_send_uses_whatsapp_and_logs(env):
    store, sent = env
    row = messaging.send("cand-1", "Hello", purpose="manual", author="recruiter")
    assert sent[0]["to"] == "whatsapp:+919876543210" and sent[0]["body"] == "Hello"
    assert row["status"] == "sent" and row["author"] == "recruiter"


def test_template_used_for_purpose(env, monkeypatch):
    store, sent = env
    monkeypatch.setattr(settings, "twilio_wa_templates", '{"missed_call": "HX123"}')
    import app.routers.portal as portal
    monkeypatch.setattr(portal, "ensure_token", lambda cid: "tok123")
    messaging.missed_call("cand-1", "screening")
    assert sent[0]["content_sid"] == "HX123" and "body" not in sent[0]
    assert '"1": "Priya"' in sent[0]["content_variables"]
    assert "/c/tok123" in sent[0]["content_variables"]


def test_inbound_call_now_enqueues_a_call(env, monkeypatch):
    store, sent = env
    monkeypatch.setattr(messaging, "_find_candidate", lambda phone: messaging.db.get_candidate("cand-1"))
    queued = []
    import app.workers.queue as q
    monkeypatch.setattr(q, "enqueue", lambda kind, payload, **k: queued.append((kind, payload)))

    async def fake_claude(**kw):
        return '{"reply": "Calling you now!", "action": "call_now", "kind": null, "details": null}'

    import app.services.ai_conversation as ai
    monkeypatch.setattr(ai, "call_claude", fake_claude)
    reply = asyncio.run(messaging.handle_inbound("whatsapp:+919876543210", "whatsapp:+1415", "CALL", "SMx"))
    assert reply == "Calling you now!"
    assert queued and queued[0][0] == "call.initiate"


def test_stop_opts_out(env, monkeypatch):
    store, sent = env
    monkeypatch.setattr(messaging, "_find_candidate", lambda phone: messaging.db.get_candidate("cand-1"))
    reply = asyncio.run(messaging.handle_inbound("whatsapp:+919876543210", "x", "STOP", "SMy"))
    assert "won't get more messages" in reply
    assert {"messaging_opt_out": True} in store.rows["candidates:update"]

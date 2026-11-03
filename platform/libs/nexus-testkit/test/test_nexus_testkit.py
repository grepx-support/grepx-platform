"""Criteria, policy, engine and the in-memory client of the test hub."""
import pytest
from nexus_api.criteria import compile_criteria
from nexus_testkit.engine import NexusEngine, TransitionError
from nexus_testkit.memory import MemoryClient


@pytest.mark.parametrize("text,fields,expected", [
    ("", {}, True),
    ("status = 'NEW'", {"status": "NEW"}, True),
    ("WHERE status = 'NEW' AND to_service = 'a'", {"status": "NEW", "to_service": "b"}, False),
    ("status = 'X' OR (to_service = 'a' AND n >= 3)", {"to_service": "a", "n": 3}, True),
    ("state IN ('OPEN','DRAFT')", {"state": "DRAFT"}, True),
    ("state NOT IN ('OPEN')", {"state": "DRAFT"}, True),
    ("reminded_at IS NULL", {}, True),
    ("reminded_at IS NOT NULL", {"reminded_at": "x"}, True),
    ("name LIKE 'an%'", {"name": "Anna"}, True),
    ("capacity > 5", {"capacity": "7"}, True),
    ("status != 'DONE'", {}, True),  # a missing field is 'not equal'
    ("name = 'O''Neil'", {"name": "O'Neil"}, True),
])
def test_criteria_should_match_sql_semantics(text, fields, expected):
    assert compile_criteria(text)(fields) is expected


def test_claim_should_succeed_only_once():
    engine = NexusEngine()
    engine.submit("t", "k", {"status": "NEW"})
    engine.submit("t", "k", {"status": "CLAIMED"})
    with pytest.raises(TransitionError):
        engine.submit("t", "k", {"status": "CLAIMED"})


def test_submit_should_bump_version_and_record_outbox():
    engine = NexusEngine()
    assert engine.submit("t", "k", {"status": "NEW"}) == 1
    assert engine.submit("t", "k", {"status": "CLAIMED"}) == 2
    assert engine.submit("t", "k", {"status": "ACCEPTED"}) == 3
    assert [h["to"] for h in engine.store.history("t", "k")] == ["NEW", "CLAIMED", "ACCEPTED"]


def test_submit_should_follow_the_cpp_state_machine_and_insert_should_not():
    engine = NexusEngine()
    engine.submit("t", "k", {"status": "ACCEPTED"})            # a new row may start anywhere
    with pytest.raises(TransitionError):
        engine.submit("t", "k", {"status": "ACCEPTED"})        # ACCEPTED -> ACCEPTED is not an edge
    assert engine.insert("t", "k", {"status": "DELETED"}) == 2  # INSERT is a plain upsert


def test_memory_client_should_deliver_matching_events_only():
    client = MemoryClient()
    seen = []
    client.subscribe("t", "status = 'NEW'", lambda row: seen.append(row.key))
    client.submit("t", "a", {"status": "NEW"})
    client.submit("t", "b", {"status": "ACCEPTED"})
    client.drain()
    assert seen == ["a"]

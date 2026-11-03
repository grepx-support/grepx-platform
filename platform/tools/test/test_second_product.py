"""Phase 4/5 gate: a product made by `scripts/run.sh new-product` (a cooking club) runs on the generic services alone -
its own person table, role names, catalogue and no plugins - without editing platform or generic code."""
import sys
from datetime import date
from pathlib import Path

from grepx_service.catalog import seed_catalog
from grepx_testkit.stack import start_stack

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))
import new_product  # noqa: E402
from root import ROOT  # noqa: E402

TODAY = date.today().isoformat()


def test_new_product_template(tmp_path):
    (tmp_path / "config" / "projects").mkdir(parents=True)
    home = new_product.create("cooking-club", "Cooking Club", root=tmp_path)
    assert sorted(p.name for p in (home / "catalog").iterdir()) == ["access.yaml", "messages.yaml", "playbook.yaml", "schedules.yaml"]
    assert (tmp_path / "config/projects/cooking-club.yaml").read_text().endswith("catalog: product-services/cooking-club/catalog\n")


def test_cooking_club_on_generic_services(tmp_path):
    (tmp_path / "config" / "projects").mkdir(parents=True)
    home = new_product.create("cooking-club", "Cooking Club", root=tmp_path)
    stack = start_stack(ROOT, layers=("common-services",), settings=new_product.deployment("cooking-club"))
    assert all(seed_catalog(stack.requests, home / "catalog").values())
    call = lambda table, service, **f: stack.call(table, service, f)  # noqa: E731

    cook = call("people_requests", "people-service", action="CREATE", name="Kim Cook", email="kim@club.sg", phone="9123 4567")
    assert cook.ok, cook.reason
    pid = cook.fields["person_id"]
    friend = call("people_requests", "people-service", action="CREATE", name="Lee Friend", email="lee@club.sg", phone="9123 4568",
                  invite_code=cook.fields["ref_code"]).fields["person_id"]

    event = call("event_requests", "event-service", action="CREATE", title="Dumpling night", venue="Club kitchen", event_date=TODAY,
                 apply_checklist=True)
    assert event.ok, event.reason
    eid = event.fields["event_id"]
    assert call("slot_requests", "slot-service", action="GENERATE", event_id=eid,
                plan={"start": "18:00", "end": "19:00", "minutes": 60, "capacity": 4}).ok
    slot = next(r for r in stack.read.accepted("slots") if r.get("event_id") == eid)["_key"]
    assert len([t for t in stack.read.accepted("tasks") if t.get("ref_id") == eid]) == 4      # the starter checklist

    for person in (pid, friend):
        booked = call("booking_requests", "booking-service", action="BOOK", event_id=eid, person_id=person, slot_id=slot)
        assert booked.ok, booked.reason
    booking = stack.read.accepted_one("bookings", f"{eid}-{pid}")
    assert (booking["name"], booking["state"]) == ("Kim Cook", "confirmed")          # contact read from the club's people table
    assert call("booking_requests", "booking-service", action="MARK", booking_id=f"{eid}-{pid}", state="attended").ok

    assert call("campaign_requests", "campaign-service", action="BROADCAST", audience="member", text="Bring an apron").fields["count"] == 2
    assert call("campaign_requests", "campaign-service", action="BROADCAST", audience="eligible", text="x").reason == "UNKNOWN_AUDIENCE"

    assert call("event_requests", "event-service", action="COMPLETE", event_id=eid).ok
    assert [c["person_id"] for c in stack.read.accepted("certificates")] == [pid]
    assert stack.read.accepted_one("bookings", f"{eid}-{friend}")["state"] == "no_show"

    assert call("event_report_requests", "event-report-service", action="SNAPSHOT", event_id=eid).ok
    stats = stack.read.accepted_one("event_reports", eid)["stats"]
    assert (stats["registered"], stats["attended"], stats["no_show"]) == (2, 1, 1) and "blood_groups" not in stats

    assert stack.read.accepted_one("referral_scores", pid)["joined"] == 1

# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Distributed tracing over Nexus - one id from the browser click to the last side effect.

Every row carries trace_id (same for the whole request), parent (the row that caused it)
and hop (distance from the edge). The outbox records every transition with its trace_id,
so a trace is rebuilt server-side with one TRACE call; explain() turns it into a timeline
that says which service, which step, and why it failed or where it is stuck.
"""
from __future__ import annotations

from datetime import datetime

OPEN = {"NEW", "CLAIMED", "QUEUED", "REQUESTED", "PENDING", "SENDING"}


def _ms(a: str, b: str) -> int:
    try:
        return int((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() * 1000)
    except ValueError:
        return 0


def explain(trace_id: str, events: list[dict]) -> dict:
    steps, latest = [], {}
    for e in events:
        f = e.get("fields") or {}
        step = {"seq": e.get("seq"), "at": e.get("at"), "table": e["table"], "key": e["key"], "from": e.get("from"), "to": e.get("to"),
                "service": f.get("from_service") or f.get("application", ""), "to_service": f.get("to_service", ""),
                "action": f.get("action", ""), "hop": f.get("hop", 0), "parent": f.get("parent", ""),
                "reason": f.get("reason", "") if e.get("to") == "REJECTED" else "", "error": f.get("error", "")}
        steps.append(step)
        latest[(e["table"], e["key"])] = step
    failures = [s for s in steps if s["to"] == "REJECTED" or s["table"] == "dead_letters" or s["error"]]
    stuck = [s for s in latest.values() if s["to"] in OPEN and s["table"] not in ("dead_letters", "ticks")]
    services = list(dict.fromkeys(s["service"] for s in steps if s["service"]))
    return {"trace_id": trace_id, "ok": bool(steps) and not failures and not stuck, "events": len(steps),
            "duration_ms": _ms(steps[0]["at"], steps[-1]["at"]) if steps else 0, "services": services,
            "failures": failures, "stuck": [{**s, "waiting_for": s["to_service"] or "?"} for s in stuck], "steps": steps}


def render(report: dict) -> str:
    """Plain-text timeline for terminals and logs."""
    lines = [f"trace {report['trace_id']}  {'OK' if report['ok'] else 'PROBLEM'}  {report['events']} events  {report['duration_ms']} ms",
             f"services: {' -> '.join(report['services'])}"]
    for s in report["steps"]:
        mark = "X" if s in report["failures"] else ("..." if s["to"] in OPEN else "OK")
        lines.append(f"{mark} {'  ' * int(s['hop'] or 0)}{s['service'] or '?':24} {s['table']}/{s['key'][:12]:12} {s['from'] or '-'}->{s['to']}"
                     f"{' ' + s['action'] if s['action'] else ''}{' reason=' + s['reason'] if s['reason'] else ''}{' error=' + s['error'] if s['error'] else ''}")
    for s in report["stuck"]:
        lines.append(f"! stuck at {s['table']}/{s['key']} status {s['to']} - waiting for {s['waiting_for']} (is it running?)")
    return "\n".join(lines)

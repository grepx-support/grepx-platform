# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""serve.plan: what a service runs, from its config - request services and read-only edge services alike."""
import pytest
from grepx_config import Config
from grepx_service.runner import Subscription
from grepx_service.serve import plan


def find(path):
    return {"routes.handle": "HANDLE", "jobs.react": "REACT",
            "feed.subs": lambda cfg: [Subscription("x_requests", "WATCH", "", "")],
            "web.create": lambda cfg, health: ("WEB", health)}[path]


def test_request_service_runs_its_table_and_plain_health():
    cfg = Config({"service_name": "x-service", "snapshot_table": "x_requests", "live_criteria": "a", "recovery_criteria": "b",
                  "subscriptions": [{"table": "ticks", "handler": "jobs.react", "when": "to_service = '{service}'"}]})
    subs, web = plan(cfg, find)
    assert [(s.table, s.handler) for s in subs] == [("x_requests", "HANDLE"), ("ticks", "REACT")]
    assert subs[1].live_criteria == "to_service = 'x-service'"
    assert callable(web())


def test_edge_service_needs_no_request_table_and_brings_its_own_app():
    cfg = Config({"service_name": "watch-service", "discover": "feed.subs", "web_app": "web.create"})
    subs, web = plan(cfg, find)
    assert [(s.table, s.handler) for s in subs] == [("x_requests", "WATCH")]
    kind, health = web()
    assert kind == "WEB" and callable(health)


def test_a_service_with_nothing_to_run_is_refused():
    with pytest.raises(ValueError):
        plan(Config({"service_name": "empty"}), find)

# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Seed the common services with a product's catalogue folder (idempotent: every request has a stable key).

A product keeps plain YAML in its catalogue folder (declared as `catalog:` in config/projects/<product>.yaml):
    messages.yaml   templates      -> template-service   (SEED)
    playbook.yaml   checklist      -> checklist-service  (SEED_TEMPLATE)
    access.yaml     permissions    -> access-service     (REGISTER_PERMISSION, SAVE_ROLE)
    schedules.yaml  schedules      -> scheduler-service  (REGISTER)
Missing files are skipped, so a product seeds only what it uses.
"""
from __future__ import annotations
import grepx_contracts as gc

import hashlib
import json
from pathlib import Path

import yaml

from .request_client import RequestClient


def _stamp(value) -> str:
    """Stable across runs (unlike hash()): a changed entry gets a new key, an unchanged one is a no-op."""
    return hashlib.sha1(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()[:10]


def _load(folder: Path, name: str) -> dict:
    path = folder / name
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {} if path.exists() else {}


def seed_catalog(requests: RequestClient, folder: Path) -> dict[str, bool]:
    folder, results = Path(folder), {}
    for key, t in (_load(folder, "messages.yaml").get("templates") or {}).items():
        results[f"template:{key}"] = requests.call(gc.template.REQUESTS, gc.template.SERVICE, {
            "action": "SEED", "template_key": key, "label": t["label"], "placeholders": t["placeholders"],
            "bodies": {"subject": t.get("subject", ""), "text": t["text"]}, "channels": t.get("channels", ["email", "whatsapp"])},
            key=f"seed-template-{key}-{_stamp(t)}").ok
    playbook = _load(folder, "playbook.yaml")
    if playbook:
        results["playbook"] = requests.call(gc.checklist.REQUESTS, gc.checklist.SERVICE, {"action": "SEED_TEMPLATE", **playbook},
                                            key=f"seed-playbook-{_stamp(playbook)}").ok
    access = _load(folder, "access.yaml")
    for perm, label in (access.get("permissions") or {}).items():
        results[f"perm:{perm}"] = requests.call(gc.access.REQUESTS, gc.access.SERVICE, {"action": "REGISTER_PERMISSION", "perm": perm, "label": label},
                                                key=f"seed-perm-{perm}-{_stamp(label)}").ok
    for role in access.get("roles") or []:
        results[f"role:{role['role_id']}"] = requests.call(gc.access.REQUESTS, gc.access.SERVICE, {"action": "SAVE_ROLE", **role},
                                                           key=f"seed-role-{role['role_id']}-{_stamp(role)}").ok
    for s in _load(folder, "schedules.yaml").get("schedules") or []:
        results[f"schedule:{s['schedule_id']}"] = requests.call(gc.scheduler.REQUESTS, gc.scheduler.SERVICE, {"action": "REGISTER", **s},
                                                                key=f"seed-schedule-{s['schedule_id']}-{_stamp(s)}").ok
    return results

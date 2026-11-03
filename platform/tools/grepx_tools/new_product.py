# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Start a new product on the platform - nothing in platform/ or common-services/ is edited.

    scripts/run.sh new-product NAME [--title "Cooking Club"]

Creates
    product-services/NAME/deployment.yaml   how NAME plugs into the generic services (roles, phone, links, person,
                                            message templates per role, checklist, referral points, plugins)
    product-services/NAME/catalog/          message templates, a starter event checklist, permissions, schedules
    product-services/NAME/plugins/          where product rules for generic services go (README lists the interfaces)
    config/projects/NAME.yaml               the project's settings (catalog: for `run.sh seed`)
To run it: point grepx.workspace.yaml at it (product: NAME, deployment: product-services/NAME/deployment.yaml),
then scripts/setup.sh, scripts/run.sh start, scripts/run.sh seed NAME.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

from log import say

from root import ROOT  # noqa: E402  (the workspace, see root.py)
ROLES = ("welcome", "event_announcement", "event_invitation", "event_reminder", "booking_moved", "certificate",
         "referral_joined", "broadcast")
EVENT = ["first_name", "name", "org", "link", "event_title", "event_date", "event_time", "venue"]
TEMPLATES = {
    "welcome": ("Welcome after sign-up", ["first_name", "name", "org", "link"], "Welcome to {org}, {first_name}",
                "Hi {first_name},\n\nWelcome to {org}! Your account is ready.\n\n{link}"),
    "event_announcement": ("New event announced", EVENT, "New: {event_title}",
                           "Hi {first_name},\n\n{event_title}\n{event_date} {event_time}\n{venue}\n\nBook a place: {link}"),
    "event_invitation": ("Personal invitation", EVENT, "You're invited: {event_title} on {event_date}",
                         "Hi {first_name}, we'd love to see you at {event_title} on {event_date} ({event_time}) at {venue}.\n\n{link}"),
    "event_reminder": ("Reminder the day before", EVENT + ["slot_time"], "Tomorrow: {event_title}",
                       "Hi {first_name}, see you tomorrow at {event_title} ({event_time}, {venue}). Change or cancel: {link}"),
    "booking_moved": ("Booking moved to a new time", EVENT + ["slot_time"], "New time for {event_title}: {slot_time}",
                      "Hi {first_name}, your time for {event_title} on {event_date} is now {slot_time}. {link}"),
    "certificate": ("Certificate after the event", ["first_name", "name", "org", "link", "event_title", "voucher"],
                    "Your certificate from {event_title}", "Thank you {first_name}! Your certificate: {link}\n{voucher}"),
    "referral_joined": ("A friend joined", ["first_name", "name", "org", "link", "friend"], "{friend} joined {org}",
                        "Hi {first_name}, {friend} joined with your invite. Thank you!"),
    "broadcast": ("Message to a group", ["first_name", "name", "org", "link", "text"], "{org}", "Hi {first_name},\n\n{text}"),
}


def slug(name: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,40}", name):
        raise SystemExit("NAME: lower-case letters, digits and '-', e.g. cooking-club")
    return name


def deployment(name: str) -> dict:
    return {
        "roles": {"member": "member", "staff": ["staff", "admin"], "admin": "admin"},
        "phone": {"country": "65", "local": "[3689]\\d{7}", "example": "9123 4567"},
        "links": {"home": "/", "events": "/#events", "dashboard": "/dashboard", "event": "/event/{id}",
                  "certificate": "/certificate/{code}"},
        "person": {"table": "people", "service": "people-service", "requests": "people_requests", "key": "person_id"},
        "messages": {role: role for role in ROLES},
        "events": {"checklist_template": f"{name}-event-checklist"},
        "referral": {"join_points": 1, "convert_points": 2, "conversion": {"table": "", "field": "count"}},
        "plugins": {"path": f"product-services/{name}/plugins"},
    }


def catalog(name: str, title: str) -> dict[str, dict]:
    return {
        "messages.yaml": {"templates": {k: {"label": l, "placeholders": p, "subject": s, "text": t}
                                        for k, (l, p, s, t) in TEMPLATES.items()}},
        "playbook.yaml": {"template_key": f"{name}-event-checklist", "name": f"{title} event checklist", "items": [
            {"phase": "Planning", "title": "Confirm date, venue and capacity", "days": -21, "details": "", "important": True},
            {"phase": "Promotion", "title": "Announce the event to members", "days": -14, "details": "", "important": False},
            {"phase": "Event day", "title": "Mark attendance on the board", "days": 0, "details": "", "important": True},
            {"phase": "After", "title": "Complete the event and review the report", "days": 1, "details": "", "important": False}]},
        "access.yaml": {"permissions": {"manage_events": "Create, edit and complete events", "checkin": "Check-in desk",
                                        "notify": "Send messages and invitations", "reports": "Event reports"},
                        "roles": [{"role_id": "event-coordinator", "name": "Event coordinator",
                                   "perms": ["manage_events", "checkin", "reports"]}]},
        "schedules.yaml": {"schedules": [
            {"schedule_id": "task-reminders", "job": "task-reminders", "target_service": "task-service", "kind": "EVERY_MINUTES",
             "every_minutes": 15},
            {"schedule_id": "event-reminders", "job": "event-reminders", "target_service": "booking-service",
             "kind": "EVERY_MINUTES", "every_minutes": 60}]},
    }


PLUGINS_README = """# {title} plugins

Product rules the generic services load by name (deployment.yaml `plugins:`); add a module and name it there.

| role (deployment.yaml) | used by | interface |
|---|---|---|
| `profile` | people-service | `FIELDS = (...)`; `clean(raw, partial) -> dict` (raise `ValueError("<REASON>")`) |
| `questionnaire` | questionnaire-service | `check(answers) -> dict`, `chat(state, message) -> dict`, `criteria() -> dict` |
| `audience` | campaign-service | `STATS_TABLE`; `audience(name, people, stats, roles, today, member_role) -> list or None`; `matches(person, stats, filters, today) -> bool` |
| `event_report` | event-report-service | `extras(read, event, attended) -> dict` |
"""


def write(path: Path, data, root: Path) -> None:
    if path.exists():
        raise SystemExit(f"{path.relative_to(root)} already exists - pick another name")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data if isinstance(data, str) else yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=120),
                    encoding="utf-8")


def create(name: str, title: str = "", root: Path = ROOT) -> Path:
    name, title = slug(name), title or name.replace("-", " ").title()
    home = root / "product-services" / name
    write(home / "deployment.yaml", f"# How {title} plugs into the generic services (point grepx.workspace.yaml `deployment:` here).\n"
          + yaml.safe_dump(deployment(name), sort_keys=False, width=120), root)
    for file, data in catalog(name, title).items():
        write(home / "catalog" / file, data, root)
    write(home / "plugins" / "README.md", PLUGINS_README.format(title=title), root)
    write(root / "config" / "projects" / f"{name}.yaml",
          f"# Settings for every {title} service and app.\ncatalog: product-services/{name}/catalog\n", root)
    return home


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    title = argv[argv.index("--title") + 1] if "--title" in argv else ""
    if not args:
        print(__doc__)
        return 1
    home = create(args[0], title)
    say("OK", "new-product", f"{home.relative_to(ROOT)} ready - next: scripts/run.sh new product/{args[0]} <name>-service, "
                             f"then set grepx.workspace.yaml product/deployment to run it")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

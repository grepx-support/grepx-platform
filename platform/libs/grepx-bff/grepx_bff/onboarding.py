# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Setting up a new business, the same whoever starts it (the platform operator, or the owner signing up themselves):
the business, a copy of each staff-role template for it, the owner as a person with a login, staff, in the owner role.
One saga: a step that fails undoes the ones before it.

The product's deployment file names its roles in its own section (e.g. `shop:` or `kitchen:`):
    staff_roles: [owner, sales, ...]   owner_role: owner   currency: INR   timezone: Asia/Kolkata
"""
from __future__ import annotations

from typing import Callable, Iterable, Optional

import grepx_contracts as gc
from grepx_service import Saga, SagaRunner, Step, new_key

from .errors import ApiError
from .gateway import CURRENT_TRACE


def settings(gw, section: str) -> dict:
    return gw.cfg.get(section) or {}


def role_steps(gw, tenant: str, section: str) -> list[Step]:
    """A copy of each staff-role template for the new business (its owner can then change them)."""
    steps = []
    for name in settings(gw, section).get("staff_roles") or []:
        template = gw.one(gc.access.STAFF_ROLES, name) or {}
        steps.append(Step(f"role-{name}", gc.access.REQUESTS, gc.access.SERVICE,
                          lambda s, n=name, t=template: {"action": "SAVE_ROLE", "role_id": f"{tenant}.{n}", "name": t.get("name") or n.title(),
                                                         "description": f"{tenant}", "perms": t.get("perms") or [], "tenant_id": tenant}))
    return steps


def open_business(gw, *, section: str, name: str, currency: str, timezone: str, owner: dict, password_enc: str, actor_id: str = "",
                  extra: Optional[Callable[[str], Iterable[Step]]] = None) -> dict:
    """Creates the business and its owner's login; returns {business_id, owner_id}. owner: {name, email, phone};
    password_enc: the owner's password sealed with the platform key; extra(tenant): the product's own first steps."""
    tenant = new_key()[:10]
    owner_role = settings(gw, section).get("owner_role") or "owner"
    saga = Saga("business-set-up", [
        Step("business", gc.business.REQUESTS, gc.business.SERVICE,
             lambda s: {"action": "CREATE", "tenant_id": tenant, "name": name, "currency": currency, "timezone": timezone}),
        *role_steps(gw, tenant, section),
        Step("person", gc.people.REQUESTS, gc.people.SERVICE,
             lambda s: {"action": "CREATE", "tenant_id": tenant, "name": owner["name"], "email": owner["email"],
                        "phone": owner["phone"], "source": "staff", "link": gw.site}),
        Step("login", gc.auth.REQUESTS, gc.auth.SERVICE,
             lambda s: {"action": "REGISTER", "tenant_id": tenant, "user_id": s["person"]["person_id"], "email": owner["email"],
                        "password_enc": password_enc}),
        Step("staff", gc.access.REQUESTS, gc.access.SERVICE,
             lambda s: {"action": "SET_ROLE", "tenant_id": tenant, "user_id": s["person"]["person_id"], "role": "staff",
                        "actor_id": actor_id or s["person"]["person_id"]}),
        Step("owner", gc.access.REQUESTS, gc.access.SERVICE,
             lambda s: {"action": "SET_STAFF_ROLE", "tenant_id": tenant, "user_id": s["person"]["person_id"],
                        "staff_role_id": f"{tenant}.{owner_role}"}),
        *(extra(tenant) if extra else []),
    ])
    outcome = SagaRunner(gw.requests).run(saga, {}, trace_id=CURRENT_TRACE.get() or None)
    if not outcome.ok:
        raise ApiError(outcome.reason)
    return {"business_id": tenant, "owner_id": outcome.results["person"]["person_id"]}


def email_in_use(gw, email: str) -> bool:
    """Someone already signs in with this email (logins are by email, so it must be new)."""
    email = email.strip().lower()
    return any(str(p.get("email") or "").lower() == email for p in gw.read.accepted(gc.people.PEOPLE, email=email))

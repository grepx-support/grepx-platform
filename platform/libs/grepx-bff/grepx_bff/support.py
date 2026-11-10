# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Support access: a platform admin opens one organisation (a business, a clinic ...) to see what its people see.

The admin gets a short-lived token that names the organisation (act_tenant). security.py turns it into a Principal of
that organisation with every permission; a read-only token refuses every change (READ_ONLY_SUPPORT). Every opening is
written to the audit log. The product decides which organisations exist (it checks before calling open_support).
"""
from __future__ import annotations

from grepx_audit.writer import write_audit

from grepx_bff.errors import ApiError
from grepx_bff.security import Principal

HOURS = 1.0


def open_support(gw, user: Principal, tenant: str, edit: bool = False, hours: float = HOURS) -> dict:
    """A session for `user` (a platform admin) inside `tenant`: {token, tenant, support, read_only, expires_in}."""
    if not user.is_admin or user.tenant or user.support:
        raise ApiError("FORBIDDEN", 403)
    if not tenant:
        raise ApiError("MISSING_FIELD", 400)
    token = gw.tokens.issue({"sub": user.user_id, "role": user.role, "tenant": "", "act_tenant": tenant,
                             "support": "edit" if edit else "read"}, hours=hours)
    write_audit(gw.client, from_service=gw.cfg.service_name, actor_user_id=user.user_id, action="SUPPORT_OPEN",
                entity_type="tenant", entity_id=f"{tenant}-{token[-12:]}", tenant_id=tenant,
                detail="edit" if edit else "read only", username=gw.cfg.service_name)
    return {"token": token, "user_id": user.user_id, "role": user.role, "tenant": tenant, "support": True,
            "read_only": not edit, "expires_in": int(hours * 3600)}

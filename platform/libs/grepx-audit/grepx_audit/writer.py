# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Shared audit-log writer for backend services.

Any service that reaches an ACCEPTED business decision should call
`write_audit(...)` once, right after its own emit(). The helper submits
a NEW row to the `audit_log` table with:
  - status = NEW           (state machine entry point for audit-log-service)
  - from_service = <caller>  (Story 0.3 provenance stamp)
  - to_service = audit-log-service   (directed request; A2 #13)
  - application/username/occurred_at envelope

audit-log-service picks the row up, validates, and marks it ACCEPTED
(or REJECTED with a reason code). This helper is fire-and-forget from
the caller's point of view — failure to write the audit row must never
break the business flow, so all errors are swallowed and logged.
"""
from __future__ import annotations
import grepx_contracts as gc

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from nexus_api import Row

logger = logging.getLogger(__name__)

AUDIT_LOG_SERVICE = gc.audit_log.SERVICE
AUDIT_LOG_TABLE = gc.audit_log.AUDIT_LOG
_STATUS_NEW = "NEW"


def tenant_id_for_audit(row: Row) -> Optional[str]:
    """Normalize tenant_id extraction for audit emission across all services.

    Returns stripped tenant_id if present and non-empty, else None.
    This is legitimate for DENIED outcomes where MISSING_FIELD validation
    rejects the row before tenant_id is available. Every ACCEPTED path
    guarantees a tenant_id exists on the row.
    """
    raw = row.fields.get("tenant_id")
    if raw is None or raw == "":
        return None
    stripped = str(raw).strip()
    return stripped if stripped else None


class Outcome(str, Enum):
    ALLOWED = "ALLOWED"
    DENIED = "DENIED"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_audit(
    client,
    *,
    from_service: str,
    actor_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    outcome: Outcome = Outcome.ALLOWED,
    tenant_id: Optional[str] = None,
    detail: Optional[str] = None,
    username: str = "system",
) -> Optional[str]:
    """Submit a NEW row to audit_log addressed to audit-log-service.

    Returns the generated audit key on success, None on failure.
    Never raises — audit is a side-effect on the accept path; a broken
    bus must not abort the business row that just accepted.
    """
    # Deterministic key: replay of the same business decision (same entity,
    # same action, same outcome) collides on the row bus and dedupes to one
    # audit row instead of duplicating on recovery re-emit.
    key = f"audit-{entity_type}-{entity_id}-{action}-{outcome.value if isinstance(outcome, Outcome) else str(outcome)}"
    fields: dict[str, Any] = {
        "status": _STATUS_NEW,
        "from_service": from_service,
        "to_service": AUDIT_LOG_SERVICE,
        "application": from_service,
        "username": username,
        "occurred_at": _now_iso(),
        "actor_user_id": actor_user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "outcome": outcome.value if isinstance(outcome, Outcome) else str(outcome),
    }
    if tenant_id is not None:
        fields["tenant_id"] = tenant_id
    if detail is not None:
        fields["detail"] = detail

    try:
        client.submit(AUDIT_LOG_TABLE, key, fields)
        return key
    except Exception:
        logger.exception(
            "write_audit failed from=%s action=%s entity=%s/%s",
            from_service, action, entity_type, entity_id,
        )
        return None


def audit_from_row(
    app,
    cfg,
    row,
    *,
    action: str,
    entity_type: str,
    outcome: Outcome = Outcome.ALLOWED,
    tenant_id: Optional[str] = None,
    reason: Optional[str] = None,
    actor_field: str = "created_by",
) -> Optional[str]:
    """Convenience wrapper — pulls from_service from cfg.service_name and
    actor_user_id from row.fields[actor_field] (falls back to 'system').
    entity_id defaults to row.key.
    """
    actor = str(row.fields.get(actor_field) or "system")
    # cfg may be a dataclass (attribute) or OmegaConf DictConfig (mapping).
    from_service = getattr(cfg, "service_name", None)
    if from_service is None and hasattr(cfg, "get"):
        try:
            from_service = cfg.get("service_name", None)
        except Exception:
            from_service = None
    return write_audit(
        app.client,
        from_service=str(from_service or "unknown-service"),
        actor_user_id=actor,
        action=action,
        entity_type=entity_type,
        entity_id=row.key,
        outcome=outcome,
        tenant_id=tenant_id,
        detail=reason,
    )

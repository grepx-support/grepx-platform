# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Per-request log context: the trace id being handled right now (set by the service kit)."""
from contextvars import ContextVar

TRACE_ID: ContextVar[str] = ContextVar("trace_id", default="")
SERVICE: ContextVar[str] = ContextVar("service", default="")

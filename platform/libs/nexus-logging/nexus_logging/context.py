"""Per-request log context: the trace id being handled right now (set by the service kit)."""
from contextvars import ContextVar

TRACE_ID: ContextVar[str] = ContextVar("trace_id", default="")
SERVICE: ContextVar[str] = ContextVar("service", default="")

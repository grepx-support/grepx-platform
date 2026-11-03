"""RequestContext — what an action handler gets: the request, the reader, and its verdict methods."""
from __future__ import annotations

from typing import Any, Optional

from nexus_api import NexusApplication, Row, RowField, RowStatus

from .emitter import Emitter
from .reader import Reader
from .wire import plain, plain_fields


class RequestContext:
    def __init__(self, app: NexusApplication, row: Row, cfg: Any, table: str):
        self.app, self.row, self.cfg, self.table = app, row, cfg, table
        self.emitter = Emitter(app, cfg, cause=row, table=table)
        self.read = Reader(app.client)
        self.fields = dict(row.fields)
        self.done = False
        self.rejected = False

    @property
    def key(self) -> str:
        return self.row.key

    def get(self, field: Any, default: Any = None) -> Any:
        value = self.fields.get(plain(field), default)
        return default if value is None else value

    def text(self, field: Any) -> str:
        return str(self.get(field, "") or "").strip()

    def accept(self, fields: Optional[dict] = None, status: Any = RowStatus.ACCEPTED) -> int:
        self.done = True
        merged = {**self.fields, **plain_fields(fields or {})}
        merged.pop("reason", None)
        guarded = self._claimed() and plain(status) in (RowStatus.ACCEPTED.value, RowStatus.REJECTED.value)
        return self.emitter.submit(self.table, self.key, status, merged, guarded=guarded)

    def reject(self, reason: Any, detail: str = "", to_service: Optional[str] = None) -> int:
        self.done = self.rejected = True
        return self.emitter.submit(self.table, self.key, RowStatus.REJECTED,
                                   {**self.fields, "reason": plain(reason), "detail": detail}, to_service,
                                   guarded=self._claimed())

    def _claimed(self) -> bool:
        """A request this service claimed is answered through the server's state machine
        (CLAIMED -> ACCEPTED | REJECTED); anything else is a plain state write."""
        return self.fields.get(RowField.STATUS.value) == RowStatus.CLAIMED.value

    def request(self, table: str, key: str, fields: dict, to_service: str) -> int:
        """Directed follow-up request to another service (fan-out step of a saga)."""
        return self.emitter.request(table, key, fields, to_service)

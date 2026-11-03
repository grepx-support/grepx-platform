"""One JSON object per line: easy to grep, merge across services, or ship to Loki (observability/) or any log store."""
import json
import logging
import os
from datetime import datetime, timezone

from .context import SERVICE, TRACE_ID


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {"ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
                 "level": record.levelname, "service": SERVICE.get() or os.environ.get("GREPX_SERVICE", ""),
                 "project": os.environ.get("GREPX_PROJECT", "platform"),
                 "trace_id": TRACE_ID.get(), "logger": record.name, "msg": record.getMessage()}
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)

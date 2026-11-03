"""ServerAdapter: one method, one job - run a framework's app on a host/port.
Each web framework gets its own adapter implementing this; run_server()
picks the right one and never branches on framework type itself.
"""
from abc import ABC, abstractmethod
from typing import Any


class ServerAdapter(ABC):
    @staticmethod
    @abstractmethod
    def supports(app: Any) -> bool:
        """True if this adapter knows how to serve `app`."""

    @abstractmethod
    def serve(self, app: Any, host: str, port: int) -> None:
        """Block, serving `app` on host:port."""

# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Handle returned by NexusClient.subscribe() — closes the background
listener thread and its connection.

Depends on ConnectionInterface, not any concrete connection class — this
model has no idea (and shouldn't need to) whether it's holding a real
TCP socket or a test double."""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from ..interfaces.connection_interface import ConnectionInterface

logger = logging.getLogger(__name__)


@dataclass
class Subscription:
    _conn: ConnectionInterface
    _thread: threading.Thread
    _stop: threading.Event

    def close(self) -> None:
        """Sends LOGOUT before closing - lets the server log this
        subscription's session out immediately rather than only via TCP
        eventually noticing the socket died. Safe to call concurrently
        with the background thread's recv_line() on the same connection
        (independent directions of one full-duplex socket) - the OK
        response this triggers is silently ignored by that thread, which
        only acts on lines starting with "EVENT ".
        """
        self._stop.set()
        try:
            self._conn.send_line("LOGOUT")
            logger.info("subscription logout sent")
        except Exception as exc:
            logger.warning("subscription logout failed (closing anyway): error=%s", exc)
        self._conn.close()
        logger.info("subscription connection closed")

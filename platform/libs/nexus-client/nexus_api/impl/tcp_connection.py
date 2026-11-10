# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""TcpConnection — the concrete, socket-backed ConnectionInterface.
Line-buffered exactly like nexus::net::Socket
(libs/net/include/nexus/net/socket.hpp).

Every line sent and received is logged in full here — the single choke
point every NexusClient call funnels through — mirroring nexus_server's
own REQUEST/RESPONSE logging in apps/nexus_server/src/main.cpp (see the
`send` lambda there).
"""
from __future__ import annotations

import itertools
import logging
import socket
from collections import deque
from typing import Optional

from ..interfaces.connection_interface import ConnectionInterface

logger = logging.getLogger(__name__)

_next_conn_id = itertools.count(1)
_QUICKACK = getattr(socket, "TCP_QUICKACK", None)     # Linux only; elsewhere the default ACK timing applies


class TcpConnection(ConnectionInterface):
    def __init__(self, host: str, port: int):
        self._sock = socket.create_connection((host, port))
        # Small request/response lines: send each one at once (no Nagle wait).
        self._sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        self._buf = b""                 # an incomplete last line
        self._lines: deque[bytes] = deque()   # complete lines received, not yet read
        # Purely for log correlation, same idea as nexus_server's conn_id —
        # one NexusClient can hold two connections at once (the persistent
        # one plus a dedicated subscribe one), so tagging lines by id keeps
        # their REQUEST/RESPONSE pairs distinguishable in an interleaved log.
        self.conn_id = next(_next_conn_id)
        logger.debug("conn=%d connected to %s:%d", self.conn_id, host, port)

    def send_line(self, line: str) -> None:
        logger.info("conn=%d REQUEST: %s", self.conn_id, line)
        self._sock.sendall((line + "\n").encode())

    def recv_line(self) -> Optional[str]:
        while not self._lines:
            # nexus_server writes a SELECT answer as many small lines and (without TCP_NODELAY on its side) holds the
            # next one until this end acknowledges; Linux delays that ACK ~40 ms. Acknowledge at once instead: a
            # read returning rows went from ~44 ms to ~1 ms. (The flag resets itself, so it is set before each read.)
            if _QUICKACK is not None:
                self._sock.setsockopt(socket.IPPROTO_TCP, _QUICKACK, 1)
            chunk = self._sock.recv(65536)
            if not chunk:
                logger.debug("conn=%d connection closed by peer", self.conn_id)
                return None
            *complete, self._buf = (self._buf + chunk).split(b"\n")    # each byte is split once, not once per line
            self._lines.extend(complete)
        text = self._lines.popleft().decode().rstrip("\r")
        logger.info("conn=%d RESPONSE: %s", self.conn_id, text)
        return text

    def close(self) -> None:
        logger.debug("conn=%d closing", self.conn_id)
        self._sock.close()

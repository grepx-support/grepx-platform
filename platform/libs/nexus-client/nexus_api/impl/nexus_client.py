"""NexusClient — the concrete ClientInterface implementation. See
libs/protocol/include/nexus/protocol/codec.hpp for the wire format this
implements.

Depends on ConnectionInterface, not TcpConnection directly — the
connection_factory constructor parameter is where that's injected
(defaulting to TcpConnection so callers don't have to think about it for
normal use). Swapping in a test double means passing a different
factory; NexusClient's own logic never changes.
"""
from __future__ import annotations

import logging
import itertools
import os
import threading
import time
from typing import Callable, Optional

from ..codec.fields import decode_fields, encode_fields
from ..interfaces.client_interface import ClientInterface
from ..interfaces.connection_interface import ConnectionInterface
from ..models.row import Row
from ..models.subscription import Subscription
from .tcp_connection import TcpConnection

logger = logging.getLogger(__name__)
AUTH_ATTEMPTS = 14

ConnectionFactory = Callable[[str, int], ConnectionInterface]


_CONNECTION_SEQ = itertools.count(1)

class NexusClient(ClientInterface):
    """One persistent, authenticated connection per NexusClient instance,
    reused for every INSERT/SELECT/TRANSITION call — nexus_server treats
    application_name as a stable per-client identity (see libs/session)
    and reconnecting for every single call would mean re-logging-in every
    single call too. subscribe() opens ONE additional dedicated
    connection instead, since it blocks on incoming EVENT pushes and
    can't share a socket with synchronous request/response calls.

    application_name + access_mode together must be unique among
    currently-active sessions — nexus_server rejects a second concurrent
    login using the same (application_name, access_mode) pair (see
    InMemorySessionRegistry). This client always uses access_mode
    "SUBSCRIBE" for the dedicated subscribe connection and whatever
    access_mode was passed to the constructor (default "ALL") for
    everything else, so the two never collide with each other — but two
    NexusClient instances sharing one application_name for the same role
    still will, by design.
    """

    def __init__(self, application_name: str, username: Optional[str] = None,
                 password: Optional[str] = None, access_mode: str = "ALL",
                 host: Optional[str] = None, port: Optional[int] = None,
                 connection_factory: ConnectionFactory = TcpConnection):
        # Credentials default from NEXUS_USERNAME/NEXUS_PASSWORD - one
        # place for every consumer, instead of each service re-reading
        # the same two env vars itself. Pass username/password explicitly
        # only when a caller genuinely needs to override the environment
        # (e.g. a script authenticating as a different user).
        from grepx_config import nexus_address
        default_host, default_port = nexus_address()
        self.host = host or default_host
        self.port = int(port or default_port)
        self.username = username if username is not None else os.environ.get("NEXUS_USERNAME", "demo")
        self.password = password if password is not None else os.environ.get("NEXUS_PASSWORD", "demo")
        self.application_name = application_name
        self.access_mode = access_mode
        self._connection_factory = connection_factory
        self._lock = threading.Lock()
        self._conn: Optional[ConnectionInterface] = None

    def _authenticate(self, conn: ConnectionInterface, access_mode: str) -> None:
        # The C++ server allows one live session per (application_name, access_mode). A process
        # opens several connections (calls, one per subscription, reconnects after a drop while the
        # server may still hold the old session), so each connection gets its own suffix.
        access_mode = f"{access_mode}.{os.getpid()}.{next(_CONNECTION_SEQ)}"
        logger.info("connecting: application=%s access_mode=%s host=%s:%s",
                    self.application_name, access_mode, self.host, self.port)
        for attempt in range(AUTH_ATTEMPTS):
            conn.send_line(f"AUTH {self.username} {self.password} {self.application_name} {access_mode}")
            response = conn.recv_line()
            # The C++ server checks the password in the SQLite file it also writes rows to; while a write holds the
            # lock the check fails and it answers "unauthorized". The connection stays open, so ask again shortly.
            if response != "ERR unauthorized" or attempt == AUTH_ATTEMPTS - 1:
                break
            time.sleep(min(2.0, 0.1 * 2 ** attempt))   # ~20 s in all: a busy start-up (every service recovering) can hold the lock
        if response is None or not response.startswith("OK"):
            conn.close()
            logger.warning("login failed: application=%s access_mode=%s response=%s",
                           self.application_name, access_mode, response)
            raise RuntimeError(
                f"login failed for application '{self.application_name}' ({access_mode}): {response}")
        logger.info("login OK: application=%s access_mode=%s", self.application_name, access_mode)

    def _get_conn(self) -> ConnectionInterface:
        """Returns the persistent request/response connection, (re)connecting
        and re-authenticating on first use or after a drop."""
        if self._conn is None:
            conn = self._connection_factory(self.host, self.port)
            self._authenticate(conn, self.access_mode)
            self._conn = conn
        return self._conn

    def _reset_conn(self) -> None:
        """Forget a dead persistent connection so the next call reconnects."""
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None

    def _exchange(self, line: str, until_end: bool = False) -> list[str]:
        """Send one request line and read its answer (one line, or up to END for SELECT/TRACE).
        A dropped connection (Nexus restarted, network blip) is reconnected once and the request
        retried, so long-lived clients such as the BFF recover by themselves."""
        for attempt in (1, 2):
            try:
                conn = self._get_conn()
                conn.send_line(line)
                lines: list[str] = []
                while True:
                    answer = conn.recv_line()
                    if answer is None:
                        raise ConnectionError("connection closed")
                    lines.append(answer)
                    if not until_end or answer == "END" or answer.startswith("ERR"):
                        return lines
            except (OSError, ConnectionError) as exc:
                self._conn_dropped()
                if attempt == 2:
                    logger.error("no response from Nexus for %s: %s", line.split(" ", 1)[0], exc)
                    raise RuntimeError("no response from Nexus") from exc
                logger.warning("Nexus connection lost (%s) - reconnecting", exc)
        return []

    def _conn_dropped(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    def insert(self, table: str, key: str, fields: dict) -> None:
        with self._lock:
            response = self._exchange(f"INSERT {table} {key} {encode_fields(fields)}")[0]
            if not response.startswith("OK"):
                logger.error("insert failed: table=%s key=%s response=%s", table, key, response)
                raise RuntimeError(f"insert failed: {response}")

    def delete(self, table: str, key: str) -> None:
        with self._lock:
            try:
                conn = self._get_conn()
                conn.send_line(f"DELETE {table} {key}")
                response = conn.recv_line()
                logger.debug("delete: table=%s key=%s response=%s", table, key, response)
            except Exception as exc:
                logger.warning("delete failed: table=%s key=%s error=%s", table, key, exc)

    def select(self, table: str, criteria: str = "") -> list[Row]:
        with self._lock:
            rows: list[Row] = []
            for line in self._exchange(f"SELECT {table} {criteria}", until_end=True):
                if line.startswith("ROW "):
                    _, key, fields_text = line.split(" ", 2)
                    rows.append(Row(key, decode_fields(fields_text)))
                elif line.startswith("ERR"):
                    logger.warning("select refused: table=%s criteria=%r response=%s", table, criteria, line)
            return rows

    def trace(self, trace_id: str) -> list[dict]:
        """TRACE: every transition that carried this trace id (servers without TRACE return [])."""
        with self._lock:
            events = []
            for line in self._exchange(f"TRACE {trace_id}", until_end=True):
                if line.startswith("EVT "):
                    _, seq, table, key, frm, to, at, fields_text = line.split(" ", 7)
                    events.append({"seq": int(seq), "table": table, "key": key, "from": None if frm == "-" else frm,
                                   "to": None if to == "-" else to, "at": at, "fields": decode_fields(fields_text)})
            return events

    def transition(self, table: str, key: str, from_status: str, to_status: str,
                   expected_version: int, fields: dict) -> int:
        """Returns the new version on success; raises on conflict or an illegal transition."""
        with self._lock:
            response = self._exchange(f"TRANSITION {table} {key} {from_status} {to_status} "
                                      f"{expected_version} {encode_fields(fields)}")[0]
            if response.startswith("OK"):
                return int(response.split(" ", 1)[1])
            logger.warning("transition rejected: table=%s key=%s %s->%s response=%s",
                           table, key, from_status, to_status, response)
            raise RuntimeError(f"transition failed: {response}")

    def submit(self, table: str, key: str, fields: dict) -> int:
        with self._lock:
            response = self._exchange(f"SUBMIT {table} {key} {encode_fields(fields)}")[0]
            if response.startswith("OK"):
                return int(response.split(" ", 1)[1])
            logger.warning("submit rejected: table=%s key=%s status=%s response=%s",
                           table, key, fields.get("status"), response)
            raise RuntimeError(f"submit failed: {response}")

    def subscribe(self, table: str, criteria: str, on_event: Callable[[Row], None],
                  subscription_id: Optional[str] = None) -> Subscription:
        """Opens the dedicated long-lived SUBSCRIBE connection and calls
        on_event(row) on a background thread for every insert/update
        matching criteria. The server itself filters by predicate before
        sending EVENT lines (see DispatchService) — on_event only ever
        sees matching rows."""
        conn = self._connection_factory(self.host, self.port)
        self._authenticate(conn, "SUBSCRIBE")

        sub_id = subscription_id or f"py-{id(conn)}"
        conn.send_line(f"SUBSCRIBE {sub_id} {table} {criteria}")
        ack = conn.recv_line()
        if ack is None or not ack.startswith("OK"):
            conn.close()
            logger.error("subscribe failed: table=%s criteria=%r response=%s", table, criteria, ack)
            raise RuntimeError(f"subscribe failed: {ack}")
        logger.info("subscribed: table=%s criteria=%r subscription_id=%s", table, criteria, sub_id)

        stop = threading.Event()

        def _reconnect() -> None:
            # Called from the subscription thread only, when the subscribed
            # connection drops (peer close, reset on a stale socket,
            # or a failed on_event). Tears down the dead connection, re-
            # SUBSCRIBEs on a fresh one, and replays rows still matching the
            # live criteria so nothing that changed while disconnected is
            # lost (on_event must be safe to call more than once for the
            # same key - same contract as RecoveringSubscriber).
            nonlocal conn
            try:
                conn.close()
            except Exception:
                pass
            while not stop.is_set():
                try:
                    fresh = self._connection_factory(self.host, self.port)
                    self._authenticate(fresh, "SUBSCRIBE")
                    fresh.send_line(f"SUBSCRIBE {sub_id} {table} {criteria}")
                    ack = fresh.recv_line()
                    if ack is None or not ack.startswith("OK"):
                        raise RuntimeError(f"subscribe failed: {ack}")
                    conn = fresh
                    logger.warning("subscription resumed: subscription_id=%s table=%s (replaying pending)",
                                   sub_id, table)
                    try:
                        pending = self.select(table, criteria)
                    except OSError:
                        self._reset_conn()
                        pending = self.select(table, criteria)
                    for row in pending:
                        on_event(Row(row.key, dict(row.fields)))
                    return
                except Exception as exc:
                    logger.warning("subscription reconnect failed (%s): subscription_id=%s; retrying",
                                   exc, sub_id)
                    try:
                        fresh.close()
                    except Exception:
                        pass
                    time.sleep(2.0)

        def _loop():
            while not stop.is_set():
                try:
                    line = conn.recv_line()
                except OSError as exc:
                    logger.warning("subscription connection error: subscription_id=%s (%s); reconnecting",
                                   sub_id, exc)
                    line = None
                if line is None:
                    if stop.is_set():
                        return
                    logger.warning("subscription connection closed: subscription_id=%s; reconnecting", sub_id)
                    _reconnect()
                    continue
                if line.startswith("EVENT "):
                    _, _table, key, fields_text = line.split(" ", 3)
                    try:
                        logger.debug("event: table=%s key=%s", _table, key)
                        on_event(Row(key, decode_fields(fields_text)))
                    except Exception:
                        logger.exception("event handler failed: subscription_id=%s table=%s key=%s; reconnecting",
                                         sub_id, _table, key)
                        _reconnect()

        thread = threading.Thread(target=_loop, daemon=True)
        thread.start()
        return Subscription(conn, thread, stop)

    def close(self) -> None:
        """Sends LOGOUT then closes the persistent request/response
        connection, if open - lets the server log this session out
        immediately rather than only ever discovering it via TCP noticing
        the socket died (which, without SO_KEEPALIVE tuning on the C++
        side, could otherwise take minutes - see
        platform::enable_keepalive in nexus_server). If the connection is
        already dead (send/recv fails), that's fine - there's nothing left
        to log out anyway. subscribe() connections are independent - close
        those via the returned Subscription instead.
        """
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.send_line("LOGOUT")
                    response = self._conn.recv_line()
                    logger.info("logout: application=%s response=%s", self.application_name, response)
                except Exception as exc:
                    logger.warning("logout failed (closing anyway): application=%s error=%s",
                                  self.application_name, exc)
                self._conn.close()
                self._conn = None
                logger.info("closed persistent connection: application=%s", self.application_name)

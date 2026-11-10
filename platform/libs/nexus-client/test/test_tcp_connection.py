# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""TcpConnection reads whole lines however the bytes arrive, and does not wait on delayed ACKs."""
import socket
import threading

from nexus_api.impl.tcp_connection import TcpConnection


def _pair(chunks: list[bytes]) -> TcpConnection:
    server = socket.create_server(("127.0.0.1", 0))
    port = server.getsockname()[1]

    def serve():
        conn, _ = server.accept()
        conn.recv(100)                            # the request line
        for chunk in chunks:
            conn.sendall(chunk)
        conn.close()
        server.close()

    threading.Thread(target=serve, daemon=True).start()
    c = TcpConnection("127.0.0.1", port)
    c.send_line("SELECT t")
    return c


def test_lines_are_whole_however_the_bytes_are_split():
    c = _pair([b"ROW a x=1\nROW b", b" x=2\r\nRO", b"W c x=3\nEND\n"])
    assert [c.recv_line() for _ in range(4)] == ["ROW a x=1", "ROW b x=2", "ROW c x=3", "END"]
    assert c.recv_line() is None                  # peer closed


def test_a_large_answer_reads_back_in_order():
    rows = [f"ROW k{n} v={n}" for n in range(20000)]
    c = _pair([("\n".join(rows) + "\nEND\n").encode()])
    got = []
    while (line := c.recv_line()) != "END":
        got.append(line)
    assert got == rows


def test_small_lines_go_out_at_once():
    c = _pair([b"END\n"])
    assert c._sock.getsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY)

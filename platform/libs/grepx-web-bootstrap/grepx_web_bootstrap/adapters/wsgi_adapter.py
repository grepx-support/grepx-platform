# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Plain WSGI apps (any callable(environ, start_response)) on the standard library — no framework needed.
Also serves Flask/Django/Bottle apps, which are WSGI too, when no more specific adapter claims them."""
from socketserver import ThreadingMixIn
from typing import Any
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

from .base import ServerAdapter


class _Quiet(WSGIRequestHandler):
    def log_message(self, *args):  # health probes every few seconds would flood the log
        pass


class _ThreadingServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class WsgiAdapter(ServerAdapter):
    @staticmethod
    def supports(app: Any) -> bool:
        return callable(app)

    def serve(self, app: Any, host: str, port: int) -> None:
        make_server(host, port, app, server_class=_ThreadingServer, handler_class=_Quiet).serve_forever()

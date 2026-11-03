# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Single entry point every service uses to start its web app, whatever
framework it's built on. Port comes from grepx_port_provider - no service
hardcodes its own port anymore.
"""
from typing import Any, Optional

from grepx_port_provider import get_free_port

from .adapters import ADAPTERS


def _adapter_for(app: Any):
    for adapter in ADAPTERS:
        if adapter.supports(app):
            return adapter
    raise TypeError(f"No adapter registered for app type {type(app)!r}")


def run_server(app: Any, service: str, host: Optional[str] = None, port: Optional[int] = None) -> None:
    """Blocks, serving `app` on a free port from `service`'s reserved
    range (config/services.ini `ports =`) - or `port` if given
    explicitly. Listens on this machine only (127.0.0.1) unless `host` or GREPX_BIND says otherwise:
    health and metrics are for the operator, not the internet; a public web app passes its own host.
    """
    import os
    host = host or os.environ.get("GREPX_BIND") or "127.0.0.1"
    resolved_port = port if port is not None else get_free_port(service)
    if resolved_port is None:
        from grepx_port_provider import get_port_range
        start, end = get_port_range(service) or ("?", "?")
        raise RuntimeError(f"No free port for {service!r} in {start}-{end} - something else is using them "
                           f"(find it: ss -ltnp | grep ':{start}')")

    import os
    os.environ["GREPX_PORT"] = str(resolved_port)
    _adapter_for(app).serve(app, host=host, port=resolved_port)

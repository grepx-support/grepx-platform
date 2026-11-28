# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""What the edge layer is told: the CSP mode, the extra hosts a product's pages use, the CORS origins - from env and config."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

MODES = {"report-only": "Content-Security-Policy-Report-Only", "enforce": "Content-Security-Policy", "off": ""}
LOCAL = re.compile(r"^https?://(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0|[^/:]*\.local)([:/]|$)")


@dataclass(frozen=True)
class EdgeOptions:
    mode: str = "report-only"                      # report-only | enforce | off
    connect: tuple = ()                            # extra hosts per directive (a map's tiles, an analytics endpoint ...)
    img: tuple = ()
    font: tuple = ()
    style: tuple = ()
    site: str = ""                                 # the public address (SITE_URL); local = development

    @property
    def header(self) -> str:
        return MODES.get(self.mode, MODES["report-only"])

    @property
    def public(self) -> bool:
        return bool(self.site) and not LOCAL.match(self.site.lower())

    @classmethod
    def read(cls, cfg=None, env=os.environ) -> "EdgeOptions":
        conf = (cfg.get("edge") if cfg is not None and hasattr(cfg, "get") else None) or {}
        hosts = lambda k: tuple(str(h) for h in conf.get(k) or [])          # noqa: E731
        return cls(mode=env.get("CSP_MODE", conf.get("csp_mode", "report-only")).strip().lower(),
                   connect=hosts("connect"), img=hosts("img"), font=hosts("font"), style=hosts("style"),
                   site=str(env.get("SITE_URL", "") or (cfg.get("site_url") if cfg is not None and hasattr(cfg, "get") else "") or "").strip())


def cors_origins(env=os.environ) -> list[str]:
    """CORS_ORIGINS=https://studio.grepx.sg,https://app.grepx.sg; unset = "*" (safe only because auth is a bearer header, A-6)."""
    raw = [o.strip().rstrip("/") for o in env.get("CORS_ORIGINS", "").split(",") if o.strip()]
    return raw or ["*"]

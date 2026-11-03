"""Product plugins: a generic service gets the product's rules as a module named in configuration (Strategy by config).

    product-services/<product>/deployment.yaml
      plugins:
        path: product-services/blood-donation/plugins     # folder holding the product's plugin modules
        questionnaire: blood_eligibility                  # module for the questionnaire-service

    rules = plugin(cfg, "questionnaire")   # -> the module, or None when the deployment configured none
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any, Optional


def plugin(cfg: Any, role: str) -> Optional[Any]:
    settings = cfg.get("plugins") or {}
    name = settings.get(role)
    if not name:
        return None
    folder = Path(cfg.get("workspace") or ".") / str(settings.get("path") or "plugins")
    if str(folder) not in sys.path:
        sys.path.insert(0, str(folder))
    return importlib.import_module(name)


def person_table(cfg: Any) -> str:
    """The table holding the deployment's people (config `person.table`: donors, members, staff …)."""
    return str((cfg.get("person") or {}).get("table") or "people")


def template_for(cfg: Any, role: str) -> str:
    """The message template a deployment uses for a generic message role (config `messages:`), else the role itself."""
    return str((cfg.get("messages") or {}).get(role) or role)

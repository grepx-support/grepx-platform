"""Which code still types another service's name, request table or owned table as a string (phase 2 gate).

A name belongs in grepx_contracts and in the owning service's own folder - nowhere else. Tests may use literals.
    scripts/run.sh lint-contracts
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path
import tokenize

import yaml

from log import say
from workspace import ROOT, registry

SKIP = (".venv/", "egg-info", "/test/", "platform/libs/grepx-contracts/", "platform/tools/")


def published() -> dict[str, str]:
    """name -> owning service folder (relative, with a trailing slash)."""
    out = {}
    for service, svc in registry().items():
        cfg_file = svc["path"] / "config" / "config.yaml"
        if not cfg_file.exists() or not (svc["path"] / "src" / "dto").exists():
            continue
        cfg = yaml.safe_load(cfg_file.read_text(encoding="utf-8")) or {}
        if not cfg.get("snapshot_table"):
            continue
        home = svc["path"].relative_to(ROOT).as_posix() + "/"
        for name in [service, cfg["snapshot_table"], *(cfg.get("owns") or [])]:
            out[name] = home
    return out


WORDS_NOT_NAMES = {"get", "Blueprint", "APIRouter", "Path", "tags", "template_folder", "prefix", "url_prefix", "link"}


def used_as_name(tokens: list, i: int) -> bool:
    """A literal that names a table or service: not a dict key, not a subscript, not a .get() key,
    not a keyword argument, not a router / blueprint / folder name."""
    prev = next((t for t in reversed(tokens[:i]) if t.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.COMMENT)), None)
    nxt = next((t for t in tokens[i + 1:] if t.type not in (tokenize.NL, tokenize.COMMENT)), None)
    if nxt is not None and nxt.string == ":":
        return False                                   # {"donors": ...}
    if prev is not None and prev.string in ("[", "/", "=", "=="):
        return prev.string == "=" and tokens[i - 1].string == "=" and _is_constant(tokens, i)   # x["donors"], p / "media", tags=[..], k="v"
    callee = next((tokens[j - 1].string for j in range(i, 0, -1) if tokens[j].string == "(" and tokens[j - 1].type == tokenize.NAME), "")
    return callee not in WORDS_NOT_NAMES


def _is_constant(tokens: list, i: int) -> bool:
    """NAME = "table" at module level, where NAME is upper case (a module constant; an enum member is a field name)."""
    j = i - 2
    while j >= 0 and tokens[j].string in (",",) or (j >= 0 and tokens[j].type == tokenize.NAME and tokens[j].string.isupper()):
        j -= 1
    return (j < 0 or tokens[j].type in (tokenize.NEWLINE, tokenize.NL, tokenize.DEDENT)) and tokens[j + 1].start[1] == 0


def python_files(scopes) -> list:
    """*.py under each scope, following linked repos (common-services/ may be a symlink into grepx-services)."""
    found = []
    for scope in scopes:
        for folder, dirs, files in os.walk(ROOT / scope, followlinks=True):
            dirs[:] = [d for d in dirs if d not in (".venv", "__pycache__", "node_modules")]
            found += [Path(folder) / f for f in files if f.endswith(".py")]
    return sorted(found)


def offences() -> list[str]:
    names, found = published(), []
    for f in python_files(("apps", "platform/libs", "common-services", "product-services")):
        rel = f.relative_to(ROOT).as_posix()
        if any(s in rel for s in SKIP):
            continue
        try:
            tokens = list(tokenize.generate_tokens(io.StringIO(f.read_text(encoding="utf-8")).readline))
        except (tokenize.TokenError, SyntaxError):
            continue
        for i, t in enumerate(tokens):
            s = t.string
            if t.type == tokenize.STRING and len(s) > 2 and s[0] in "\"'" and s[-1] == s[0] and not s.startswith(('"""', "'''")):
                home = names.get(s[1:-1])
                if home and not rel.startswith(home) and used_as_name(tokens, i):
                    found.append(f"{rel}:{t.start[0]}  {s}")
    return found


def main() -> int:
    found = offences()
    for line in found:
        print(line)
    say("OK" if not found else "ERROR", "contracts", f"{len(found)} typed service/table name(s) outside grepx_contracts")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())

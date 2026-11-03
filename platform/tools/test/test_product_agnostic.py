# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Phase 5 gate: the platform libraries and generic services never speak one product's words in code
(identifiers, string literals, config values). Comments and docstrings may give examples."""
import io
import re
import sys
import tokenize
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))
from root import ROOT  # noqa: E402  (the workspace, also when platform/ is a linked repo)

WORDS = re.compile(r"donor|drive(?!r)|blood|donat|lifeflow", re.IGNORECASE)
SCOPES = ("platform/libs", "common-services")
SKIP = (".venv", "egg-info", "/test/", "grepx-contracts", "__pycache__")


def code_words(path: Path) -> list[str]:
    tokens = list(tokenize.generate_tokens(io.StringIO(path.read_text(encoding="utf-8")).readline))
    found = []
    for i, t in enumerate(tokens):
        prev = next((p for p in reversed(tokens[:i]) if p.type not in (tokenize.NL, tokenize.COMMENT)), None)
        docstring = t.type == tokenize.STRING and (prev is None or prev.type in (tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT))
        if t.type in (tokenize.NAME, tokenize.STRING) and not docstring and WORDS.search(t.string):
            found.append(f"{path.relative_to(ROOT)}:{t.start[0]}  {t.string[:60]}")
    return found


def yaml_words(path: Path) -> list[str]:
    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                yield from walk(k)
                yield from walk(v)
        elif isinstance(node, list):
            for v in node:
                yield from walk(v)
        elif isinstance(node, str) and WORDS.search(node):
            yield node
    return [f"{path.relative_to(ROOT)}  {w[:60]}" for w in walk(yaml.safe_load(path.read_text(encoding="utf-8")) or {})]


def files_under(top: Path) -> list[Path]:
    import os
    return [Path(d) / f for d, dirs, files in os.walk(top, followlinks=True)
            for f in files if not any(s in d for s in (".venv", "__pycache__"))]


def offences() -> list[str]:
    found = []
    for scope in SCOPES:
        for f in sorted(files_under(ROOT / scope)):
            rel = f.relative_to(ROOT).as_posix()
            if any(s in f"/{rel}" for s in SKIP) or not f.is_file():
                continue
            if f.suffix == ".py":
                found += code_words(f)
            elif f.suffix in (".yaml", ".yml"):
                found += yaml_words(f)
    return found


def test_generic_code_speaks_no_product_words():
    assert offences() == []

# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The shared web shell and UI kit: their unit tests pass (node --test), every kit part is exported once from
kit/index.js, files stay small, and the generic code never names a product's words."""
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))
from root import ROOT  # noqa: E402

WEB = ROOT / "web" if (ROOT / "web").exists() else Path(__file__).resolve().parents[3] / "web"
KIT, SHELL = WEB / "kit", WEB / "shell"
PRODUCT_WORDS = re.compile(r"donor|blood|donat|kitchen|recipe|warehouse|supplier", re.IGNORECASE)
MAX_LINES = 160                      # small files: one component or concern each


def code_lines(path: Path):
    """Lines of JS that are not comments (comments may give product examples)."""
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        text = line.strip()
        if text and not text.startswith(("//", "*", "/*")):
            yield n, text.split(" // ")[0]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_kit_unit_tests_pass():
    files = [str(f) for f in sorted([*(KIT / "test").glob("*.test.mjs"), *(SHELL / "test").glob("*.test.mjs")])]
    out = subprocess.run(["node", "--test", *files], capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, out.stdout[-2000:] + out.stderr[-2000:]


def test_every_kit_module_is_exported_from_the_index():
    index = (KIT / "index.js").read_text(encoding="utf-8")
    parts = [p for p in KIT.rglob("*.js") if p.name != "index.js" and "test" not in p.parts]
    missing = [p.relative_to(KIT).as_posix() for p in parts if f'"./{p.relative_to(KIT).as_posix()}"' not in index]
    assert not missing, f"not exported from kit/index.js: {missing}"


def test_files_are_small_and_generic():
    too_long, words = [], []
    for f in sorted([*KIT.rglob("*.js"), *SHELL.rglob("*.js"), WEB / "app.js"]):
        if "test" in f.parts:
            continue
        lines = f.read_text(encoding="utf-8").count("\n")
        if lines > MAX_LINES:
            too_long.append(f"{f.relative_to(WEB)} ({lines} lines)")
        words += [f"{f.relative_to(WEB)}:{n} {t[:60]}" for n, t in code_lines(f) if PRODUCT_WORDS.search(t)]
    assert not too_long, f"split these into smaller files: {too_long}"
    assert not words, "product words in generic web code:\n" + "\n".join(words)

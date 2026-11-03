# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Run every test suite, each in its own process (services have same-named modules)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from log import say
from workspace import ROOT, env


SKIP = {"legacy", "node_modules", ".venv", "site-packages", ".git", "__pycache__", "data", "logs", "run"}


def test_folders(root: Path = ROOT) -> list[Path]:
    """Every <x>/test folder with test_*.py, following linked repos (platform/, common-services/ may be symlinks)."""
    found = []
    for folder, dirs, files in os.walk(root, followlinks=True):
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not d.endswith(".egg-info"))
        if Path(folder).name == "test" and any(f.startswith("test_") and f.endswith(".py") for f in files):
            found.append(Path(folder))
    return sorted(found)


def run_tests(path: str = "") -> int:
    suites = [Path(path)] if path else test_folders()
    failed = []
    for suite in dict.fromkeys(suites):
        code = subprocess.call([sys.executable, "-m", "pytest", str(suite)], cwd=ROOT, env=env())
        if code:
            failed.append(str(suite))
    say("OK", "test", "ALL SUITES PASSED") if not failed else say("ERROR", "test", "FAILED: " + ", ".join(failed))
    return 1 if failed else 0

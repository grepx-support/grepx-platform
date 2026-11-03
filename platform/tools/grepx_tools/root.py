# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The workspace the tools work on: GREPX_HOME (scripts/run.sh and setup.sh export it), else the nearest folder above
the current directory holding config/common.yaml, else the folder these tools sit in. Never resolved through symlinks,
so a workspace assembled from several repos (platform/ and common-services/ linked in) is found as itself."""
from __future__ import annotations

import os
from pathlib import Path


def _find() -> Path:
    if os.environ.get("GREPX_HOME"):
        return Path(os.environ["GREPX_HOME"])
    here = Path(os.environ.get("PWD") or os.getcwd())
    for folder in [here, *here.parents]:
        if (folder / "config" / "common.yaml").exists():
            return folder
    return Path(__file__).resolve().parents[3]


ROOT = _find()

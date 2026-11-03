"""Split a requirements file into what pip must download and the repo's own libraries.

    python reqs.py <requirements.txt> <out-dir>
writes <out-dir>/third_party.txt (pip installs it) and <out-dir>/grepx-libs.pth (copied into the venv's
site-packages so the in-repo libraries import straight from source). Our own libraries are never built by
pip: no build backend, no editable-install subprocesses. Stdlib only.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

LIBS = re.compile(r"^(?:\.\./)*platform/libs/(?P<name>[^/]+)/?$")


def library(base: Path, ref: str) -> Path:
    """A `-e` path. Platform libraries are found in the workspace (GREPX_HOME), so a service inside a linked repo
    (common-services/ -> ../grepx-services/common-services) still finds platform/libs next to it in the workspace."""
    m = LIBS.match(ref.replace("\\", "/"))
    if m and os.environ.get("GREPX_HOME"):
        return (Path(os.environ["GREPX_HOME"]) / "platform" / "libs" / m.group("name")).resolve()
    return (base / ref).resolve()


def install_requires(lib: Path) -> list[str]:
    """[project] dependencies of a library's pyproject.toml (read without tomllib, so Python 3.10 works)."""
    toml = lib / "pyproject.toml"
    if not toml.exists():
        return []
    block = re.search(r"^dependencies\s*=\s*\[(.*?)\]", toml.read_text(encoding="utf-8"), re.S | re.M)
    return re.findall(r'"([^"]+)"', block.group(1)) if block else []


def split(req: Path) -> tuple[list[str], list[Path]]:
    third, libs, seen = [], [], set()

    def read(path: Path) -> None:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            if line.startswith("-r "):
                read((path.parent / line[3:].strip()).resolve())
            elif line.startswith("-e "):
                lib = library(path.parent, line[3:].strip())
                if lib not in seen:
                    seen.add(lib)
                    libs.append(lib)
            else:
                third.append(line)

    read(req.resolve())
    local_names = {lib.name.lower() for lib in libs} | {p.name.lower() for p in libs[0].parent.iterdir()} if libs else set()
    for lib in libs:
        third += [r for r in install_requires(lib) if re.split(r"[<>=!\[ ;]", r, maxsplit=1)[0].lower() not in local_names]
    return list(dict.fromkeys(third)), libs


if __name__ == "__main__":
    third, libs = split(Path(sys.argv[1]))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    (out / "third_party.txt").write_text("".join(t + "\n" for t in third), encoding="utf-8")
    (out / "grepx-libs.pth").write_text("".join(f"{lib}\n" for lib in libs), encoding="utf-8")
    print(f"{len(third)} third-party requirement(s), {len(libs)} repo librar{'y' if len(libs) == 1 else 'ies'} linked")

"""scripts/run.sh deps - write each service's requirements.txt and each library's pyproject dependencies from what
the code imports (platform libraries, with everything they need in turn); fail on an import cycle between libraries.

Third-party lines (requests, google-auth ...) a service lists are kept; library lines are always regenerated.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from log import say
from workspace import ROOT

LIBS_DIR = ROOT / "platform" / "libs"
IMPORT = re.compile(r"^\s*(?:from|import) ((?:grepx|nexus)_[a-z_]+)", re.M)
TEST_ONLY = {"nexus-testkit", "grepx-testkit"}


def libraries() -> dict[str, str]:
    """import name -> library folder, read from each library's own package folder."""
    out = {}
    for lib in sorted(LIBS_DIR.iterdir()):
        for pkg in lib.iterdir():
            if (pkg / "__init__.py").exists() and not pkg.name.endswith(".egg-info"):
                out[pkg.name] = lib.name
    return out


def imports(folders: list[Path], names: dict[str, str]) -> set[str]:
    found = set()
    for folder in folders:
        for f in folder.rglob("*.py") if folder.exists() else []:
            if ".venv" not in f.parts:
                found |= {names[m] for m in IMPORT.findall(f.read_text(encoding="utf-8")) if m in names}
    return found


def graph() -> dict[str, set[str]]:
    names = libraries()
    return {lib: imports([LIBS_DIR / lib / mod], names) - {lib} for mod, lib in names.items()}


def closure(start: set[str], deps: dict[str, set[str]]) -> set[str]:
    out, todo = set(start), list(start)
    while todo:
        for d in deps.get(todo.pop(), ()):
            if d not in out:
                out.add(d)
                todo.append(d)
    return out


def order(deps: dict[str, set[str]]) -> list[str]:
    """Libraries, each after the ones it needs; raises on a cycle."""
    done, out = set(), []

    def visit(lib: str, path: tuple) -> None:
        if lib in path:
            raise SystemExit(f"import cycle between platform libraries: {' -> '.join(path + (lib,))}")
        if lib not in done:
            for d in sorted(deps[lib]):
                visit(d, path + (lib,))
            done.add(lib)
            out.append(lib)

    for lib in sorted(deps):
        visit(lib, ())
    return out


def write_requirements(folder: Path, deps: dict[str, set[str]], ordered: list[str]) -> None:
    req = folder / "requirements.txt"
    lines = req.read_text(encoding="utf-8").splitlines() if req.exists() else []
    need = closure(imports([folder / "src", folder / "web"], libraries()), deps) - TEST_ONLY
    up = "/".join([".."] * len(folder.relative_to(ROOT).parts))
    head = [f"# {folder.relative_to(ROOT).as_posix()} - library lines are written by scripts/run.sh deps"]
    third = [l for l in lines if l.strip() and not l.startswith(("#", "-e "))]
    req.write_text("\n".join(head + [f"-e {up}/platform/libs/{l}" for l in ordered if l in need] + third) + "\n", encoding="utf-8")


def write_pyprojects(deps: dict[str, set[str]]) -> None:
    """Each library's [project] dependencies: the GrepX libraries it imports + its third-party lines (kept)."""
    for lib, needs in deps.items():
        toml = LIBS_DIR / lib / "pyproject.toml"
        text = toml.read_text(encoding="utf-8")
        block = re.search(r"^dependencies\s*=\s*\[(.*?)\]", text, re.S | re.M)
        third = [d for d in re.findall(r'"([^"]+)"', block.group(1)) if d not in deps]
        items = sorted(needs) + third
        body = "[" + ("\n" + "".join(f'    "{d}",\n' for d in items) if items else "") + "]"
        toml.write_text(text[:block.start()] + "dependencies = " + body + text[block.end():], encoding="utf-8")


def main() -> int:
    deps = graph()
    ordered = order(deps)
    write_pyprojects(deps)
    from workspace import registry
    for name, svc in registry().items():
        if (svc["path"] / "src").exists():
            write_requirements(svc["path"], deps, ordered)
    root = ROOT / "requirements.txt"
    third = [l for l in root.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith(("#", "-e "))]
    root.write_text("\n".join(["# Every platform library + tooling in one environment (scripts/setup.sh)."] +
                              [f"-e platform/libs/{l}" for l in ordered] + third) + "\n", encoding="utf-8")
    say("OK", "deps", f"{len(ordered)} libraries, no cycles; requirements written")
    return 0


if __name__ == "__main__":
    sys.exit(main())

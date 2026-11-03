"""The platform libraries never import each other in a cycle (phase 1 gate)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))

import deps  # noqa: E402


def test_platform_libraries_have_no_import_cycle():
    graph = deps.graph()
    ordered = deps.order(graph)          # raises SystemExit on a cycle
    assert ordered.index("grepx-config") < ordered.index("nexus-client") < ordered.index("grepx-service")
    assert "grepx-service" not in deps.closure({"nexus-client"}, graph)


def test_each_library_declares_exactly_the_libraries_it_imports():
    import reqs
    graph = deps.graph()
    for lib, needs in graph.items():
        declared = {d for d in reqs.install_requires(deps.LIBS_DIR / lib) if d in graph}
        assert declared == needs, f"{lib}/pyproject.toml lists {sorted(declared)} but imports {sorted(needs)}"

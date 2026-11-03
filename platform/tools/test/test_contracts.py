"""Phase 2 gate: contracts are current, and no code outside a service types its name or its tables."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grepx_tools"))

import contracts  # noqa: E402
import lint_contracts  # noqa: E402


def test_generated_contracts_match_the_services():
    assert contracts.main(check=True) == 0, "run scripts/run.sh contracts"


def test_no_service_or_table_name_is_typed_outside_its_contract():
    assert lint_contracts.offences() == []

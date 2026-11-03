# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""SUBMIT state machine - a copy of the C++ nexus_server's (libs/statemachine/transaction_transitions.hpp).

A new row may start with any status; an existing row may only move along these edges.
INSERT is not checked (plain upsert), exactly like the C++ server.
"""
from __future__ import annotations

from typing import Optional

TRANSITIONS = frozenset({
    ("NEW", "CLAIMED"), ("NEW", "REJECTED"),
    ("CLAIMED", "ACCEPTED"), ("CLAIMED", "REJECTED"), ("CLAIMED", "NEW"),
    ("ACCEPTED", "PROCESSING"), ("ACCEPTED", "REJECTED"),
    ("PROCESSING", "COMPLETED"), ("PROCESSING", "FAILED"),
})


class TransitionPolicy:
    def __init__(self, transitions=TRANSITIONS):
        self.transitions = transitions

    def check(self, current: Optional[str], target: str) -> Optional[str]:
        """None when legal, otherwise an error code (the C++ server answers ERR invalid transition)."""
        if current is None:
            return None
        if (current, target) not in self.transitions:
            return f"ILLEGAL_TRANSITION {current}->{target}"
        return None

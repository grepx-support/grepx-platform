# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Generic NexusApplication factory shared by every plain subscriber service."""
from __future__ import annotations

from .application import NexusApplication
from .impl.nexus_client import NexusClient


def create_app(application_name: str, snapshot_table: str, access_mode: str = "ALL",
                host: str | None = None, port: int | None = None) -> NexusApplication:
    return NexusApplication(
        client=NexusClient(application_name=application_name, access_mode=access_mode,
                            host=host, port=port),
        snapshot_table=snapshot_table,
    )

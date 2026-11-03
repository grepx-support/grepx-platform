"""nexus_testkit - an in-memory stand-in for the Nexus hub, for unit tests only.

Same row model as the C++ nexus_server (one latest row per key per table, version CAS,
outbox per transition, criteria filters), so service tests run without a server:
    from nexus_testkit import MemoryClient
The real hub is always the C++ binary in platform/nexus-server/bin/.
"""
from .engine import NexusEngine
from .memory import MemoryClient

__all__ = ["NexusEngine", "MemoryClient"]

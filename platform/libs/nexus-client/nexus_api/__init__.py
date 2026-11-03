"""Everything a client needs to connect to nexus_server - the single door.

    from nexus_api import NexusClient, NexusApplication, RecoveringSubscriber, Row

Configuration lives in grepx_config, running a service in grepx_service; this package only talks to Nexus.
"""
from .app_factory import create_app
from .application import NexusApplication, RecoveringSubscriber
from .impl.nexus_client import NexusClient
from .interfaces import ClientInterface, ConnectionInterface
from .fields import RowField
from .heartbeat import HEALTH_TABLE, Heartbeat, is_stale
from .models import Row, Subscription
from .status import RowStatus

__all__ = [
    "NexusClient",
    "NexusApplication",
    "RecoveringSubscriber",
    "Row",
    "Subscription",
    "ClientInterface",
    "ConnectionInterface",
    "create_app",
    "RowStatus",
    "RowField",
    "Heartbeat",
    "HEALTH_TABLE",
    "is_stale",
]

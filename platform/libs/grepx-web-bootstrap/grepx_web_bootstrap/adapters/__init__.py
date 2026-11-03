"""Registry of known adapters, in preference order. Add a new framework
by writing one adapter class and appending it here - nothing else changes.
"""
from .base import ServerAdapter
from .fastapi_adapter import FastAPIAdapter
from .flask_adapter import FlaskAdapter
from .wsgi_adapter import WsgiAdapter

ADAPTERS = [FastAPIAdapter(), FlaskAdapter(), WsgiAdapter()]  # WSGI last: any plain callable

__all__ = ["ServerAdapter", "FastAPIAdapter", "FlaskAdapter", "WsgiAdapter", "ADAPTERS"]

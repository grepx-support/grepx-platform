"""grepx_store - a service's private database, chosen by configuration, not code.

    store = open_store(database_url(cfg))      # sqlite:///... | postgresql://... | mongodb://... | memory://
    store.put("credentials", user_id, {...}); store.get(...); store.find("credentials", email="a@b"); store.delete(...)

Which database a service uses is resolved (first match wins):
  1. env DATABASE_URL_<SERVICE_NAME> (e.g. DATABASE_URL_AUTH_SERVICE), then env DATABASE_URL
  2. the service's config/config.yaml   database: { url: ... }
  3. the project's config/projects/<project>.yaml   database: { url: ... }
  4. config/common.yaml   database: { url: ... }        ({service} in a URL becomes the service name)
"""
from .registry import store_for
from .setup import ensure_schema
from .resolve import database_url, engine_of
from .stores import DocumentStore, MemoryStore, MongoStore, PostgresStore, SqliteStore, open_store

__all__ = ["store_for", "ensure_schema", "database_url", "engine_of", "DocumentStore", "MemoryStore", "MongoStore", "PostgresStore", "SqliteStore", "open_store"]

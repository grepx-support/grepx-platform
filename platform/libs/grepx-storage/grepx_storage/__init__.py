"""grepx_storage — blob storage strategy (local disk or S3-compatible), shared by BFFs and media-service.

    store = storage_from_env()        # MEDIA_STORAGE=local|s3
    store.put("staging/ab.bin", data); store.get(key); store.delete(key); store.url(key)
"""
from .storage import LocalStorage, S3Storage, Storage, storage_from_env

__all__ = ["Storage", "LocalStorage", "S3Storage", "storage_from_env"]

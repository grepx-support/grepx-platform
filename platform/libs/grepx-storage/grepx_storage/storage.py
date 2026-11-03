# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Storage strategy: one interface, local and S3 implementations, chosen by env."""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional


class Storage(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None: ...

    @abstractmethod
    def get(self, key: str) -> Optional[bytes]: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    def url(self, key: str) -> Optional[str]:
        """Public URL when the backend serves files itself; None means 'serve through the BFF'."""
        return None


class LocalStorage(Storage):
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("key escapes storage root")
        return path

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> Optional[bytes]:
        path = self._path(key)
        return path.read_bytes() if path.exists() else None

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3Storage(Storage):
    def __init__(self, bucket: str, public_url: str = "", **client_kwargs):
        import boto3
        self.bucket, self.public_url = bucket, public_url.rstrip("/")
        self.s3 = boto3.client("s3", **{k: v for k, v in client_kwargs.items() if v})

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> Optional[bytes]:
        try:
            return self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except Exception:
            return None

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def url(self, key: str) -> Optional[str]:
        return f"{self.public_url}/{key}" if self.public_url else None


def storage_from_env() -> Storage:
    if os.environ.get("MEDIA_STORAGE", "local") == "s3":
        return S3Storage(os.environ["S3_BUCKET"], os.environ.get("S3_PUBLIC_URL", ""),
                         endpoint_url=os.environ.get("S3_ENDPOINT_URL"), region_name=os.environ.get("S3_REGION"),
                         aws_access_key_id=os.environ.get("S3_ACCESS_KEY"), aws_secret_access_key=os.environ.get("S3_SECRET_KEY"))
    from grepx_config import workspace_root
    root = os.environ.get("UPLOAD_DIR") or str(workspace_root() / "data" / "uploads")
    return LocalStorage(root)

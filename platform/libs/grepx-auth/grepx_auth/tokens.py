"""TokenService over a swappable TokenStrategy (JWT today; opaque/OAuth later)."""
from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from typing import Any

import jwt


class InvalidToken(ValueError):
    pass


class TokenStrategy(ABC):
    @abstractmethod
    def encode(self, claims: dict) -> str: ...

    @abstractmethod
    def decode(self, token: str) -> dict: ...


class JwtStrategy(TokenStrategy):
    def __init__(self, secret: str, algorithm: str = "HS256"):
        self.secret, self.algorithm = secret, algorithm

    def encode(self, claims: dict) -> str:
        return jwt.encode(claims, self.secret, algorithm=self.algorithm)

    def decode(self, token: str) -> dict:
        try:
            return jwt.decode(token, self.secret, algorithms=[self.algorithm])
        except jwt.PyJWTError as exc:
            raise InvalidToken(str(exc)) from exc


class TokenService:
    def __init__(self, strategy: TokenStrategy, access_hours: float = 12.0):
        self.strategy, self.access_hours = strategy, access_hours

    @classmethod
    def from_env(cls) -> "TokenService":
        return cls(JwtStrategy(os.environ.get("JWT_SECRET") or "dev-only-secret-change-me"),
                   float(os.environ.get("ACCESS_TOKEN_HOURS", "12")))

    def issue(self, claims: dict[str, Any], hours: float | None = None, kind: str = "access") -> str:
        now = int(time.time())
        return self.strategy.encode({**claims, "kind": kind, "iat": now, "exp": now + int((hours or self.access_hours) * 3600)})

    def verify(self, token: str, kind: str = "access") -> dict:
        claims = self.strategy.decode(token or "")
        if claims.get("kind") != kind:
            raise InvalidToken("wrong token kind")
        return claims

"""The role ladder, from config `roles:` — products name the roles, code never does.

    roles:
      member: donor            # every new account; long "remember me" sessions allowed
      staff: [volunteer, admin]
      admin: admin             # holds every permission ("*")
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Roles:
    member: str = "member"
    staff: tuple = ("staff", "admin")
    admin: str = "admin"

    @classmethod
    def of(cls, cfg: Any) -> "Roles":
        raw = (cfg.get("roles") if hasattr(cfg, "get") else None) or {}
        admin = str(raw.get("admin") or cls.admin)
        staff = tuple(raw.get("staff") or cls.staff)
        return cls(str(raw.get("member") or cls.member), staff if admin in staff else staff + (admin,), admin)

    @property
    def all(self) -> tuple:
        return (self.member,) + self.staff

    def is_staff(self, role: str) -> bool:
        return role in self.staff

    def effective_permissions(self, role: str, personal, role_perms) -> list[str]:
        if role == self.admin:
            return ["*"]
        return sorted(set(personal) | set(role_perms)) if self.is_staff(role) else []

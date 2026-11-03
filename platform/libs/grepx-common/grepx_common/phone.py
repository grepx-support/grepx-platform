# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""Phone numbers stored as E.164 (+6591234567) so search, WhatsApp and SMS all agree.

The home country is a deployment setting (the product deployment file, see grepx_config.common):
    phone:
      country: "65"              # calling code for numbers written without +
      local: "[3689]\\d{7}"      # what a local number looks like
      example: "9123 4567"
Other countries are accepted when written with + and their calling code.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache


class PhoneError(ValueError):
    pass


@dataclass(frozen=True)
class PhoneRules:
    country: str = ""
    local: str = r"\d{6,12}"
    example: str = ""

    @property
    def help(self) -> str:
        sample = f" (e.g. {self.example})" if self.example else ""
        return f"Use a local number{sample}. Overseas: start with + and the country code."


@lru_cache(maxsize=1)
def rules() -> PhoneRules:
    from grepx_config import common  # common.yaml + the product deployment file
    raw = common().get("phone") or {}
    return PhoneRules(str(raw.get("country") or ""), str(raw.get("local") or PhoneRules.local), str(raw.get("example") or ""))


class Phone:
    ALLOWED = re.compile(r"^[\d\s\-().+]+$")
    BAD_CHARS = "Phone numbers can only contain digits, spaces or dashes (and + at the start)."

    @classmethod
    def normalize(cls, raw, r: PhoneRules | None = None) -> str:
        r = r or rules()
        if isinstance(raw, float) and raw.is_integer():
            raw = int(raw)  # Excel stores 91234567 as 91234567.0
        s = str(raw or "").strip()
        if not s:
            raise PhoneError("Phone number is required.")
        if s.startswith("00"):
            s = "+" + s[2:]
        s = s.replace("(", "").replace(")", "").strip() if cls.ALLOWED.match(s) else ""
        if not s or "+" in s[1:]:
            raise PhoneError(cls.BAD_CHARS)
        digits = re.sub(r"\D", "", s)
        if s.startswith("+") and not (r.country and digits.startswith(r.country)):
            if 8 <= len(digits) <= 15:
                return "+" + digits
            raise PhoneError("Overseas numbers need 8 to 15 digits including the country code.")
        local = digits[len(r.country):] if r.country and digits.startswith(r.country) and not re.fullmatch(r.local, digits) else digits
        if not r.country or not re.fullmatch(r.local, local):
            raise PhoneError(r.help)
        return "+" + r.country + local

    @classmethod
    def clean_or_none(cls, raw):
        try:
            return cls.normalize(raw)
        except PhoneError:
            return None

    @classmethod
    def pretty(cls, value) -> str:
        """+6591234567 -> +65 9123 4567 for home numbers (anything else is shown as stored)."""
        v, cc = str(value or ""), rules().country
        m = re.fullmatch(rf"\+{cc}(\d{{4}})(\d{{4}})", v) if cc else None
        return f"+{cc} {m[1]} {m[2]}" if m else v

    @staticmethod
    def digits(q) -> str:
        """Digits of a search box entry, so '9123 4567' finds +6591234567."""
        return re.sub(r"\D", "", q or "")

    @classmethod
    def like(cls, q) -> str:
        d = cls.digits(q)
        return f"%{d}%" if len(d) >= 3 else "~no-match~"

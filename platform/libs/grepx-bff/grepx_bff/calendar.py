# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""iCalendar (.ics) rendering for downloads and subscription feeds; time zone and naming come from the deployment."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.parse import urlparse

from grepx_config.deployment import org_name, site_url, timezone as local_zone


@dataclass
class IcsEvent:
    uid: str
    title: str
    start: datetime | date
    end: datetime | date
    location: str = ""
    description: str = ""


class IcsCalendar:
    def __init__(self, org: str = ""):
        self.org = org or org_name() or "Calendar"
        self.zone = local_zone().key
        self.domain = urlparse(site_url()).hostname or "localhost"

    def render(self, events, name: str | None = None) -> str:
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:-//{self._esc(self.org)}//EN", "CALSCALE:GREGORIAN",
                 f"X-WR-CALNAME:{self._esc(name or self.org)}", f"X-WR-TIMEZONE:{self.zone}"]
        for e in events:
            lines += self._event(e)
        return "\r\n".join(lines + ["END:VCALENDAR"]) + "\r\n"

    def _event(self, e: IcsEvent) -> list[str]:
        return ["BEGIN:VEVENT", f"UID:{e.uid}@{self.domain}", f"DTSTAMP:{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
                self._dt("DTSTART", e.start), self._dt("DTEND", e.end), f"SUMMARY:{self._esc(e.title)}",
                f"LOCATION:{self._esc(e.location)}", f"DESCRIPTION:{self._esc(e.description)}", "END:VEVENT"]

    def _dt(self, key: str, v) -> str:
        if isinstance(v, datetime):
            return f"{key};TZID={self.zone}:{v:%Y%m%dT%H%M%S}"
        return f"{key};VALUE=DATE:{v:%Y%m%d}"

    @staticmethod
    def _esc(s) -> str:
        return (s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

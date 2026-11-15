# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""A finished PDF and the two ways it leaves the BFF: shown in the browser, or attached to a message (email carries the
bytes; WhatsApp through Twilio fetches the same file from a link that works for 14 days)."""
from __future__ import annotations

import base64
from dataclasses import dataclass

from fastapi.responses import Response
from ..shared_files import publish, safe_name


@dataclass(frozen=True)
class PdfFile:
    data: bytes
    name: str            # without .pdf

    @property
    def filename(self) -> str:
        return f"{safe_name(self.name)}.pdf"

    def response(self) -> Response:
        return Response(self.data, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{self.filename}"'})

    def attachment(self, storage) -> dict:
        return {"name": self.filename, "mime": "application/pdf", "data_b64": base64.b64encode(self.data).decode(),
                "url": publish(storage, self.data, self.filename)}

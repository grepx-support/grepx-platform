# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

from typing import Any

from .base import ServerAdapter


class FlaskAdapter(ServerAdapter):
    @staticmethod
    def supports(app: Any) -> bool:
        return type(app).__module__.startswith("flask")

    def serve(self, app: Any, host: str, port: int) -> None:
        app.run(host=host, port=port)

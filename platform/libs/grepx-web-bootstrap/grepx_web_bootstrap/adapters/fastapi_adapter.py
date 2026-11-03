# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

from typing import Any

from .base import ServerAdapter


class FastAPIAdapter(ServerAdapter):
    @staticmethod
    def supports(app: Any) -> bool:
        return type(app).__module__.startswith("fastapi")

    def serve(self, app: Any, host: str, port: int) -> None:
        import uvicorn
        uvicorn.run(app, host=host, port=port)

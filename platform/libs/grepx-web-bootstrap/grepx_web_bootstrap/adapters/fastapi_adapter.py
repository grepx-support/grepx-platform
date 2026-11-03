from typing import Any

from .base import ServerAdapter


class FastAPIAdapter(ServerAdapter):
    @staticmethod
    def supports(app: Any) -> bool:
        return type(app).__module__.startswith("fastapi")

    def serve(self, app: Any, host: str, port: int) -> None:
        import uvicorn
        uvicorn.run(app, host=host, port=port)

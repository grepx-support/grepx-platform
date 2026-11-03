from typing import Any

from .base import ServerAdapter


class FlaskAdapter(ServerAdapter):
    @staticmethod
    def supports(app: Any) -> bool:
        return type(app).__module__.startswith("flask")

    def serve(self, app: Any, host: str, port: int) -> None:
        app.run(host=host, port=port)

"""
Local dev entry point.

Local:
    python server.py

Production (Render):
    python server.py
"""

import os
import uvicorn

from app.config.settings import settings


class DevServer:
    # Wraps uvicorn for local development

    def __init__(self, host: str, port: int, reload: bool) -> None:
        self._host = host
        self._port = port
        self._reload = reload

    def run(self) -> None:
        uvicorn.run(
            "app.main:app",
            host=self._host,
            port=self._port,
            reload=self._reload,
            reload_dirs=["app"] if self._reload else None,
        )


if __name__ == "__main__":
    # Use the port Render provides, or fall back to 8000 for local dev
    port = int(os.environ.get("PORT", 8000))
    
    dev = DevServer(
        host="0.0.0.0" if settings.is_production else "127.0.0.1",
        port=port,
        reload=settings.is_development,
    )
    dev.run()
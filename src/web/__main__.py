"""Run via `python -m web` (with PYTHONPATH=src).

Binds to 127.0.0.1 by default — remote access goes through SSH tunnel:
    ssh -L 8765:localhost:8765 user@host
"""

import os

import uvicorn


def main() -> None:
    host = os.environ.get("BLACKBOX_WEB_HOST", "127.0.0.1")
    port = int(os.environ.get("BLACKBOX_WEB_PORT", "8765"))
    uvicorn.run(
        "web.application:get_app",
        factory=True,
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()

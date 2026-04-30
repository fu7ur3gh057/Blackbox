"""Pull web.user / web.jwt out of config and onto broker.state.

Called from main._run before the FastAPI server starts. Both worker-only
and worker+web modes call init_db; only the web mode calls init_auth, so
the JWT secret never ends up loaded for a CLI-only deployment.
"""

import logging
import secrets

from config import Config
from services.taskiq.broker import broker

log = logging.getLogger(__name__)

_DEFAULT_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days


def init_auth(config: Config) -> None:
    web = config.web or {}

    user_cfg = web.get("user") or {}
    if user_cfg.get("username") and user_cfg.get("password_hash"):
        broker.state.web_user = {
            "username": user_cfg["username"],
            "password_hash": user_cfg["password_hash"],
        }
    else:
        broker.state.web_user = None
        log.warning(
            "web: no admin user in config.web.user — login disabled. "
            "Re-run `make setup` to create one."
        )

    jwt_cfg = web.get("jwt") or {}
    secret = jwt_cfg.get("secret")
    if not secret:
        secret = secrets.token_hex(32)
        log.warning(
            "web: jwt secret auto-generated — sessions reset on every restart. "
            "Add web.jwt.secret to config.yaml to persist (or re-run make setup)."
        )
    broker.state.web_jwt_secret = secret
    broker.state.web_jwt_expiry = int(jwt_cfg.get("expiry_seconds", _DEFAULT_EXPIRY_SECONDS))

    # Terminal auth is now PAM-based against system users — no separate
    # creds in config.yaml. The terminal_token_ttl knob still controls
    # how long an unlock-token stays valid before auto-relock.
    term_cfg = (web.get("terminal") or {})
    broker.state.terminal_enabled = bool(term_cfg.get("enabled"))
    broker.state.terminal_token_ttl = int(term_cfg.get("token_ttl", 1800))

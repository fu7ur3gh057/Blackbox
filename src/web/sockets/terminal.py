"""In-browser shell: PTY pump over a Socket.IO namespace.

Each client connection forks a PTY and execs the configured shell.
Bytes coming from the browser (`terminal:input`) write straight into the
pty master; bytes coming out of the pty are emitted back as
`terminal:output`. Window resize comes in as `terminal:resize` and is
forwarded via TIOCSWINSZ.

Three guardrails baked in:

  - **opt-in**: the namespace is registered only when
    `web.terminal.enabled: true` is set in config.yaml, so a default
    install doesn't expose a root shell to anyone with the JWT cookie.
  - **single session per user**: a second connect with the same username
    is refused — keeps fork bombs / stuck handles bounded.
  - **audit**: every input chunk is persisted to `terminal_audit`. The
    open / close / kill events are also written, plus an alert is fired
    so the operator sees session activity in `RecentAlertsFeed`.
"""

from __future__ import annotations

import asyncio
import fcntl
import logging
import os
import pty
import signal
import struct
import subprocess
import termios
import time

from socketio import AsyncNamespace

from services.taskiq.broker import broker
from web.auth.tokens import decode_token

log = logging.getLogger(__name__)


class _Session:
    """One PTY + child process pair. Owned by a single sid."""

    __slots__ = ("master_fd", "proc", "username", "started_at", "_loop")

    def __init__(self, master_fd: int, proc: subprocess.Popen, username: str) -> None:
        self.master_fd = master_fd
        self.proc = proc
        self.username = username
        self.started_at = time.time()
        self._loop: asyncio.AbstractEventLoop | None = None

    def write(self, data: bytes) -> None:
        try:
            os.write(self.master_fd, data)
        except OSError:
            pass

    def resize(self, cols: int, rows: int) -> None:
        try:
            fcntl.ioctl(
                self.master_fd,
                termios.TIOCSWINSZ,
                struct.pack("HHHH", rows, cols, 0, 0),
            )
        except OSError:
            pass

    def close(self) -> None:
        try:
            if self.proc.poll() is None:
                # Send SIGHUP to the whole session so backgrounded jobs go too.
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGHUP)
                except (OSError, ProcessLookupError):
                    pass
                try:
                    self.proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self.proc.kill()
        except Exception:
            pass
        try:
            os.close(self.master_fd)
        except OSError:
            pass


class TerminalNamespace(AsyncNamespace):
    """Single-session-per-user PTY bridge.

    JWT auth is the same as `AuthedNamespace` but we duplicate the body
    here because we also need to remember the username on the session
    object (for audit + single-session enforcement).
    """

    def __init__(self, namespace: str = "/terminal") -> None:
        super().__init__(namespace)
        self._sessions: dict[str, _Session] = {}        # sid → session
        self._user_to_sid: dict[str, str] = {}          # username → sid (single-session lock)

    # ── connect ──────────────────────────────────────────────────────

    async def on_connect(self, sid: str, environ: dict, auth: dict | None = None) -> bool | None:
        secret = broker.state.data.get("web_jwt_secret")
        if not secret:
            log.warning("terminal: refusing %s — auth not configured", sid)
            return False

        token = _extract_token(auth, environ)
        if not token:
            log.info("terminal: refusing %s — no token", sid)
            return False
        try:
            from jwt import InvalidTokenError
            try:
                claims = decode_token(token, secret)
            except InvalidTokenError as e:
                log.info("terminal: refusing %s — bad token: %s", sid, e)
                return False
        except Exception:
            log.exception("terminal: token decode crashed")
            return False

        username = claims.get("sub", "")

        # Single-session lock — refuse if user already has a session.
        existing = self._user_to_sid.get(username)
        if existing and existing in self._sessions:
            log.info("terminal: refusing %s — %s already has session %s", sid, username, existing)
            await _audit("denied", sid, username, "another session active")
            return False

        cfg = _terminal_cfg()
        shell = cfg.get("shell", "/bin/bash")
        cwd = cfg.get("cwd", "/")
        env = {
            **os.environ,
            "TERM": "xterm-256color",
            "COLORTERM": "truecolor",
            "LANG": os.environ.get("LANG", "C.UTF-8"),
        }

        try:
            master_fd, slave_fd = pty.openpty()
            # Sane initial size — client will TIOCSWINSZ on its first frame.
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))
            proc = subprocess.Popen(
                [shell, "-i"],
                stdin=slave_fd, stdout=slave_fd, stderr=slave_fd,
                preexec_fn=os.setsid,           # new session → killpg works on shutdown
                cwd=cwd if os.path.isdir(cwd) else None,
                env=env,
                close_fds=True,
            )
            os.close(slave_fd)
            fcntl.fcntl(master_fd, fcntl.F_SETFL, os.O_NONBLOCK)
        except Exception:
            log.exception("terminal: failed to spawn shell")
            return False

        sess = _Session(master_fd=master_fd, proc=proc, username=username)
        self._sessions[sid] = sess
        self._user_to_sid[username] = sid
        await self.save_session(sid, {"username": username})

        loop = asyncio.get_running_loop()
        sess._loop = loop
        loop.add_reader(master_fd, lambda: asyncio.create_task(self._on_pty_readable(sid)))

        log.info("terminal: %s opened for %s (pid=%s, shell=%s)", sid, username, proc.pid, shell)
        await _audit("open", sid, username, f"shell={shell} cwd={cwd}")
        await _alert("terminal_open", username,
                     f"web terminal session opened ({shell})")
        return None

    # ── disconnect ───────────────────────────────────────────────────

    async def on_disconnect(self, sid: str) -> None:
        sess = self._sessions.pop(sid, None)
        if not sess:
            return
        # Drop the user-lock if it pointed at this sid.
        if self._user_to_sid.get(sess.username) == sid:
            self._user_to_sid.pop(sess.username, None)

        loop = sess._loop
        if loop is not None:
            try:
                loop.remove_reader(sess.master_fd)
            except (ValueError, OSError):
                pass

        sess.close()
        duration = int(time.time() - sess.started_at)
        log.info("terminal: %s closed for %s (duration=%ds)", sid, sess.username, duration)
        await _audit("close", sid, sess.username, f"duration={duration}s")
        await _alert("terminal_close", sess.username,
                     f"web terminal session ended ({duration}s)")

    # ── client → server ──────────────────────────────────────────────

    async def on_input(self, sid: str, data: dict) -> None:
        sess = self._sessions.get(sid)
        if not sess:
            return
        chunk = (data or {}).get("data") if isinstance(data, dict) else None
        if not isinstance(chunk, str):
            return
        sess.write(chunk.encode("utf-8", errors="replace"))
        # Audit the raw chunk — includes whatever was typed, no scrubbing.
        await _audit("input", sid, sess.username, chunk)

    async def on_resize(self, sid: str, data: dict) -> None:
        sess = self._sessions.get(sid)
        if not sess:
            return
        cols = int((data or {}).get("cols") or 80)
        rows = int((data or {}).get("rows") or 24)
        cols = max(2, min(500, cols))
        rows = max(2, min(200, rows))
        sess.resize(cols=cols, rows=rows)

    # ── pty → client ─────────────────────────────────────────────────

    async def _on_pty_readable(self, sid: str) -> None:
        sess = self._sessions.get(sid)
        if not sess:
            return
        try:
            data = os.read(sess.master_fd, 4096)
        except (OSError, ValueError):
            data = b""
        if not data:
            # EOF — child exited. Tell client and disconnect.
            try:
                await self.emit("terminal:exit", {"reason": "child exited"}, room=sid)
            except Exception:
                pass
            try:
                await self.disconnect(sid)
            except Exception:
                pass
            return
        try:
            await self.emit("terminal:output", {"data": data.decode("utf-8", "replace")}, room=sid)
        except Exception:
            log.exception("terminal: emit failed")


# ── helpers ───────────────────────────────────────────────────────────


def _terminal_cfg() -> dict:
    ctx = broker.state.data.get("app_ctx")
    if ctx is None:
        return {}
    return ((getattr(ctx.config, "web", None) or {}).get("terminal") or {})


def _extract_token(auth: dict | None, environ: dict) -> str | None:
    if isinstance(auth, dict) and auth.get("token"):
        return str(auth["token"])
    cookies = environ.get("HTTP_COOKIE", "")
    for piece in cookies.split(";"):
        piece = piece.strip()
        if piece.startswith("bb_session="):
            return piece[len("bb_session="):]
    return None


async def _audit(kind: str, sid: str, username: str, data: str | None) -> None:
    """Persist one audit row. Truncates to 4 KB so a paste-bomb doesn't
    bloat the table; if the user pastes a giant blob we still get the
    head + a marker."""
    from db.models import TerminalAuditEntry

    sm = broker.state.data.get("db_session_maker")
    if sm is None:
        return
    try:
        async with sm() as session:
            session.add(TerminalAuditEntry(
                ts=time.time(),
                sid=sid,
                username=username,
                kind=kind,
                data=(data[:4096] + "…[truncated]" if data and len(data) > 4096 else data),
            ))
            await session.commit()
    except Exception:
        log.exception("terminal: audit insert failed (kind=%s)", kind)


async def _alert(kind: str, username: str, detail: str) -> None:
    """Fire an alert event so the lifecycle shows up in RecentAlertsFeed."""
    from db.models import AlertEvent

    sm = broker.state.data.get("db_session_maker")
    if sm is None:
        return
    try:
        async with sm() as session:
            row = AlertEvent(
                ts=time.time(),
                name=f"terminal:{username}",
                level="ok" if kind != "kill" else "warn",
                kind=kind,
                detail=detail,
                metrics=None,
            )
            session.add(row)
            await session.commit()
    except Exception:
        log.exception("terminal: alert insert failed (kind=%s)", kind)

    # Also push live so the right column highlights without polling.
    from web.sockets import emit
    try:
        await emit("/alerts", "alert:fired", {
            "ts": time.time(),
            "name": f"terminal:{username}",
            "level": "ok" if kind != "kill" else "warn",
            "kind": kind,
            "detail": detail,
            "metrics": None,
        })
    except Exception:
        pass

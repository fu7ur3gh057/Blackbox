"""/logs namespace.

Server emits:
  - `log:line`   per matching log line LogProcessor records (broadcast +
    per-source room `src:<source>`).
  - `log:digest` after the periodic dedup digest fires.

Client emits:
  - `subscribe`   `{source}` → join `src:<source>` room
  - `unsubscribe` `{source}` → leave it
"""

from web.sockets.namespaces.base import AuthedNamespace


class LogsNamespace(AuthedNamespace):
    async def on_subscribe(self, sid: str, data: dict) -> dict:
        source = data.get("source") if isinstance(data, dict) else None
        if not source:
            return {"ok": False, "error": "missing source"}
        room = f"src:{source}"
        await self.enter_room(sid, room)
        return {"ok": True, "room": room}

    async def on_unsubscribe(self, sid: str, data: dict) -> dict:
        source = data.get("source") if isinstance(data, dict) else None
        if source:
            await self.leave_room(sid, f"src:{source}")
        return {"ok": True}

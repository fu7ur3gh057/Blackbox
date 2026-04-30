"""/checks namespace.

Server emits:
  - `check:result`  every time a `run_check` task finishes (broadcast +
    per-check room `check:<name>` so a check-detail page only sees the
    one it cares about).

Client emits:
  - `subscribe`     `{name}` → join `check:<name>` room
  - `unsubscribe`   `{name}` → leave it
"""

import logging

from web.sockets.namespaces.base import AuthedNamespace

log = logging.getLogger(__name__)


class ChecksNamespace(AuthedNamespace):
    async def on_subscribe(self, sid: str, data: dict) -> dict:
        name = data.get("name") if isinstance(data, dict) else None
        if not name:
            return {"ok": False, "error": "missing name"}
        room = f"check:{name}"
        await self.enter_room(sid, room)
        return {"ok": True, "room": room}

    async def on_unsubscribe(self, sid: str, data: dict) -> dict:
        name = data.get("name") if isinstance(data, dict) else None
        if name:
            await self.leave_room(sid, f"check:{name}")
        return {"ok": True}

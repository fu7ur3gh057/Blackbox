"""/system namespace — reserved for periodic VPS snapshot pushes.

For now there's nothing emitting here automatically; the dashboard polls
GET /api/system every few seconds. Once we wire a periodic emitter it
will land on this namespace as `system:tick`.
"""

from web.sockets.namespaces.base import AuthedNamespace


class SystemNamespace(AuthedNamespace):
    pass

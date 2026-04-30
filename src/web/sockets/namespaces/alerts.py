"""/alerts namespace — server pushes `alert:fired` whenever send_alert
runs. Read-only on the client side; no events to handle inbound."""

from web.sockets.namespaces.base import AuthedNamespace


class AlertsNamespace(AuthedNamespace):
    pass

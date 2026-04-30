/**
 * Socket.IO client factory. One Manager per namespace, mounted at
 * `/blackbox/ws/socket.io` (path is also routed through Next dev rewrites).
 *
 * Auth: cookie-based (the bb_session cookie set on /api/auth/login). We
 * pass `withCredentials: true` so the WS handshake includes it.
 * AuthedNamespace.on_connect picks it up server-side via HTTP_COOKIE.
 */

import { io, Socket } from "socket.io-client";

const SOCKET_PATH = "/blackbox/ws/socket.io";

export type Namespace = "/alerts" | "/checks" | "/logs" | "/system";

export function connectNamespace(ns: Namespace): Socket {
  return io(`${window.location.origin}${ns}`, {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
}

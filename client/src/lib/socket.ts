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

/**
 * Browsers reject `0.0.0.0` as a WebSocket destination — it's a bind-only
 * address, valid for servers but not for clients. If the page is opened
 * via that URL, fall back to `localhost` so the socket can still connect.
 */
function safeOrigin(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.origin);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return `${url.protocol}//${url.host}`;
}

export function connectNamespace(ns: Namespace): Socket {
  return io(`${safeOrigin()}${ns}`, {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
}

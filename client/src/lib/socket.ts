/**
 * Socket.IO client factory with ref-counted sharing.
 *
 * Multiple components subscribe to the same namespace (e.g. /docker is
 * used by both `useDockerSnapshot` and `EventsTicker`). socket.io-client
 * returns the SAME Socket instance per namespace — so if one component
 * calls `sock.disconnect()` in its cleanup, every other listener loses
 * the channel. Instead, callers `release()` the namespace and we tear
 * the socket down only when the last subscriber unsubscribes.
 *
 * Auth: cookie-based (the bb_session cookie set on /api/auth/login). We
 * pass `withCredentials: true` so the WS handshake includes it.
 * AuthedNamespace.on_connect picks it up server-side via HTTP_COOKIE.
 */

import { io, Socket } from "socket.io-client";

const SOCKET_PATH = "/blackbox/ws/socket.io";

export type Namespace = "/alerts" | "/checks" | "/docker" | "/logs" | "/system" | "/terminal";

interface SharedEntry {
  sock: Socket;
  refCount: number;
}

const shared: Partial<Record<Namespace, SharedEntry>> = {};

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

/**
 * Acquire a shared Socket for the namespace. The caller MUST eventually
 * call `releaseNamespace(ns)` to drop their refcount — typically in the
 * cleanup of the same useEffect that called this.
 */
export function connectNamespace(ns: Namespace): Socket {
  let entry = shared[ns];
  if (!entry) {
    const sock = io(`${safeOrigin()}${ns}`, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    entry = { sock, refCount: 0 };
    shared[ns] = entry;
  }
  entry.refCount++;
  return entry.sock;
}

/**
 * Drop a refcount. Tears the socket down only when nobody else holds it.
 */
export function releaseNamespace(ns: Namespace): void {
  const entry = shared[ns];
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.sock.disconnect();
    delete shared[ns];
  }
}

/**
 * Open a one-shot socket for the /terminal namespace.
 *
 * The auth payload is unique per session — every unlock issues a new
 * token — so we can't use the shared/refcounted socket: by the time the
 * caller sets `sock.auth`, the default `autoConnect: true` has already
 * sent an empty handshake and the server has already refused.
 *
 * Caller is responsible for `.disconnect()` in the cleanup path.
 */
export function openTerminalSocket(terminalToken: string): Socket {
  return io(`${safeOrigin()}/terminal`, {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: { terminal_token: terminalToken },
    forceNew: true,            // never share a Manager with other namespaces
  });
}

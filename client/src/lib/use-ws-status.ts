"use client";

import { useEffect, useState } from "react";
import { connectNamespace, releaseNamespace } from "@/lib/socket";

export type WsState = "connecting" | "online" | "offline";

/**
 * Reflects the realtime WebSocket connection state.
 *
 * Subtle race fix: socket.io's `connect` event can fire before our
 * useEffect's listener attaches (Manager already connected from a sibling
 * widget). After subscribing we explicitly read `sock.connected` and a
 * 5 s heartbeat keeps the state in sync if events get dropped.
 */
export function useWsStatus(): WsState {
  const [state, setState] = useState<WsState>("connecting");

  useEffect(() => {
    const sock = connectNamespace("/alerts");

    const sync = () => setState(sock.connected ? "online" : "offline");
    const onConnect = () => setState("online");
    const onDisconnect = () => setState("offline");
    const onError = () => setState("offline");

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("connect_error", onError);

    // Catch the race: if Manager was already connected, `connect` fired
    // before we got here.
    queueMicrotask(sync);
    const tick = setInterval(sync, 5_000);

    return () => {
      clearInterval(tick);
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("connect_error", onError);
      releaseNamespace("/alerts");
    };
  }, []);

  return state;
}

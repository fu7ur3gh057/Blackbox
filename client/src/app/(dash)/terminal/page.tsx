"use client";

import { connectNamespace, releaseNamespace } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Terminal as TerminalIcon, Zap, ZapOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
// xterm CSS — side-effect import resolved by Next at build time.
import "xterm/css/xterm.css";

/**
 * In-browser PTY view backed by xterm.js. The page is a thin shell
 * around a single namespace `/terminal` — the backend is opt-in
 * (`web.terminal.enabled: true`), so if it's off we render a friendly
 * placeholder rather than letting xterm spin trying to handshake.
 *
 * Layout: sticky header strip with status / disconnect button, the
 * xterm canvas filling the remaining viewport. The fit addon resizes
 * the PTY whenever the container changes (window resize / right-rail
 * toggle), forwarded over WS as `terminal:resize`.
 */
export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "disabled" | "denied" | "closed">("connecting");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | null = null;

    (async () => {
      // Dynamic import — xterm pulls ~150KB and is only needed here.
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("xterm"),
        import("xterm-addon-fit"),
      ]);

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 13,
        theme: {
          background: "#0A0B0F",
          foreground: "#D4D4D8",
          cursor: "#FFFFFF",
          cursorAccent: "#0A0B0F",
          selectionBackground: "rgba(255,255,255,0.20)",
          black: "#0A0B0F",
          red: "#EF4444",
          green: "#84F4A3",
          yellow: "#FBBF24",
          blue: "#C084FC",
          magenta: "#F472B6",
          cyan: "#2DD4BF",
          white: "#E0E0E5",
          brightBlack: "#4D5057",
          brightRed: "#EF4444",
          brightGreen: "#84F4A3",
          brightYellow: "#FBBF24",
          brightBlue: "#C084FC",
          brightMagenta: "#F472B6",
          brightCyan: "#2DD4BF",
          brightWhite: "#FFFFFF",
        },
        allowProposedApi: true,
        scrollback: 5000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);

      const sock = connectNamespace("/terminal");

      const sendResize = () => {
        try {
          fit.fit();
          sock.emit("resize", { cols: term.cols, rows: term.rows });
        } catch {
          /* container not ready yet — next ResizeObserver tick will retry */
        }
      };
      // Initial fit, then sync on every container size change.
      requestAnimationFrame(sendResize);
      const ro = new ResizeObserver(sendResize);
      ro.observe(containerRef.current);

      const onConnect = () => {
        setStatus("open");
        setReason(null);
        sendResize();
      };
      const onConnectError = (err: Error) => {
        // Backend refused — most commonly because the namespace isn't
        // registered (terminal.enabled is false on the server).
        setStatus(err.message?.includes("not exist") || err.message?.includes("Invalid namespace")
          ? "disabled"
          : "denied");
        setReason(err.message || null);
      };
      const onDisconnect = (reason: string) => {
        setStatus("closed");
        setReason(reason);
      };
      const onOutput = (payload: { data: string }) => {
        term.write(payload.data);
      };
      const onExit = (payload: { reason: string }) => {
        term.write(`\r\n\x1b[33m[ session ended: ${payload.reason} ]\x1b[0m\r\n`);
      };

      sock.on("connect", onConnect);
      sock.on("connect_error", onConnectError);
      sock.on("disconnect", onDisconnect);
      sock.on("terminal:output", onOutput);
      sock.on("terminal:exit", onExit);

      term.onData((data) => {
        if (sock.connected) sock.emit("input", { data });
      });

      dispose = () => {
        ro.disconnect();
        sock.off("connect", onConnect);
        sock.off("connect_error", onConnectError);
        sock.off("disconnect", onDisconnect);
        sock.off("terminal:output", onOutput);
        sock.off("terminal:exit", onExit);
        releaseNamespace("/terminal");
        term.dispose();
      };
    })().catch((e) => {
      console.error("terminal init failed", e);
      setStatus("disabled");
      setReason("xterm.js failed to load");
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  return (
    <div className="h-[calc(100vh-136px)] flex flex-col gap-3">
      <Header status={status} reason={reason} />
      <div className="flex-1 min-h-0 rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
        <div ref={containerRef} className="h-full w-full p-2" />
      </div>
      {(status === "disabled" || status === "denied") && (
        <Overlay status={status} reason={reason} />
      )}
    </div>
  );
}

function Header({ status, reason }: { status: string; reason: string | null }) {
  const cfg = {
    connecting: { Icon: Zap,    tone: "text-level-warn",  label: "connecting" },
    open:       { Icon: Zap,    tone: "text-accent-pale", label: "live" },
    closed:     { Icon: ZapOff, tone: "text-ink-mute",    label: "closed" },
    denied:     { Icon: ZapOff, tone: "text-level-crit",  label: "denied" },
    disabled:   { Icon: ZapOff, tone: "text-ink-mute",    label: "disabled" },
  }[status] ?? { Icon: ZapOff, tone: "text-ink-mute", label: status };

  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-accent-green/12 text-accent-pale flex items-center justify-center">
          <TerminalIcon size={14} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[14px] font-semibold text-ink-strong tracking-tight">Terminal</h1>
          <p className="text-[10.5px] font-mono text-ink-mute">
            web shell · single session · audited
          </p>
        </div>
      </div>
      <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px]",
        "bg-white/[0.04] ring-1 ring-white/[0.06]", cfg.tone)}>
        <cfg.Icon size={11} />
        <span className="uppercase tracking-[0.16em]">{cfg.label}</span>
        {reason && status !== "open" && (
          <span className="text-ink-mute text-[10px] ml-1 truncate max-w-[200px]">
            · {reason}
          </span>
        )}
      </div>
    </div>
  );
}

function Overlay({ status, reason }: { status: "disabled" | "denied"; reason: string | null }) {
  const txt = status === "disabled"
    ? {
        title: "Terminal disabled",
        body:
          "The /terminal namespace isn't mounted. Add `terminal: { enabled: true }` to the `web:` block of config.yaml and restart the daemon.",
      }
    : {
        title: "Connection refused",
        body:
          reason?.includes("session active")
            ? "Another session is already active for your account. Close the other tab/window and try again."
            : (reason ?? "Backend refused the connection — check JWT cookie and server logs."),
      };

  return (
    <div className="rounded-card border border-level-warn/30 bg-level-warn/[0.06] px-5 py-4">
      <div className="text-[12.5px] font-semibold text-level-warn">{txt.title}</div>
      <div className="text-[11.5px] text-ink-dim mt-1 leading-relaxed">{txt.body}</div>
    </div>
  );
}

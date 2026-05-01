"use client";

import { RoleGate } from "@/components/role-gate";
import { api, ApiError } from "@/lib/api";
import { openTerminalSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Lock, Terminal as TerminalIcon, Zap, ZapOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "xterm/css/xterm.css";

/**
 * Two-step access:
 *
 *   1. Already-logged-in admin (bb_session cookie) — this page is gated
 *      behind /(dash) layout's AuthGate so this is implicit.
 *   2. Separate terminal username + password (`web.terminal.user.*`) —
 *      submitted to POST /api/terminal/unlock, which returns a short-
 *      lived token. Only when we hold that token do we mount xterm and
 *      connect the WS.
 *
 * The token lives in component state — closes the tab and it's gone, no
 * persistent storage. After expiry the next connect attempt fails and we
 * drop back to the lock screen.
 */
export default function TerminalPage() {
  return (
    <RoleGate allowed={["admin"]}>
      <TerminalPageInner />
    </RoleGate>
  );
}

function TerminalPageInner() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null while probing
  const [token, setToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);

  // Probe /api/terminal/status once to know whether to even show the
  // lock form. If the daemon doesn't have web.terminal configured we
  // tell the user up front instead of letting them type a wrong password.
  useEffect(() => {
    api.get<{ enabled: boolean; ttl_seconds: number }>("/terminal/status")
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <div className="h-[calc(100vh-136px)] flex items-center justify-center">
        <div className="text-[12px] font-mono text-ink-mute">checking terminal status…</div>
      </div>
    );
  }

  if (!enabled) {
    return <DisabledState />;
  }

  if (!token) {
    return (
      <LockScreen
        onUnlocked={(t, ttl) => {
          setToken(t);
          setTokenExpiresAt(Date.now() + ttl * 1000);
        }}
      />
    );
  }

  return (
    <TerminalSession
      token={token}
      tokenExpiresAt={tokenExpiresAt}
      onLock={() => {
        setToken(null);
        setTokenExpiresAt(null);
      }}
    />
  );
}

// ── disabled placeholder ────────────────────────────────────────────────


function DisabledState() {
  return (
    <div className="h-[calc(100vh-136px)] flex flex-col gap-3">
      <Header status="disabled" reason="not configured" />
      <div className="rounded-card border border-level-warn/30 bg-level-warn/[0.06] px-5 py-4">
        <div className="text-[12.5px] font-semibold text-level-warn">Terminal disabled</div>
        <div className="text-[11.5px] text-ink-dim mt-1 leading-relaxed font-mono">
          Add a credentials block to <span className="text-accent-pale">config.yaml</span> and
          restart the daemon:
        </div>
        <pre className="mt-3 px-3 py-2.5 rounded-lg bg-black/40 border border-white/[0.05] text-[11px] font-mono text-zinc-300 whitespace-pre">
{`web:
  terminal:
    enabled: true
    user:
      username: blackbox-term
      password_hash: "$2b$12$…"   # bcrypt — generate via the wizard
    shell: /bin/bash
    cwd: /
    audit: true
    max_sessions: 1
    token_ttl: 1800`}
        </pre>
        <div className="text-[10.5px] text-ink-mute font-mono mt-3">
          easiest path: re-run <span className="text-accent-pale">make setup</span> and answer
          yes to the terminal prompt — it generates the bcrypt hash for you.
        </div>
      </div>
    </div>
  );
}

// ── lock screen ─────────────────────────────────────────────────────────


function LockScreen({ onUnlocked }: { onUnlocked: (token: string, ttlSeconds: number) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; expires_in: number }>(
        "/terminal/unlock",
        { username, password },
      );
      onUnlocked(res.token, res.expires_in);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 401
        ? "invalid credentials"
        : (e as Error).message || "unlock failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-[calc(100vh-136px)] flex flex-col gap-3">
      <Header status="locked" reason="enter terminal credentials" />
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <form
          onSubmit={submit}
          className={cn(
            "w-[360px] max-w-full rounded-card border border-white/[0.06] bg-canvas-elev",
            "px-6 py-7 space-y-4",
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
              <Lock size={14} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold text-ink-strong">Terminal locked</div>
              <div className="text-[10.5px] font-mono text-ink-mute">
                separate credentials from the web admin
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono">username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className={cn(
                  "mt-1 w-full px-3 py-2 rounded-lg",
                  "bg-black/40 border border-white/[0.06] font-mono text-[12px] text-ink-strong",
                  "focus:outline-none focus:border-accent-pale/50",
                )}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono">password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={cn(
                  "mt-1 w-full px-3 py-2 rounded-lg",
                  "bg-black/40 border border-white/[0.06] font-mono text-[12px] text-ink-strong",
                  "focus:outline-none focus:border-accent-pale/50",
                )}
              />
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-level-crit/12 ring-1 ring-level-crit/30 text-level-crit text-[11px] font-mono px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className={cn(
              "w-full h-10 rounded-xl font-mono text-[12px] uppercase tracking-[0.16em]",
              "bg-accent-pale/15 text-accent-pale border border-accent-pale/30",
              "hover:bg-accent-pale/25 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {busy ? "unlocking…" : "unlock"}
          </button>

          <div className="text-[10px] font-mono text-ink-mute leading-relaxed pt-1">
            failed attempts logged · single session enforced · every keystroke audited
          </div>
        </form>
      </div>
    </div>
  );
}

// ── live session ────────────────────────────────────────────────────────


function TerminalSession({
  token,
  tokenExpiresAt,
  onLock,
}: {
  token: string;
  tokenExpiresAt: number | null;
  onLock: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "denied" | "closed">("connecting");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | null = null;

    (async () => {
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

      // Fresh socket bound to this token. NOT shared via the
      // refcounted cache — auth must travel with the very first
      // handshake, otherwise the server rejects an empty connect and
      // we end up on the "denied" branch even when the password was
      // correct.
      const sock = openTerminalSocket(token);

      const sendResize = () => {
        try {
          fit.fit();
          sock.emit("resize", { cols: term.cols, rows: term.rows });
        } catch { /* not ready yet */ }
      };
      requestAnimationFrame(sendResize);
      const ro = new ResizeObserver(sendResize);
      ro.observe(containerRef.current);

      const onConnect = () => {
        setStatus("open");
        setReason(null);
        sendResize();
      };
      const onConnectError = (err: Error) => {
        setStatus("denied");
        setReason(err.message || null);
      };
      const onDisconnect = (r: string) => {
        setStatus("closed");
        setReason(r);
      };
      const onOutput = (payload: { data: string }) => term.write(payload.data);
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
        sock.disconnect();
        term.dispose();
      };
    })().catch((e) => {
      console.error("terminal init failed", e);
      setStatus("denied");
      setReason("xterm.js failed to load");
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [token]);

  // Auto-relock on token expiry — drop back to the lock screen.
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const ms = Math.max(0, tokenExpiresAt - Date.now());
    const t = setTimeout(onLock, ms);
    return () => clearTimeout(t);
  }, [tokenExpiresAt, onLock]);

  return (
    <div className="h-[calc(100vh-136px)] flex flex-col gap-3">
      <Header status={status} reason={reason} onLock={onLock} />
      <div className="flex-1 min-h-0 rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
        <div ref={containerRef} className="h-full w-full p-2" />
      </div>
    </div>
  );
}

// ── header strip ────────────────────────────────────────────────────────


function Header({
  status, reason, onLock,
}: {
  status: string;
  reason: string | null;
  onLock?: () => void;
}) {
  const cfg = {
    connecting: { Icon: Zap,    tone: "text-level-warn",  label: "connecting" },
    open:       { Icon: Zap,    tone: "text-accent-pale", label: "live" },
    closed:     { Icon: ZapOff, tone: "text-ink-mute",    label: "closed" },
    denied:     { Icon: ZapOff, tone: "text-level-crit",  label: "denied" },
    disabled:   { Icon: ZapOff, tone: "text-ink-mute",    label: "disabled" },
    locked:     { Icon: Lock,   tone: "text-accent-pale", label: "locked" },
  }[status] ?? { Icon: ZapOff, tone: "text-ink-mute", label: status };

  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
          <TerminalIcon size={14} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[14px] font-semibold text-ink-strong tracking-tight">Terminal</h1>
          <p className="text-[10.5px] font-mono text-ink-mute">
            two-step auth · single session · audited
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onLock && status === "open" && (
          <button
            type="button"
            onClick={onLock}
            className="text-[11px] font-mono text-ink-dim hover:text-level-crit transition-colors px-2 py-1 rounded ring-1 ring-white/[0.06]"
            title="end session and re-lock"
          >
            lock
          </button>
        )}
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
    </div>
  );
}

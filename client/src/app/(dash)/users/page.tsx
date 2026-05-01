"use client";

import { Tip } from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { cn, relativeTime } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useState } from "react";

interface UserOut {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: number;
  last_login_ts: number | null;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => auth.me(), retry: false });
  const list = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<UserOut[]>("/users"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserOut | null>(null);

  const isAdmin = me.data?.role === "admin";

  if (!isAdmin && !me.isLoading) {
    return (
      <div className="rounded-card border border-level-warn/30 bg-level-warn/[0.06] px-5 py-4">
        <div className="text-[12.5px] font-semibold text-level-warn">Admin role required</div>
        <div className="text-[11.5px] text-ink-dim mt-1 leading-relaxed font-mono">
          this page lists and manages every web user — only admins can see it.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
              <UsersIcon size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-ink-strong tracking-tight">Users</h1>
              <p className="text-[11.5px] text-ink-mute font-mono">
                web admins · stored in <span className="text-ink-dim">users</span> table
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono ring-1 transition-colors",
              "bg-accent-pale/15 text-accent-pale ring-accent-pale/30 hover:bg-accent-pale/25",
            )}
          >
            <Plus size={11} /> add user
          </button>
        </div>
      </div>

      <div className="rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
        {list.isLoading ? (
          <div className="px-6 py-12 text-center text-[12px] font-mono text-ink-mute">loading…</div>
        ) : (list.data?.length ?? 0) === 0 ? (
          <div className="px-6 py-12 text-center">
            <UsersIcon size={32} className="mx-auto text-ink-mute opacity-40 mb-2" />
            <div className="text-[13px] text-ink-strong font-medium">no users</div>
            <div className="text-[11px] text-ink-mute font-mono mt-1">
              run `make setup` to seed the first admin
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {(list.data ?? []).map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isMe={u.username === me.data?.username}
                onChangePassword={() => setPwTarget(u)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["users"] });
            setShowCreate(false);
          }}
        />
      )}

      {pwTarget && (
        <ChangePasswordDialog
          user={pwTarget}
          isMe={pwTarget.username === me.data?.username}
          onClose={() => setPwTarget(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["users"] });
            setPwTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── row ───────────────────────────────────────────────────────────────


function UserRow({
  user, isMe, onChangePassword,
}: {
  user: UserOut;
  isMe: boolean;
  onChangePassword: () => void;
}) {
  const qc = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/users/${user.id}`, { is_active: !user.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const setRole = useMutation({
    mutationFn: (role: string) => api.patch(`/users/${user.id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/users/${user.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  function confirmRemove() {
    if (!window.confirm(`Delete user "${user.username}"? This is irreversible.`)) return;
    remove.mutate(undefined, {
      onError: (e) => alert((e as Error).message),
    });
  }

  return (
    <div className="grid grid-cols-[40px_1fr_88px_120px_140px_auto] gap-3 px-5 py-3.5 items-center">
      <div className={cn(
        "h-8 w-8 rounded-xl flex items-center justify-center text-[12px] font-bold",
        user.role === "admin"
          ? "bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/25"
          : "bg-white/[0.05] text-ink-dim ring-1 ring-white/10",
      )}>
        {user.username[0]?.toUpperCase()}
      </div>
      <div>
        <div className="text-[13px] font-medium text-ink-strong">
          {user.username}
          {isMe && <span className="ml-2 text-[10px] text-accent-pale font-mono uppercase tracking-wider">(you)</span>}
        </div>
        <div className="text-[10.5px] text-ink-mute font-mono">
          created {relativeTime(user.created_at)}
        </div>
      </div>
      <RoleSelect
        value={user.role}
        onChange={(v) => setRole.mutate(v, { onError: (e) => alert((e as Error).message) })}
        busy={setRole.isPending}
      />
      <button
        onClick={() => toggleActive.mutate(undefined, { onError: (e) => alert((e as Error).message) })}
        disabled={toggleActive.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider ring-1 transition-colors",
          user.is_active
            ? "bg-level-ok/[0.10] text-level-ok ring-level-ok/25 hover:bg-level-ok/15"
            : "bg-white/[0.04] text-ink-mute ring-white/[0.06] hover:bg-white/[0.08]",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", user.is_active ? "bg-level-ok" : "bg-ink-mute")} />
        {user.is_active ? "active" : "disabled"}
      </button>
      <span className="text-[10.5px] text-ink-mute font-mono tabular-nums">
        {user.last_login_ts ? relativeTime(user.last_login_ts) : "never"}
      </span>
      <div className="flex items-center gap-1.5">
        <Tip text="change password">
          <button
            onClick={onChangePassword}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-mute hover:bg-white/[0.05] hover:text-accent-pale transition-colors"
          >
            <KeyRound size={12} />
          </button>
        </Tip>
        <Tip text={isMe ? "can't delete yourself" : "delete user"}>
          <button
            onClick={confirmRemove}
            disabled={isMe || remove.isPending}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
              isMe
                ? "text-ink-mute/40 cursor-not-allowed"
                : "text-ink-mute hover:bg-level-crit/[0.10] hover:text-level-crit",
            )}
          >
            <Trash2 size={12} />
          </button>
        </Tip>
      </div>
    </div>
  );
}

function RoleSelect({
  value, onChange, busy,
}: {
  value: string; onChange: (v: string) => void; busy: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        className={cn(
          "appearance-none bg-white/[0.04] ring-1 ring-white/[0.06] rounded-full",
          "px-3 py-1 text-[10.5px] font-mono uppercase tracking-wider text-ink-strong",
          "hover:bg-white/[0.08] focus:outline-none focus:ring-accent-pale/30",
          "disabled:opacity-60",
        )}
      >
        <option value="admin">admin</option>
        <option value="staff">staff</option>
        <option value="viewer">viewer</option>
      </select>
    </div>
  );
}

// ── create dialog ─────────────────────────────────────────────────────


function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "viewer">("staff");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/users", { username, password, role, is_active: true }),
    onSuccess: () => onCreated(),
    onError: (e) => {
      if (e instanceof ApiError) setError((e.body as { detail?: string })?.detail ?? e.message);
      else setError((e as Error).message);
    },
  });

  return (
    <Dialog onClose={onClose} title="Add user" Icon={UserCog}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate();
        }}
        className="space-y-3"
      >
        <Field label="username">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            minLength={1}
            className={dialogInputClass}
          />
        </Field>
        <Field label="password (min 8 chars)">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className={dialogInputClass}
          />
        </Field>
        <Field label="role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "staff" | "viewer")}
            className={dialogInputClass}
          >
            <option value="staff">staff (no terminal/docker)</option>
            <option value="viewer">viewer (no terminal/docker)</option>
            <option value="admin">admin (full access)</option>
          </select>
        </Field>
        {error && (
          <div className="rounded-lg bg-level-crit/12 ring-1 ring-level-crit/30 text-level-crit text-[11px] font-mono px-3 py-2 flex items-start gap-2">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={create.isPending || !username || password.length < 8}
            className={cn(
              "flex-1 h-10 rounded-xl font-mono text-[12px] uppercase tracking-[0.16em]",
              "bg-accent-pale/15 text-accent-pale border border-accent-pale/30 hover:bg-accent-pale/25",
              "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
            )}
          >
            {create.isPending ? <Loader2 size={12} className="inline animate-spin mr-2" /> : <Check size={12} className="inline mr-2" />}
            create
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl font-mono text-[11px] uppercase tracking-wider text-ink-dim ring-1 ring-white/[0.06] hover:bg-white/[0.04]"
          >
            cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── change-password dialog ────────────────────────────────────────────


function ChangePasswordDialog({
  user, isMe, onClose, onChanged,
}: {
  user: UserOut;
  isMe: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => {
      if (isMe) {
        return api.patch("/users/me/password", {
          current_password: currentPassword,
          new_password: newPassword,
        });
      }
      return api.patch(`/users/${user.id}/password`, { new_password: newPassword });
    },
    onSuccess: () => onChanged(),
    onError: (e) => {
      if (e instanceof ApiError) setError((e.body as { detail?: string })?.detail ?? e.message);
      else setError((e as Error).message);
    },
  });

  return (
    <Dialog onClose={onClose} title={`Change password — ${user.username}`} Icon={KeyRound}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          change.mutate();
        }}
        className="space-y-3"
      >
        {isMe && (
          <Field label="current password">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
              className={dialogInputClass}
            />
          </Field>
        )}
        <Field label="new password (min 8 chars)">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoFocus={!isMe}
            className={dialogInputClass}
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-level-crit/12 ring-1 ring-level-crit/30 text-level-crit text-[11px] font-mono px-3 py-2 flex items-start gap-2">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={change.isPending || newPassword.length < 8 || (isMe && !currentPassword)}
            className={cn(
              "flex-1 h-10 rounded-xl font-mono text-[12px] uppercase tracking-[0.16em]",
              "bg-accent-pale/15 text-accent-pale border border-accent-pale/30 hover:bg-accent-pale/25",
              "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
            )}
          >
            {change.isPending ? <Loader2 size={12} className="inline animate-spin mr-2" /> : <Check size={12} className="inline mr-2" />}
            update
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl font-mono text-[11px] uppercase tracking-wider text-ink-dim ring-1 ring-white/[0.06] hover:bg-white/[0.04]"
          >
            cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── shared dialog ─────────────────────────────────────────────────────


import { createPortal } from "react-dom";
import { useEffect } from "react";

const dialogInputClass = cn(
  "w-full px-3 py-2 rounded-lg",
  "bg-black/40 border border-white/[0.06] font-mono text-[12px] text-ink-strong",
  "focus:outline-none focus:border-accent-pale/50",
);

function Dialog({
  title, Icon, onClose, children,
}: {
  title: string;
  Icon: typeof ShieldCheck;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[reveal-in_0.2s_ease-out]"
        onClick={onClose}
      />
      <div className="relative w-[400px] max-w-[calc(100vw-32px)] rounded-card bg-canvas-elev border border-white/[0.08] shadow-canvas animate-[reveal-in_0.2s_ease-out]">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
              <Icon size={14} strokeWidth={1.8} />
            </div>
            <div className="text-[14px] font-semibold text-ink-strong">{title}</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-mute hover:bg-white/[0.05] hover:text-ink-strong transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

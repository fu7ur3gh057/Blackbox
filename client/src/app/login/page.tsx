"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.login({ username, password });
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Invalid credentials" : err.message);
      } else {
        setError("Could not reach server");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Extra concentrated glow behind the login card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-accent/15 blur-[120px] pointer-events-none" />

      <div className="glass relative w-full max-w-sm p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="relative">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-accent via-rose-500 to-violet-accent shadow-glow" />
            <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none" />
          </div>
          <div className="leading-none">
            <div className="text-base font-semibold tracking-tight bg-gradient-to-r from-text-strong via-orange-200 to-violet-accent bg-clip-text text-transparent">
              blackbox
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-mute mt-0.5">
              monitoring
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-text-strong">Welcome back</h1>
          <p className="text-sm text-text-dim mt-1">Sign in with your config.yaml credentials.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-text-mute">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-text-mute">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-rose-300 border border-rose-400/25 bg-rose-400/5 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-[11px] text-text-mute text-center mt-6">
          forgot your creds? rerun <code className="text-text-dim">make setup</code> on the VPS
        </p>
      </div>
    </div>
  );
}

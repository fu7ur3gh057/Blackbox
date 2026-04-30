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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="canvas w-full max-w-sm p-8">
        <div className="flex items-baseline gap-3 mb-8">
          <span className="text-2xl font-semibold tracking-tight text-ink-strong">
            black<span className="text-accent-lavender">box</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-mute">monitoring</span>
        </div>

        <h1 className="text-[20px] font-semibold tracking-tight text-ink-strong">Welcome back</h1>
        <p className="text-[13px] text-ink-dim mt-1 mb-6">Sign in with your config.yaml credentials.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">Password</label>
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
            <div className="text-[12px] text-level-crit border border-level-crit/30 bg-level-crit/5 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-[11px] text-ink-mute text-center mt-6">
          forgot creds? rerun <code className="text-ink-dim">make setup</code>
        </p>
      </div>
    </div>
  );
}

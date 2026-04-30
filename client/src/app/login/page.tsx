"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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
      <Card className="w-full max-w-sm">
        <CardBody className="pt-8 pb-7 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_2px_rgba(249,115,22,0.6)]" />
            <span className="font-semibold tracking-tight text-text-strong">blackbox</span>
          </div>

          <div>
            <h1 className="text-xl font-semibold text-text-strong">Sign in</h1>
            <p className="text-sm text-text-dim mt-1">Use the credentials from your config.yaml.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-text-mute">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-text-mute">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-level-crit border border-level-crit/30 bg-level-crit/5 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => auth.me(),
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-dim text-sm">
        loading…
      </div>
    );
  }
  if (!data) return null; // redirecting
  return <>{children}</>;
}

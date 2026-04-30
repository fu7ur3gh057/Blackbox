import { AuthGate } from "@/components/auth-gate";
import { Topbar } from "@/components/topbar";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col">
        <Topbar />
        <main className="flex-1">{children}</main>
      </div>
    </AuthGate>
  );
}

import { AuthGate } from "@/components/auth-gate";
import { LeftRail } from "@/components/left-rail";
import { TopHeader } from "@/components/top-header";
import { FloatingPill } from "@/components/widgets/floating-pill";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen grid grid-cols-[64px_1fr]">
        <LeftRail />
        <div className="flex flex-col min-w-0 border-l border-white/[0.05]">
          <TopHeader />
          <main className="flex-1 px-7 py-6">{children}</main>
        </div>
        <FloatingPill />
      </div>
    </AuthGate>
  );
}

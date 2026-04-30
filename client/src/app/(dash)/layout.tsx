import { AuthGate } from "@/components/auth-gate";
import { LeftRail } from "@/components/left-rail";
import { TopHeader } from "@/components/top-header";
import { FloatingPill } from "@/components/widgets/floating-pill";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen p-5 md:p-7">
        <div className="canvas grid grid-cols-[64px_1fr] min-h-[calc(100vh-2.5rem)] md:min-h-[calc(100vh-3.5rem)]">
          <LeftRail />
          <div className="flex flex-col min-w-0">
            <TopHeader />
            <main className="flex-1 px-7 py-6">{children}</main>
          </div>
        </div>
        <FloatingPill />
      </div>
    </AuthGate>
  );
}

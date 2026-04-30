import { AuthGate } from "@/components/auth-gate";
import { LeftRail } from "@/components/left-rail";
import { RightColumn } from "@/components/right-column";
import { TopHeader } from "@/components/top-header";

/**
 * Three regions, all fixed: left rail (64 px, icon nav), top header
 * (between the rails), and the wide right column (~460 px, holds the
 * status cluster + recent alerts + quick actions). Main scrolls
 * between them at roughly the 1 : 6 : 3 ratio the user asked for.
 */
const RIGHT_W = 460;

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen">
        {/* Left fixed rail */}
        <div className="fixed top-0 left-0 bottom-0 w-16 z-30 border-r border-white/[0.05] bg-canvas/95 backdrop-blur-md">
          <LeftRail />
        </div>

        {/* Top fixed header — slots between the two rails */}
        <div
          className="fixed top-0 left-16 z-30 border-b border-white/[0.05] bg-canvas/85 backdrop-blur-md"
          style={{ right: RIGHT_W }}
        >
          <TopHeader />
        </div>

        {/* Right fixed column — combined sidebar + utility rail */}
        <div
          className="fixed top-0 right-0 bottom-0 z-30 border-l border-white/[0.05] bg-canvas/95 backdrop-blur-md"
          style={{ width: RIGHT_W }}
        >
          <RightColumn />
        </div>

        {/* Main — scrolls between the bars */}
        <main
          className="ml-16 pt-[88px] min-h-screen"
          style={{ marginRight: RIGHT_W }}
        >
          <div className="px-7 py-6">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}

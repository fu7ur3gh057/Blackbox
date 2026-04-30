import { AuthGate } from "@/components/auth-gate";
import { LeftRail } from "@/components/left-rail";
import { RightBar } from "@/components/right-bar";
import { TopHeader } from "@/components/top-header";
import { FloatingPill } from "@/components/widgets/floating-pill";

/**
 * Three fixed chrome bars (left rail, top header, right bar) frame the
 * scrollable main column. The bars carry their own borders + bg so a
 * little blur shows through when content scrolls underneath.
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen">
        {/* Left fixed rail */}
        <div className="fixed top-0 left-0 bottom-0 w-16 z-30 border-r border-white/[0.05] bg-canvas/95 backdrop-blur-md">
          <LeftRail />
        </div>

        {/* Top fixed header — slots between the two rails */}
        <div className="fixed top-0 left-16 right-16 z-30 border-b border-white/[0.05] bg-canvas/85 backdrop-blur-md">
          <TopHeader />
        </div>

        {/* Right fixed bar (empty for now) */}
        <div className="fixed top-0 right-0 bottom-0 w-16 z-30 border-l border-white/[0.05] bg-canvas/95 backdrop-blur-md">
          <RightBar />
        </div>

        {/* Main — scrolls; outer offsets clear all three bars. */}
        <main className="ml-16 mr-16 pt-[88px] min-h-screen">
          <div className="px-7 py-6">
            {children}
          </div>
        </main>

        <FloatingPill />
      </div>
    </AuthGate>
  );
}

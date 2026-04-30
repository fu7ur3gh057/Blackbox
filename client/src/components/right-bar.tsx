"use client";

/**
 * Empty fixed right rail. Reserved real estate for future widgets —
 * vertical command-palette, per-page tools, mini live counters etc.
 * For now it just holds the negative space and the border line.
 */
export function RightBar() {
  return (
    <aside className="h-full flex flex-col items-center py-5">
      {/* placeholder dots — barely-there visual cue that the bar exists */}
      <div className="mt-auto mb-4 flex flex-col items-center gap-1 opacity-30">
        <span className="h-1 w-1 rounded-full bg-accent-pale" />
        <span className="h-1 w-1 rounded-full bg-accent-pale" />
        <span className="h-1 w-1 rounded-full bg-accent-pale" />
      </div>
    </aside>
  );
}

import type { NextConfig } from "next";

/**
 * In dev (`pnpm dev`):    no `output: export` so rewrites work, proxying
 *                         /blackbox/api → backend on :8765 — cookies
 *                         stay on a single origin (the dev server, :8677).
 * In prod (`pnpm build`): BUILD_STATIC=true triggers static export into
 *                         `out/`; FastAPI mounts that directory at
 *                         /blackbox so client + api share one origin.
 */
const isStatic = process.env.BUILD_STATIC === "true";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8765";

const config: NextConfig = {
  basePath: "/blackbox",
  trailingSlash: true,
  ...(isStatic ? { output: "export" } : {}),
  // Rewrites are dev-only; in static export Next strips them and warns.
  // Skip declaring the function entirely when building static.
  ...(isStatic
    ? {}
    : {
        async rewrites() {
          return [
            { source: "/blackbox/api/:path*", destination: `${BACKEND}/blackbox/api/:path*` },
            { source: "/blackbox/ws/:path*", destination: `${BACKEND}/blackbox/ws/:path*` },
          ];
        },
      }),
};

export default config;

import type { NextConfig } from "next";

/**
 * In dev (`pnpm dev`):     no `output: export` → rewrites work, proxying
 *                          /blackbox/api → backend on :8765 so cookies
 *                          stay on a single origin (:3000).
 * In prod (`pnpm build`):  BUILD_STATIC=true triggers static export into
 *                          `out/`; FastAPI mounts that directory at
 *                          /blackbox so client + api share one origin.
 */
const isStatic = process.env.BUILD_STATIC === "true";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8765";

const config: NextConfig = {
  basePath: "/blackbox",
  trailingSlash: true,
  ...(isStatic ? { output: "export" } : {}),
  async rewrites() {
    if (isStatic) return [];
    return [
      { source: "/blackbox/api/:path*", destination: `${BACKEND}/blackbox/api/:path*` },
      { source: "/blackbox/ws/:path*", destination: `${BACKEND}/blackbox/ws/:path*` },
    ];
  },
};

export default config;

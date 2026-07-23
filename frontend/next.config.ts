import type { NextConfig } from "next";

// INTERNAL_API_URL is used only for server-side rewrites (Next → API). It
// is NOT exposed to the browser. The browser hits relative `/api/...` paths
// which Next then forwards to this URL on the server side.
//
// NEXT_PUBLIC_API_URL is intentionally NOT used here — if it were, every
// client bundle would bake in the docker service hostname (`http://api:8000`)
// and the browser would fail to resolve it.
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  // FastAPI routes are registered with trailing slashes (e.g. /api/projects/).
  // Without this, Next.js 16's default 308 strip of trailing slashes collides
  // with FastAPI's 307 add of trailing slashes — producing an infinite redirect
  // loop and "Failed to fetch" in the browser.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${INTERNAL_API_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${INTERNAL_API_URL}/health`,
      },
    ];
  },
};

export default nextConfig;

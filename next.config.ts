import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stale-build guard (lib/buildVersion.ts): Vercel sets VERCEL_GIT_COMMIT_SHA at build time.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
};

export default nextConfig;

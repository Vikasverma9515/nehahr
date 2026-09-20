import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cairnvibe/sdk", "@cairnvibe/core"],
  // Native / socket modules used by the Cairn server entry must not be bundled.
  serverExternalPackages: ["better-sqlite3", "ws"],
};

export default nextConfig;

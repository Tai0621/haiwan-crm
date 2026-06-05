import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disk on this machine is very tight. Turbopack's persistent filesystem
    // cache writes large SST files into .next/ that fill the remaining space
    // (causing "not enough space on the disk" errors). Disable it for dev —
    // builds are a touch slower on restart but the cache no longer grows.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

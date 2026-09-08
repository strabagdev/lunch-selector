import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(),
  },
  /* config options here */
};

export default nextConfig;

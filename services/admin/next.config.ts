import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (deployment/docker/nextjs.Dockerfile).
  output: "standalone",
};

export default nextConfig;

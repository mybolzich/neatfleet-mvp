import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: "dist",
  basePath: isGithubPages ? "/NeatFleet_mvp" : undefined,
  assetPrefix: isGithubPages ? "/NeatFleet_mvp/" : undefined,
};

export default nextConfig;

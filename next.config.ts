import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["highs"],
  async redirects() {
    return [
      { source: "/plan", destination: "/", permanent: false },
      { source: "/courses", destination: "/", permanent: false },
      { source: "/requirements", destination: "/audit", permanent: false },
      { source: "/plans", destination: "/compare", permanent: false },
    ];
  },
};

export default nextConfig;

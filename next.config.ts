import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/collect', destination: '/', permanent: true },
    ]
  },
};

export default nextConfig;

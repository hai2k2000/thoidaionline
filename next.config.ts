import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/user",
        destination: "/users",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

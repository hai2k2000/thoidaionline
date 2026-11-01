import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "51mb",
  },
  outputFileTracingExcludes: {
    "*": ["src/**", "docs/**", "mobile/**", "supabase/**", "bridge/**", "work/**", "sql/**", "deploy/**", "scripts/e2e/**", "**/*.test.*", "AGENTS.md", "*.md"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/login",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" }],
      },
    ];
  },
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

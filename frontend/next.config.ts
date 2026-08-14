import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // trends.server.ts reads this file at runtime via a dynamically-built
  // path, which Next.js's automatic serverless file tracing can miss.
  outputFileTracingIncludes: {
    "/**/*": ["./public/data/trends.json"],
  },
};

export default nextConfig;

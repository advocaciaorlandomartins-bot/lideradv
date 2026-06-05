import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "openai", "pdf-parse"],
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "openai", "pdf-parse"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

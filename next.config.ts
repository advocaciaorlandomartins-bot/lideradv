import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "openai",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

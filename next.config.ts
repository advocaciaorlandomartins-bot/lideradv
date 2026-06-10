import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "openai",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "pdf-parse/worker",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

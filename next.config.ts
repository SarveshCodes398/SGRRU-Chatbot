import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable server external packages for pdf-parse since we use it in server components
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;

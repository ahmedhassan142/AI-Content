import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: [
    "*.space-z.ai",
    "preview-chat-fd9100b9-88f7-4286-9c13-597c04e9d1a6.space-z.ai",
  ],
};

export default nextConfig;

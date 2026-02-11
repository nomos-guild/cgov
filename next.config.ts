import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ["en", "de", "fr", "es", "pt", "ja", "zh"],
    defaultLocale: "en",
    // localeDetection is enabled by default in Next.js 15
  },
  webpack: (config, { dev }) => {
    // Windows file locking causes webpack cache corruption during HMR
    // ("Cannot find module './chunks/vendor-chunks/next.js'" errors)
    // Using in-memory cache in dev avoids the filesystem rename issue
    if (dev) {
      config.cache = {
        type: "memory",
      };
    }
    return config;
  },
};

export default nextConfig;

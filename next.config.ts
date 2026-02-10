import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ["en", "de", "fr", "es", "pt", "ja", "zh"],
    defaultLocale: "en",
    // localeDetection is enabled by default in Next.js 15
  },
};

export default nextConfig;

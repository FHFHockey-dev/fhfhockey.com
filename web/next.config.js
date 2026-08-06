const path = require("path");

const CMS_URL = process.env.CMS_URL;
const isProd = process.env.NODE_ENV === "production";
const preserveDistDir = process.env.PRESERVE_NEXT_DIST === "1";
const nextDistDir =
  process.env.PLAYER_FORECAST_ISOLATED_NEXT === "1"
    ? ".next-player-forecasts"
    : ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  cleanDistDir: !preserveDistDir,
  // Next 15.5's Pages Router static indicator can receive an ISR manifest
  // before the router component map exists, producing a noisy dev-only HMR error.
  devIndicators: false,
  distDir: nextDistDir,
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/v1/db/cron-report": [
      "../tasks/TASKS/cron-operations/cron-schedule.md",
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@portabletext/react", "@portabletext/toolkit"],
  images: {
    // If the image optimizer is failing in dev (common when sharp/libvips mismatches),
    // bypass it so local development isn't blocked.
    unoptimized: !isProd,
    // We intentionally allow SVGs because we use NHL-provided SVG team logos
    // (e.g. https://assets.nhle.com/logos/nhl/svg/TOR_light.svg) throughout the site.
    // Without this, `next/image` returns 400 for any `.svg` source.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
      {
        protocol: "https",
        hostname: "nhl.bamcontent.com",
      },
      {
        protocol: "https",
        hostname: "assets.nhle.com",
      },
    ],
  },
  reactStrictMode: true,
  watchOptions: {
    pollIntervalMs: 1000,
  },
  webpack(config, { dev }) {
    if (dev) {
      const ignored = [
        "**/.next/**",
        "**/.next-codex-reconcile/**",
        "**/.next-player-forecasts/**",
        "**/node_modules/**",
        "**/coverage/**",
        "**/storybook-static/**",
        "**/tasks/artifacts/**",
        "**/package-lock 2.json",
      ];
      const existingIgnored = config.watchOptions?.ignored;
      const existingIgnoredGlobs = Array.isArray(existingIgnored)
        ? existingIgnored.filter(
            (entry) => typeof entry === "string" && entry.length > 0,
          )
        : typeof existingIgnored === "string" && existingIgnored.length > 0
          ? [existingIgnored]
          : [];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [...existingIgnoredGlobs, ...ignored],
      };
    }
    return config;
  },
  // swcMinify: false, // Default is true, sticking to standard
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      {
        source: "/studio",
        destination: `${CMS_URL}/studio`,
      },
      {
        source: "/studio/:path*",
        destination: `${CMS_URL}/studio/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/game-grid",
        // not the url to change button label
        destination: "/game-grid/7-Day-Forecast",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;

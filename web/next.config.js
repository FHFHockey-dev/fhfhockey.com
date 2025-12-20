const CMS_URL = process.env.CMS_URL;
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io"
      },
      {
        protocol: "https",
        hostname: "nhl.bamcontent.com"
      },
      {
        protocol: "https",
        hostname: "assets.nhle.com"
      }
    ]
  },
  reactStrictMode: true,
  experimental: {
    externalDir: true
  },
  async rewrites() {
    return [
      {
        source: "/studio",
        destination: `${CMS_URL}/studio`
      },
      {
        source: "/studio/:path*",
        destination: `${CMS_URL}/studio/:path*`
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/game-grid",
        // not the url to change button label
        destination: "/game-grid/7-Day-Forecast",
        permanent: false
      }
    ];
  }
};

module.exports = nextConfig;

const CMS_URL = process.env.CMS_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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

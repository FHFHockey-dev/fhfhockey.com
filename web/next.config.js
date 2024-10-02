const CMS_URL = process.env.CMS_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "images.unsplash.com",
      "cdn.sanity.io",
      "nhl.bamcontent.com",
      "assets.nhle.com",
    ],
  },
  reactStrictMode: true,
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

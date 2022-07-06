const CMS_URL = process.env.CMS_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    ]
  },
}

module.exports = nextConfig

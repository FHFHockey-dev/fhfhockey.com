const CMS_URL = process.env.CMS_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["images.unsplash.com"]
  },
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

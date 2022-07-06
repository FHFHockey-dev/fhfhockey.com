const BLOG_URL = process.env.BLOG_URL;
const CMS_URL = process.env.CMS_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: `/:path*`,
      },
      {
        source: '/blog',
        destination: `${BLOG_URL}/blog`,
      },
      {
        source: '/blog/:path*',
        destination: `${BLOG_URL}/blog/:path*`,
      },
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

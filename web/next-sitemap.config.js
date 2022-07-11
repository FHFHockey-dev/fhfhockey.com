// https://www.techomoro.com/generate-sitemap-for-static-and-dynamic-pages-in-a-next-js-app/

const SITE_URL = process.env.SITE_URL;
/** @type {import('next-sitemap').IConfig} */
const config = {
    siteUrl: SITE_URL || 'https://fhfhockey.com',
    exclude: ["/404"],
    generateRobotsTxt: true,
    robotsTxtOptions: {
        policies: [
            {
                userAgent: "*",
                disallow: ["/404"],
            },
            { userAgent: "*", allow: "/" },
        ],
        additionalSitemaps: [
            `${SITE_URL}/blog/sitemap.xml`, // TODO: for posts
        ],
    },
}

module.exports = config
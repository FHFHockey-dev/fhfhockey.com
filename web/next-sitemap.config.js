// https://www.techomoro.com/generate-sitemap-for-static-and-dynamic-pages-in-a-next-js-app/

const { SITE_URL, NOINDEX_PATHS } = require('./lib/seo');
/** @type {import('next-sitemap').IConfig} */
const config = {
    siteUrl: SITE_URL,
    exclude: [
        ...NOINDEX_PATHS.flatMap((path) => [path, `${path}/*`]),
        '/api/*', '/game-grid', '/blog/substack/*', '/server-sitemap.xml',
    ],
    generateRobotsTxt: true,
    generateIndexSitemap: false,
    autoLastmod: false,
    additionalPaths: async (config) => Promise.all(
        ['/game-grid/7-Day-Forecast', '/game-grid/10-Day-Forecast']
            .map((path) => config.transform(config, path))
    ),
    robotsTxtOptions: {
        additionalSitemaps: [`${SITE_URL}/server-sitemap.xml`],
        policies: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/"],
            },
        ],
    },
}

module.exports = config

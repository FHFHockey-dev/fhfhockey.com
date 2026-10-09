// Shared by the browser metadata and the postbuild sitemap generator.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fhfhockey.com").replace(/\/+$/, "");

const NOINDEX_PATHS = [
  "/404", "/500", "/_error", "/account", "/auth", "/db", "/studio",
  "/privacy", "/draft-pro/policies", "/player-forecasts",
  "/cssTestingGrounds", "/trendsDebug", "/trendsTestingGrounds",
  "/trendsSandbox", "/trends/placeholder", "/statsPlaceholder",
  "/skoCharts", "/underlying-stats/xg/operations",
];

function cleanPath(path) {
  return path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
}

function isNoindexPath(path) {
  const pathname = cleanPath(path);
  return NOINDEX_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function canonicalUrl(path) {
  return `${SITE_URL}${cleanPath(path)}`;
}

module.exports = { SITE_URL, NOINDEX_PATHS, isNoindexPath, canonicalUrl };

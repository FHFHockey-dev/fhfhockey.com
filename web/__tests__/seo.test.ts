// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalUrl, isNoindexPath, SITE_URL } from "lib/seo";

const sitemapConfig = require("../next-sitemap.config.js");

describe("public SEO boundaries", () => {
  it("canonicalizes query and fragment variants without losing a player or article path", () => {
    expect(canonicalUrl("/stats/player/8478402/?season=20252026#games")).toBe(`${SITE_URL}/stats/player/8478402`);
    expect(canonicalUrl("/blog/draft-strategy")).toBe(`${SITE_URL}/blog/draft-strategy`);
    expect(canonicalUrl("/?utm_source=test")).toBe(`${SITE_URL}/`);
    expect(SITE_URL).not.toContain("undefined");
  });

  it("keeps account, admin, auth, sandbox and draft policy pages out of search", () => {
    for (const path of ["/auth", "/auth/callback?code=x", "/account/", "/db/player-aliases", "/privacy", "/cssTestingGrounds", "/404", "/underlying-stats/xg/operations"]) {
      expect(isNoindexPath(path), path).toBe(true);
    }
    for (const path of ["/", "/blog", "/blog/authors", "/game-grid/7-Day-Forecast", "/stats/player/8478402", "/underlying-stats", "/draft-dashboard"]) {
      expect(isNoindexPath(path), path).toBe(false);
    }
  });

  it("builds a public-only sitemap while retaining prerendered articles and forecast modes", async () => {
    // Exercise the installed generator without a build or generated artifacts.
    const { withDefaultConfig } = await import(new URL("../node_modules/next-sitemap/dist/esm/utils/defaults.js", import.meta.url).href);
    const { UrlSetBuilder } = await import(new URL("../node_modules/next-sitemap/dist/esm/builders/url-set-builder.js", import.meta.url).href);
    const config = withDefaultConfig(sitemapConfig);
    const paths = ["/", "/blog", "/auth", "/auth/callback", "/db", "/db/player-aliases", "/account", "/privacy", "/cssTestingGrounds", "/game-grid", "/game-grid/[mode]", "/stats/player/[playerId]", "/blog/substack/copied-post", "/server-sitemap.xml"];
    const manifest = {
      build: { pages: Object.fromEntries(paths.map((path) => [path, []])) },
      preRender: { routes: { "/blog/published-post": {} }, notFoundRoutes: [] },
      routes: {},
    };
    const entries = await new UrlSetBuilder(config, manifest).createUrlSet();
    expect(entries.map((entry: { loc: string }) => entry.loc).sort()).toEqual([
      SITE_URL,
      `${SITE_URL}/blog`,
      `${SITE_URL}/blog/published-post`,
      `${SITE_URL}/game-grid/10-Day-Forecast`,
      `${SITE_URL}/game-grid/7-Day-Forecast`,
    ].sort());
    expect(entries.every((entry: { lastmod?: string }) => !entry.lastmod)).toBe(true);
  });

  it("advertises the runtime sitemap and allows crawlers to read noindex directives", async () => {
    const { RobotsTxtBuilder } = await import(new URL("../node_modules/next-sitemap/dist/esm/builders/robots-txt-builder.js", import.meta.url).href);
    const robots = new RobotsTxtBuilder().generateRobotsTxt(sitemapConfig);
    expect(robots).toContain(`Sitemap: ${SITE_URL}/server-sitemap.xml`);
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toMatch(/Disallow: \/(?:auth|db|privacy|404)/);
  });
});

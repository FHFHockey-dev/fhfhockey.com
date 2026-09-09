// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const sources = vi.hoisted(() => ({ sanity: vi.fn(), substack: vi.fn() }));
vi.mock("lib/sanity/sanity.server", () => ({ getClient: () => ({ fetch: sources.sanity }) }));
vi.mock("lib/sanity/sanity", () => ({ urlFor: () => ({ url: () => "" }) }));
vi.mock("lib/substack", () => ({ getSubstackPosts: sources.substack }));
import { relatedArticles } from "./related.server";

describe("related articles", () => {
  it("selects across origins, preferring topic matches and excluding the current route", async () => {
    sources.sanity.mockResolvedValue([
      { slug: "current", title: "Current", publishedAt: "2026-09-08", topics: ["Strategy"] },
      { slug: "matching", title: "Matching", publishedAt: "2026-09-01", topics: ["Strategy"] }
    ]);
    sources.substack.mockResolvedValue([{ slug: "newer", title: "Newer", summary: "", imageUrl: "", publishedAt: "2026-09-07" }]);
    expect((await relatedArticles("current", ["Strategy"])).map(p => p.slug)).toEqual(["matching", "substack/newer"]);
  });

  it("keeps recommendations optional when either provider is unavailable", async () => {
    sources.sanity.mockRejectedValue(new Error("Sanity unavailable"));
    sources.substack.mockResolvedValue([{ slug: "available", title: "Available", summary: "", imageUrl: "", publishedAt: "2026-09-07" }]);
    expect((await relatedArticles("current")).map(p => p.slug)).toEqual(["substack/available"]);
    sources.substack.mockRejectedValue(new Error("Substack unavailable"));
    expect(await relatedArticles("current")).toEqual([]);
  });
});

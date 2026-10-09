import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, fetchMock, sitemapMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  fetchMock: vi.fn(),
  sitemapMock: vi.fn(),
}));

vi.mock("lib/supabase/public-client", () => ({ default: { from: fromMock } }));
vi.mock("lib/sanity/sanity.server", () => ({
  getClient: () => ({ fetch: fetchMock }),
}));
vi.mock("next-sitemap", () => ({ getServerSideSitemap: sitemapMock }));

import { getServerSideProps } from "pages/server-sitemap.xml";

describe("server sitemap", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchMock.mockReset();
    sitemapMock.mockReset();
    sitemapMock.mockReturnValue({ props: {} });
  });

  it("paginates public player IDs and includes published Sanity articles", async () => {
    const players = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1 }));
    players[0].id = 0;
    players[1].id = 1.5;
    const ranges: Array<[number, number]> = [];
    const chain = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn((from: number, to: number) => {
        ranges.push([from, to]);
        return Promise.resolve({ data: players.slice(from, to + 1), error: null });
      }),
    };
    chain.select.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    fromMock.mockReturnValue(chain);
    fetchMock.mockResolvedValue(["published-article"]);
    const setHeader = vi.fn();
    const context = { res: { setHeader } } as any;

    await getServerSideProps(context);

    expect(fromMock).toHaveBeenCalledWith("players");
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.order).toHaveBeenCalledWith("id");
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(fetchMock.mock.calls[0][0]).toContain('path("drafts.**")');
    expect(fetchMock.mock.calls[0][0]).toContain("dateTime(now())");
    const fields = sitemapMock.mock.calls[0][1];
    expect(fields).toHaveLength(1000);
    expect(fields).not.toContainEqual({ loc: "https://fhfhockey.com/stats/player/0" });
    expect(fields).not.toContainEqual({ loc: "https://fhfhockey.com/stats/player/1.5" });
    expect(fields).toContainEqual({ loc: "https://fhfhockey.com/stats/player/1001" });
    expect(fields).toContainEqual({ loc: "https://fhfhockey.com/blog/published-article" });
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });

  it("fails when a data source fails instead of serving an empty sitemap", async () => {
    const chain = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({ data: null, error: new Error("unavailable") }),
    };
    chain.select.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    fromMock.mockReturnValue(chain);
    fetchMock.mockResolvedValue([]);

    await expect(getServerSideProps({ res: { setHeader: vi.fn() } } as any)).rejects.toThrow("unavailable");
    expect(sitemapMock).not.toHaveBeenCalled();
  });

  it("does not serve or cache a sitemap when Sanity fails", async () => {
    const chain = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    chain.select.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    fromMock.mockReturnValue(chain);
    fetchMock.mockRejectedValue(new Error("Sanity unavailable"));
    const setHeader = vi.fn();

    await expect(getServerSideProps({ res: { setHeader } } as any)).rejects.toThrow("Sanity unavailable");
    expect(setHeader).not.toHaveBeenCalled();
    expect(sitemapMock).not.toHaveBeenCalled();
  });
});

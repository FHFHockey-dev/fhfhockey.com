import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lines, { getStaticProps } from "pages/lines";

vi.mock("components/LineCombinations/ProjectedLineups", () => ({ default: () => null }));
vi.mock("components/LineCombinations/utilities", () => ({ getLineCombinations: vi.fn() }));
vi.mock("lib/NHL/server", () => ({ getTeams: vi.fn(async () => []), getCurrentSeason: vi.fn() }));
vi.mock("lib/newsFeed", () => ({ fetchLatestPlayerNewsFlags: vi.fn(async () => new Map()) }));
vi.mock("lib/supabase", () => ({
  default: {
    from: () => ({ select: () => ({ in: () => ({ throwOnError: async () => ({ data: [] }) }) }) }),
  },
}));
vi.mock("next/legacy/image", () => ({
  default: ({ alt = "" }: { alt?: string }) => React.createElement("img", { alt }),
}));
vi.mock("components/TimeAgo", () => ({
  default: ({ date }: { date: string }) => <time dateTime={date}>1h ago</time>,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Lines page freshness", () => {
  it("identifies the movement section timestamp as a page refresh", () => {
    const refreshedAt = "2026-10-15T04:00:00.000Z";
    render(<Lines teams={[]} promotions={[]} demotions={[]} pageRefreshedAt={refreshedAt} />);

    const timestamp = screen.getByRole("link", { name: "Page refreshed: 1h ago" });
    expect(timestamp.querySelector("time")?.dateTime).toBe(refreshedAt);
    expect(screen.queryByText(/^Updated:/)).toBeNull();
    expect(screen.getAllByText("No Data Found")).toHaveLength(2);
  });

  it("returns the page-generation time without claiming a source update time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T05:00:00.000Z"));
    const result = await getStaticProps({});

    expect(result).toMatchObject({
      props: { pageRefreshedAt: "2026-10-15T05:00:00.000Z", promotions: [], demotions: [] },
      revalidate: 60,
    });
    if ("props" in result) expect(await result.props).not.toHaveProperty("lastUpdated");
  });
});

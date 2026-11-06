import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lines, { getStaticProps } from "pages/lines";

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

    // Plain text, not a link to /shiftChart in a new tab.
    expect(screen.queryByRole("link", { name: /Page refreshed/ })).toBeNull();
    const timestamp = screen.getByText(/Page refreshed/);
    expect(timestamp.querySelector("time")?.dateTime).toBe(refreshedAt);
    expect(screen.queryByText(/^Updated:/)).toBeNull();
    expect(screen.getAllByText("No line changes yet.")).toHaveLength(2);
  });

  it("links to team pages instead of mounting an unscoped projected-lineup request", () => {
    const teams = [{ name: "Edmonton Oilers", abbreviation: "EDM", logo: "/edm.svg" }] as any;
    render(<Lines teams={teams} promotions={[]} demotions={[]} pageRefreshedAt="2026-10-15T04:00:00.000Z" />);

    expect(screen.getByRole("navigation", { name: /Pick a team/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edmonton Oilers lines" }).getAttribute("href")).toBe("/lines/EDM");
  });

  it("makes each movement row one link with plain-language line changes", () => {
    const row = { playerId: 8478402, playerName: "Connor McDavid", abbreviation: "EDM" };
    render(
      <Lines
        teams={[]}
        promotions={[{ ...row, previousLine: null, currentLine: 1 }]}
        demotions={[{ ...row, playerId: 2, previousLine: 4, currentLine: null }]}
        pageRefreshedAt="2026-10-15T04:00:00.000Z"
      />,
    );

    const links = screen.getAllByRole("link", { name: /Connor McDavid/ });
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("New");
    expect(screen.getByText("new to the lineup on L1")).toBeTruthy();
    expect(screen.getByText("moved from L4 out of the lineup")).toBeTruthy();
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

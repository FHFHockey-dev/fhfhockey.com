import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lines, { getStaticProps } from "pages/lines";
import { getLineCombinations } from "components/LineCombinations/utilities";
import { getTeams } from "lib/NHL/server";

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
    const row = {
      playerId: 8478402,
      playerName: "Connor McDavid",
      abbreviation: "EDM",
      lineSource: "five_on_five_observed" as const,
    };
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
    expect(screen.getByText("new to the lineup on L1, by 5v5 units")).toBeTruthy();
    expect(screen.getByText("moved from L4 out of the lineup, by 5v5 units")).toBeTruthy();
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

  it("labels each movement row by its team's line source (5v5 units or legacy)", async () => {
    vi.mocked(getTeams).mockResolvedValueOnce([
      { id: 10, abbreviation: "TOR" },
      { id: 22, abbreviation: "EDM" },
    ] as any);
    vi.mocked(getLineCombinations).mockImplementation(
      async (teamId: number) =>
        ({
          lineSource: teamId === 10 ? "five_on_five_observed" : "all_strength_legacy",
          promotions: [{ playerId: teamId * 100, previousLine: 2, currentLine: 1 }],
          demotions: [{ playerId: teamId * 100 + 1, previousLine: 1, currentLine: 2 }],
        }) as any,
    );

    const result = await getStaticProps({});
    if (!("props" in result)) throw new Error("expected props");
    const props = (await result.props) as any;
    const sources = (rows: any[]) =>
      rows.map((row) => `${row.abbreviation}:${row.lineSource}`).sort();
    expect(sources(props.promotions)).toEqual(["EDM:all_strength_legacy", "TOR:five_on_five_observed"]);
    expect(sources(props.demotions)).toEqual(["EDM:all_strength_legacy", "TOR:five_on_five_observed"]);

    render(<Lines {...props} />);
    expect(screen.getAllByText("5v5 units")).toHaveLength(2);
    expect(screen.getAllByText("Legacy lines")).toHaveLength(2);
    expect(screen.getAllByText("moved from L2 to L1, by legacy lines")).toHaveLength(1);
    expect(screen.getByText(/Legacy lines: the all-strength grouping/)).toBeTruthy();
  });
});

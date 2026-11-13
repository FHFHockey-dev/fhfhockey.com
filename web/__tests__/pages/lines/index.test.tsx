import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lines, { getStaticProps } from "pages/lines";
import { getLatestLineChanges } from "components/LineCombinations/utilities";
import { getCurrentSeason, getTeams } from "lib/NHL/server";

vi.mock("components/LineCombinations/utilities", () => ({
  getLatestLineChanges: vi.fn(async () => new Map()),
}));
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
    const summary = (teamId: number) => ({
      lineSource: teamId === 10 ? "five_on_five_observed" : "all_strength_legacy",
      fiveOnFiveUnitSeconds: null,
      promotions: [{ playerId: teamId * 100, previousLine: 2, currentLine: 1 }],
      demotions: [{ playerId: teamId * 100 + 1, previousLine: 1, currentLine: 2 }],
    });
    vi.mocked(getLatestLineChanges).mockResolvedValueOnce(
      new Map([10, 22].map((teamId) => [teamId, summary(teamId)])) as any,
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

  it("reads every team's line changes in one batched call", async () => {
    vi.mocked(getLatestLineChanges).mockClear();
    vi.mocked(getTeams).mockResolvedValueOnce([
      { id: 10, abbreviation: "TOR" },
      { id: 22, abbreviation: "EDM" },
      { id: 68, abbreviation: "UTA" },
    ] as any);
    vi.mocked(getCurrentSeason).mockResolvedValueOnce({ lastSeasonId: 20242025 } as any);
    vi.mocked(getLatestLineChanges)
      .mockResolvedValueOnce(
        new Map([
          [10, { lineSource: "all_strength_legacy", fiveOnFiveUnitSeconds: null, promotions: [{ playerId: 1, previousLine: 2, currentLine: 1 }], demotions: [] }],
        ]) as any,
      )
      // Utah's fallback: last season's team 59, through the same reader.
      .mockResolvedValueOnce(
        new Map([
          [59, { lineSource: "five_on_five_observed", fiveOnFiveUnitSeconds: null, promotions: [{ playerId: 2, previousLine: 3, currentLine: 2 }], demotions: [] }],
        ]) as any,
      );

    const result = await getStaticProps({});
    if (!("props" in result)) throw new Error("expected props");
    const props = (await result.props) as any;

    expect(vi.mocked(getLatestLineChanges).mock.calls).toEqual([[[10, 22, 68]], [[59], 20242025]]);
    // EDM has fewer than two games and is skipped; UTA uses the fallback.
    expect(props.promotions.map((row: any) => `${row.abbreviation}:${row.playerId}:${row.lineSource}`)).toEqual([
      "TOR:1:all_strength_legacy",
      "UTA:2:five_on_five_observed",
    ]);
  });
});

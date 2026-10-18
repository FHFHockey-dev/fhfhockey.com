import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamDataWithTotals } from "lib/NHL/types";
import DesktopMasterTable from "./DesktopMasterTable";
import OpponentMetricsTable from "./OpponentMetricsTable";
import { OpponentMetricAverages, UseOpponentMetricsDataResult } from "./utils/useOpponentMetricsData";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("hooks/useTeams", () => ({ useTeamsMap: () => ({}) }));
vi.mock("components/common/OptimizedImage", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const columns: UseOpponentMetricsDataResult["metricColumns"] = [
  { label: "xGF", key: "avgXgf" }, { label: "xGA", key: "avgXga" }, { label: "GF", key: "avgGoalFor" },
  { label: "GA", key: "avgGoalAgainst" }, { label: "SF", key: "avgSf" }, { label: "SA", key: "avgSa" },
  { label: "PTS%", key: "avgWinPct" }
];
const full = { known: 1, expected: 1 };
const entries = [1, 2, 3, 4].map((teamId) => {
  const averages: OpponentMetricAverages = {
    avgXgf: teamId, avgXga: teamId, avgGoalFor: teamId, avgGoalAgainst: teamId,
    avgSf: 25 + teamId, avgSa: 25 + teamId, avgWinPct: teamId / 10
  };
  return {
    team: { teamId, teamAbbreviation: `T${teamId}` } as unknown as TeamDataWithTotals,
    averages,
    coverage: Object.fromEntries(columns.map(({ key }) => [key, full])) as UseOpponentMetricsDataResult["entries"][number]["coverage"]
  };
});
const metricsData = {
  entries, metricsByTeamId: {}, coverageByTeamId: {}, leagueAverages: {}, leagueCoverage: {},
  metricColumns: columns, statsLoading: false, statsError: null, sourceLabel: "fixture"
} as unknown as UseOpponentMetricsDataResult;

const saCells = () => screen.getAllByRole("row").slice(2).map((row) => within(row).getAllByRole("cell")[6]);

describe("OpponentMetricsTable perspective", () => {
  it("defaults to the skater view and uncolors mixed-sign metrics for goalies", () => {
    render(<OpponentMetricsTable teamData={entries.map(({ team }) => team)} metricsData={metricsData} />);
    const skaters = screen.getByRole("button", { name: "Skaters" });
    const goalies = screen.getByRole("button", { name: "Goalies" });
    expect(skaters.getAttribute("aria-pressed")).toBe("true");
    expect(saCells().every((cell) => cell.className !== "")).toBe(true);
    expect(screen.getByRole("columnheader", { name: /SA/ }).hasAttribute("data-uncolored")).toBe(false);

    fireEvent.click(goalies);
    expect(goalies.getAttribute("aria-pressed")).toBe("true");
    expect(skaters.getAttribute("aria-pressed")).toBe("false");
    expect(saCells().every((cell) => cell.className === "")).toBe(true);
    expect(screen.getByRole("columnheader", { name: /SA/ }).hasAttribute("data-uncolored")).toBe(true);
    expect(screen.getByRole("columnheader", { name: /xGF/ }).hasAttribute("data-uncolored")).toBe(false);
  });
});

describe("DesktopMasterTable perspective", () => {
  it("shares the skater default and the goalie split with the standalone table", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    render(<DesktopMasterTable
      start="2026-10-19" extended={false}
      scheduleRows={entries.map(({ team }) => ({ teamId: team.teamId, totalGamesPlayed: 3, totalOffNights: 1, weekScore: 1 }))}
      gamesPerDay={[4, 9, 3, 10, 4, 14, 3]} excludedDays={[]} setExcludedDays={vi.fn()}
      opponentMetricsByTeamId={Object.fromEntries(entries.map(({ team, averages }) => [team.teamId, averages]))}
      opponentMetricColumns={columns} opponentLeagueAverages={metricsData.leagueAverages as never}
      opponentMetricsLoading={false} opponentMetricsError={null}
      fourWeekSummaryByTeamId={{}} fourWeekAverages={{ gamesPlayed: null, offNights: null, avgOpponentPointPct: null, score: null }}
    />);
    const sa = () => screen.getAllByRole("link", { name: /Team HQ/ }).map((link) => link.closest("tr")!.querySelectorAll("td")[5].className);
    expect(sa().every((name) => /masterMetric(Good|Bad)/.test(name))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Goalies" }));
    expect(screen.getByRole("button", { name: "Goalies" }).getAttribute("aria-pressed")).toBe("true");
    expect(sa().some((name) => /masterMetric(Good|Bad)/.test(name))).toBe(false);
  });
});

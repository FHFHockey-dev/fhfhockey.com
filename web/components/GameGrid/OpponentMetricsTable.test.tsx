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
    team: { teamId, teamAbbreviation: `T${teamId}`, weeks: [], totals: { gamesPlayed: 1, offNights: 0, opponents: [], scheduleCoverage: full }, avgOpponentPointPct: null } as TeamDataWithTotals,
    averages,
    coverage: Object.fromEntries(columns.map(({ key }) => [key, full])) as UseOpponentMetricsDataResult["entries"][number]["coverage"]
  };
});
const metricsData = {
  entries, metricsByTeamId: {}, coverageByTeamId: {}, leagueAverages: {}, leagueCoverage: {},
  metricColumns: columns, statsLoading: false, statsError: null, sourceLabel: "fixture"
} as unknown as UseOpponentMetricsDataResult;

const saCells = () => screen.getAllByRole("row").slice(2).map((row) => within(row).getAllByRole("cell")[8]);

describe("OpponentMetricsTable perspective", () => {
  it("hides the role control and preserves the released skater colors", () => {
    render(<OpponentMetricsTable teamData={entries.map(({ team }) => team)} metricsData={metricsData} />);
    expect(screen.queryByRole("button", { name: "Skaters" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Goalies" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand opponent details" }));
    expect(saCells().every((cell) => cell.className !== "")).toBe(true);
    expect(screen.getByRole("columnheader", { name: /SA/ }).hasAttribute("data-uncolored")).toBe(false);
  });
});

describe("DesktopMasterTable perspective", () => {
  it("hides the role control and shares the unchanged skater default", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Expand opponent details" }));
    const sa = () => screen.getAllByRole("link", { name: /Team HQ/ }).map((link) => link.closest("tr")!.querySelectorAll("td")[7].className);
    expect(sa().every((name) => /masterMetric(Good|Bad)/.test(name))).toBe(true);
    expect(screen.queryByRole("button", { name: "Skaters" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Goalies" })).toBeNull();
  });
});

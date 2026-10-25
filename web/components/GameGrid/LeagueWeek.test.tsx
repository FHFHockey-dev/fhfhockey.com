import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAYS, EXTENDED_DAY_ABBREVIATION, GameData, WeekData } from "lib/NHL/types";
import DesktopMasterTable from "./DesktopMasterTable";
import { getRegularGamesPerDay } from "./utils/helper";
import { getTeamScheduleSummary } from "./utils/scheduleSummary";

// Real NHL week, Mon 2025-03-17 to Sun 2025-03-23 (32 teams, 52 games): opponent per day, "@" = away.
const WEEK: Record<string, string> = {
  ANA: ",@DAL,,@NSH,,,CAR", BOS: "BUF,,,@VGK,,@S.J,@L.A", BUF: "@BOS,,,@UTA,,@MIN,@WPG", CAR: ",,,@S.J,,@L.A,@ANA",
  CBJ: "N.J,,,FLA,@PIT,,", CGY: "@TOR,@NYR,,@N.J,,@NYI,", CHI: ",SEA,,L.A,,@STL,PHI", COL: ",,@TOR,@OTT,,@MTL,",
  DAL: ",ANA,,T.B,,PHI,", DET: ",@WSH,,,,@VGK,", EDM: ",UTA,,WPG,,SEA,", FLA: ",,,@CBJ,,@WSH,PIT",
  "L.A": "@MIN,,,@CHI,,CAR,BOS", MIN: "L.A,,SEA,,,BUF,", MTL: ",OTT,,@NYI,,COL,", "N.J": "@CBJ,,,CGY,,OTT,",
  NSH: ",STL,,ANA,,TOR,@STL", NYI: ",@PIT,,MTL,,CGY,", NYR: ",CGY,,TOR,,VAN,", OTT: ",@MTL,,COL,,@N.J,",
  PHI: "@T.B,,,@WSH,,@DAL,@CHI", PIT: ",NYI,,,CBJ,,@FLA", "S.J": ",,,CAR,,BOS,", SEA: ",@CHI,@MIN,,,@EDM,",
  STL: ",@NSH,,VAN,,CHI,NSH", "T.B": "PHI,,,@DAL,,@UTA,@VGK", TOR: "CGY,,COL,@NYR,,@NSH,", UTA: ",@EDM,,BUF,,T.B,",
  VAN: ",WPG,,@STL,,@NYR,", VGK: ",,,BOS,,DET,T.B", WPG: ",@VAN,,@EDM,,,BUF", WSH: ",DET,,PHI,,FLA,"
};
const ABBREVIATIONS = Object.keys(WEEK).sort();
const idOf = (abbreviation: string) => ABBREVIATIONS.indexOf(abbreviation) + 1;
const teams = Object.fromEntries(ABBREVIATIONS.map((abbreviation) => [idOf(abbreviation),
  { id: idOf(abbreviation), name: `Team ${abbreviation}`, abbreviation, logo: `/${abbreviation}.svg` }]));

vi.mock("hooks/useTeams", () => ({ useTeamsMap: () => teams }));
vi.mock("./contexts/GameGridContext", () => ({ useTeam: (id: number) => teams[id] }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

type Row = WeekData & { teamId: number };
function buildRows(edit?: (game: GameData) => GameData): Row[] {
  return ABBREVIATIONS.map((abbreviation) => {
    const row: Row = { teamId: idOf(abbreviation) };
    WEEK[abbreviation].split(",").forEach((cell, day) => {
      if (!cell) return;
      const opponent = idOf(cell.replace("@", "")), self = idOf(abbreviation);
      const [home, away] = cell.startsWith("@") ? [opponent, self] : [self, opponent];
      const game: GameData = { id: 2024010000 + day * 100 + Math.min(home, away), season: 20242025, gameType: 2,
        gameDate: `2025-03-${17 + day}`, homeTeam: { id: home }, awayTeam: { id: away } };
      row[DAYS[day]] = edit ? edit(game) : game;
    });
    return row;
  });
}
const masks = Array.from({ length: 127 }, (_, i) => i + 1).map((mask) =>
  DAYS.filter((_, day) => !(mask >> day & 1)) as EXTENDED_DAY_ABBREVIATION[]);
const allCovered = DAYS.map(() => true);

describe("Game Grid on a complete 32-team week", () => {
  const rows = buildRows();
  const perDay = getRegularGamesPerDay(rows);

  it("derives the league slate once per game from all 32 rows", () => {
    expect(rows).toHaveLength(32);
    expect(perDay).toEqual([5, 9, 2, 14, 1, 14, 7]);
  });

  it("keeps totals consistent and rankings guaranteed for every one of the 127 day masks", () => {
    for (const excluded of masks) {
      const summaries = rows.map((row) => getTeamScheduleSummary(row, perDay, excluded, DAYS, allCovered));
      const leagueGames = DAYS.reduce((sum, day, i) => sum + (excluded.includes(day) ? 0 : perDay[i]), 0);
      expect(summaries.reduce((sum, s) => sum + s.totalGamesPlayed, 0)).toBe(2 * leagueGames);
      summaries.forEach((s) => {
        expect(s.totalOffNights).toBeLessThanOrEqual(s.totalGamesPlayed);
        if (s.totalGamesPlayed === 0) { expect(s.weekScore).toBe(-100); return; }
        const { games, offNights, matchup, crowding } = s.scoreDecomposition;
        expect(games + offNights + matchup + crowding).toBeCloseTo(s.weekScore, 9);
        expect(s.crowding.status).toBe("available");
      });
      // 6×GP + 4×ON dominates the bounded matchup (≤1) and crowding (≤0.5) swings.
      for (const a of summaries) for (const b of summaries) {
        if (!a.totalGamesPlayed || !b.totalGamesPlayed) continue;
        const edge = 6 * (a.totalGamesPlayed - b.totalGamesPlayed) + 4 * (a.totalOffNights - b.totalOffNights);
        if (edge >= 2) expect(a.weekScore).toBeGreaterThan(b.weekScore);
      }
    }
  });

  it("withholds crowding (neutral, unavailable) when an included date is not covered", () => {
    const partial = [true, true, true, false, true, true, true];
    rows.forEach((row) => {
      const summary = getTeamScheduleSummary(row, perDay, [], DAYS, partial);
      if (summary.totalGamesPlayed) expect(summary.crowding).toMatchObject({ status: "unavailable", adjustment: 0 });
      // Excluding the uncovered date restores complete evidence.
      const excluded = getTeamScheduleSummary(row, perDay, ["THU"], DAYS, partial);
      if (excluded.totalGamesPlayed) expect(excluded.crowding.status).toBe("available");
    });
  });

  it("applies a postponement to both teams and the league slate only", () => {
    const changed = buildRows((game) => game.gameDate === "2025-03-20" && game.homeTeam.id === idOf("S.J")
      ? { ...game, gameScheduleState: "PPD" } : game);
    const changedPerDay = getRegularGamesPerDay(changed);
    expect(changedPerDay).toEqual([5, 9, 2, 13, 1, 14, 7]);
    changed.forEach((row, i) => {
      const before = getTeamScheduleSummary(rows[i], perDay).totalGamesPlayed;
      const after = getTeamScheduleSummary(row, changedPerDay).totalGamesPlayed;
      const affected = [idOf("S.J"), idOf("CAR")].includes(row.teamId);
      expect(after).toBe(affected ? before - 1 : before);
    });
  });

  it("returns the empty sentinel for an empty week", () => {
    const empty: Row[] = ABBREVIATIONS.map((abbreviation) => ({ teamId: idOf(abbreviation) }));
    expect(getRegularGamesPerDay(empty)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(getTeamScheduleSummary(empty[0], [0, 0, 0, 0, 0, 0, 0], [], DAYS, allCovered))
      .toMatchObject({ totalGamesPlayed: 0, totalOffNights: 0, weekScore: -100 });
  });

  it("renders all 32 team rows with aligned per-day totals and ranks them by Score", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const setExcludedDays = vi.fn();
    const scheduleRows = rows.map((row) => {
      const s = getTeamScheduleSummary(row, perDay, [], DAYS, allCovered);
      return { ...row, totalGamesPlayed: s.totalGamesPlayed, totalOffNights: s.totalOffNights, weekScore: s.weekScore };
    });
    render(<DesktopMasterTable
      start="2025-03-17" extended={false} scheduleRows={scheduleRows} gamesPerDay={perDay}
      excludedDays={[]} setExcludedDays={setExcludedDays}
      opponentMetricsByTeamId={{}} opponentMetricColumns={[]}
      opponentLeagueAverages={{ avgXgf: null, avgXga: null, avgSf: null, avgSa: null, avgGoalFor: null, avgGoalAgainst: null, avgWinPct: null }}
      opponentMetricsLoading={false} opponentMetricsError={null}
      fourWeekSummaryByTeamId={{}} fourWeekAverages={{ gamesPlayed: null, offNights: null, avgOpponentPointPct: null, score: null }}
    />);
    const links = () => screen.getAllByRole("link", { name: /^Open Team .+ Team HQ$/ });
    expect(links()).toHaveLength(32);

    const totals = screen.getByText("GP/Day").closest("tr")!;
    const totalCells = within(totals).getAllByRole("cell");
    const firstDay = totalCells.findIndex((cell) => cell.textContent?.startsWith("GP/Day")) + 1;
    const dayCells = totalCells.slice(firstDay, firstDay + 7).map((cell) => cell.textContent);
    expect(dayCells).toEqual(perDay.map(String));

    fireEvent.click(screen.getByRole("button", { name: "Sort by Score descending" }));
    const expected = [...scheduleRows].sort((a, b) => b.weekScore - a.weekScore || teams[a.teamId].name.localeCompare(teams[b.teamId].name));
    expect(links().map((link) => link.getAttribute("aria-label"))).toEqual(expected.map(({ teamId }) => `Open ${teams[teamId].name} Team HQ`));

    fireEvent.click(screen.getByRole("switch", { name: "Include THU games" }));
    expect(setExcludedDays).toHaveBeenCalled();
  });
});

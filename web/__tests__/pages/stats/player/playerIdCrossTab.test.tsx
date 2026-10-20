import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same fixture, all five tabs: counts, denominators, season context and SH%
// must agree. Only chart canvases and the search bar are stubbed.
const { fromMock, radarMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  radarMock: vi.fn((_props: Record<string, unknown>) => null)
}));
vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));
vi.mock("next/router", () => ({
  useRouter: () => ({ query: { playerId: "8485406" } })
}));
vi.mock("next-seo", () => ({ NextSeo: () => null }));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({ default: () => null }));
vi.mock("components/PlayerStats/PlayerRadarChart", () => ({ PlayerRadarChart: radarMock }));
vi.mock("components/PlayerStats/PlayerStatsChart", () => ({ PlayerStatsChart: () => null }));

import PlayerStatsPage, { getServerSideProps } from "pages/stats/player/[playerId]";

type Row = Record<string, unknown> & { date: string };

const day = (month: number, d: number, year = 2026) =>
  `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const skaterRow = (date: string, goals: number, shots: number, extra: Record<string, unknown> = {}): Row => ({
  date,
  games_played: 1,
  goals,
  assists: 0,
  points: goals,
  shots,
  shooting_percentage: shots > 0 ? goals / shots : null,
  fow_percentage: 0.5,
  toi_per_game: 900,
  ...extra
});

const schedule = (date: string, extra: Record<string, unknown> = {}) => ({
  date,
  gameId: Number(date.replace(/-/g, "")),
  homeTeamId: 1,
  awayTeamId: 2,
  isPlayoff: false,
  seasonId: 20262027,
  ...extra
});

function renderPage(props: Record<string, unknown>) {
  return render(
    React.createElement(PlayerStatsPage, {
      player: { id: 8485406, fullName: "Fixture Skater", position: "C", team_id: 1 },
      playoffGameLog: [],
      seasonTotals: [],
      isGoalie: false,
      availableSeasons: [],
      availableSeasonsFormatted: [],
      asOfDate: "2026-10-20",
      ...props
    } as any)
  );
}

const openTab = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

// Value rendered immediately before / after a label in the stat groups.
const valueBefore = (label: string) =>
  screen.getByText(label).previousElementSibling?.textContent;
const valueAfter = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent;

function snapshotAllTabs() {
  openTab("Overview");
  const overview = {
    availability: screen.queryByText(/possible games|games played \(/)?.textContent ?? null,
    shooting: screen.queryByText("Shooting %") ? valueAfter("Shooting %") : null,
    calendarGames: screen.queryByText("Games Played") ? valueBefore("Games Played") : null,
    calendarMissed: screen.queryByText("Missed Games") ? valueBefore("Missed Games") : null,
    calendarUpcoming: screen.queryByText("Upcoming Games") ? valueBefore("Upcoming Games") : null
  };

  openTab("Advanced");
  const advanced = {
    availability: screen.queryByText(/possible games|games played \(/)?.textContent ?? null,
    radar: radarMock.mock.lastCall?.[0],
    tableGames: screen.queryByText(/^Games: /)?.textContent ?? null
  };

  openTab("Trends");
  fireEvent.click(screen.getByLabelText("SHOOTING PERCENTAGE"));
  const trends = {
    shooting: screen.queryByText("SH%") ? valueAfter("SH%") : null,
    gamesPlayed: screen.queryAllByText(/games played$/)[0]?.textContent ?? null
  };

  openTab("Calendar");
  const calendar = {
    games: screen.queryByText("Games Played") ? valueBefore("Games Played") : null,
    missed: screen.queryByText("Missed Games") ? valueBefore("Missed Games") : null,
    upcoming: screen.queryByText("Upcoming Games") ? valueBefore("Upcoming Games") : null
  };

  openTab("Gamelog");
  const gamelog = {
    header: screen.queryByText(/^Games: /)?.textContent ?? null,
    rows: Math.max(0, screen.queryAllByRole("row").length - 1),
    missedRows: screen.queryAllByAltText("Missed Game").length
  };

  return { overview, advanced, trends, calendar, gamelog };
}

describe("player page cross-tab contract", () => {
  beforeEach(() => {
    fromMock.mockReset();
    radarMock.mockClear();
  });
  afterEach(cleanup);

  it("early season: future games are not absences and every tab counts 10 games", () => {
    // Provider order is newest first; the opener is on Sept 30 / Oct 1.
    const gameLog = [
      skaterRow(day(10, 18), 1, 3),
      skaterRow(day(10, 16), 0, 2),
      skaterRow(day(10, 14), 1, 2),
      skaterRow(day(10, 11), 0, 1),
      skaterRow(day(10, 9), 0, 0),
      skaterRow(day(10, 7), 0, 1),
      skaterRow(day(10, 5), 0, 0),
      skaterRow(day(10, 3), 0, 1),
      skaterRow(day(10, 1), 0, 0),
      skaterRow(day(9, 30), 0, 1)
    ];
    const missedGames = [
      schedule(day(10, 22), { isFuture: true }),
      schedule(day(10, 24), { isFuture: true }),
      schedule(day(10, 27), { isFuture: true }),
      schedule(day(10, 29), { isFuture: true }),
      schedule(day(10, 31), { isFuture: true })
    ];

    renderPage({ gameLog, missedGames, mostRecentSeason: 20262027 });
    const tabs = snapshotAllTabs();

    expect(tabs.overview.availability).toBe("10 of 10 possible games");
    expect(tabs.advanced.availability).toBe("10 of 10 possible games");
    expect(tabs.overview.calendarGames).toBe("10");
    expect(tabs.calendar.games).toBe("10");
    expect(tabs.overview.calendarMissed).toBe("0");
    expect(tabs.calendar.missed).toBe("0");
    expect(tabs.overview.calendarUpcoming).toBe("5");
    expect(tabs.calendar.upcoming).toBe("5");
    expect(tabs.advanced.tableGames).toBe("Games: 10");
    expect(tabs.gamelog.header).toBe("Games: 10");
    expect(tabs.gamelog.rows).toBe(10);
    expect(tabs.gamelog.missedRows).toBe(0);
    expect(tabs.trends.gamesPlayed).toBe("10 games played");

    // 2 goals on 11 shots, everywhere.
    expect(tabs.overview.shooting).toBe("18.2%");
    expect(tabs.trends.shooting).toBe("18.2%");

    expect(tabs.advanced.radar).toMatchObject({
      seasonId: 20262027,
      timeFrame: "season",
      usedGameLogFallback: false
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("game log shows a 1-goal/3-shot row as 33.3%, not 0.3%", () => {
    renderPage({ gameLog: [skaterRow(day(10, 18), 1, 3)], missedGames: [], mostRecentSeason: 20262027 });
    openTab("Trends");
    fireEvent.click(screen.getByLabelText("SHOOTING PERCENTAGE"));
    openTab("Gamelog");
    expect(screen.getByText("33.3%")).toBeTruthy();
    expect(screen.queryByText("0.3%")).toBeNull();
  });

  it("historical season: elapsed absences agree across tabs", () => {
    const gameLog = [
      skaterRow("2024-01-10", 1, 4),
      skaterRow("2024-01-06", 0, 2),
      skaterRow("2024-01-02", 1, 2)
    ];
    const missedGames = [
      schedule("2024-01-04", { seasonId: 20232024 }),
      schedule("2024-01-08", { seasonId: 20232024 })
    ];
    renderPage({ gameLog, missedGames, mostRecentSeason: 20232024 });
    const tabs = snapshotAllTabs();

    expect(tabs.overview.availability).toBe("3 of 5 possible games (2 missed)");
    expect(tabs.advanced.availability).toBe("3 of 5 possible games (2 missed)");
    expect(tabs.overview.calendarGames).toBe("3");
    expect(tabs.calendar.games).toBe("3");
    expect(tabs.calendar.missed).toBe("2");
    expect(tabs.calendar.upcoming).toBe("0");
    expect(tabs.gamelog.header).toBe("Games: 3 | Missed: 2");
    expect(tabs.gamelog.rows).toBe(5);
    expect(tabs.gamelog.missedRows).toBe(2);
    expect(tabs.advanced.radar).toMatchObject({ seasonId: 20232024 });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("no shots: SH% is unavailable rather than 0%", () => {
    const gameLog = [skaterRow(day(10, 3), 0, 0), skaterRow(day(10, 1), 0, 0)];
    renderPage({ gameLog, missedGames: [], mostRecentSeason: 20262027 });
    const tabs = snapshotAllTabs();
    expect(tabs.overview.shooting).toBeNull();
    expect(tabs.trends.shooting).toBe("-");
    expect(tabs.gamelog.header).toBe("Games: 2");
  });

  it("partial provider data: a row without games_played is not counted anywhere", () => {
    const gameLog = [
      skaterRow(day(10, 5), 1, 2),
      skaterRow(day(10, 3), 0, 1, { games_played: null }),
      skaterRow(day(10, 1), 0, 2)
    ];
    renderPage({ gameLog, missedGames: [], mostRecentSeason: 20262027 });
    const tabs = snapshotAllTabs();
    expect(tabs.overview.availability).toBe("2 of 2 possible games");
    expect(tabs.calendar.games).toBe("2");
    expect(tabs.advanced.tableGames).toBe("Games: 2");
    expect(tabs.gamelog.header).toBe("Games: 2");
    expect(tabs.trends.gamesPlayed).toBe("2 games played");
  });

  it("unknown schedule: availability is reported unavailable, not 100%", () => {
    const gameLog = [skaterRow(day(10, 3), 0, 1)];
    renderPage({ gameLog, missedGames: null, mostRecentSeason: 20262027 });
    const tabs = snapshotAllTabs();
    expect(tabs.overview.availability).toBe("1 games played (schedule unavailable)");
    expect(tabs.advanced.availability).toBe("1 games played (schedule unavailable)");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("no games: every tab renders without inventing counts", () => {
    renderPage({ gameLog: [], missedGames: [], mostRecentSeason: 20262027 });
    const tabs = snapshotAllTabs();
    expect(tabs.overview.availability).toBeNull();
    expect(tabs.calendar.games).toBeNull();
    // Honest empty state instead of a zero-count table.
    expect(tabs.gamelog.header).toBeNull();
    expect(tabs.gamelog.rows).toBe(0);
    expect(screen.getByText("No game data available")).toBeTruthy();
    expect(tabs.trends.shooting).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("season reads are bounded by date: a 2012 row labelled 20242025 is ignored everywhere", async () => {
    // In-memory stand-in for the PostgREST builder; supports the filters the
    // route uses and nothing else.
    const tables: Record<string, Record<string, any>[]> = {
      players: [{ id: 8485406, fullName: "Window Skater", position: "C", team_id: 1 }],
      wgo_skater_stats_totals: [{ season: "20242025", games_played: 3 }],
      wgo_skater_stats: [
        skaterRow("2024-10-10", 1, 3, { player_id: 8485406, season_id: 20242025 }),
        skaterRow("2024-10-12", 0, 2, { player_id: 8485406, season_id: 20242025 }),
        skaterRow("2024-10-15", 1, 2, { player_id: 8485406, season_id: 20242025 }),
        // Mislabelled provider row from another era.
        skaterRow("2012-03-01", 3, 3, { player_id: 8485406, season_id: 20242025 })
      ],
      wgo_skater_stats_playoffs: [],
      nst_gamelog_as_counts: [],
      nst_gamelog_as_counts_oi: [],
      nst_gamelog_as_rates: [],
      nst_gamelog_as_rates_oi: [],
      player_lineup_deployment_tallies: [],
      seasons: [{ id: 20242025, startDate: "2024-10-04", endDate: "2025-06-17", regularSeasonEndDate: "2025-04-17" }],
      games: [
        ...["2024-10-10", "2024-10-12", "2024-10-13", "2024-10-15"].map((date, i) => ({
          id: i + 1, date, seasonId: 20242025, type: 2, homeTeamId: 1, awayTeamId: 2
        })),
        { id: 99, date: "2012-03-02", seasonId: 20242025, type: 2, homeTeamId: 1, awayTeamId: 2 }
      ]
    };
    const fakeQuery = (rows: Record<string, any>[]) => {
      let out = [...rows];
      let single = false;
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => ((out = out.filter((r) => String(r[c]) === String(v))), q),
        gt: (c: string, v: any) => ((out = out.filter((r) => r[c] > v)), q),
        gte: (c: string, v: any) => ((out = out.filter((r) => r[c] >= v)), q),
        lt: (c: string, v: any) => ((out = out.filter((r) => r[c] < v)), q),
        lte: (c: string, v: any) => ((out = out.filter((r) => r[c] <= v)), q),
        or: (expr: string) => {
          const parts = expr.split(",").map((p) => p.split(".eq."));
          out = out.filter((r) => parts.some(([c, v]) => String(r[c]) === v));
          return q;
        },
        order: (c: string, opts?: { ascending?: boolean }) => {
          const dir = opts?.ascending === false ? -1 : 1;
          out.sort((a, b) => (a[c] > b[c] ? dir : a[c] < b[c] ? -dir : 0));
          return q;
        },
        range: (from: number, to: number) => ((out = out.slice(from, to + 1)), q),
        limit: (n: number) => ((out = out.slice(0, n)), q),
        maybeSingle: () => ((single = true), q),
        single: () => ((single = true), q),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve({ data: single ? (out[0] ?? null) : out, error: null }).then(resolve, reject)
      };
      return q;
    };
    fromMock.mockImplementation((table: string) => fakeQuery(tables[table] ?? []));

    const result: any = await getServerSideProps({
      query: { playerId: "8485406", season: "20242025" }
    } as any);
    expect(result.props.gameLog.map((g: Row) => g.date).sort()).toEqual([
      "2024-10-10",
      "2024-10-12",
      "2024-10-15"
    ]);
    expect(result.props.missedGames.map((g: Row) => g.date)).toEqual(["2024-10-13"]);

    fromMock.mockReset();
    renderPage(result.props);
    const tabs = snapshotAllTabs();
    expect(tabs.overview.availability).toBe("3 of 4 possible games (1 missed)");
    expect(tabs.calendar.games).toBe("3");
    expect(tabs.calendar.missed).toBe("1");
    expect(tabs.gamelog.header).toBe("Games: 3 | Missed: 1");
    expect(tabs.trends.gamesPlayed).toBe("3 games played");
    // 2 goals on 7 shots; the 2012 row's 3-for-3 would make it 5/10.
    expect(tabs.overview.shooting).toBe("28.6%");
    expect(tabs.trends.shooting).toBe("28.6%");
  });
});

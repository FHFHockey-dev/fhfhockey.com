import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Preflight freshness anchoring (TJ, 2026-10-26): run-projection-v2?date=2026-11-01 failed its preflight on 10-26
// because the backward-looking windows ended at the game date, past any data that can exist yet. These tests run
// the real preflight against an in-memory Supabase fixture; no production reads.

type Row = Record<string, unknown>;

const { tables } = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

function fixtureQuery(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let count = false;
  let head = false;
  let order: { key: string; ascending: boolean } | null = null;
  let limit: number | null = null;
  const rows = () => {
    let out = (tables[table] ?? []).filter((row) => filters.every((keep) => keep(row)));
    if (order) {
      const { key, ascending } = order;
      out = [...out].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
    }
    return limit === null ? out : out.slice(0, limit);
  };
  const result = () => {
    const data = rows();
    return { data: head ? null : data, count: count ? data.length : null, error: null };
  };
  const query: any = {
    select: (_columns: string, options?: { count?: string; head?: boolean }) => {
      count = Boolean(options?.count);
      head = Boolean(options?.head);
      return query;
    },
    eq: (key: string, value: unknown) => (filters.push((row) => row[key] === value), query),
    in: (key: string, values: unknown[]) => (filters.push((row) => values.includes(row[key])), query),
    lt: (key: string, value: string) => (filters.push((row) => String(row[key]) < value), query),
    gte: (key: string, value: string) => (filters.push((row) => String(row[key]) >= value), query),
    or: (expression: string) => {
      const clauses = expression.split(",").map((clause) => clause.split(".eq."));
      filters.push((row) => clauses.some(([key, value]) => String(row[key]) === value));
      return query;
    },
    order: (key: string, options?: { ascending?: boolean }) => {
      order = { key, ascending: options?.ascending !== false };
      return query;
    },
    limit: (n: number) => ((limit = n), query),
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };
  return query;
}

vi.mock("lib/supabase/server", () => ({ default: { from: (table: string) => fixtureQuery(table) } }));
vi.mock("lib/supabase", () => ({ default: { from: (table: string) => fixtureQuery(table) } }));
vi.mock("lib/NHL/server", () => ({ resolveLatestStartedSeasonIdForDate: vi.fn(async () => 20262027) }));
vi.mock("lib/projections/run-forge-projections", () => ({ runProjectionV2ForDate: vi.fn() }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: unknown) => handler }));
// Played games (dated before the frozen clock's today) have terminal PBP and complete shifts.
vi.mock("lib/projections/pbpCompletenessServer", () => ({
  classifyStoredPbpGames: vi.fn(async (gameIds: number[]) =>
    new Map(gameIds.map((id) => [id, String(tables.games.find((game) => game.id === id)?.date) < TODAY]))),
}));
vi.mock("lib/projections/shiftChartCompletenessServer", () => ({
  classifyStoredShiftChartStrengthGamesAgainstRawSource: vi.fn(async (gameIds: number[]) =>
    new Map(gameIds.map((id) => [id, { status: "complete", rowCount: 40 }]))),
}));

import {
  preflightFreshnessAnchorDate,
  runProjectionPreflightChecks,
} from "../../../../../pages/api/v1/db/run-projection-v2";

const TODAY = "2026-10-26";
const ROLE_PLAYERS = Array.from({ length: 12 }, (_, index) => index + 1);

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Teams 1 and 2 play `slateDate`. Each played its latest game on the given date, with line combinations and
 * derived skater, team and goalie rows for it; the slate has goalie start priors unless `goaliePriors` is false. */
function seed(args: { slateDate: string; lastPlayed: Record<1 | 2, string>; goaliePriors?: boolean }) {
  const played = ([1, 2] as const).map((teamId) => ({
    id: 100 + teamId,
    date: args.lastPlayed[teamId],
    homeTeamId: teamId,
    awayTeamId: 30 + teamId,
  }));
  tables.games = [...played, { id: 500, date: args.slateDate, homeTeamId: 1, awayTeamId: 2 }];
  tables.teams = [{ id: 1 }, { id: 2 }];
  tables.players = [{ id: 1 }];
  tables.lineCombinations = played.map((game) => ({
    gameId: game.id,
    teamId: game.homeTeamId,
    forwards: ROLE_PLAYERS.slice(0, 6),
    defensemen: ROLE_PLAYERS.slice(6),
    goalies: [],
  }));
  const derived = played.map((game) => ({ team_id: game.homeTeamId, player_id: game.id, game_date: game.date }));
  tables.forge_player_game_strength = derived;
  tables.forge_team_game_strength = derived;
  tables.forge_goalie_game = derived;
  tables.goalie_start_projections = args.goaliePriors === false ? [] : [{ game_id: 500 }];
  tables.rosters = [];
}

const failing = (summary: Awaited<ReturnType<typeof runProjectionPreflightChecks>>) =>
  summary.gates.filter((gate) => gate.status === "FAIL").map((gate) => gate.gate_key);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T16:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runProjectionPreflightChecks freshness anchoring", () => {
  // Fresh as of today: team 1 played yesterday, team 2 four days ago (a normal break).
  const fresh = { 1: addDays(TODAY, -1), 2: addDays(TODAY, -4) } as const;

  it("passes today's slate on today-fresh inputs", async () => {
    seed({ slateDate: TODAY, lastPlayed: fresh });
    const summary = await runProjectionPreflightChecks(TODAY, false);
    expect(failing(summary)).toEqual([]);
    expect(summary).toMatchObject({ status: "PASS", freshnessAnchorDate: TODAY });
  });

  it.each([4, 5, 6])("passes a slate %i days ahead on the same today-fresh inputs", async (daysAhead) => {
    const slateDate = addDays(TODAY, daysAhead);
    seed({ slateDate, lastPlayed: fresh });
    const summary = await runProjectionPreflightChecks(slateDate, false);
    expect(failing(summary)).toEqual([]);
    expect(summary).toMatchObject({ asOfDate: slateDate, status: "PASS", freshnessAnchorDate: TODAY });
  });

  it("passes a slate 6 days ahead after a league off-day, as today's run would", async () => {
    const offDay = { 1: addDays(TODAY, -2), 2: addDays(TODAY, -3) } as const;
    seed({ slateDate: TODAY, lastPlayed: offDay });
    expect(failing(await runProjectionPreflightChecks(TODAY, false))).toEqual([]);
    const slateDate = addDays(TODAY, 6);
    seed({ slateDate, lastPlayed: offDay });
    expect(failing(await runProjectionPreflightChecks(slateDate, false))).toEqual([]);
  });

  it("fails a future slate whose inputs are stale as of today, exactly as today's run does", async () => {
    // Team 2's newest derived rows are 8 days old: outside today's 7-day window.
    const stale = { 1: addDays(TODAY, -1), 2: addDays(TODAY, -8) } as const;
    seed({ slateDate: TODAY, lastPlayed: stale });
    const todaySummary = await runProjectionPreflightChecks(TODAY, false);
    expect(failing(todaySummary)).toEqual(["skater_derived_freshness"]);
    for (const daysAhead of [1, 4, 6]) {
      const slateDate = addDays(TODAY, daysAhead);
      seed({ slateDate, lastPlayed: stale });
      const summary = await runProjectionPreflightChecks(slateDate, false);
      expect(summary.status).toBe("FAIL");
      expect(failing(summary)).toEqual(["skater_derived_freshness"]);
    }
  });

  it("fails a future slate whose line combinations are hard-stale as of today", async () => {
    const lineStale = { 1: addDays(TODAY, -1), 2: addDays(TODAY, -22) } as const;
    seed({ slateDate: addDays(TODAY, 5), lastPlayed: lineStale });
    const summary = await runProjectionPreflightChecks(addDays(TODAY, 5), false);
    expect(failing(summary)).toEqual(expect.arrayContaining(["skater_line_freshness", "skater_derived_freshness"]));
  });

  it("still requires goalie start priors for the future slate's scheduled games", async () => {
    const slateDate = addDays(TODAY, 6);
    seed({ slateDate, lastPlayed: fresh, goaliePriors: false });
    const summary = await runProjectionPreflightChecks(slateDate, false);
    expect(failing(summary)).toEqual(["goalie_start_priors_v2"]);
    expect(summary.gates.find((gate) => gate.gate_key === "goalie_start_priors_v2")?.action).toContain(
      `date=${slateDate}`,
    );
  });

  it("anchors a past slate at its own date, not today", async () => {
    // A 10-20 slate may not count data from after 10-20: team 2's only game is 10-22.
    const slateDate = addDays(TODAY, -6);
    seed({ slateDate, lastPlayed: { 1: addDays(TODAY, -7), 2: addDays(TODAY, -4) } });
    const summary = await runProjectionPreflightChecks(slateDate, false);
    expect(summary.freshnessAnchorDate).toBe(slateDate);
    expect(failing(summary)).toEqual(
      expect.arrayContaining(["line_combinations", "skater_role_coverage", "skater_derived_freshness"]),
    );
  });
});

describe("preflightFreshnessAnchorDate", () => {
  it("is the as-of date up to today (UTC, the route's default date) and today after it", () => {
    const noonEt = new Date("2026-10-26T16:00:00.000Z");
    expect(preflightFreshnessAnchorDate("2026-10-20", noonEt)).toBe("2026-10-20");
    expect(preflightFreshnessAnchorDate("2026-10-26", noonEt)).toBe("2026-10-26");
    expect(preflightFreshnessAnchorDate("2026-11-01", noonEt)).toBe("2026-10-26");
    // 9 p.m. ET on 10-26 is already 10-27 in UTC: the ET date keeps its own anchor, and the default (UTC) date's
    // run is checked as strictly as before.
    const eveningEt = new Date("2026-10-27T01:00:00.000Z");
    expect(preflightFreshnessAnchorDate("2026-10-26", eveningEt)).toBe("2026-10-26");
    expect(preflightFreshnessAnchorDate("2026-10-27", eveningEt)).toBe("2026-10-27");
    expect(preflightFreshnessAnchorDate("2026-11-01", eveningEt)).toBe("2026-10-27");
  });
});

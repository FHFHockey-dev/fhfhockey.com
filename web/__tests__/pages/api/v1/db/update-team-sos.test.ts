import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
});

const { fetchCurrentSeasonMock, writes } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
  writes: [] as Array<{ table: string; rows: any[]; options: any }>,
}));

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: unknown) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: unknown) => handler,
  nhlCalendarDate: (now: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
}));
vi.mock("utils/fetchCurrentSeason", () => ({ fetchCurrentSeason: fetchCurrentSeasonMock }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: [], error: null }),
        upsert: (rows: any[], options: any) => {
          writes.push({ table, rows, options });
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  }),
}));

import handler from "../../../../../pages/api/v1/db/update-team-sos";

const SEASON = 20252026;
/** An ad-hoc run while the 2026-01-14 (ET) slate is in progress. */
const RUN_AT = "2026-01-15T03:00:00.000Z";

type Game = {
  id: number;
  home: string;
  away: string;
  gameDate: string;
  start: string;
  gameState: string;
  scheduleState?: string;
  score?: [number, number];
  period?: string;
};

const BASE_GAMES: Game[] = [
  { id: 2025020101, home: "ANA", away: "BOS", gameDate: "2026-01-09", start: "2026-01-10T00:00:00Z", gameState: "OFF", score: [3, 1], period: "REG" },
  { id: 2025020102, home: "BOS", away: "BUF", gameDate: "2026-01-10", start: "2026-01-11T00:00:00Z", gameState: "OFF", score: [2, 3], period: "OT" },
  { id: 2025020103, home: "BUF", away: "CGY", gameDate: "2026-01-11", start: "2026-01-12T00:00:00Z", gameState: "OFF", score: [1, 4], period: "REG" },
  { id: 2025020104, home: "CGY", away: "ANA", gameDate: "2026-01-12", start: "2026-01-13T00:00:00Z", gameState: "OFF", score: [2, 5], period: "REG" },
  { id: 2025020105, home: "BOS", away: "CGY", gameDate: "2026-01-13", start: "2026-01-14T00:00:00Z", gameState: "OFF", score: [4, 2], period: "REG" },
  { id: 2025020106, home: "CHI", away: "BUF", gameDate: "2026-01-11", start: "2026-01-12T01:00:00Z", gameState: "OFF", score: [2, 1], period: "SO" },
  // Postponed before the cutoff: pending, never played.
  { id: 2025020107, home: "ANA", away: "CBJ", gameDate: "2026-01-13", start: "2026-01-14T00:30:00Z", gameState: "FUT", scheduleState: "PPD" },
  // Started but not final at the run: pending, never played.
  { id: 2025020108, home: "CAR", away: "ANA", gameDate: "2026-01-14", start: "2026-01-15T00:30:00Z", gameState: "LIVE", score: [1, 1] },
  // Scheduled for today's date (the run's UTC date) but not started: future.
  { id: 2025020109, home: "ANA", away: "CHI", gameDate: "2026-01-15", start: "2026-01-16T00:00:00Z", gameState: "FUT" },
  { id: 2025020110, home: "BOS", away: "ANA", gameDate: "2026-01-17", start: "2026-01-18T00:00:00Z", gameState: "FUT" },
];

let games: Game[] = BASE_GAMES;

const toNhl = (game: Game) => ({
  id: game.id,
  season: SEASON,
  gameType: 2,
  gameDate: game.gameDate,
  startTimeUTC: game.start,
  gameState: game.gameState,
  gameScheduleState: game.scheduleState ?? "OK",
  homeTeam: { abbrev: game.home, id: 1, ...(game.score ? { score: game.score[0] } : {}) },
  awayTeam: { abbrev: game.away, id: 2, ...(game.score ? { score: game.score[1] } : {}) },
  ...(game.period ? { gameOutcome: { lastPeriodType: game.period } } : {}),
});

/** Real standings (head-to-head included), for the legacy path only. */
const standings = () => {
  const table = new Map<string, { wins: number; losses: number; otLosses: number }>();
  const row = (team: string) => {
    if (!table.has(team)) table.set(team, { wins: 0, losses: 0, otLosses: 0 });
    return table.get(team)!;
  };
  games.filter((g) => g.gameState === "OFF").forEach((g) => {
    const [h, a] = g.score!;
    const [winner, loser] = h > a ? [g.home, g.away] : [g.away, g.home];
    row(winner).wins += 1;
    if (g.period === "REG") row(loser).losses += 1;
    else row(loser).otLosses += 1;
  });
  ["ANA", "BOS", "BUF", "CGY", "CHI", "CAR", "CBJ"].forEach(row);
  return [...table].map(([abbrev, r], i) => ({
    teamAbbrev: { default: abbrev }, teamId: i + 1, ...r,
    points: 2 * r.wins + r.otLosses, gamesPlayed: r.wins + r.losses + r.otLosses,
  }));
};

const fetchMock = vi.fn(async (url: string) => {
  const club = url.match(/club-schedule-season\/([A-Z]{3})\//);
  const body = club
    ? { games: games.filter((g) => g.home === club[1] || g.away === club[1]).map(toNhl) }
    : url.includes("/standings/")
      ? { standings: standings() }
      : null;
  if (!body) throw new Error(`unexpected URL ${url}`);
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
});

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  } as any;
}

const run = async (query: Record<string, string> = {}) => {
  const res = createRes();
  await handler({ method: "GET", query } as any, res);
  return res;
};

/** ANA's most recent written row, whichever table the writer used. */
const latestRow = (team: string) => {
  const rows = writes.flatMap((write) => write.rows).filter((row) => row.team_abbrev === team);
  const date = (row: any) => String(row.snapshot_date ?? row.game_date);
  return rows.sort((a, b) => date(b).localeCompare(date(a)))[0];
};
const opponents = (list: any[] | undefined) => (list ?? []).map((entry) => entry.opponent);

describe("/api/v1/db/update-team-sos (descriptive-sos-v2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(RUN_AT));
    writes.length = 0;
    games = BASE_GAMES;
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    fetchCurrentSeasonMock.mockResolvedValue({
      id: SEASON,
      startDate: "2026-01-14",
      endDate: "2026-04-16",
      regularSeasonEndDate: "2026-04-16",
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts only final games as past; today's unplayed game is future and started or postponed games are pending", async () => {
    const res = await run();
    expect(res.statusCode).toBe(200);
    const ana = latestRow("ANA");

    // Old writer: every gameDate <= the run's UTC date was "past" (CBJ, CAR and CHI included).
    expect(opponents(ana.past_opponents)).toEqual(["BOS", "CGY"]);
    expect(opponents(ana.future_opponents)).toEqual(["CHI", "BOS"]);
    expect(ana.pending_games).toEqual([
      { game_id: 2025020107, opponent: "CBJ", starts_at: "2026-01-14T00:30:00.000Z", game_state: "FUT", schedule_state: "PPD" },
      { game_id: 2025020108, opponent: "CAR", starts_at: "2026-01-15T00:30:00.000Z", game_state: "LIVE", schedule_state: "OK" },
    ]);
    expect(ana).toMatchObject({
      sos_version: "descriptive-sos-v2",
      past_view: "past-retrospective",
      snapshot_date: "2026-01-14",
      past_fixtures: 2,
      pending_fixtures: 2,
      future_fixtures: 2,
    });
    expect(ana.cutoff_at > RUN_AT).toBe(true);
    expect(writes.map((write) => write.table)).toEqual(["team_sos_daily"]);
    expect(writes[0].options).toEqual({ onConflict: "season_id,snapshot_date,team_id,sos_version" });
    expect(writes[0].rows).toHaveLength(32);
  });

  it("values opponents by their records excluding games against the team (fixture means)", async () => {
    await run();
    const ana = latestRow("ANA");
    // BOS without ANA: W vs CGY, OTL vs BUF -> win 1/2, points 3/4. CGY without ANA: 1-1-0.
    expect(ana.past_direct_win_pct).toBeCloseTo((0.5 + 0.5) / 2, 12);
    expect(ana.past_direct_points_pct).toBeCloseTo((0.75 + 0.5) / 2, 12);
    // Future: CHI 1-0-0 (shootout win), BOS as above.
    expect(ana.future_direct_win_pct).toBeCloseTo((1 + 0.5) / 2, 12);
    expect(ana.future_direct_points_pct).toBeCloseTo((1 + 0.75) / 2, 12);

    // Flipping ANA vs BOS leaves ANA's past SOS unchanged (head-to-head excluded).
    writes.length = 0;
    games = BASE_GAMES.map((g) => (g.id === 2025020101 ? { ...g, score: [1, 3] as [number, number] } : g));
    await run();
    const flipped = latestRow("ANA");
    expect(flipped.past_direct_win_pct).toBe(ana.past_direct_win_pct);
    expect(flipped.past_direct_points_pct).toBe(ana.past_direct_points_pct);
  });

  it("uses only the 32 club schedules (no per-date standings requests)", async () => {
    await run();
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.includes("/club-schedule-season/"))).toHaveLength(32);
    expect(urls.filter((url) => url.includes("/standings/"))).toEqual([]);
    expect(urls).toHaveLength(32);
  });

  it("keeps a final without a complete result pending and drops cancelled fixtures", async () => {
    games = [
      ...BASE_GAMES.map((g) => (g.id === 2025020104 ? { ...g, period: undefined } : g)),
      { id: 2025020111, home: "ANA", away: "BUF", gameDate: "2026-01-08", start: "2026-01-09T00:00:00Z", gameState: "FUT", scheduleState: "CNCL" },
    ];
    const res = await run();
    const ana = latestRow("ANA");
    expect(opponents(ana.past_opponents)).toEqual(["BOS"]);
    expect(opponents(ana.pending_games)).toEqual(["CGY", "CBJ", "CAR"]);
    expect(res.body.issues).toEqual({
      cancelledFixturesExcluded: 1,
      postponedFixtures: 1,
      finalsWithoutCompleteResult: 1,
      conflictingFinals: 0,
    });
    expect(ana.evidence).toMatchObject({ actualEndTimesSupplied: false, schedulesFetched: 32 });
  });

  it("refuses historical backfill instead of rebuilding past dates", async () => {
    const res = await run({ start: "2025-10-07" });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});

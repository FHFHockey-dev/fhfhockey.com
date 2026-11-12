/**
 * Math-audit fix lane L2-landing: player and goalie landing math proven at the
 * served API routes (rule 14) on a frozen, oriented fixture (rule 15). See
 * landingMathFixture.ts for the event script and the hand-derived answers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AWAY_GOALIE,
  BASE_QUERY,
  HOME_GOALIE,
  buildFixtureTables,
  createFakeSupabase,
  createMockApiContext,
} from "./landingMathFixture";

const fake = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("lib/supabase/server", () => ({
  default: new Proxy(
    {},
    { get: (_target, prop) => (fake.client as Record<string | symbol, unknown>)[prop] }
  ),
}));
vi.mock("lib/underlying-stats/entityRatingsOverlay", () => ({
  overlayEntityRatingsOnLandingResponse: async ({ response }: { response: unknown }) => response,
}));

import goaliesHandler from "../../../../../pages/api/v1/underlying-stats/goalies";
import goalieDetailHandler from "../../../../../pages/api/v1/underlying-stats/goalies/[playerId]";
import goalieChartHandler from "../../../../../pages/api/v1/underlying-stats/goalies/[playerId]/chart";
import playersHandler from "../../../../../pages/api/v1/underlying-stats/players";
import {
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  invalidatePlayerStatsSeasonAggregateCache,
} from "lib/underlying-stats/playerStatsLandingServer";

/**
 * Serve the fixture the way production does: the summary refresh writes
 * per-game partitions to nhl_api_game_payloads_raw and the routes read them.
 */
async function installFixture(tables: ReturnType<typeof buildFixtureTables>) {
  const client = createFakeSupabase(tables);
  const snapshots = await buildPlayerStatsLandingSummarySnapshotsForGameIds(
    tables.games.map((game) => Number(game.id)),
    client as any
  );
  tables.nhl_api_game_payloads_raw.push(
    ...snapshots.map((snapshot, index) => ({ ...snapshot, id: index + 1 }))
  );
  fake.client = client;
}

async function callRoute(
  handler: (req: any, res: any) => Promise<unknown>,
  query: Record<string, string>
) {
  const { req, res } = createMockApiContext({ ...BASE_QUERY, ...query });
  await handler(req, res);
  expect(res.statusCode, JSON.stringify(res.body)).toBe(200);
  return res.body as { rows: Array<Record<string, any>>; pagination: Record<string, number> };
}

function rowFor(rows: Array<Record<string, any>>, playerId: number) {
  return rows.find((row) => row.playerId === playerId);
}

beforeEach(async () => {
  invalidatePlayerStatsSeasonAggregateCache();
  await installFixture(buildFixtureTables());
});

describe("goalie landing danger GA, GSAA and GSAx (W2-P0-3, W1 P0 #5, decision 10)", () => {
  it("counts each MD/LD/HD goal once and computes danger GSAA against bucket league SV%", async () => {
    const body = await callRoute(goaliesHandler, {
      strength: "allStrengths",
      scoreState: "allScores",
      displayMode: "counts",
    });
    const away = rowFor(body.rows, AWAY_GOALIE)!;
    const home = rowFor(body.rows, HOME_GOALIE)!;

    // Away G 2001: MD save (t=100) + MD PP goal (t=350).
    expect(away).toMatchObject({ shotsAgainst: 2, saves: 1, goalsAgainst: 1 });
    expect(away).toMatchObject({ mdShotsAgainst: 2, mdSaves: 1, mdGoalsAgainst: 1 });
    // Home G 1001: MD save, LD goal, HD save.
    expect(home).toMatchObject({ shotsAgainst: 3, saves: 2, goalsAgainst: 1 });
    expect(home).toMatchObject({ hdGoalsAgainst: 0, mdGoalsAgainst: 0, ldGoalsAgainst: 1 });

    // League SV% = 3 saves / 5 shots = .6. GSAA = SA × (1 − .6) − GA.
    expect(home.gsaa).toBeCloseTo(3 * 0.4 - 1, 10);
    expect(away.gsaa).toBeCloseTo(2 * 0.4 - 1, 10);
    // MD league SV% = 2 / 3; HD = 1 / 1; LD = 0 / 1.
    expect(away.mdGsaa).toBeCloseTo(2 * (1 / 3) - 1, 10);
    expect(home.mdGsaa).toBeCloseTo(1 * (1 / 3) - 0, 10);
    expect(home.hdGsaa).toBeCloseTo(0, 10);
    expect(home.ldGsaa).toBeCloseTo(1 * 1 - 1, 10);
    // MDGAA stays GA × 3600 ÷ TOI on the single counted goal.
    expect(away.mdGaa).toBeCloseTo((1 * 3600) / 1200, 10);
    // Own goals / no-geometry goals are an explicit residual, zero here.
    expect(away.unclassifiedGoalsAgainst).toBe(0);
    // The heuristic xG column is GSAx, separately named.
    expect(away).toHaveProperty("gsax");
  });

  it("files the home PP goal against the away goalie's PK split, not PP (oriented, decision 70)", async () => {
    const pk = await callRoute(goaliesHandler, {
      strength: "penaltyKill",
      scoreState: "allScores",
      displayMode: "counts",
    });
    const awayPk = rowFor(pk.rows, AWAY_GOALIE)!;
    expect(awayPk).toMatchObject({
      toiSeconds: 50,
      shotsAgainst: 1,
      goalsAgainst: 1,
      mdShotsAgainst: 1,
      mdGoalsAgainst: 1,
    });
    // Only one goalie has PK time, so the PK league MD SV% is 0 and MDGSAA is 0.
    expect(awayPk.mdGsaa).toBeCloseTo(0, 10);
    expect(rowFor(pk.rows, HOME_GOALIE)).toBeUndefined();

    const pp = await callRoute(goaliesHandler, {
      strength: "powerPlay",
      scoreState: "allScores",
      displayMode: "counts",
    });
    expect(rowFor(pp.rows, AWAY_GOALIE)).toBeUndefined();
    const homePp = rowFor(pp.rows, HOME_GOALIE);
    expect(homePp?.mdGoalsAgainst ?? 0).toBe(0);
  });

  it("serves the same GSAA on the goalie detail route (season row)", async () => {
    const { req, res } = createMockApiContext({
      ...BASE_QUERY,
      playerId: String(HOME_GOALIE),
      strength: "allStrengths",
      scoreState: "allScores",
      displayMode: "counts",
    });
    await goalieDetailHandler(req, res);
    expect(res.statusCode, JSON.stringify(res.body)).toBe(200);
    const [season] = res.body.rows;
    expect(season.gsaa).toBeCloseTo(3 * 0.4 - 1, 10);
    expect(season.mdGsaa).toBeCloseTo(1 / 3, 10);
  });

  it("serves GSAA on the goalie chart route from the game's league baseline", async () => {
    const { req, res } = createMockApiContext({
      ...BASE_QUERY,
      playerId: String(AWAY_GOALIE),
      strength: "allStrengths",
      scoreState: "allScores",
      displayMode: "counts",
    });
    await goalieChartHandler(req, res);
    expect(res.statusCode, JSON.stringify(res.body)).toBe(200);
    const [point] = res.body.rows;
    expect(point.mdGoalsAgainst).toBe(1);
    expect(point.gsaa).toBeCloseTo(2 * 0.4 - 1, 10);
  });
});

describe("goalie score states from the running score (W2-P0-5, decision 11)", () => {
  it("classifies the boundary goal by the score before it and intervals by the score after", async () => {
    const leading = await callRoute(goaliesHandler, {
      strength: "allStrengths",
      scoreState: "leading",
      displayMode: "counts",
    });
    // Home led 1-0 from 350 to 700; the tying goal at 700 happened while leading.
    expect(rowFor(leading.rows, HOME_GOALIE)).toMatchObject({
      toiSeconds: 350,
      shotsAgainst: 2,
      goalsAgainst: 1,
      ldGoalsAgainst: 1,
    });
    const upOne = await callRoute(goaliesHandler, {
      strength: "allStrengths",
      scoreState: "upOne",
      displayMode: "counts",
    });
    expect(rowFor(upOne.rows, HOME_GOALIE)).toMatchObject({ toiSeconds: 350, goalsAgainst: 1 });
    const tied = await callRoute(goaliesHandler, {
      strength: "allStrengths",
      scoreState: "tied",
      displayMode: "counts",
    });
    // Tied 0-350 and 700-1200; the PP goal at 350 was scored while tied.
    expect(rowFor(tied.rows, AWAY_GOALIE)).toMatchObject({
      toiSeconds: 850,
      shotsAgainst: 2,
      goalsAgainst: 1,
      mdGoalsAgainst: 1,
    });
    expect(rowFor(tied.rows, HOME_GOALIE)).toMatchObject({
      toiSeconds: 850,
      shotsAgainst: 1,
      goalsAgainst: 0,
    });
  });
});

describe("skater split keys (W2-P0-4)", () => {
  it.each([
    ["fiveOnFourPP", 102, { goals: 1, toiSeconds: 50 }],
    ["powerPlay", 102, { goals: 1, toiSeconds: 50 }],
    ["fiveOnFive", 101, { shots: 1, toiSeconds: 1150 }],
    ["threeOnThree", 101, undefined],
  ] as const)("serves the %s split for skaters", async (strength, playerId, expected) => {
    const body = await callRoute(playersHandler, {
      strength,
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
    });
    const row = rowFor(body.rows, playerId);
    if (expected === undefined) {
      expect(row).toBeUndefined();
    } else {
      expect(row).toMatchObject(expected);
    }
  });

  it("serves 4v5 PK time to the shorthanded away skaters only", async () => {
    const body = await callRoute(playersHandler, {
      strength: "fourOnFivePK",
      scoreState: "allScores",
      statMode: "onIce",
      displayMode: "counts",
    });
    expect(rowFor(body.rows, 201)).toMatchObject({ toiSeconds: 50, ga: 1 });
    expect(rowFor(body.rows, 101)).toBeUndefined();
  });
});

describe("PBP-only fallback (no shifts) strength and score state (W2-P0-2, W2-P0-5)", () => {
  beforeEach(async () => {
    invalidatePlayerStatsSeasonAggregateCache();
    const tables = buildFixtureTables({ pbpOnlyGame2: true });
    tables.games = tables.games.filter((game) => game.id === 2025020002);
    await installFixture(tables);
  });

  it("files the home 5v4 goal as the home scorer's 5v4 PP goal (stored strength is away-first)", async () => {
    const body = await callRoute(playersHandler, {
      strength: "fiveOnFourPP",
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
    });
    expect(rowFor(body.rows, 102)).toMatchObject({ goals: 1 });
    expect(rowFor(body.rows, 101)).toMatchObject({ totalAssists: 1 });
  });

  it("classifies fallback events with the running score, including non-goal events and shots", async () => {
    const tied = await callRoute(playersHandler, {
      strength: "allStrengths",
      scoreState: "tied",
      statMode: "individual",
      displayMode: "counts",
    });
    // 101 won the faceoffs at 0, 300 and 700 (after the tying goal) while tied,
    // and shot at 100 while tied.
    expect(rowFor(tied.rows, 101)).toMatchObject({ faceoffsWon: 3, shots: 1 });
    const leading = await callRoute(playersHandler, {
      strength: "allStrengths",
      scoreState: "leading",
      statMode: "individual",
      displayMode: "counts",
    });
    // While home led (350-700) 101 lost the 350 faceoff and took no shot.
    expect(rowFor(leading.rows, 101)).toMatchObject({ faceoffsLost: 1, faceoffsWon: 0, shots: 0 });
  });
});

describe("nulls sort last in both directions before pagination (W2-P0-7)", () => {
  it.each(["desc", "asc"] as const)("%s", async (direction) => {
    const body = await callRoute(playersHandler, {
      strength: "allStrengths",
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
      sortKey: "shootingPct",
      sortDirection: direction,
      pageSize: "2",
      page: "1",
    });
    expect(body.rows.map((row) => row.shootingPct)).toEqual(
      // 102 and 202 scored on their only shot; 101, 201 and 203 did not.
      direction === "desc" ? [1, 1] : [0, 0]
    );
    const lastPage = await callRoute(playersHandler, {
      strength: "allStrengths",
      scoreState: "allScores",
      statMode: "individual",
      displayMode: "counts",
      sortKey: "shootingPct",
      sortDirection: direction,
      pageSize: "2",
      page: String(body.pagination.totalPages),
    });
    expect(lastPage.rows.every((row) => row.shootingPct == null)).toBe(true);
  });

  it("orders an all-null column by the stable tie-break (player name)", async () => {
    const body = await callRoute(goaliesHandler, {
      strength: "allStrengths",
      scoreState: "allScores",
      displayMode: "counts",
      sortKey: "notAColumn",
      sortDirection: "desc",
    });
    expect(body.rows.map((row) => row.playerId)).toEqual([HOME_GOALIE, AWAY_GOALIE]);
  });
});

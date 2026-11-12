import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rule 14: fixture events → the summary writer's rows → stored table → the
// served /api/v1/underlying-stats/teams response. No provider calls (fetch stubbed).
const store = vi.hoisted(() => ({ summaryRows: [] as Array<Record<string, any>> }));

vi.mock("lib/supabase/serverReadonly", () => {
  const from = (table: string) => {
    let rows: Array<Record<string, any>> =
      table === "team_underlying_stats_summary"
        ? [...store.summaryRows]
        : table === "teams"
          ? [
              { id: 10, abbreviation: "HOM" },
              { id: 20, abbreviation: "AWY" },
              { id: 30, abbreviation: "THR" },
            ]
          : [];
    const orders: Array<[string, boolean]> = [];
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => ((rows = rows.filter((row) => row[column] === value)), builder),
      in: (column: string, values: unknown[]) => ((rows = rows.filter((row) => values.includes(row[column]))), builder),
      gte: (column: string, value: any) => ((rows = rows.filter((row) => row[column] >= value)), builder),
      lte: (column: string, value: any) => ((rows = rows.filter((row) => row[column] <= value)), builder),
      lt: (column: string, value: any) => ((rows = rows.filter((row) => row[column] < value)), builder),
      order: (column: string, options?: { ascending?: boolean }) => (orders.push([column, options?.ascending ?? true]), builder),
      range: (start: number, end: number) => {
        const sorted = [...rows].sort((left, right) => {
          for (const [column, ascending] of orders) {
            if (left[column] === right[column]) continue;
            return (left[column] < right[column] ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
        return Promise.resolve({ data: sorted.slice(start, end + 1), error: null });
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve),
    };
    return builder;
  };
  return { default: { from } };
});

import { buildTeamUnderlyingSummaryRowsForGame } from "lib/underlying-stats/teamStatsSummaryRefresh";
import handler from "../../../../../pages/api/v1/underlying-stats/teams";

const HOME = 10;
const AWAY = 20;

type FixtureEvent = {
  event_id: number;
  t: number;
  code: string;
  type: string;
  owner?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  period?: number;
  periodType?: string;
};

function writerRows(args: {
  gameId: number;
  date: string;
  gameType?: number;
  home?: number;
  away?: number;
  events: FixtureEvent[];
  shots: Array<{ eventId: number; owner: number; type: string }>;
}) {
  const home = args.home ?? HOME;
  const away = args.away ?? AWAY;
  return buildTeamUnderlyingSummaryRowsForGame({
    gameParity: {
      game: {
        id: args.gameId,
        seasonId: 20262027,
        type: args.gameType ?? 2,
        date: args.date,
        startTime: `${args.date}T23:00:00Z`,
        homeTeamId: home,
        awayTeamId: away,
      },
      parity: {},
      shotFeatures: args.shots.map((shot) => ({
        eventId: shot.eventId,
        eventOwnerTeamId: shot.owner,
        // Stored strength_exact is away-first and is deliberately misleading here.
        strengthExact: "4v5",
        shotEventType: shot.type,
        isGoal: shot.type === "goal",
        isOwnGoal: false,
        isShootoutEvent: false,
        ownerGoalieOnIce: true,
        opponentGoalieOnIce: true,
        ownerScoreDiffBeforeEvent: null,
        shotDistanceFeet: 30,
        shotAngleDegrees: 20,
      })),
    } as never,
    events: args.events.map((event) => ({
      game_id: args.gameId,
      event_id: event.event_id,
      sort_order: event.event_id,
      period_number: event.period ?? 1,
      period_type: event.periodType ?? "REG",
      period_seconds_elapsed: event.t,
      time_remaining_seconds: null,
      situation_code: event.code,
      type_desc_key: event.type,
      event_owner_team_id: event.owner ?? null,
      is_goal: event.type === "goal",
      home_score: event.home_score ?? null,
      away_score: event.away_score ?? null,
    })) as never,
  });
}

async function serve(query: Record<string, string>) {
  const res: any = {
    body: null,
    statusCode: 200,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => ((res.statusCode = code), res)),
    json: vi.fn((payload: unknown) => ((res.body = payload), res)),
  };
  await handler(
    {
      method: "GET",
      query: { fromSeasonId: "20262027", throughSeasonId: "20262027", seasonType: "regularSeason", ...query },
    } as never,
    res
  );
  expect(res.body?.error ?? null).toBeNull();
  expect(res.statusCode).toBe(200);
  return res.body as { rows: Array<Record<string, any>> };
}

const byTeam = (body: { rows: Array<Record<string, any>> }) =>
  new Map(body.rows.map((row) => [row.teamId as number, row]));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no provider calls in tests"))));
  // Game 1: home PP shot at 1451; home goal at 200 (1-0); home leads the rest of P1.
  store.summaryRows = writerRows({
    gameId: 2026020001,
    date: "2026-10-10",
    events: [
      { event_id: 1, t: 0, code: "1551", type: "faceoff" },
      { event_id: 2, t: 100, code: "1451", type: "shot-on-goal", owner: HOME },
      { event_id: 3, t: 200, code: "1551", type: "goal", owner: HOME, home_score: 1, away_score: 0 },
      { event_id: 4, t: 200, code: "1551", type: "faceoff" },
      { event_id: 5, t: 1200, code: "1551", type: "period-end" },
      { event_id: 6, t: 0, code: "1551", type: "faceoff", period: 2 },
      { event_id: 7, t: 1200, code: "1551", type: "period-end", period: 2 },
      { event_id: 8, t: 0, code: "1551", type: "faceoff", period: 3 },
      { event_id: 9, t: 1200, code: "1551", type: "game-end", period: 3 },
    ],
    shots: [
      { eventId: 2, owner: HOME, type: "shot-on-goal" },
      { eventId: 3, owner: HOME, type: "goal" },
    ],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/v1/underlying-stats/teams served math", () => {
  it("serves a home power-play shot on the home PP row and the away PK row (W2-P0-2)", async () => {
    const powerPlay = byTeam(await serve({ strength: "powerPlay", scoreState: "allScores", displayMode: "counts" }));
    const penaltyKill = byTeam(await serve({ strength: "penaltyKill", scoreState: "allScores", displayMode: "counts" }));
    expect(powerPlay.get(HOME)).toMatchObject({ sf: 1, toiSeconds: 100 });
    expect(powerPlay.get(AWAY)).toBeUndefined();
    expect(penaltyKill.get(AWAY)).toMatchObject({ sa: 1, toiSeconds: 100 });
    expect(penaltyKill.get(HOME)).toBeUndefined();
  });

  it("serves score-state ice time with one-goal leads as leading (W2-P0-5, decision 11)", async () => {
    const leading = byTeam(await serve({ strength: "allStrengths", scoreState: "leading", displayMode: "counts" }));
    const tied = byTeam(await serve({ strength: "allStrengths", scoreState: "tied", displayMode: "counts" }));
    expect(leading.get(HOME)?.toiSeconds).toBe(3400);
    expect(tied.get(HOME)?.toiSeconds).toBe(200);
    expect(tied.get(HOME)?.gf).toBe(1);
  });

  it("hides the record columns under a split and the bucket xG everywhere (decisions 92, 12)", async () => {
    const split = byTeam(await serve({ strength: "fiveOnFive", scoreState: "allScores", displayMode: "rates" }));
    expect(split.get(HOME)).toMatchObject({ wins: null, losses: null, points: null, pointPct: null, xgfPct: null, xgfPer60: null });
    const all = byTeam(await serve({ strength: "allStrengths", scoreState: "allScores", displayMode: "counts" }));
    expect(all.get(HOME)).toMatchObject({ wins: 1, points: 2, pointPct: 1, xgf: null });
    expect(all.get(AWAY)).toMatchObject({ losses: 1, points: 0, pointPct: 0 });
  });
});

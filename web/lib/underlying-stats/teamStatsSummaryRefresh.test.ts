import { describe, expect, it } from "vitest";

import {
  buildTeamUnderlyingSummaryRowsForGame,
  fetchSeasonTeamSummaryGameIdSet,
  resolveGameOutcomeFromOfficialPayload,
} from "./teamStatsSummaryRefresh";

type MockSummaryRow = {
  game_id: number;
  team_id: number;
  toi_seconds: number;
  season_id: number;
  game_type: number;
  strength: string;
  score_state: string;
};

function createSummaryRow(overrides: Partial<MockSummaryRow>): MockSummaryRow {
  return {
    game_id: 1,
    team_id: 1,
    toi_seconds: 3600,
    season_id: 20252026,
    game_type: 2,
    strength: "allStrengths",
    score_state: "allScores",
    ...overrides,
  };
}

function createMockSupabase(rows: MockSummaryRow[]) {
  return {
    from(table: string) {
      if (table !== "team_underlying_stats_summary") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const eqFilters = new Map<string, unknown>();

      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          eqFilters.set(column, value);
          return this;
        },
        order() {
          return this;
        },
        async range(from: number, to: number) {
          const filtered = rows.filter((row) => {
            for (const [column, value] of eqFilters.entries()) {
              if (row[column as keyof MockSummaryRow] !== value) {
                return false;
              }
            }

            return true;
          });

          return {
            data: filtered.slice(from, to + 1),
            error: null,
          };
        },
      };
    },
  };
}

describe("fetchSeasonTeamSummaryGameIdSet", () => {
  it("only marks games covered when both teams have sampled broad rows", async () => {
    const supabase = createMockSupabase([
      createSummaryRow({ game_id: 10, team_id: 1, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 10, team_id: 2, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 11, team_id: 1, toi_seconds: 3600 }),
      createSummaryRow({ game_id: 12, team_id: 1, toi_seconds: 0 }),
      createSummaryRow({ game_id: 12, team_id: 2, toi_seconds: 0 }),
      createSummaryRow({ game_id: 13, team_id: 1, toi_seconds: 3600, strength: "fiveOnFive" }),
      createSummaryRow({ game_id: 13, team_id: 2, toi_seconds: 3600, strength: "fiveOnFive" }),
      createSummaryRow({ game_id: 14, team_id: 1, toi_seconds: 3600, game_type: 3 }),
      createSummaryRow({ game_id: 14, team_id: 2, toi_seconds: 3600, game_type: 3 }),
    ]);

    const covered = await fetchSeasonTeamSummaryGameIdSet({
      supabase: supabase as never,
      seasonId: 20252026,
      requestedGameType: 2,
    });

    expect([...covered]).toEqual([10]);
  });
});

describe("resolveGameOutcomeFromOfficialPayload", () => {
  it("classifies shootout and overtime decisions from official payload scores", () => {
    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          periodDescriptor: { periodType: "SO" },
          homeTeam: { id: 21, score: 4 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toEqual({
      winnerTeamId: 21,
      outcomeType: "shootout",
    });

    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          summary: {
            scoring: [
              { periodDescriptor: { periodType: "REG" } },
              { periodDescriptor: { periodType: "OT" } },
            ],
          },
          homeTeam: { id: 21, score: 2 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toEqual({
      winnerTeamId: 7,
      outcomeType: "overtime",
    });
  });

  it("returns null when the payload is tied or mismatched", () => {
    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          gameOutcome: { lastPeriodType: "SO" },
          homeTeam: { id: 21, score: 3 },
          awayTeam: { id: 7, score: 3 },
        },
      })
    ).toBeNull();

    expect(
      resolveGameOutcomeFromOfficialPayload({
        homeTeamId: 21,
        awayTeamId: 7,
        payload: {
          gameOutcome: { lastPeriodType: "REG" },
          homeTeam: { id: 99, score: 3 },
          awayTeam: { id: 7, score: 2 },
        },
      })
    ).toBeNull();
  });
});
// ---------------------------------------------------------------------------
// Writer fixtures (W2-P0-2, W2-P0-5, W2-3 A2, W2-3 D12). Oriented: the home
// team (10) has the power play, so a reciprocal swap cannot pass (rule 15).
// ---------------------------------------------------------------------------
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

function buildFixtureGame(args: {
  gameId?: number;
  gameType?: number;
  events: FixtureEvent[];
  shots: Array<{
    eventId: number;
    owner: number;
    type: "goal" | "shot-on-goal" | "missed-shot" | "blocked-shot";
    strengthExact: string;
    ownerScoreDiffBeforeEvent: number | null;
    ownerGoalieOnIce?: boolean;
    opponentGoalieOnIce?: boolean;
  }>;
}) {
  const gameId = args.gameId ?? 2026020001;
  const events = args.events.map((event) => ({
    game_id: gameId,
    season_id: 20262027,
    game_date: "2026-10-10",
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
  }));
  const shotFeatures = args.shots.map((shot) => ({
    eventId: shot.eventId,
    eventOwnerTeamId: shot.owner,
    eventOwnerSide: shot.owner === HOME ? "home" : "away",
    strengthExact: shot.strengthExact,
    shotEventType: shot.type,
    isGoal: shot.type === "goal",
    isOwnGoal: false,
    isShootoutEvent: false,
    ownerGoalieOnIce: shot.ownerGoalieOnIce ?? true,
    opponentGoalieOnIce: shot.opponentGoalieOnIce ?? true,
    ownerScoreDiffBeforeEvent: shot.ownerScoreDiffBeforeEvent,
    shotDistanceFeet: 30,
    shotAngleDegrees: 20,
    isReboundShot: false,
    isRushShot: false,
    crossedRoyalRoad: false,
  }));

  return buildTeamUnderlyingSummaryRowsForGame({
    gameParity: {
      game: {
        id: gameId,
        seasonId: 20262027,
        type: args.gameType ?? 2,
        date: "2026-10-10",
        startTime: "2026-10-10T23:00:00Z",
        homeTeamId: HOME,
        awayTeamId: AWAY,
      },
      parity: {} as never,
      shotFeatures: shotFeatures as never,
    } as never,
    events: events as never,
  });
}

const rowFor = (
  rows: ReturnType<typeof buildTeamUnderlyingSummaryRowsForGame>,
  teamId: number,
  strength: string,
  scoreState = "allScores"
) => {
  const row = rows.find(
    (candidate) =>
      candidate.team_id === teamId &&
      candidate.strength === strength &&
      candidate.score_state === scoreState
  );
  if (!row) throw new Error(`missing ${teamId} ${strength} ${scoreState}`);
  return row;
};

describe("buildTeamUnderlyingSummaryRowsForGame strength orientation (W2-P0-2, decision 70)", () => {
  // Period 1: 5v5 0-100; home PP (1451) 100-200; 5v5 200-600; home goalie pulled at 5v5 (1560) 600-1200.
  const rows = buildFixtureGame({
    events: [
      { event_id: 1, t: 0, code: "1551", type: "faceoff" },
      { event_id: 2, t: 100, code: "1451", type: "shot-on-goal", owner: HOME },
      { event_id: 3, t: 200, code: "1551", type: "faceoff" },
      { event_id: 4, t: 600, code: "1560", type: "shot-on-goal", owner: HOME },
      { event_id: 5, t: 1200, code: "1560", type: "period-end" },
    ],
    shots: [
      // Stored strength_exact is away-first: a home PP is "4v5".
      { eventId: 2, owner: HOME, type: "shot-on-goal", strengthExact: "4v5", ownerScoreDiffBeforeEvent: 0 },
      // 6v5 with the home net empty and no penalty.
      { eventId: 4, owner: HOME, type: "shot-on-goal", strengthExact: "5v6", ownerScoreDiffBeforeEvent: 0, ownerGoalieOnIce: false },
    ],
  });

  it("files a home power-play shot in the home PP row and the away PK row", () => {
    expect(rowFor(rows, HOME, "powerPlay").sf).toBe(1);
    expect(rowFor(rows, HOME, "fiveOnFourPP").sf).toBe(1);
    expect(rowFor(rows, HOME, "penaltyKill").sf).toBe(0);
    expect(rowFor(rows, AWAY, "penaltyKill").sa).toBe(1);
    expect(rowFor(rows, AWAY, "fourOnFivePK").sa).toBe(1);
    expect(rowFor(rows, AWAY, "powerPlay").sa).toBe(0);
  });

  it("keeps 6v5 with no penalty at even strength with an empty-net attribute, for time and shots", () => {
    expect(rowFor(rows, HOME, "powerPlay").toi_seconds).toBe(100);
    expect(rowFor(rows, HOME, "evenStrength").toi_seconds).toBe(1100);
    expect(rowFor(rows, HOME, "evenStrength").sf).toBe(1);
    expect(rowFor(rows, HOME, "withEmptyNet").toi_seconds).toBe(600);
    expect(rowFor(rows, AWAY, "againstEmptyNet").sa).toBe(1);
    expect(rowFor(rows, HOME, "fiveOnFive").toi_seconds).toBe(500);
    // Exclusive ES + PP + PK reconciles to all-strengths time.
    const exclusive = ["evenStrength", "powerPlay", "penaltyKill"].reduce(
      (total, strength) => total + rowFor(rows, HOME, strength).toi_seconds,
      0
    );
    expect(exclusive).toBe(rowFor(rows, HOME, "allStrengths").toi_seconds);
  });
});

describe("buildTeamUnderlyingSummaryRowsForGame score states (W2-P0-5, decision 11)", () => {
  // Tied 0-200; home goal at 200 (1-0); home leads 200-1200. The goal event is
  // classified by the score before it (tied); the interval after it by the score after.
  const rows = buildFixtureGame({
    events: [
      { event_id: 1, t: 0, code: "1551", type: "faceoff" },
      { event_id: 2, t: 200, code: "1551", type: "goal", owner: HOME, home_score: 1, away_score: 0 },
      { event_id: 3, t: 200, code: "1551", type: "faceoff" },
      { event_id: 4, t: 700, code: "1551", type: "shot-on-goal", owner: AWAY },
      { event_id: 5, t: 1200, code: "1551", type: "period-end" },
    ],
    shots: [
      { eventId: 2, owner: HOME, type: "goal", strengthExact: "5v5", ownerScoreDiffBeforeEvent: 0 },
      { eventId: 4, owner: AWAY, type: "shot-on-goal", strengthExact: "5v5", ownerScoreDiffBeforeEvent: -1 },
    ],
  });

  it("gives every score state its time, with one-goal leads counted as leading", () => {
    expect(rowFor(rows, HOME, "allStrengths", "tied").toi_seconds).toBe(200);
    expect(rowFor(rows, HOME, "allStrengths", "leading").toi_seconds).toBe(1000);
    expect(rowFor(rows, HOME, "allStrengths", "upOne").toi_seconds).toBe(1000);
    expect(rowFor(rows, AWAY, "allStrengths", "trailing").toi_seconds).toBe(1000);
    expect(rowFor(rows, AWAY, "allStrengths", "downOne").toi_seconds).toBe(1000);
    expect(rowFor(rows, HOME, "allStrengths", "trailing").toi_seconds).toBe(0);
    const partition = ["tied", "leading", "trailing"].reduce(
      (total, state) => total + rowFor(rows, HOME, "allStrengths", state).toi_seconds,
      0
    );
    expect(partition).toBe(rowFor(rows, HOME, "allStrengths").toi_seconds);
  });

  it("classifies the goal by the score before it and later shots by the running score", () => {
    expect(rowFor(rows, HOME, "allStrengths", "tied").gf).toBe(1);
    expect(rowFor(rows, HOME, "allStrengths", "leading").gf).toBe(0);
    expect(rowFor(rows, HOME, "allStrengths", "leading").sa).toBe(1);
    expect(rowFor(rows, AWAY, "allStrengths", "trailing").sf).toBe(1);
  });
});

describe("buildTeamUnderlyingSummaryRowsForGame overtime and outcome (W2-3 A2, D12)", () => {
  const overtimeEvents = (homeScoreAtEnd: number): FixtureEvent[] => [
    { event_id: 1, t: 0, code: "1551", type: "faceoff" },
    { event_id: 2, t: 1200, code: "1551", type: "period-end" },
    { event_id: 3, t: 0, code: "1331", type: "faceoff", period: 4, periodType: "OT" },
    {
      event_id: 4,
      t: 60,
      code: "1331",
      type: "goal",
      owner: HOME,
      home_score: homeScoreAtEnd,
      away_score: 0,
      period: 4,
      periodType: "OT",
    },
    { event_id: 5, t: 60, code: "1331", type: "game-end", period: 4, periodType: "OT" },
  ];

  it("stops team exposure at the sudden-death goal", () => {
    const rows = buildFixtureGame({ events: overtimeEvents(1), shots: [] });
    expect(rowFor(rows, HOME, "allStrengths").toi_seconds).toBe(1260);
    expect(rowFor(rows, HOME, "threeOnThree").toi_seconds).toBe(60);
  });

  it("gives a regular-season OT loss an OTL point but a playoff OT loss none", () => {
    const regular = buildFixtureGame({ events: overtimeEvents(1), shots: [] });
    expect(rowFor(regular, AWAY, "allStrengths")).toMatchObject({ losses: 0, otl: 1, points: 1 });
    const playoff = buildFixtureGame({ gameId: 2026030111, gameType: 3, events: overtimeEvents(1), shots: [] });
    expect(rowFor(playoff, AWAY, "allStrengths")).toMatchObject({ losses: 1, otl: 0, points: 0 });
    expect(rowFor(playoff, HOME, "allStrengths")).toMatchObject({ wins: 1, losses: 0, otl: 0 });
  });
});

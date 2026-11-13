import { describe, expect, it } from "vitest";

import {
  buildTeamUnderlyingSummaryRowsForGame,
  compareTeamSummaryRows,
  fetchSeasonTeamSummaryGameIdSet,
  fetchTeamSummaryRebuildGameIds,
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

describe("fetchTeamSummaryRebuildGameIds (rule 19, contract nhl-game-state-v1)", () => {
  type GameRow = {
    id: number;
    seasonId: number;
    type: number;
    date: string;
    startTime: string;
    game_state: string | null;
    game_schedule_state: string | null;
    game_state_observed_at: string | null;
  };
  const game = (overrides: Partial<GameRow> & Pick<GameRow, "id">): GameRow => ({
    seasonId: 20252026,
    type: 2,
    date: "2026-04-01",
    startTime: "2026-04-01T23:00:00.000Z",
    game_state: null,
    game_schedule_state: null,
    game_state_observed_at: null,
    ...overrides,
  });
  const gamesClient = (rows: GameRow[]) => ({
    from(table: string) {
      if (table !== "games") throw new Error(`Unexpected table: ${table}`);
      const filters: Array<(row: GameRow) => boolean> = [];
      const builder = {
        select: () => builder,
        eq: (column: keyof GameRow, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        gte: (column: keyof GameRow, value: string) => {
          filters.push((row) => String(row[column]) >= value);
          return builder;
        },
        lte: (column: keyof GameRow, value: string) => {
          filters.push((row) => String(row[column]) <= value);
          return builder;
        },
        order: () => builder,
        range: async (from: number, to: number) => ({
          data: rows.filter((row) => filters.every((keep) => keep(row))).slice(from, to + 1),
          error: null,
        }),
      };
      return builder;
    },
  });

  it("keeps a late game dated before today out while its stored state is LIVE", async () => {
    const supabase = gamesClient([
      game({ id: 1, game_state: "FINAL", game_schedule_state: "OK",
        game_state_observed_at: "2026-04-02T02:00:00.000Z" }),
      // 10 pm ET start on Apr 2: dated before "today" (UTC Apr 3) but still being played.
      game({ id: 2, date: "2026-04-02", startTime: "2026-04-03T02:00:00.000Z", game_state: "LIVE",
        game_schedule_state: "OK", game_state_observed_at: "2026-04-03T03:20:00.000Z" }),
      // No stored state: the labelled start + 8 h fallback decides.
      game({ id: 3 }),
      game({ id: 4, date: "2026-04-02", startTime: "2026-04-02T23:00:00.000Z", game_state: "FUT",
        game_schedule_state: "PPD", game_state_observed_at: "2026-04-02T20:00:00.000Z" }),
      game({ id: 5, seasonId: 20242025, game_state: "OFF",
        game_state_observed_at: "2026-04-02T02:00:00.000Z" }),
    ]);

    const ids = await fetchTeamSummaryRebuildGameIds({
      seasonId: 20252026,
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      supabase: supabase as never,
      now: new Date("2026-04-03T03:30:00.000Z"),
    });

    expect(ids).toEqual([1, 3]);
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

describe("buildTeamUnderlyingSummaryRowsForGame penalty shots: all-situations only (decision 149, Astra AF-07)", () => {
  // Fixtures shaped on the official NHL boxscores of three of the 8 games with a
  // penalty shot in 2026-27 (stored boxscores, read 2026-11-13). Ordinary shots
  // are 5v5 (1551); the penalty shot has no shot feature, as in production.
  type Side = typeof HOME | typeof AWAY;
  function officialGame(args: {
    gameId: number;
    home: { sog: number; goals: number };
    away: { sog: number; goals: number };
    penaltyShot: { owner: Side; scored: boolean; period: number; t: number };
    shootout?: Array<{ owner: Side; scored: boolean }>;
  }) {
    const events: FixtureEvent[] = [];
    const shots: Parameters<typeof buildFixtureGame>[0]["shots"] = [];
    let id = 1;
    const score = { home: 0, away: 0 };
    for (let period = 1; period <= 3; period += 1) {
      events.push({ event_id: id++, t: 0, code: "1551", type: "faceoff", period });
      if (period === args.penaltyShot.period) {
        const ps = args.penaltyShot;
        if (ps.scored) score[ps.owner === HOME ? "home" : "away"] += 1;
        events.push({
          event_id: id++,
          t: ps.t,
          code: ps.owner === HOME ? "1010" : "0101",
          type: ps.scored ? "goal" : "shot-on-goal",
          owner: ps.owner,
          period,
          ...(ps.scored ? { home_score: score.home, away_score: score.away } : {}),
        });
      }
      for (const [owner, key] of [[HOME, "home"], [AWAY, "away"]] as const) {
        const psOnGoal = args.penaltyShot.owner === owner ? 1 : 0;
        const psGoal = args.penaltyShot.owner === owner && args.penaltyShot.scored ? 1 : 0;
        const total = args[key].sog - psOnGoal;
        const goals = args[key].goals - psGoal;
        // Spread this side's ordinary shots over the three periods.
        for (let n = period - 1; n < total; n += 3) {
          const goal = n < goals;
          if (goal) score[key] += 1;
          const eventId = id++;
          events.push({
            event_id: eventId,
            t: 100 + n,
            code: "1551",
            type: goal ? "goal" : "shot-on-goal",
            owner,
            period,
            ...(goal ? { home_score: score.home, away_score: score.away } : {}),
          });
          shots.push({ eventId, owner, type: goal ? "goal" : "shot-on-goal", strengthExact: "5v5", ownerScoreDiffBeforeEvent: null });
        }
      }
      events.push({ event_id: id++, t: 1200, code: "1551", type: "period-end", period });
    }
    for (const attempt of args.shootout ?? []) {
      events.push({
        event_id: id++,
        t: 0,
        code: attempt.owner === HOME ? "1010" : "0101",
        type: attempt.scored ? "goal" : "shot-on-goal",
        owner: attempt.owner,
        period: 5,
        periodType: "SO",
      });
    }
    return buildFixtureGame({ gameId: args.gameId, events, shots });
  }

  const allSituations = (rows: ReturnType<typeof buildFixtureGame>, team: number) => {
    const row = rowFor(rows, team, "allStrengths");
    return { sf: row.sf, gf: row.gf, sa: row.sa, ga: row.ga };
  };

  it("2026020131: a scored home penalty shot is one goal and one shot for, and against the other team", () => {
    // Official: home 24 SOG / 5 goals, away 26 SOG / 2 goals; home penalty-shot goal in P1.
    const rows = officialGame({
      gameId: 2026020131,
      home: { sog: 24, goals: 5 },
      away: { sog: 26, goals: 2 },
      penaltyShot: { owner: HOME, scored: true, period: 1, t: 520 },
    });
    expect(allSituations(rows, HOME)).toEqual({ sf: 24, gf: 5, sa: 26, ga: 2 });
    expect(allSituations(rows, AWAY)).toEqual({ sf: 26, gf: 2, sa: 24, ga: 5 });
    // ES/PP/PK unchanged: the penalty shot is in no strength split.
    expect(rowFor(rows, HOME, "evenStrength")).toMatchObject({ sf: 23, gf: 4 });
    expect(rowFor(rows, AWAY, "evenStrength")).toMatchObject({ sa: 23, ga: 4 });
    for (const strength of ["powerPlay", "penaltyKill", "fiveOnFive", "withEmptyNet", "againstEmptyNet"]) {
      expect(rowFor(rows, HOME, strength).gf).toBe(strength === "fiveOnFive" ? 4 : 0);
    }
    // One attempt for, one against; never in xG or scoring chances.
    expect(rowFor(rows, HOME, "allStrengths").cf - rowFor(rows, HOME, "evenStrength").cf).toBe(1);
    expect(rowFor(rows, AWAY, "allStrengths").ca - rowFor(rows, AWAY, "evenStrength").ca).toBe(1);
    expect(rowFor(rows, HOME, "allStrengths").xgf).toBeCloseTo(rowFor(rows, HOME, "evenStrength").xgf, 9);
    expect(rowFor(rows, HOME, "allStrengths").scf).toBe(rowFor(rows, HOME, "evenStrength").scf);
    // Tied / leading / trailing still partition the all-situation totals, penalty shot included.
    for (const key of ["sf", "gf", "sa", "ga", "cf"] as const) {
      const partition = ["tied", "leading", "trailing"].reduce(
        (total, state) => total + rowFor(rows, HOME, "allStrengths", state)[key],
        0
      );
      expect([key, partition]).toEqual([key, rowFor(rows, HOME, "allStrengths")[key]]);
    }
  });

  it("2026020101: a saved home penalty shot is one shot, no goal", () => {
    // Official: home 28 SOG / 2 goals, away 25 SOG / 5 goals; home penalty-shot save in P1.
    const rows = officialGame({
      gameId: 2026020101,
      home: { sog: 28, goals: 2 },
      away: { sog: 25, goals: 5 },
      penaltyShot: { owner: HOME, scored: false, period: 1, t: 789 },
    });
    expect(allSituations(rows, HOME)).toEqual({ sf: 28, gf: 2, sa: 25, ga: 5 });
    expect(allSituations(rows, AWAY)).toEqual({ sf: 25, gf: 5, sa: 28, ga: 2 });
    expect(rowFor(rows, HOME, "evenStrength")).toMatchObject({ sf: 27, gf: 2 });
  });

  it("2026020094: an away penalty-shot save counts once; shootout attempts never count", () => {
    // Official: home 26 SOG / 2 goals, away 31 SOG / 2 goals (shootout goal removed);
    // away penalty-shot save in P2; the shootout had goals and saves on both sides.
    const rows = officialGame({
      gameId: 2026020094,
      home: { sog: 26, goals: 2 },
      away: { sog: 31, goals: 2 },
      penaltyShot: { owner: AWAY, scored: false, period: 2, t: 383 },
      shootout: [
        { owner: HOME, scored: false },
        { owner: AWAY, scored: true },
        { owner: HOME, scored: true },
        { owner: AWAY, scored: false },
      ],
    });
    expect(allSituations(rows, HOME)).toEqual({ sf: 26, gf: 2, sa: 31, ga: 2 });
    expect(allSituations(rows, AWAY)).toEqual({ sf: 31, gf: 2, sa: 26, ga: 2 });
    expect(rowFor(rows, AWAY, "evenStrength")).toMatchObject({ sf: 30, gf: 2 });
  });
});

describe("compareTeamSummaryRows (read-only diff mode)", () => {
  it("reports only the fields a rebuild would change, and missing stored rows", () => {
    const rebuilt = [
      { game_id: 1, team_id: 10, strength: "allStrengths", score_state: "allScores", sf: 24, gf: 5, xgf: 1.23 },
      { game_id: 1, team_id: 10, strength: "evenStrength", score_state: "allScores", sf: 23, gf: 4, xgf: 1.23 },
      { game_id: 1, team_id: 20, strength: "allStrengths", score_state: "allScores", sf: 26, gf: 2, xgf: 0.5 },
    ] as never[];
    const stored = [
      { game_id: "1", team_id: "10", strength: "allStrengths", score_state: "allScores", sf: 23, gf: 4, xgf: "1.2300000001" },
      { game_id: 1, team_id: 10, strength: "evenStrength", score_state: "allScores", sf: 23, gf: 4, xgf: 1.23 },
    ];
    expect(compareTeamSummaryRows(stored, rebuilt)).toEqual([
      {
        game_id: 1,
        team_id: 10,
        strength: "allStrengths",
        score_state: "allScores",
        changes: { sf: { stored: 23, rebuilt: 24 }, gf: { stored: 4, rebuilt: 5 } },
      },
      { game_id: 1, team_id: 20, strength: "allStrengths", score_state: "allScores", missing: true, changes: {} },
    ]);
  });
});

/**
 * Synthetic exact-five PP fixtures. Every id, date and clock here is invented;
 * nothing is captured from the NHL, Supabase or any provider. Expected values
 * are hand-computed and also cross-checked against the per-second oracle.
 *
 * Situation codes are NHL order: away goalie, away skaters, home skaters,
 * home goalie. "1451" is a home 5v4.
 */
import type { ExactFiveGameInput, ExactFiveShiftInput } from "./exactFivePpUnits";

export const HOME = 1;
export const AWAY = 2;
export const HOME_GOALIE = 901;
export const AWAY_GOALIE = 902;
/** Deliberately absent from the roster. */
export const UNROSTERED_SKATER = 113;

export const UNIT_A = [101, 102, 103, 104, 110];
export const UNIT_B = [102, 103, 104, 105, 110];
export const UNIT_C = [105, 106, 107, 108, 111];
export const AWAY_PK = [206, 207, 208, 210];

const FORWARD_CODES = ["C", "L", "R"];

function roster(): ExactFiveGameInput["roster"] {
  const spots: ExactFiveGameInput["roster"] = [];
  for (const [teamId, base, goalie] of [
    [HOME, 100, HOME_GOALIE],
    [AWAY, 200, AWAY_GOALIE],
  ] as const) {
    for (let offset = 1; offset <= 12; offset += 1) {
      spots.push({
        playerId: base + offset,
        teamId,
        positionCode: offset >= 10 ? "D" : FORWARD_CODES[offset % 3],
      });
    }
    spots.push({ playerId: goalie, teamId, positionCode: "G" });
  }
  return spots;
}

export function on(
  teamId: number,
  playerIds: readonly number[],
  period: number,
  startSecond: number,
  endSecond: number,
): ExactFiveShiftInput[] {
  return playerIds.map((playerId) => ({
    playerId,
    teamId,
    period,
    startSecond,
    endSecond,
  }));
}

function goalies(period: number, end: number): ExactFiveShiftInput[] {
  return [...on(HOME, [HOME_GOALIE], period, 0, end), ...on(AWAY, [AWAY_GOALIE], period, 0, end)];
}

function segments(...parts: Array<[number, number, string]>) {
  return parts.map(([startSecond, endSecond, situationCode]) => ({
    startSecond,
    endSecond,
    situationCode,
  }));
}

function game(
  gameId: number,
  gameDate: string,
  periods: ExactFiveGameInput["periods"],
  shifts: ExactFiveShiftInput[],
  validation: Partial<ExactFiveGameInput["validation"]> = {},
): ExactFiveGameInput {
  return {
    gameId,
    seasonId: 20262027,
    gameDate,
    homeTeamId: HOME,
    awayTeamId: AWAY,
    periods,
    shifts,
    roster: roster(),
    validation: {
      shiftValidationPassed: true,
      pbpFinal: true,
      rosterScopeBound: true,
      upstreamHoldReasons: [],
      ...validation,
    },
  };
}

export type ExactFiveFixture = {
  name: string;
  input: ExactFiveGameInput;
  /** Hand-computed expectations for the home team unless noted. */
  expected: {
    status: "included" | "excluded";
    unitSeconds: Record<string, number>;
    qualifying?: { "5v4": number; "5v3": number };
    unknown?: Record<string, number>;
    excluded?: Record<string, number>;
    shiftOnlyAdvantageSeconds?: number;
    duplicateShiftSeconds?: number;
  };
};

const key = (ids: number[], manpower = "5v4") =>
  `${manpower}|x5:${[...ids].sort((a, b) => a - b).join("-")}`;

export const FIXTURES: ExactFiveFixture[] = [
  {
    name: "transition and substitution inside one 5v4",
    input: game(
      1001,
      "2026-10-01",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 220, "1451"], [220, 1200, "1551"]) }],
      [
        ...goalies(1, 1200),
        ...on(HOME, UNIT_A, 1, 100, 160),
        // 105 replaces 101 at 160; the other four stay on.
        ...on(HOME, [105], 1, 160, 190),
        ...on(HOME, [102, 103, 104, 110], 1, 160, 190),
        // Full change at 190; unit C stays 10s past the PBP return to 5v5.
        ...on(HOME, [106, 107, 108, 111], 1, 190, 230),
        ...on(HOME, [105], 1, 190, 230),
        ...on(AWAY, AWAY_PK, 1, 100, 230),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 60, [key(UNIT_B)]: 30, [key(UNIT_C)]: 30 },
      qualifying: { "5v4": 120, "5v3": 0 },
      unknown: {},
      shiftOnlyAdvantageSeconds: 10,
      duplicateShiftSeconds: 0,
    },
  },
  {
    name: "same unit across a period boundary stays period-scoped",
    input: game(
      1002,
      "2026-10-03",
      [
        { period: 1, playedEndSecond: 1200, situationSegments: segments([0, 1100, "1551"], [1100, 1200, "1451"]) },
        { period: 2, playedEndSecond: 1200, situationSegments: segments([0, 20, "1451"], [20, 1200, "1551"]) },
      ],
      [
        ...goalies(1, 1200),
        ...goalies(2, 1200),
        ...on(HOME, UNIT_A, 1, 1100, 1200),
        ...on(AWAY, AWAY_PK, 1, 1100, 1200),
        ...on(HOME, UNIT_A, 2, 0, 20),
        ...on(AWAY, AWAY_PK, 2, 0, 20),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 120 },
      qualifying: { "5v4": 120, "5v3": 0 },
      unknown: {},
    },
  },
  {
    name: "duplicate and overlapping shift rows count once",
    input: game(
      1003,
      "2026-10-05",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 200, "1451"], [200, 1200, "1551"]) }],
      [
        ...goalies(1, 1200),
        ...on(HOME, UNIT_A, 1, 100, 200),
        ...on(HOME, [101], 1, 100, 200),
        ...on(HOME, [101], 1, 150, 200),
        ...on(AWAY, AWAY_PK, 1, 100, 200),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 100 },
      qualifying: { "5v4": 100, "5v3": 0 },
      unknown: {},
      duplicateShiftSeconds: 150,
    },
  },
  {
    name: "missing shift leaves seconds unknown, not attributed",
    input: game(
      1004,
      "2026-10-07",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 200, "1451"], [200, 1200, "1551"]) }],
      [
        ...goalies(1, 1200),
        ...on(HOME, [101, 102, 103, 110], 1, 100, 200),
        ...on(HOME, [104], 1, 100, 130),
        ...on(HOME, [104], 1, 160, 200),
        ...on(AWAY, AWAY_PK, 1, 100, 200),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 70 },
      qualifying: { "5v4": 100, "5v3": 0 },
      unknown: { team_skater_count_mismatch: 30 },
    },
  },
  {
    name: "5v3, 5v4, extra attacker, opponent empty net and 4v3 stay separate",
    input: game(
      1005,
      "2026-10-09",
      [{
        period: 1,
        playedEndSecond: 1200,
        situationSegments: segments(
          [0, 100, "1551"],
          [100, 130, "1351"],
          [130, 200, "1451"],
          [200, 230, "1460"],
          [230, 260, "0551"],
          [260, 300, "1341"],
          [300, 1200, "1551"],
        ),
      }],
      [
        ...on(HOME, [HOME_GOALIE], 1, 0, 200),
        ...on(HOME, [HOME_GOALIE], 1, 230, 1200),
        ...on(AWAY, [AWAY_GOALIE], 1, 0, 230),
        ...on(AWAY, [AWAY_GOALIE], 1, 260, 1200),
        ...on(HOME, UNIT_A, 1, 100, 260),
        ...on(HOME, [106], 1, 200, 230),
        ...on(HOME, [101, 102, 103, 110], 1, 260, 300),
        ...on(AWAY, [206, 207, 210], 1, 100, 300),
        ...on(AWAY, [208], 1, 130, 260),
        ...on(AWAY, [201], 1, 230, 260),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A, "5v3")]: 30, [key(UNIT_A)]: 70 },
      qualifying: { "5v4": 70, "5v3": 30 },
      unknown: {},
      excluded: { own_net_empty: 30, opponent_net_empty: 30, "4v3": 40 },
    },
  },
  {
    name: "every pair shares ice but the five are never together",
    input: game(
      1006,
      "2026-10-11",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 220, "1451"], [220, 1200, "1551"]) }],
      [
        ...goalies(1, 1200),
        ...on(HOME, [101, 102, 103, 104, 106], 1, 100, 130),
        ...on(HOME, [101, 102, 103, 105, 107], 1, 130, 160),
        ...on(HOME, [101, 104, 105, 106, 107], 1, 160, 190),
        ...on(HOME, [102, 103, 104, 105, 106], 1, 190, 220),
        ...on(AWAY, AWAY_PK, 1, 100, 220),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: {
        [key([101, 102, 103, 104, 106])]: 30,
        [key([101, 102, 103, 105, 107])]: 30,
        [key([101, 104, 105, 106, 107])]: 30,
        [key([102, 103, 104, 105, 106])]: 30,
      },
      qualifying: { "5v4": 120, "5v3": 0 },
      unknown: {},
    },
  },
  {
    name: "event-sampled PBP lags a penalty expiry; shifts expose it",
    input: game(
      1007,
      "2026-10-13",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 250, "1451"], [250, 1200, "1551"]) }],
      [
        ...goalies(1, 1200),
        ...on(HOME, UNIT_A, 1, 100, 250),
        ...on(AWAY, AWAY_PK, 1, 100, 250),
        // Penalized skater returns at 220; no PBP event until 250.
        ...on(AWAY, [205], 1, 220, 250),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 120 },
      qualifying: { "5v4": 150, "5v3": 0 },
      unknown: { opponent_skater_count_mismatch: 30 },
    },
  },
  {
    name: "upstream shift hold excludes the whole game",
    input: game(
      1008,
      "2026-10-15",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 200, "1451"], [200, 1200, "1551"]) }],
      [...goalies(1, 1200), ...on(HOME, UNIT_A, 1, 100, 200), ...on(AWAY, AWAY_PK, 1, 100, 200)],
      {
        shiftValidationPassed: false,
        upstreamHoldReasons: ["Incomplete situation coverage for shift (synthetic)"],
      },
    ),
    expected: { status: "excluded", unitSeconds: {} },
  },
  {
    name: "missing goalie shift and unrostered skater stay unknown",
    input: game(
      1009,
      "2026-10-17",
      [{ period: 1, playedEndSecond: 1200, situationSegments: segments([0, 100, "1551"], [100, 200, "1451"], [200, 1200, "1551"]) }],
      [
        ...on(HOME, [HOME_GOALIE], 1, 0, 100),
        ...on(HOME, [HOME_GOALIE], 1, 120, 1200),
        ...on(AWAY, [AWAY_GOALIE], 1, 0, 1200),
        ...on(HOME, [101, 102, 103, 104], 1, 100, 200),
        ...on(HOME, [110], 1, 100, 150),
        ...on(HOME, [UNROSTERED_SKATER], 1, 150, 200),
        ...on(AWAY, AWAY_PK, 1, 100, 200),
      ],
    ),
    expected: {
      status: "included",
      unitSeconds: { [key(UNIT_A)]: 30 },
      qualifying: { "5v4": 100, "5v3": 0 },
      unknown: { goalie_presence_conflict: 20, unknown_position: 50 },
    },
  },
];

/** Deterministic PRNG (mulberry32) for randomized oracle agreement. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_CODES = ["1551", "1451", "1541", "1351", "1531", "1341", "1431", "1460", "0651", "0551", "1550", "1441"];

/**
 * A noisy synthetic game: random situation segments, random overlapping and
 * duplicate shifts for both teams, goalies with gaps, and an unrostered
 * skater. Used only to check the sweep against the per-second oracle.
 */
export function randomGame(seed: number): ExactFiveGameInput {
  const random = seededRandom(seed);
  const int = (max: number) => Math.floor(random() * max);
  const periods: ExactFiveGameInput["periods"] = [];
  const shifts: ExactFiveShiftInput[] = [];
  const periodCount = 1 + int(2);
  for (let period = 1; period <= periodCount; period += 1) {
    const end = 120 + int(120);
    const cuts = new Set<number>([0, end]);
    for (let index = 0; index < 4; index += 1) cuts.add(1 + int(end - 1));
    const points = Array.from(cuts).sort((a, b) => a - b);
    periods.push({
      period,
      playedEndSecond: end,
      situationSegments: points.slice(0, -1).map((startSecond, index) => ({
        startSecond,
        endSecond: points[index + 1],
        situationCode: RANDOM_CODES[int(RANDOM_CODES.length)],
      })),
    });
    for (const [teamId, base, goalie] of [
      [HOME, 100, HOME_GOALIE],
      [AWAY, 200, AWAY_GOALIE],
    ] as const) {
      const pool = [101, 102, 103, 104, 105, 106, 107, 110, 111].map((id) => id - 100 + base);
      if (teamId === HOME) pool.push(UNROSTERED_SKATER);
      for (let index = 0; index < 18; index += 1) {
        const start = int(end - 1);
        const stop = Math.min(end, start + 1 + int(60));
        shifts.push({ playerId: pool[int(pool.length)], teamId, period, startSecond: start, endSecond: stop });
      }
      // Long same-unit shifts make five-skater sets common.
      const unitStart = int(end - 30);
      for (const playerId of pool.slice(0, 5)) {
        shifts.push({ playerId, teamId, period, startSecond: unitStart, endSecond: unitStart + 30 });
      }
      const gap = int(end);
      shifts.push({ playerId: goalie, teamId, period, startSecond: 0, endSecond: Math.max(1, gap) });
      if (gap + 5 < end) {
        shifts.push({ playerId: goalie, teamId, period, startSecond: gap + 5, endSecond: end });
      }
    }
  }
  return game(5000 + seed, "2026-10-18", periods, shifts);
}

/**
 * Frozen two-game fixture and an in-memory Supabase fake for proving the
 * player and goalie landing math at the served API routes (math-audit fix
 * lane L2-landing, rule 14). The real landing server runs end to end: games,
 * PBP events, shifts and roster spots go in; the route's JSON comes out.
 *
 * Game 1 (2025020001, shifts present), period 1 only, home 10 (HME) v away 20 (AWY):
 *   t=0    faceoff 1551, home 101 beats away 201
 *   t=100  home 101 shot on goal, medium danger, saved by away G 2001 (5v5)
 *   t=300  away 205 minor penalty (drawn by 101); faceoff at 1451 (home 5v4 PP)
 *   t=350  home 102 PP goal, medium danger, on 2001 (stored strength_exact "4v5", away-first)
 *   t=350  faceoff back at 1551
 *   t=500  away 201 shot on goal, medium danger, saved by home G 1001
 *   t=700  away 202 goal, low danger, on 1001 (home led 1-0 before it)
 *   t=900  away 203 shot on goal, high danger, saved by 1001
 *   period ends at 1200
 * Game 2 (2025020002, no shifts: PBP-only fallback), same teams and events.
 */
import type {
  PlayerStatsSourceEventRow,
  PlayerStatsSourceGameRow,
  PlayerStatsSourceShiftRow,
} from "lib/underlying-stats/playerStatsLandingServer";

export const HOME = 10;
export const AWAY = 20;
export const HOME_GOALIE = 1001;
export const AWAY_GOALIE = 2001;
export const HOME_SKATERS = [101, 102, 103, 104, 105];
export const AWAY_SKATERS = [201, 202, 203, 204, 205];

export const GAME_1: PlayerStatsSourceGameRow = {
  id: 2025020001,
  seasonId: 20252026,
  date: "2025-10-10",
  startTime: "2025-10-10T23:00:00.000Z",
  homeTeamId: HOME,
  awayTeamId: AWAY,
  type: 2,
  created_at: "2025-10-10T00:00:00.000Z",
} as PlayerStatsSourceGameRow;

export const GAME_2: PlayerStatsSourceGameRow = {
  ...GAME_1,
  id: 2025020002,
  date: "2025-10-12",
  startTime: "2025-10-12T23:00:00.000Z",
} as PlayerStatsSourceGameRow;

/** A later game with the same script but no penalty: all 5v5. */
export const GAME_3: PlayerStatsSourceGameRow = {
  ...GAME_1,
  id: 2025020003,
  date: "2025-10-14",
  startTime: "2025-10-14T23:00:00.000Z",
} as PlayerStatsSourceGameRow;

type EventSpec = {
  id: number;
  t: number;
  type: string;
  situation: string;
  owner: number | null;
  extra?: Partial<PlayerStatsSourceEventRow>;
};

function awayFirstStrength(situation: string) {
  return `${situation[1]}v${situation[2]}`;
}

function makeEvent(game: PlayerStatsSourceGameRow, spec: EventSpec): PlayerStatsSourceEventRow {
  return {
    event_id: spec.id,
    game_id: game.id,
    season_id: game.seasonId,
    game_date: game.date,
    sort_order: spec.id,
    period_number: 1,
    period_type: "REG",
    period_seconds_elapsed: spec.t,
    time_remaining_seconds: 1200 - spec.t,
    time_in_period: null,
    time_remaining: null,
    situation_code: spec.situation,
    away_goalie: Number(spec.situation[0]),
    away_skaters: Number(spec.situation[1]),
    home_skaters: Number(spec.situation[2]),
    home_goalie: Number(spec.situation[3]),
    strength_exact: awayFirstStrength(spec.situation),
    strength_state: null,
    strength_version: 2,
    home_team_defending_side: "left",
    type_code: null,
    type_desc_key: spec.type,
    event_owner_team_id: spec.owner,
    event_owner_side: null,
    is_shot_like: ["goal", "shot-on-goal", "missed-shot", "blocked-shot"].includes(spec.type),
    is_goal: spec.type === "goal",
    is_penalty: spec.type === "penalty",
    losing_player_id: null,
    winning_player_id: null,
    shooting_player_id: null,
    scoring_player_id: null,
    goalie_in_net_id: null,
    blocking_player_id: null,
    hitting_player_id: null,
    hittee_player_id: null,
    committed_by_player_id: null,
    drawn_by_player_id: null,
    served_by_player_id: null,
    player_id: null,
    assist1_player_id: null,
    assist2_player_id: null,
    shot_type: null,
    penalty_type_code: null,
    penalty_desc_key: null,
    penalty_duration_minutes: null,
    reason: null,
    secondary_reason: null,
    x_coord: null,
    y_coord: null,
    zone_code: null,
    home_score: null,
    away_score: null,
    home_sog: null,
    away_sog: null,
    details: null,
    raw_event: null,
    parser_version: 1,
    source_play_by_play_hash: "fixture",
    created_at: "2025-10-10T00:00:00.000Z",
    updated_at: "2025-10-10T00:00:00.000Z",
    ...spec.extra,
  } as PlayerStatsSourceEventRow;
}

/** Home attacks the right net (x = +89) in period 1; away attacks the left. */
export function buildGameEvents(game: PlayerStatsSourceGameRow): PlayerStatsSourceEventRow[] {
  const specs: EventSpec[] = [
    { id: 1, t: 0, type: "faceoff", situation: "1551", owner: HOME,
      extra: { winning_player_id: 101, losing_player_id: 201, x_coord: 0, y_coord: 0, zone_code: "N" } },
    { id: 2, t: 100, type: "shot-on-goal", situation: "1551", owner: HOME,
      extra: { shooting_player_id: 101, goalie_in_net_id: AWAY_GOALIE, x_coord: 59, y_coord: 0, zone_code: "O", shot_type: "wrist" } },
    { id: 3, t: 300, type: "penalty", situation: "1551", owner: AWAY,
      extra: { committed_by_player_id: 205, drawn_by_player_id: 101, penalty_duration_minutes: 2, penalty_type_code: "MIN", penalty_desc_key: "tripping" } },
    { id: 4, t: 300, type: "faceoff", situation: "1451", owner: HOME,
      extra: { winning_player_id: 101, losing_player_id: 201, x_coord: 69, y_coord: 22, zone_code: "O" } },
    { id: 5, t: 350, type: "goal", situation: "1451", owner: HOME,
      extra: { scoring_player_id: 102, shooting_player_id: 102, assist1_player_id: 101, goalie_in_net_id: AWAY_GOALIE, x_coord: 59, y_coord: 4, zone_code: "O", shot_type: "wrist", home_score: 1, away_score: 0 } },
    { id: 6, t: 350, type: "faceoff", situation: "1551", owner: AWAY,
      extra: { winning_player_id: 201, losing_player_id: 101, x_coord: 0, y_coord: 0, zone_code: "N" } },
    { id: 7, t: 500, type: "shot-on-goal", situation: "1551", owner: AWAY,
      extra: { shooting_player_id: 201, goalie_in_net_id: HOME_GOALIE, x_coord: -59, y_coord: 0, zone_code: "O", shot_type: "wrist" } },
    { id: 8, t: 700, type: "goal", situation: "1551", owner: AWAY,
      extra: { scoring_player_id: 202, shooting_player_id: 202, goalie_in_net_id: HOME_GOALIE, x_coord: -40, y_coord: 35, zone_code: "O", shot_type: "slap", home_score: 1, away_score: 1 } },
    { id: 9, t: 700, type: "faceoff", situation: "1551", owner: HOME,
      extra: { winning_player_id: 101, losing_player_id: 201, x_coord: 0, y_coord: 0, zone_code: "N" } },
    { id: 10, t: 900, type: "shot-on-goal", situation: "1551", owner: AWAY,
      extra: { shooting_player_id: 203, goalie_in_net_id: HOME_GOALIE, x_coord: -80, y_coord: 0, zone_code: "O", shot_type: "wrist" } },
  ];
  return specs.map((spec) => makeEvent(game, spec));
}

function makeShift(
  game: PlayerStatsSourceGameRow,
  shiftId: number,
  playerId: number,
  teamId: number,
  start: number,
  end: number
): PlayerStatsSourceShiftRow {
  return {
    game_id: game.id,
    shift_id: shiftId,
    season_id: game.seasonId,
    game_date: game.date,
    player_id: playerId,
    team_id: teamId,
    team_abbrev: teamId === HOME ? "HME" : "AWY",
    first_name: "P",
    last_name: String(playerId),
    period: 1,
    shift_number: shiftId,
    start_seconds: start,
    end_seconds: end,
    duration_seconds: end - start,
  } as PlayerStatsSourceShiftRow;
}

export function buildGameShifts(game: PlayerStatsSourceGameRow): PlayerStatsSourceShiftRow[] {
  const shifts: PlayerStatsSourceShiftRow[] = [];
  let id = 1;
  for (const playerId of [HOME_GOALIE, ...HOME_SKATERS]) {
    shifts.push(makeShift(game, id++, playerId, HOME, 0, 1200));
  }
  for (const playerId of [AWAY_GOALIE, ...AWAY_SKATERS.slice(0, 4)]) {
    shifts.push(makeShift(game, id++, playerId, AWAY, 0, 1200));
  }
  // 205 serves the minor from 300 until the PP goal at 350.
  shifts.push(makeShift(game, id++, 205, AWAY, 0, 300));
  shifts.push(makeShift(game, id++, 205, AWAY, 350, 1200));
  return shifts;
}

export function buildRosterSpots(game: PlayerStatsSourceGameRow) {
  return [
    ...[HOME_GOALIE, ...HOME_SKATERS].map((playerId) => ({ playerId, teamId: HOME })),
    ...[AWAY_GOALIE, ...AWAY_SKATERS].map((playerId) => ({ playerId, teamId: AWAY })),
  ].map(({ playerId, teamId }) => ({
    game_id: game.id,
    team_id: teamId,
    player_id: playerId,
    first_name: "P",
    last_name: String(playerId),
    sweater_number: playerId % 100,
    position_code: playerId === HOME_GOALIE || playerId === AWAY_GOALIE ? "G" : "C",
  }));
}

export function buildPlayers() {
  return [
    ...[HOME_GOALIE, AWAY_GOALIE].map((id) => ({ id, fullName: `Goalie ${id}`, position: "G" })),
    // 104 has no recorded position (decision 96).
    ...[...HOME_SKATERS, ...AWAY_SKATERS].map((id) => ({
      id,
      fullName: `Skater ${id}`,
      position: id === 104 ? null : "C",
    })),
  ];
}

export const TEAMS = [
  { id: HOME, abbreviation: "HME" },
  { id: AWAY, abbreviation: "AWY" },
];

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

/** Minimal PostgREST-style query builder over in-memory tables. */
export function createFakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Filter[] = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];
      let range: [number, number] | null = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
        in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), builder),
        gte: (column: string, value: never) => (filters.push((row) => (row[column] as never) >= value), builder),
        lte: (column: string, value: never) => (filters.push((row) => (row[column] as never) <= value), builder),
        like: (column: string, pattern: string) => {
          const prefix = pattern.replace(/%$/, "");
          filters.push((row) => String(row[column] ?? "").startsWith(prefix));
          return builder;
        },
        not: (column: string, operator: string, pattern: string) => {
          const prefix = pattern.replace(/%$/, "");
          filters.push((row) =>
            operator === "like" ? !String(row[column] ?? "").startsWith(prefix) : row[column] !== pattern
          );
          return builder;
        },
        order: (column: string, options?: { ascending?: boolean }) => (
          orders.push({ column, ascending: options?.ascending !== false }), builder
        ),
        range: (from: number, to: number) => ((range = [from, to]), builder),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          const rows = (tables[table] ?? [])
            .filter((row) => filters.every((filter) => filter(row)))
            .sort((left, right) => {
              for (const { column, ascending } of orders) {
                const a = left[column] as never;
                const b = right[column] as never;
                if (a === b) continue;
                if (a == null) return 1;
                if (b == null) return -1;
                return (a < b ? -1 : 1) * (ascending ? 1 : -1);
              }
              return 0;
            });
          const page = range ? rows.slice(range[0], range[1] + 1) : rows;
          return Promise.resolve({ data: page, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function buildEvenStrengthGameEvents(game: PlayerStatsSourceGameRow) {
  return buildGameEvents(game)
    .filter((event) => event.type_desc_key !== "penalty")
    .map((event) => ({
      ...event,
      situation_code: "1551",
      away_skaters: 5,
      strength_exact: "5v5",
    })) as PlayerStatsSourceEventRow[];
}

export function buildFixtureTables(
  options: { pbpOnlyGame2?: boolean; evenStrengthGame3?: boolean } = {}
) {
  const games = [
    GAME_1,
    ...(options.pbpOnlyGame2 ? [GAME_2] : []),
    ...(options.evenStrengthGame3 ? [GAME_3] : []),
  ];
  return {
    games: games as unknown as Row[],
    nhl_api_pbp_events: games.flatMap((game) =>
      game.id === GAME_3.id ? buildEvenStrengthGameEvents(game) : buildGameEvents(game)
    ) as unknown as Row[],
    nhl_api_shift_rows: [
      ...buildGameShifts(GAME_1),
      ...(options.evenStrengthGame3 ? buildGameShifts(GAME_3) : []),
    ] as unknown as Row[],
    nhl_api_game_roster_spots: games.flatMap((game) => buildRosterSpots(game)) as Row[],
    nhl_api_game_payloads_raw: [] as Row[],
    players: buildPlayers() as Row[],
    teams: TEAMS as Row[],
  };
}

export function createMockApiContext(query: Record<string, string>) {
  const response = {
    statusCode: 200,
    body: null as any,
    setHeader: () => undefined,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
  };
  return { req: { method: "GET", query } as any, res: response as any };
}

export const BASE_QUERY = {
  fromSeasonId: "20252026",
  throughSeasonId: "20252026",
  seasonType: "regularSeason",
  pageSize: "100",
};

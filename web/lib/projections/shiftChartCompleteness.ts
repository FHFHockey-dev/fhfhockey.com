import type { Database } from "lib/supabase/database-generated.types";

type ShiftChartTableRow = Database["public"]["Tables"]["shift_charts"]["Row"];

export type ShiftChartStrengthRow = Pick<
  ShiftChartTableRow,
  | "id"
  | "game_id"
  | "player_id"
  | "team_id"
  | "opponent_team_id"
  | "season_id"
  | "game_date"
  | "game_type"
  | "home_or_away"
  | "team_abbreviation"
  | "opponent_team_abbreviation"
  | "total_es_toi"
  | "total_pp_toi"
  | "total_pk_toi"
>;

export const SHIFT_CHART_STRENGTH_SELECT =
  "id,game_id,player_id,team_id,opponent_team_id,season_id,game_date,game_type,home_or_away,team_abbreviation,opponent_team_abbreviation,total_es_toi,total_pp_toi,total_pk_toi";

export type CompletenessStatus = "complete" | "partial" | "invalid";

export type ShiftChartStrengthRowClassification = {
  status: CompletenessStatus;
  reasons: string[];
};

export type ShiftChartStrengthGameClassification = {
  status: CompletenessStatus;
  reasons: string[];
  rowCount: number;
  playerIds: number[];
  expectedPlayerCount: number | null;
};

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isPositiveIntegerString(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

export function parseStrictShiftClock(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;
  return Number.isSafeInteger(minutes) && Number.isSafeInteger(total)
    ? total
    : null;
}

function addMissing(
  reasons: string[],
  row: ShiftChartStrengthRow,
  key: keyof ShiftChartStrengthRow,
): void {
  const value = row[key];
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    reasons.push(`missing:${key}`);
  }
}

export function classifyShiftChartStrengthRow(
  row: ShiftChartStrengthRow,
  expectedGameId?: number,
): ShiftChartStrengthRowClassification {
  const missing: string[] = [];
  const invalid: string[] = [];
  const required: Array<keyof ShiftChartStrengthRow> = [
    "id",
    "game_id",
    "player_id",
    "team_id",
    "opponent_team_id",
    "season_id",
    "game_date",
    "game_type",
    "home_or_away",
    "team_abbreviation",
    "opponent_team_abbreviation",
    "total_es_toi",
    "total_pp_toi",
    "total_pk_toi",
  ];

  for (const key of required) addMissing(missing, row, key);
  if (missing.length > 0) return { status: "partial", reasons: missing };

  for (const key of [
    "id",
    "game_id",
    "player_id",
    "team_id",
    "opponent_team_id",
    "season_id",
  ] as const) {
    if (!isPositiveSafeInteger(row[key])) invalid.push(`invalid:${key}`);
  }

  if (expectedGameId != null && row.game_id !== expectedGameId) {
    invalid.push("mismatched:game_id");
  }
  if (row.team_id === row.opponent_team_id) {
    invalid.push("invalid:opponent_team_id");
  }
  if (typeof row.game_date !== "string" || !isValidIsoDate(row.game_date)) {
    invalid.push("invalid:game_date");
  }
  if (
    typeof row.game_type !== "string" ||
    !isPositiveIntegerString(row.game_type)
  ) {
    invalid.push("invalid:game_type");
  }
  if (row.home_or_away !== "home" && row.home_or_away !== "away") {
    invalid.push("invalid:home_or_away");
  }
  for (const key of [
    "team_abbreviation",
    "opponent_team_abbreviation",
  ] as const) {
    if (typeof row[key] !== "string" || row[key].trim() !== row[key]) {
      invalid.push(`invalid:${key}`);
    }
  }
  for (const key of ["total_es_toi", "total_pp_toi", "total_pk_toi"] as const) {
    if (parseStrictShiftClock(row[key]) == null) {
      invalid.push(`invalid:${key}`);
    }
  }

  return invalid.length > 0
    ? { status: "invalid", reasons: invalid }
    : { status: "complete", reasons: [] };
}

function normalizedExpectedPlayerIds(
  expectedPlayerIds: Iterable<number> | undefined,
): { ids: Set<number> | null; invalid: boolean } {
  if (!expectedPlayerIds) return { ids: null, invalid: false };
  const values = Array.from(expectedPlayerIds);
  const ids = new Set<number>();
  let invalid = values.length === 0;
  for (const value of values) {
    if (!isPositiveSafeInteger(value)) {
      invalid = true;
      continue;
    }
    // Canonical raw shift feeds contain one row per shift, so the expected
    // player iterable naturally repeats a player many times. Deduplicate those
    // observations here; duplicate persisted player-game rows are still
    // rejected separately below.
    ids.add(value);
  }
  return { ids, invalid };
}

export function classifyShiftChartStrengthGame(args: {
  gameId: number;
  rows: readonly ShiftChartStrengthRow[];
  expectedPlayerIds?: Iterable<number>;
}): ShiftChartStrengthGameClassification {
  const { gameId, rows } = args;
  const expected = normalizedExpectedPlayerIds(args.expectedPlayerIds);
  if (!isPositiveSafeInteger(gameId)) {
    return {
      status: "invalid",
      reasons: ["invalid:expected_game_id"],
      rowCount: rows.length,
      playerIds: [],
      expectedPlayerCount: expected.ids?.size ?? null,
    };
  }
  if (rows.length === 0) {
    return {
      status: "partial",
      reasons: ["missing:rows"],
      rowCount: 0,
      playerIds: [],
      expectedPlayerCount: expected.ids?.size ?? null,
    };
  }

  const reasons: string[] = [];
  let status: CompletenessStatus = "complete";
  const ids = new Set<number>();
  const playerIds = new Set<number>();
  const teams = new Map<
    number,
    {
      opponent: number;
      side: "home" | "away";
      abbreviation: string;
      opponentAbbreviation: string;
    }
  >();
  let canonicalDate: string | null = null;
  let canonicalSeason: number | null = null;
  let canonicalGameType: string | null = null;

  for (const row of rows) {
    const classification = classifyShiftChartStrengthRow(row, gameId);
    if (classification.status === "invalid") status = "invalid";
    else if (classification.status === "partial" && status === "complete") {
      status = "partial";
    }
    reasons.push(...classification.reasons);
    if (classification.status !== "complete") continue;

    if (ids.has(row.id)) {
      status = "invalid";
      reasons.push("duplicate:id");
    }
    ids.add(row.id);
    if (playerIds.has(row.player_id!)) {
      status = "invalid";
      reasons.push("duplicate:player_id");
    }
    playerIds.add(row.player_id!);

    if (canonicalDate == null) canonicalDate = row.game_date;
    else if (canonicalDate !== row.game_date) {
      status = "invalid";
      reasons.push("mismatched:game_date");
    }
    if (canonicalSeason == null) canonicalSeason = row.season_id;
    else if (canonicalSeason !== row.season_id) {
      status = "invalid";
      reasons.push("mismatched:season_id");
    }
    if (canonicalGameType == null) canonicalGameType = row.game_type;
    else if (canonicalGameType !== row.game_type) {
      status = "invalid";
      reasons.push("mismatched:game_type");
    }

    const existingTeam = teams.get(row.team_id!);
    const nextTeam = {
      opponent: row.opponent_team_id!,
      side: row.home_or_away as "home" | "away",
      abbreviation: row.team_abbreviation!,
      opponentAbbreviation: row.opponent_team_abbreviation!,
    };
    if (
      existingTeam &&
      (existingTeam.opponent !== nextTeam.opponent ||
        existingTeam.side !== nextTeam.side ||
        existingTeam.abbreviation !== nextTeam.abbreviation ||
        existingTeam.opponentAbbreviation !== nextTeam.opponentAbbreviation)
    ) {
      status = "invalid";
      reasons.push("mismatched:team_metadata");
    }
    teams.set(row.team_id!, nextTeam);
  }

  if (status === "complete") {
    if (teams.size !== 2) {
      status = "invalid";
      reasons.push("invalid:team_count");
    } else {
      const entries = Array.from(teams.entries());
      const [[teamA, metaA], [teamB, metaB]] = entries;
      if (
        metaA.opponent !== teamB ||
        metaB.opponent !== teamA ||
        metaA.side === metaB.side ||
        metaA.abbreviation !== metaB.opponentAbbreviation ||
        metaB.abbreviation !== metaA.opponentAbbreviation
      ) {
        status = "invalid";
        reasons.push("invalid:reciprocal_team_metadata");
      }
    }
  }

  if (expected.invalid) {
    status = "invalid";
    reasons.push("invalid:expected_player_ids");
  } else if (expected.ids) {
    for (const playerId of expected.ids) {
      if (!playerIds.has(playerId)) {
        if (status === "complete") status = "partial";
        reasons.push("missing:expected_player_id");
      }
    }
    for (const playerId of playerIds) {
      if (!expected.ids.has(playerId)) {
        status = "invalid";
        reasons.push("unexpected:player_id");
      }
    }
  }

  return {
    status,
    reasons: Array.from(new Set(reasons)),
    rowCount: rows.length,
    playerIds: Array.from(playerIds).sort((a, b) => a - b),
    expectedPlayerCount: expected.ids?.size ?? null,
  };
}

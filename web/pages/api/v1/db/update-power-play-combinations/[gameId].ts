import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { SupabaseType } from "lib/supabase/client";
import { getKey, sortByPPTOI, type PlayerData, type TOIData } from "components/LinemateMatrix";
import { getAvg } from "components/LinemateMatrix/utilities";
import {
  buildTeamPpClock,
  type PpClockOfficialClass,
  type PpClockReferenceSource
} from "utils/getPowerPlayBlocks";
import { buildPenaltyClock } from "lib/projections/penaltyClock";
import {
  buildPowerPlayCombinationRows,
  type PowerPlayCombinationMetricRow
} from "lib/supabase/Upserts/powerPlayCombinationMetrics";

/**
 * Decision 152: PP time and share come from player shifts within the qualified team PP intervals, computed once
 * per game from stored rows (no live NHL calls) and stored for every reader:
 *  - the clock is buildTeamPpClock (decision 144 qualification, Part A Penalty Summary registry included);
 *  - PPTOI is each skater's stored shift seconds within that team's clock spans;
 *  - units follow the existing rule (LinemateMatrix sortByPPTOI on shared PP time);
 *  - pp_share_of_team = PPTOI / qualified clock seconds, never capped.
 * The game's player rows and its two pp_team_game_clock rows are replaced as one set in one transaction
 * (replace_power_play_game_v1, migration 20261113220000). A team-game whose clock is unqualified or whose inputs
 * are incomplete gets an unavailable clock row with its reason and no player rows; a qualified clock of 0 is
 * "not applicable", never 0%.
 */
export const PP_COMBINATIONS_CALCULATION_VERSION = "pp-shifts-qualified-clock-v1";
// A team on the power play has at least four skaters on the ice, so far fewer than that means its shifts are incomplete.
const MIN_SKATERS_PER_PP_SECOND = 3;
const SHIFT_TYPE_CODE = 517;
const PAGE_SIZE = 1000;
const PERIOD_SECONDS = 1200;

export type StoredPbpEvent = {
  event_id: number;
  sort_order: number | null;
  period_number: number | null;
  period_type: string | null;
  time_in_period: string | null;
  time_remaining: string | null;
  situation_code: string | null;
  type_desc_key: string | null;
  event_owner_team_id: number | null;
  penalty_type_code: string | null;
  penalty_desc_key: string | null;
  penalty_duration_minutes: number | null;
  committed_by_player_id: number | null;
  served_by_player_id: number | null;
};
export type StoredShift = {
  player_id: number;
  team_id: number;
  period: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
};
export type StoredRosterSpot = { player_id: number; team_id: number; position_code: string | null };
export type StoredTeamGameStats = { teamId: number; powerPlayToi: string | null; powerPlay: string | null };

export type PowerPlayGameInputs = {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  gameType: number;
  events: StoredPbpEvent[];
  shifts: StoredShift[];
  roster: StoredRosterSpot[];
  teamGameStats: StoredTeamGameStats[];
};

export type PpTeamGameAvailability = "available" | "not_applicable" | "unavailable";
export type PpTeamGameClockRow = {
  game_id: number;
  team_id: number;
  availability: PpTeamGameAvailability;
  unavailable_reason: string | null;
  qualified: boolean;
  clock_seconds: number | null;
  reference_source: PpClockReferenceSource;
  official_class: PpClockOfficialClass;
  official_seconds: number | null;
  penalty_summary_seconds: number | null;
  audit_checked_events: number | null;
  audit_disagreements: number | null;
  skater_seconds: number | null;
};
/** A stored row plus team_id, which the replace RPC checks against the clock rows and doesn't store. */
export type PowerPlayPlayerRow = PowerPlayCombinationMetricRow & { team_id: number };

const STORED_FIELDS = [
  "unit",
  "PPTOI",
  "percentageOfPP",
  "pp_unit_usage_index",
  "pp_unit_relative_toi",
  "pp_vs_unit_avg",
  "pp_share_of_team"
] as const;
type StoredField = (typeof STORED_FIELDS)[number];
export type StoredPowerPlayRow = { playerId: number } & Record<StoredField, number | null>;

export type PowerPlayGameDiff = {
  inserted: PowerPlayPlayerRow[];
  deleted: StoredPowerPlayRow[];
  updated: Array<{ playerId: number; changes: Partial<Record<StoredField, { before: number | null; after: number | null }>> }>;
  unchanged: number;
};

export type PowerPlayCombinationUpdateSummary = {
  gameId: number;
  dryRun: boolean;
  calculationVersion: string;
  rowCount: number;
  teamCount: number;
  clock: PpTeamGameClockRow[];
  /** The computed player rows (the full set the replace stores). */
  rows: PowerPlayPlayerRow[];
  diff: PowerPlayGameDiff;
  /** The replace keeps no stored row it didn't recompute, so this is always 0 (the batch route still sums it). */
  keptUnproven: 0;
  receipt: { deletedPlayerRows: number; insertedPlayerRows: number; clockRows: number } | null;
};

function toPlays(events: StoredPbpEvent[]) {
  return events.map((event) => {
    const details: Record<string, unknown> = {};
    if (event.event_owner_team_id != null) details.eventOwnerTeamId = event.event_owner_team_id;
    if (event.penalty_type_code != null) details.typeCode = event.penalty_type_code;
    if (event.penalty_desc_key != null) details.descKey = event.penalty_desc_key;
    if (event.penalty_duration_minutes != null) details.duration = event.penalty_duration_minutes;
    if (event.committed_by_player_id != null) details.committedByPlayerId = event.committed_by_player_id;
    if (event.served_by_player_id != null) details.servedByPlayerId = event.served_by_player_id;
    return {
      eventId: event.event_id,
      sortOrder: event.sort_order,
      periodDescriptor: { number: event.period_number, periodType: event.period_type },
      timeInPeriod: event.time_in_period,
      timeRemaining: event.time_remaining,
      situationCode: event.situation_code,
      typeDescKey: event.type_desc_key,
      details
    };
  });
}

type TeamNumerator =
  | { reason: string; skaterSeconds: number | null }
  | { rows: PowerPlayPlayerRow[]; skaterSeconds: number };

function buildTeamNumerator(
  inputs: PowerPlayGameInputs,
  plays: ReturnType<typeof toPlays>,
  teamId: number,
  clockSeconds: number
): TeamNumerator {
  const teamRoster = inputs.roster.filter((spot) => spot.team_id === teamId);
  const goalieIds = new Set(teamRoster.filter((spot) => spot.position_code === "G").map((spot) => spot.player_id));
  if (teamRoster.length === 0 || goalieIds.size === 0) {
    return { reason: "No stored roster with a goalie for this team, so skaters can't be told from goalies.", skaterSeconds: null };
  }
  const ppSeconds = new Set<number>();
  for (const span of buildPenaltyClock(plays, inputs).spans) {
    if (span.teamId !== teamId) continue;
    for (let second = span.start; second < span.end; second++) ppSeconds.add(second);
  }
  if (ppSeconds.size !== clockSeconds) {
    return { reason: `The clock spans cover ${ppSeconds.size} s, not the qualified ${clockSeconds} s.`, skaterSeconds: null };
  }

  const rosterIds = new Set(teamRoster.map((spot) => spot.player_id));
  const onIce = new Map<number, Set<number>>();
  for (const shift of inputs.shifts) {
    if (shift.team_id !== teamId) continue;
    if (shift.period == null || shift.start_seconds == null || shift.end_seconds == null) {
      return { reason: `A stored shift row for player ${shift.player_id} has no period, start or end.`, skaterSeconds: null };
    }
    if (!rosterIds.has(shift.player_id)) {
      return { reason: `Player ${shift.player_id} has shifts but isn't in the stored roster.`, skaterSeconds: null };
    }
    if (goalieIds.has(shift.player_id)) continue;
    const base = (shift.period - 1) * PERIOD_SECONDS;
    const seconds = onIce.get(shift.player_id) ?? new Set<number>();
    for (let second = base + shift.start_seconds; second < base + shift.end_seconds; second++) {
      if (ppSeconds.has(second)) seconds.add(second);
    }
    onIce.set(shift.player_id, seconds);
  }
  const skaters = [...onIce.entries()]
    .filter(([, seconds]) => seconds.size > 0)
    .sort(([a, sa], [b, sb]) => sb.size - sa.size || a - b);
  const skaterSeconds = skaters.reduce((sum, [, seconds]) => sum + seconds.size, 0);
  if (skaterSeconds < clockSeconds * MIN_SKATERS_PER_PP_SECOND) {
    return {
      reason: `Stored shifts cover ${skaterSeconds} skater-seconds of PP, below ${MIN_SKATERS_PER_PP_SECOND} x the ${clockSeconds} s clock; the shift rows look incomplete.`,
      skaterSeconds
    };
  }

  // The unit rule as the writer has always applied it, fed with shared PP seconds instead of live shift charts.
  const players = new Map<number, PlayerData>(
    skaters.map(([playerId]) => [
      playerId,
      { id: playerId, teamId, position: teamRoster.find((spot) => spot.player_id === playerId)?.position_code ?? "", sweaterNumber: 0, name: "" }
    ])
  );
  const table: Record<string, TOIData> = {};
  skaters.forEach(([a, sa], i) => {
    skaters.slice(i).forEach(([b, sb]) => {
      let shared = 0;
      for (const second of sa) if (sb.has(second)) shared++;
      table[getKey(a, b)] = { toi: shared, p1: players.get(a)!, p2: players.get(b)! };
    });
  });
  const sorted = sortByPPTOI(table);
  const rows: PowerPlayPlayerRow[] = [];
  [sorted.slice(0, 5), sorted.slice(5, 10), sorted.slice(10)].forEach((unit, i) => {
    if (unit.length === 0) return;
    rows.push(
      ...buildPowerPlayCombinationRows({
        gameId: inputs.gameId,
        unit: i + 1,
        players: unit.map((player) => ({ playerId: player.id, toiSeconds: table[getKey(player.id, player.id)].toi })),
        avgUnitToiSeconds: getAvg(unit, table),
        teamPpToiSeconds: clockSeconds
      }).map((row) => ({ ...row, team_id: teamId }))
    );
  });
  // Unreachable with set intersections; checked so an impossible value is withheld, never capped.
  if (rows.length !== skaters.length || rows.some((row) => row.PPTOI > clockSeconds || (row.pp_share_of_team ?? 0) > 1)) {
    return { reason: "A player's PP time exceeds the team clock.", skaterSeconds };
  }
  return { rows, skaterSeconds };
}

/** The decision-152 set for one game: two clock rows and the player rows of its available team-games. */
export function buildPowerPlayGameSet(inputs: PowerPlayGameInputs): {
  clockRows: PpTeamGameClockRow[];
  playerRows: PowerPlayPlayerRow[];
} {
  const plays = toPlays(inputs.events);
  const clockRows: PpTeamGameClockRow[] = [];
  const playerRows: PowerPlayPlayerRow[] = [];
  for (const teamId of [inputs.homeTeamId, inputs.awayTeamId]) {
    const stats = inputs.teamGameStats.find((row) => row.teamId === teamId);
    const clock = buildTeamPpClock({
      gameId: inputs.gameId,
      teamId,
      homeTeamId: inputs.homeTeamId,
      awayTeamId: inputs.awayTeamId,
      gameType: inputs.gameType,
      plays,
      official: stats ? { powerPlayToi: stats.powerPlayToi, powerPlay: stats.powerPlay } : null
    });
    const base = {
      game_id: inputs.gameId,
      team_id: teamId,
      qualified: clock.qualified,
      clock_seconds: clock.seconds,
      reference_source: clock.referenceSource,
      official_class: clock.official.class,
      official_seconds: clock.official.seconds,
      penalty_summary_seconds: clock.penaltySummary?.seconds ?? null,
      audit_checked_events: clock.audit?.checkedEvents ?? null,
      audit_disagreements: clock.audit?.disagreements ?? null
    };
    if (!clock.qualified || clock.seconds == null) {
      clockRows.push({
        ...base,
        availability: "unavailable",
        unavailable_reason: clock.unqualifiedReason ?? "The PP clock is not qualified.",
        skater_seconds: null
      });
      continue;
    }
    if (clock.seconds === 0) {
      clockRows.push({ ...base, availability: "not_applicable", unavailable_reason: null, skater_seconds: null });
      continue;
    }
    const numerator = buildTeamNumerator(inputs, plays, teamId, clock.seconds);
    if ("reason" in numerator) {
      clockRows.push({
        ...base,
        availability: "unavailable",
        unavailable_reason: numerator.reason,
        skater_seconds: numerator.skaterSeconds
      });
      continue;
    }
    clockRows.push({ ...base, availability: "available", unavailable_reason: null, skater_seconds: numerator.skaterSeconds });
    playerRows.push(...numerator.rows);
  }
  return { clockRows, playerRows };
}

export function diffPowerPlayGame(stored: StoredPowerPlayRow[], next: PowerPlayPlayerRow[]): PowerPlayGameDiff {
  const storedById = new Map(stored.map((row) => [row.playerId, row]));
  const nextIds = new Set(next.map((row) => row.playerId));
  const diff: PowerPlayGameDiff = {
    inserted: [],
    deleted: stored.filter((row) => !nextIds.has(row.playerId)),
    updated: [],
    unchanged: 0
  };
  for (const row of next) {
    const before = storedById.get(row.playerId);
    if (!before) {
      diff.inserted.push(row);
      continue;
    }
    const changes: PowerPlayGameDiff["updated"][number]["changes"] = {};
    for (const field of STORED_FIELDS) {
      const was = before[field] == null ? null : Number(before[field]);
      const now = row[field] == null ? null : Number(row[field]);
      if (was !== now) changes[field] = { before: was, after: now };
    }
    if (Object.keys(changes).length === 0) diff.unchanged++;
    else diff.updated.push({ playerId: row.playerId, changes });
  }
  return diff;
}

type PagedResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function readAllRows<T>(label: string, page: (from: number, to: number) => PagedResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Reading ${label} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readStoredGameInputs(gameId: number, supabase: SupabaseType): Promise<PowerPlayGameInputs> {
  const { data: game, error } = await supabase
    .from("games")
    .select("id, homeTeamId, awayTeamId, type")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(`Reading game ${gameId} failed: ${error.message}`);
  if (!game) throw new Error(`Game ${gameId} is not in games.`);
  const [events, shifts, roster, teamGameStats] = await Promise.all([
    readAllRows<StoredPbpEvent>("nhl_api_pbp_events", (from, to) =>
      supabase
        .from("nhl_api_pbp_events")
        .select(
          "event_id, sort_order, period_number, period_type, time_in_period, time_remaining, situation_code, type_desc_key, event_owner_team_id, penalty_type_code, penalty_desc_key, penalty_duration_minutes, committed_by_player_id, served_by_player_id"
        )
        .eq("game_id", gameId)
        .order("sort_order", { ascending: true })
        .order("event_id", { ascending: true })
        .range(from, to) as unknown as PagedResult<StoredPbpEvent>
    ),
    readAllRows<StoredShift>("nhl_api_shift_rows", (from, to) =>
      supabase
        .from("nhl_api_shift_rows")
        .select("player_id, team_id, period, start_seconds, end_seconds")
        .eq("game_id", gameId)
        .eq("type_code", SHIFT_TYPE_CODE)
        .order("shift_id", { ascending: true })
        .range(from, to) as unknown as PagedResult<StoredShift>
    ),
    readAllRows<StoredRosterSpot>("nhl_api_game_roster_spots", (from, to) =>
      supabase
        .from("nhl_api_game_roster_spots")
        .select("player_id, team_id, position_code")
        .eq("game_id", gameId)
        .order("player_id", { ascending: true })
        .range(from, to) as unknown as PagedResult<StoredRosterSpot>
    ),
    readAllRows<StoredTeamGameStats>("teamGameStats", (from, to) =>
      supabase
        .from("teamGameStats")
        .select("teamId, powerPlayToi, powerPlay")
        .eq("gameId", gameId)
        .range(from, to) as unknown as PagedResult<StoredTeamGameStats>
    )
  ]);
  return {
    gameId,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    gameType: game.type ?? Math.floor(gameId / 10_000) % 100,
    events,
    shifts,
    roster,
    teamGameStats
  };
}

export async function updatePowerPlayCombinations(
  gameId: number,
  supabase: SupabaseType,
  options: { dryRun?: boolean } = {}
): Promise<PowerPlayCombinationUpdateSummary> {
  const inputs = await readStoredGameInputs(gameId, supabase);
  const { clockRows, playerRows } = buildPowerPlayGameSet(inputs);
  const stored = await readAllRows<StoredPowerPlayRow>("powerPlayCombinations", (from, to) =>
    supabase
      .from("powerPlayCombinations")
      .select(`playerId, ${STORED_FIELDS.join(", ")}`)
      .eq("gameId", gameId)
      .order("playerId", { ascending: true })
      .range(from, to) as unknown as PagedResult<StoredPowerPlayRow>
  );
  const summary: PowerPlayCombinationUpdateSummary = {
    gameId,
    dryRun: options.dryRun === true,
    calculationVersion: PP_COMBINATIONS_CALCULATION_VERSION,
    rowCount: playerRows.length,
    teamCount: clockRows.length,
    clock: clockRows,
    rows: playerRows,
    diff: diffPowerPlayGame(stored, playerRows),
    keptUnproven: 0,
    receipt: null
  };
  if (summary.dryRun) return summary;

  // The RPC and its table are added by the unapplied migration 20261113220000, so they aren't in the generated types.
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{
    data: Array<{ deleted_player_rows: number; inserted_player_rows: number; clock_rows: number }> | null;
    error: { message: string } | null;
  }>)("replace_power_play_game_v1", {
    p_game_id: gameId,
    p_calculation_version: PP_COMBINATIONS_CALCULATION_VERSION,
    p_computed_at: new Date().toISOString(),
    p_clock_rows: clockRows,
    p_player_rows: playerRows
  });
  if (error) throw new Error(`Replacing the power-play rows for game ${gameId} failed; nothing was written: ${error.message}`);
  const receipt = data?.[0];
  summary.receipt = receipt
    ? {
        deletedPlayerRows: receipt.deleted_player_rows,
        insertedPlayerRows: receipt.inserted_player_rows,
        clockRows: receipt.clock_rows
      }
    : null;
  return summary;
}

export default adminOnly(withCronJobAudit(async (req, res) => {
  const { supabase } = req;
  const gameId = Number(req.query.gameId);
  if (!gameId) {
    return res.status(400).json({
      message: "Invalid game id",
      success: false
    });
  }
  const dryRun = req.query.dryRun === "true" || req.query.dryRun === "1";

  try {
    const summary = await updatePowerPlayCombinations(gameId, supabase, { dryRun });
    res.json({
      message: dryRun
        ? `Dry run for game ${gameId}: nothing was written.`
        : "Successfully updated the power play combinations for game " + gameId,
      success: true,
      ...summary
    });
  } catch (e: any) {
    res.status(400).json({
      message: "Failed to update the power play combinations. " + e.message,
      success: false
    });
  }
}));

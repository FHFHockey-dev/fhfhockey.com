import supabase from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import {
  type SandboxBandComparison,
  type SandboxBandRow,
  SANDBOX_ENTITY_CONFIG,
  type SandboxEntityType,
  type SandboxExpectationState,
  type SandboxScoreRow,
  deriveLegacyExpectationState,
  getSandboxMetricLabel
} from "./entitySurface";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type LegacyScoreRow = Database["public"]["Tables"]["sustainability_scores"]["Row"];
type LegacyBandRow =
  Database["public"]["Tables"]["sustainability_trend_bands"]["Row"];
type PlayerBaselineRow =
  Database["public"]["Tables"]["player_baselines"]["Row"];
type WgoSkaterGameContextRow =
  Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
type UnifiedScoreRow = {
  snapshot_date: string;
  season_id: number | null;
  entity_type: string;
  entity_id: number;
  team_id: number | null;
  player_id: number | null;
  metric_scope: string;
  window_code: string;
  baseline_value: number | null;
  recent_value: number | null;
  expected_value: number | null;
  z_score: number | null;
  s_raw: number;
  s_100: number;
  expectation_state: string;
  components: Json;
  provenance: Json;
  metadata: Json;
  computed_at: string;
  updated_at: string;
};
type UnifiedBandRow = {
  snapshot_date: string;
  season_id: number | null;
  entity_type: string;
  entity_id: number;
  team_id: number | null;
  player_id: number | null;
  metric_key: string;
  window_code: string;
  baseline: number | null;
  ewma: number | null;
  value: number;
  ci_lower: number;
  ci_upper: number;
  z_score: number | null;
  percentile: number | null;
  exposure: number | null;
  distribution: Json;
  provenance: Json;
  metadata: Json;
  computed_at: string;
  updated_at: string;
};
type SnapshotDateRow = {
  snapshot_date: string;
};

type BandHistoryComparisonSummary = {
  l5: number | null;
  l10: number | null;
  l20: number | null;
  season: number | null;
};

export type SandboxEntityOption = {
  id: number;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
};

export type SandboxScoresPayload = {
  entityType: SandboxEntityType;
  requestedDate: string;
  snapshotDate: string | null;
  windowCode: string;
  totalRows: number;
  rows: SandboxScoreRow[];
  selectedRow: SandboxScoreRow | null;
};

export type SandboxBandsPayload = {
  entityType: SandboxEntityType;
  requestedDate: string;
  snapshotDate: string | null;
  windowCode: string;
  currentRows: SandboxBandRow[];
  historyRows: SandboxBandRow[];
};

export type SandboxScoreHistoryRow = {
  entityType: SandboxEntityType;
  entityId: number;
  entityName: string;
  entitySubtitle: string | null;
  snapshotDate: string;
  windowCode: string;
  score: number;
  rawScore: number;
  expectationState: SandboxExpectationState;
  baselineValue: number | null;
  recentValue: number | null;
  expectedValue: number | null;
};

export type SandboxScoreHistoryPayload = {
  entityType: SandboxEntityType;
  requestedDate: string;
  snapshotDate: string | null;
  windowCode: string;
  rows: SandboxScoreHistoryRow[];
};

const DEFAULT_LIMIT = 60;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function resolveSeasonIdFromDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  return parsed.getUTCMonth() >= 8
    ? year * 10000 + (year + 1)
    : (year - 1) * 10000 + year;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveTeamMetaById(teamId: number | null | undefined) {
  if (teamId == null) return null;
  return (
    Object.values(teamsInfo).find((team) => team.id === Number(teamId)) ?? null
  );
}

function buildPlayerSubtitle(player: {
  team_id?: number | null;
  position?: string | null;
}) {
  const team = resolveTeamMetaById(player.team_id ?? null);
  const parts = [team?.abbrev ?? null, player.position ?? null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

async function fetchPlayersByIds(playerIds: number[]) {
  if (!playerIds.length) return new Map<number, PlayerRow>();
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .in("id", Array.from(new Set(playerIds)));

  if (error) {
    throw new Error(`Failed to load player metadata: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PlayerRow[]).map((player) => [Number(player.id), player])
  );
}

async function fetchPlayerBaselinesForSnapshot(snapshotDate: string) {
  const { data, error } = await supabase
    .from("player_baselines")
    .select(
      "player_id, player_name, position_code, snapshot_date, win_l5, win_l10, win_l20, win_season_prev, win_career"
    )
    .eq("snapshot_date", snapshotDate);

  if (error) {
    throw new Error(`Failed to load player baselines: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PlayerBaselineRow[]).map((row) => [Number(row.player_id), row])
  );
}

async function fetchSkaterGameContextByDate(
  playerId: number,
  seasonId: number | null
) {
  let query = supabase
    .from("wgo_skater_stats")
    .select(
      "date, game_id, current_team_abbreviation, opponent_team_abbrev, home_road, points, shots, hits, blocked_shots, pp_points, games_played"
    )
    .eq("player_id", playerId)
    .gt("games_played", 0);

  if (seasonId != null) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query.order("date", { ascending: true });

  if (error) {
    throw new Error(`Failed to load skater game context: ${error.message}`);
  }

  const lookup = new Map<
    string,
    {
      gameId: number | null;
      teamAbbreviation: string | null;
      opponentAbbreviation: string | null;
      homeRoad: string | null;
      points: number | null;
      shots: number | null;
      hits: number | null;
      blockedShots: number | null;
      ppPoints: number | null;
    }
  >();

  ((data ?? []) as WgoSkaterGameContextRow[]).forEach((row) => {
    lookup.set(String(row.date).slice(0, 10), {
      gameId: row.game_id != null ? Number(row.game_id) : null,
      teamAbbreviation: row.current_team_abbreviation ?? null,
      opponentAbbreviation: row.opponent_team_abbrev ?? null,
      homeRoad: row.home_road ?? null,
      points: typeof row.points === "number" ? row.points : null,
      shots: typeof row.shots === "number" ? row.shots : null,
      hits: typeof row.hits === "number" ? row.hits : null,
      blockedShots:
        typeof row.blocked_shots === "number" ? row.blocked_shots : null,
      ppPoints: typeof row.pp_points === "number" ? row.pp_points : null
    });
  });

  return lookup;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.mu === "number" && Number.isFinite(candidate.mu)) {
    return candidate.mu;
  }
  if (typeof candidate.value === "number" && Number.isFinite(candidate.value)) {
    return candidate.value;
  }
  return null;
}

function computeDeltaPct(currentValue: number, comparisonValue: number | null) {
  if (
    comparisonValue == null ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(comparisonValue) ||
    comparisonValue === 0
  ) {
    return null;
  }

  return ((currentValue - comparisonValue) / Math.abs(comparisonValue)) * 100;
}

const SKATER_BASELINE_METRIC_KEYS: Record<
  string,
  {
    l5?: string[];
    l10?: string[];
    l20?: string[];
    career?: string[];
  }
> = {
  icf_per_60: {
    l5: ["nst_icf_per_60"],
    l10: ["nst_icf_per_60"],
    l20: ["nst_icf_per_60"],
    career: ["nst_icf_per_60"]
  },
  ipp: {
    l5: ["nst_ipp"],
    l10: ["nst_ipp"],
    l20: ["nst_ipp"],
    career: ["nst_ipp"]
  },
  ixg_per_60: {
    l5: ["nst_ixg_per_60"],
    l10: ["nst_ixg_per_60"],
    l20: ["nst_ixg_per_60"],
    career: ["nst_ixg_per_60"]
  },
  on_ice_sh_pct: {
    l5: ["nst_oi_shooting_pct"],
    l10: ["nst_oi_shooting_pct"],
    l20: ["nst_oi_shooting_pct"],
    career: ["nst_oi_shooting_pct"]
  },
  on_ice_sv_pct: {
    l5: ["nst_oi_save_pct"],
    l10: ["nst_oi_save_pct"],
    l20: ["nst_oi_save_pct"],
    career: ["nst_oi_save_pct"]
  },
  pdo: {
    l5: ["nst_oi_pdo"],
    l10: ["nst_oi_pdo"],
    l20: ["nst_oi_pdo"],
    career: ["nst_oi_pdo"]
  },
  points_per_60_5v5: {
    l5: ["points_per_60_5v5"],
    l10: ["points_per_60_5v5"],
    l20: ["points_per_60_5v5"],
    career: ["points_per_60_5v5"]
  },
  pp_goals_per_60: {
    l5: ["pp_goals_per_60"],
    l10: ["pp_goals_per_60"],
    l20: ["pp_goals_per_60"],
    career: ["pp_goals_per_60"]
  },
  pp_points_per_60: {
    l5: ["pp_points_per_60"],
    l10: ["pp_points_per_60"],
    l20: ["pp_points_per_60"],
    career: ["pp_points_per_60"]
  },
  sh_pct: {
    l5: ["shooting_percentage", "shooting_percentage_5v5"],
    l10: ["shooting_percentage", "shooting_percentage_5v5"],
    l20: ["shooting_percentage", "shooting_percentage_5v5"],
    career: ["shooting_percentage", "shooting_percentage_5v5"]
  },
  shots_per_60: {
    l5: ["nst_shots_per_60"],
    l10: ["nst_shots_per_60"],
    l20: ["nst_shots_per_60"],
    career: ["nst_shots_per_60"]
  }
};

function resolveBaselineBucketValue(args: {
  baseline: PlayerBaselineRow | undefined;
  bucket: "l5" | "l10" | "l20" | "career";
  metricKey: string;
}) {
  const metricCandidates =
    SKATER_BASELINE_METRIC_KEYS[args.metricKey]?.[args.bucket] ?? [];
  if (!metricCandidates.length || !args.baseline) {
    return null;
  }

  const field =
    args.bucket === "l5"
      ? args.baseline.win_l5
      : args.bucket === "l10"
        ? args.baseline.win_l10
        : args.bucket === "l20"
          ? args.baseline.win_l20
          : args.baseline.win_career;

  if (typeof field !== "object" || field == null || Array.isArray(field)) {
    return null;
  }

  const record = field as Record<string, unknown>;
  for (const candidate of metricCandidates) {
    const value = toFiniteNumber(record[candidate]);
    if (value != null) return value;
  }

  return null;
}

function buildBandHistoryComparisonLookup<
  TRow extends { metric_key: string; value: number | null }
>(rows: TRow[]) {
  const grouped = new Map<string, number[]>();

  rows.forEach((row) => {
    if (typeof row.value !== "number" || !Number.isFinite(row.value)) return;
    const existing = grouped.get(row.metric_key) ?? [];
    existing.push(row.value);
    grouped.set(row.metric_key, existing);
  });

  const lookup = new Map<string, BandHistoryComparisonSummary>();
  grouped.forEach((values, metricKey) => {
    lookup.set(metricKey, {
      l5: average(values.slice(-5)),
      l10: average(values.slice(-10)),
      l20: average(values.slice(-20)),
      season: average(values)
    });
  });

  return lookup;
}

function buildBandComparisons(args: {
  entityType: SandboxEntityType;
  metricKey: string;
  currentValue: number;
  historyComparisons: BandHistoryComparisonSummary | undefined;
  baseline: PlayerBaselineRow | undefined;
}): SandboxBandComparison[] {
  const historyComparisons = args.historyComparisons;
  const l5Value =
    args.entityType === "skater"
      ? resolveBaselineBucketValue({
          baseline: args.baseline,
          bucket: "l5",
          metricKey: args.metricKey
        }) ?? historyComparisons?.l5 ?? null
      : historyComparisons?.l5 ?? null;
  const l10Value =
    args.entityType === "skater"
      ? resolveBaselineBucketValue({
          baseline: args.baseline,
          bucket: "l10",
          metricKey: args.metricKey
        }) ?? historyComparisons?.l10 ?? null
      : historyComparisons?.l10 ?? null;
  const l20Value =
    args.entityType === "skater"
      ? resolveBaselineBucketValue({
          baseline: args.baseline,
          bucket: "l20",
          metricKey: args.metricKey
        }) ?? historyComparisons?.l20 ?? null
      : historyComparisons?.l20 ?? null;
  const seasonValue = historyComparisons?.season ?? null;
  const careerValue =
    args.entityType === "skater"
      ? resolveBaselineBucketValue({
          baseline: args.baseline,
          bucket: "career",
          metricKey: args.metricKey
        })
      : null;

  return [
    {
      key: "l5",
      label: "L5 Avg",
      value: l5Value,
      deltaPct: computeDeltaPct(args.currentValue, l5Value),
      source: l5Value != null
        ? args.entityType === "skater" &&
          resolveBaselineBucketValue({
            baseline: args.baseline,
            bucket: "l5",
            metricKey: args.metricKey
          }) != null
          ? "baseline_window"
          : "history_average"
        : "unavailable"
    },
    {
      key: "l10",
      label: "L10 Avg",
      value: l10Value,
      deltaPct: computeDeltaPct(args.currentValue, l10Value),
      source: l10Value != null
        ? args.entityType === "skater" &&
          resolveBaselineBucketValue({
            baseline: args.baseline,
            bucket: "l10",
            metricKey: args.metricKey
          }) != null
          ? "baseline_window"
          : "history_average"
        : "unavailable"
    },
    {
      key: "l20",
      label: "L20 Avg",
      value: l20Value,
      deltaPct: computeDeltaPct(args.currentValue, l20Value),
      source: l20Value != null
        ? args.entityType === "skater" &&
          resolveBaselineBucketValue({
            baseline: args.baseline,
            bucket: "l20",
            metricKey: args.metricKey
          }) != null
          ? "baseline_window"
          : "history_average"
        : "unavailable"
    },
    {
      key: "season",
      label: "Season Avg",
      value: seasonValue,
      deltaPct: computeDeltaPct(args.currentValue, seasonValue),
      source: seasonValue != null ? "history_average" : "unavailable"
    },
    {
      key: "career",
      label: "Career Avg",
      value: careerValue,
      deltaPct: computeDeltaPct(args.currentValue, careerValue),
      source: careerValue != null ? "career_baseline" : "unavailable"
    }
  ];
}

async function resolveLegacySnapshotDate(args: {
  requestedDate: string;
  windowCode: string;
  entityId?: number | null;
}) {
  let query = supabase
    .from("sustainability_scores")
    .select("snapshot_date")
    .eq("window_code", args.windowCode)
    .lte("snapshot_date", args.requestedDate)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (args.entityId != null) {
    query = query.eq("player_id", args.entityId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to resolve skater snapshot date: ${error.message}`);
  }

  if (data?.[0]?.snapshot_date) {
    return String(data[0].snapshot_date);
  }

  const latest = await supabase
    .from("sustainability_scores")
    .select("snapshot_date")
    .eq("window_code", args.windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (latest.error) {
    throw new Error(
      `Failed to resolve latest skater snapshot date: ${latest.error.message}`
    );
  }

  return latest.data?.[0]?.snapshot_date
    ? String(latest.data[0].snapshot_date)
    : null;
}

async function resolveUnifiedSnapshotDate(args: {
  entityType: "team" | "goalie";
  requestedDate: string;
  windowCode: string;
  entityId?: number | null;
}) {
  let query = supabase
    .from("entity_sustainability_scores_daily" as any)
    .select("snapshot_date")
    .eq("entity_type", args.entityType)
    .eq("window_code", args.windowCode)
    .lte("snapshot_date", args.requestedDate)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (args.entityId != null) {
    query = query.eq("entity_id", args.entityId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to resolve ${args.entityType} snapshot date: ${error.message}`
    );
  }

  const snapshotRows = (data ?? []) as unknown as SnapshotDateRow[];

  if (snapshotRows[0]?.snapshot_date) {
    return String(snapshotRows[0].snapshot_date);
  }

  const latest = await supabase
    .from("entity_sustainability_scores_daily" as any)
    .select("snapshot_date")
    .eq("entity_type", args.entityType)
    .eq("window_code", args.windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (latest.error) {
    throw new Error(
      `Failed to resolve latest ${args.entityType} snapshot date: ${latest.error.message}`
    );
  }

  const latestSnapshotRows = (latest.data ?? []) as unknown as SnapshotDateRow[];

  return latestSnapshotRows[0]?.snapshot_date
    ? String(latestSnapshotRows[0].snapshot_date)
    : null;
}

function buildUnifiedExpectationState(
  value: string | null | undefined
): SandboxExpectationState {
  if (value === "overperforming" || value === "underperforming") {
    return value;
  }
  return "stable";
}

function normalizeLegacyScoreRow(args: {
  row: LegacyScoreRow;
  player: PlayerRow | undefined;
  baseline: PlayerBaselineRow | undefined;
}): SandboxScoreRow {
  const playerName =
    args.baseline?.player_name ??
    (args.player as unknown as { fullName?: string | null })?.fullName ??
    `Player ${args.row.player_id}`;

  return {
    entityType: "skater",
    entityId: Number(args.row.player_id),
    entityName: playerName,
    entitySubtitle: buildPlayerSubtitle(args.player ?? {}),
    teamId:
      args.player?.team_id != null ? Number(args.player.team_id) : null,
    playerId: Number(args.row.player_id),
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    metricScope: "overall",
    windowCode: args.row.window_code,
    baselineValue: null,
    recentValue: null,
    expectedValue: null,
    zScore: null,
    rawScore: Number(args.row.s_raw),
    score: Number(args.row.s_100),
    expectationState: deriveLegacyExpectationState(Number(args.row.s_raw)),
    components: parseJsonObject(args.row.components),
    provenance: {},
    computedAt: args.row.computed_at
  };
}

function normalizeUnifiedScoreRow(args: {
  row: UnifiedScoreRow;
  player: PlayerRow | undefined;
}): SandboxScoreRow {
  const teamMeta = resolveTeamMetaById(args.row.team_id);
  const playerName =
    (args.player as unknown as { fullName?: string | null })?.fullName ?? null;
  const entityName =
    args.row.entity_type === "team"
      ? teamMeta?.name ?? `Team ${args.row.entity_id}`
      : playerName ?? `Player ${args.row.entity_id}`;
  const entitySubtitle =
    args.row.entity_type === "team"
      ? teamMeta?.abbrev ?? null
      : buildPlayerSubtitle(args.player ?? {});

  return {
    entityType: args.row.entity_type as SandboxEntityType,
    entityId: Number(args.row.entity_id),
    entityName,
    entitySubtitle,
    teamId: args.row.team_id != null ? Number(args.row.team_id) : null,
    playerId: args.row.player_id != null ? Number(args.row.player_id) : null,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    metricScope: args.row.metric_scope,
    windowCode: args.row.window_code,
    baselineValue:
      typeof args.row.baseline_value === "number" ? args.row.baseline_value : null,
    recentValue:
      typeof args.row.recent_value === "number" ? args.row.recent_value : null,
    expectedValue:
      typeof args.row.expected_value === "number" ? args.row.expected_value : null,
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    rawScore: Number(args.row.s_raw),
    score: Number(args.row.s_100),
    expectationState: buildUnifiedExpectationState(args.row.expectation_state),
    components: parseJsonObject(args.row.components),
    provenance: parseJsonObject(args.row.provenance),
    computedAt: args.row.computed_at
  };
}

function normalizeLegacyBandRow(args: {
  row: LegacyBandRow;
  player: PlayerRow | undefined;
  baseline: PlayerBaselineRow | undefined;
  gameContext:
    | {
        gameId: number | null;
        teamAbbreviation: string | null;
        opponentAbbreviation: string | null;
        homeRoad: string | null;
        points: number | null;
        shots: number | null;
        hits: number | null;
        blockedShots: number | null;
        ppPoints: number | null;
      }
    | undefined;
  historyComparisons: BandHistoryComparisonSummary | undefined;
}): SandboxBandRow {
  const playerName =
    args.baseline?.player_name ??
    (args.player as unknown as { fullName?: string | null })?.fullName ??
    `Player ${args.row.player_id}`;

  return {
    entityType: "skater",
    entityId: Number(args.row.player_id),
    entityName: playerName,
    metricKey: args.row.metric_key,
    metricLabel: getSandboxMetricLabel("skater", args.row.metric_key),
    windowCode: args.row.window_code,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    baseline:
      typeof args.row.baseline === "number" ? args.row.baseline : null,
    ewma: typeof args.row.ewma === "number" ? args.row.ewma : null,
    value: Number(args.row.value),
    ciLower: Number(args.row.ci_lower),
    ciUpper: Number(args.row.ci_upper),
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    percentile:
      typeof args.row.percentile === "number" ? args.row.percentile : null,
    exposure: typeof args.row.exposure === "number" ? args.row.exposure : null,
    distribution: parseJsonObject(args.row.distribution),
    provenance: {},
    gameContext: args.gameContext ?? null,
    comparisons: buildBandComparisons({
      entityType: "skater",
      metricKey: args.row.metric_key,
      currentValue: Number(args.row.value),
      historyComparisons: args.historyComparisons,
      baseline: args.baseline
    })
  };
}

function normalizeUnifiedBandRow(args: {
  row: UnifiedBandRow;
  player: PlayerRow | undefined;
  historyComparisons: BandHistoryComparisonSummary | undefined;
}): SandboxBandRow {
  const teamMeta = resolveTeamMetaById(args.row.team_id);
  const playerName =
    (args.player as unknown as { fullName?: string | null })?.fullName ?? null;
  const entityName =
    args.row.entity_type === "team"
      ? teamMeta?.name ?? `Team ${args.row.entity_id}`
      : playerName ?? `Player ${args.row.entity_id}`;

  return {
    entityType: args.row.entity_type as SandboxEntityType,
    entityId: Number(args.row.entity_id),
    entityName,
    metricKey: args.row.metric_key,
    metricLabel: getSandboxMetricLabel(
      args.row.entity_type as SandboxEntityType,
      args.row.metric_key
    ),
    windowCode: args.row.window_code,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    baseline: typeof args.row.baseline === "number" ? args.row.baseline : null,
    ewma: typeof args.row.ewma === "number" ? args.row.ewma : null,
    value: Number(args.row.value),
    ciLower: Number(args.row.ci_lower),
    ciUpper: Number(args.row.ci_upper),
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    percentile:
      typeof args.row.percentile === "number" ? args.row.percentile : null,
    exposure: typeof args.row.exposure === "number" ? args.row.exposure : null,
    distribution: parseJsonObject(args.row.distribution),
    provenance: parseJsonObject(args.row.provenance),
    gameContext: null,
    comparisons: buildBandComparisons({
      entityType: args.row.entity_type as SandboxEntityType,
      metricKey: args.row.metric_key,
      currentValue: Number(args.row.value),
      historyComparisons: args.historyComparisons,
      baseline: undefined
    })
  };
}

export async function searchSandboxEntities(args: {
  entityType: SandboxEntityType;
  query?: string;
  limit?: number;
}): Promise<SandboxEntityOption[]> {
  const limit = args.limit ?? 12;

  if (args.entityType === "team") {
    const query = (args.query ?? "").trim().toLowerCase();
    return Object.values(teamsInfo)
      .filter((team) => {
        if (!query) return true;
        return (
          team.name.toLowerCase().includes(query) ||
          team.shortName.toLowerCase().includes(query) ||
          team.abbrev.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((team) => ({
        id: team.id,
        name: team.name,
        subtitle: team.abbrev,
        imageUrl: `/teamLogos/${team.abbrev}.png`
      }));
  }

  const query = (args.query ?? "").trim();
  if (query.length < 2) {
    return [];
  }

  let playerQuery = supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .ilike("fullName", `%${query}%`)
    .order("fullName", { ascending: true })
    .limit(limit);

  if (args.entityType === "goalie") {
    playerQuery = playerQuery.eq("position", "G");
  } else {
    playerQuery = playerQuery.neq("position", "G");
  }

  const { data, error } = await playerQuery;
  if (error) {
    throw new Error(`Failed to search ${args.entityType}s: ${error.message}`);
  }

  return ((data ?? []) as PlayerRow[]).map((player) => ({
    id: Number(player.id),
    name: (player as unknown as { fullName?: string | null }).fullName ?? "Unknown",
    subtitle: buildPlayerSubtitle(player),
    imageUrl: player.image_url ?? null
  }));
}

export async function fetchSandboxScores(args: {
  entityType: SandboxEntityType;
  entityId?: number | null;
  requestedDate?: string;
  windowCode?: string;
  limit?: number;
}): Promise<SandboxScoresPayload> {
  const requestedDate = args.requestedDate ?? todayIso();
  const windowCode = args.windowCode ?? "l5";
  const limit = args.limit ?? DEFAULT_LIMIT;

  if (args.entityType === "skater") {
    const snapshotDate = await resolveLegacySnapshotDate({
      requestedDate,
      windowCode,
      entityId: args.entityId
    });

    if (!snapshotDate) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate: null,
        windowCode,
        totalRows: 0,
        rows: [],
        selectedRow: null
      };
    }

    const { data, error, count } = await supabase
      .from("sustainability_scores")
      .select("*", { count: "exact" })
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode)
      .order("s_100", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load skater sustainability rows: ${error.message}`);
    }

    const legacyRows = (data ?? []) as LegacyScoreRow[];
    const playerIds = legacyRows.map((row) => Number(row.player_id));
    const [playersById, baselinesById] = await Promise.all([
      fetchPlayersByIds(playerIds),
      fetchPlayerBaselinesForSnapshot(snapshotDate)
    ]);

    const rows = legacyRows.map((row) =>
      normalizeLegacyScoreRow({
        row,
        player: playersById.get(Number(row.player_id)),
        baseline: baselinesById.get(Number(row.player_id))
      })
    );

    let selectedRow =
      args.entityId != null
        ? rows.find((row) => row.entityId === args.entityId) ?? null
        : null;

    if (args.entityId != null && !selectedRow) {
      const selectedResult = await supabase
        .from("sustainability_scores")
        .select("*")
        .eq("snapshot_date", snapshotDate)
        .eq("window_code", windowCode)
        .eq("player_id", args.entityId)
        .limit(1)
        .single();

      if (selectedResult.error && selectedResult.error.code !== "PGRST116") {
        throw new Error(
          `Failed to load selected skater sustainability row: ${selectedResult.error.message}`
        );
      }

      if (selectedResult.data) {
        const selectedPlayerMap = await fetchPlayersByIds([args.entityId]);
        selectedRow = normalizeLegacyScoreRow({
          row: selectedResult.data as LegacyScoreRow,
          player: selectedPlayerMap.get(args.entityId),
          baseline: baselinesById.get(args.entityId)
        });
      }
    }

    return {
      entityType: "skater",
      requestedDate,
      snapshotDate,
      windowCode,
      totalRows: Number(count ?? rows.length),
      selectedRow,
      rows
    };
  }

  const snapshotDate = await resolveUnifiedSnapshotDate({
    entityType: args.entityType,
    requestedDate,
    windowCode,
    entityId: args.entityId
  });

  if (!snapshotDate) {
    return {
      entityType: args.entityType,
      requestedDate,
      snapshotDate: null,
      windowCode,
      totalRows: 0,
      rows: [],
      selectedRow: null
    };
  }

  const query = supabase
    .from("entity_sustainability_scores_daily" as any)
    .select("*", { count: "exact" })
    .eq("entity_type", args.entityType)
    .eq("snapshot_date", snapshotDate)
    .eq("window_code", windowCode)
    .order("s_100", { ascending: false })
    .limit(limit);

  const { data, error, count } = await query;
  if (error) {
    throw new Error(
      `Failed to load ${args.entityType} sustainability rows: ${error.message}`
    );
  }

  const unifiedRows = (data ?? []) as unknown as UnifiedScoreRow[];
  const playerIds = unifiedRows
    .map((row) => (row.player_id != null ? Number(row.player_id) : null))
    .filter((value): value is number => value != null);
  const playersById = await fetchPlayersByIds(playerIds);
  const rows = unifiedRows.map((row) =>
    normalizeUnifiedScoreRow({
      row,
      player:
        row.player_id != null ? playersById.get(Number(row.player_id)) : undefined
      })
  );

  let selectedRow =
    args.entityId != null
      ? rows.find((row) => row.entityId === args.entityId) ?? null
      : null;

  if (args.entityId != null && !selectedRow) {
    const selectedResult = await supabase
      .from("entity_sustainability_scores_daily" as any)
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode)
      .eq("entity_id", args.entityId)
      .limit(1)
      .single();

    if (selectedResult.error && selectedResult.error.code !== "PGRST116") {
      throw new Error(
        `Failed to load selected ${args.entityType} sustainability row: ${selectedResult.error.message}`
      );
    }

    if (selectedResult.data) {
      const selectedData = selectedResult.data as unknown as UnifiedScoreRow;
      const selectedPlayerId =
        selectedData.player_id != null
          ? Number(selectedData.player_id)
          : null;
      const selectedPlayers = await fetchPlayersByIds(
        selectedPlayerId != null ? [selectedPlayerId] : []
      );
      selectedRow = normalizeUnifiedScoreRow({
        row: selectedData,
        player:
          selectedPlayerId != null
            ? selectedPlayers.get(selectedPlayerId)
            : undefined
      });
    }
  }

  return {
    entityType: args.entityType,
    requestedDate,
    snapshotDate,
    windowCode,
    totalRows: Number(count ?? rows.length),
    selectedRow,
    rows
  };
}

export async function fetchSandboxBands(args: {
  entityType: SandboxEntityType;
  entityId: number;
  requestedDate?: string;
  windowCode?: string;
  metricKey?: string;
  limit?: number;
}): Promise<SandboxBandsPayload> {
  const requestedDate = args.requestedDate ?? todayIso();
  const windowCode = args.windowCode ?? "l5";
  const metricKey =
    args.metricKey ?? SANDBOX_ENTITY_CONFIG[args.entityType].metrics[0]?.key;
  const limit = args.limit ?? 160;

  if (args.entityType === "skater") {
    const snapshotDate = await resolveLegacySnapshotDate({
      requestedDate,
      windowCode,
      entityId: args.entityId
    });

    if (!snapshotDate) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate: null,
        windowCode,
        currentRows: [],
        historyRows: []
      };
    }

    const seasonId =
      resolveSeasonIdFromDate(snapshotDate) ?? resolveSeasonIdFromDate(requestedDate);
    if (seasonId == null) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate,
        windowCode,
        currentRows: [],
        historyRows: []
      };
    }

    const [currentResult, historyResult, comparisonHistoryResult, playersById, baselinesById, gameContextByDate] =
      await Promise.all([
        supabase
          .from("sustainability_trend_bands")
          .select("*")
          .eq("player_id", args.entityId)
          .eq("snapshot_date", snapshotDate)
          .eq("window_code", windowCode),
        supabase
          .from("sustainability_trend_bands")
          .select("*")
          .eq("player_id", args.entityId)
          .eq("metric_key", metricKey)
          .eq("window_code", windowCode)
          .eq("season_id", seasonId)
          .order("snapshot_date", { ascending: true })
          .limit(limit),
        supabase
          .from("sustainability_trend_bands")
          .select("*")
          .eq("player_id", args.entityId)
          .eq("window_code", windowCode)
          .eq("season_id", seasonId)
          .lte("snapshot_date", snapshotDate)
          .order("snapshot_date", { ascending: true })
          .limit(5000),
        fetchPlayersByIds([args.entityId]),
        fetchPlayerBaselinesForSnapshot(snapshotDate),
        fetchSkaterGameContextByDate(args.entityId, seasonId)
      ]);

    if (currentResult.error) {
      throw new Error(
        `Failed to load skater band snapshot: ${currentResult.error.message}`
      );
    }
    if (historyResult.error) {
      throw new Error(
        `Failed to load skater band history: ${historyResult.error.message}`
      );
    }
    if (comparisonHistoryResult.error) {
      throw new Error(
        `Failed to load skater band comparison history: ${comparisonHistoryResult.error.message}`
      );
    }

    const player = playersById.get(args.entityId);
    const baseline = baselinesById.get(args.entityId);
    const comparisonLookup = buildBandHistoryComparisonLookup(
      (comparisonHistoryResult.data ?? []) as LegacyBandRow[]
    );

    return {
      entityType: "skater",
      requestedDate,
      snapshotDate,
      windowCode,
      currentRows: ((currentResult.data ?? []) as LegacyBandRow[]).map((row) =>
        normalizeLegacyBandRow({
          row,
          player,
          baseline,
          gameContext: gameContextByDate.get(row.snapshot_date),
          historyComparisons: comparisonLookup.get(row.metric_key)
        })
      ),
      historyRows: ((historyResult.data ?? []) as LegacyBandRow[]).map((row) =>
        normalizeLegacyBandRow({
          row,
          player,
          baseline,
          gameContext: gameContextByDate.get(row.snapshot_date),
          historyComparisons: comparisonLookup.get(row.metric_key)
        })
      )
    };
  }

  const snapshotDate = await resolveUnifiedSnapshotDate({
    entityType: args.entityType,
    requestedDate,
    windowCode,
    entityId: args.entityId
  });

  if (!snapshotDate) {
    return {
      entityType: args.entityType,
      requestedDate,
      snapshotDate: null,
      windowCode,
      currentRows: [],
      historyRows: []
    };
  }

  const [currentResult, historyResult, comparisonHistoryResult] = await Promise.all([
    supabase
      .from("entity_sustainability_bands_daily" as any)
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("entity_id", args.entityId)
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode),
    supabase
      .from("entity_sustainability_bands_daily" as any)
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("entity_id", args.entityId)
      .eq("metric_key", metricKey)
      .eq("window_code", windowCode)
      .order("snapshot_date", { ascending: true })
      .limit(limit),
    supabase
      .from("entity_sustainability_bands_daily" as any)
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("entity_id", args.entityId)
      .eq("window_code", windowCode)
      .lte("snapshot_date", snapshotDate)
      .order("snapshot_date", { ascending: true })
      .limit(5000)
  ]);

  if (currentResult.error) {
    throw new Error(
      `Failed to load ${args.entityType} band snapshot: ${currentResult.error.message}`
    );
  }
  if (historyResult.error) {
    throw new Error(
      `Failed to load ${args.entityType} band history: ${historyResult.error.message}`
    );
  }
  if (comparisonHistoryResult.error) {
    throw new Error(
      `Failed to load ${args.entityType} band comparison history: ${comparisonHistoryResult.error.message}`
    );
  }

  const playerIds = [
    ...((currentResult.data ?? []) as unknown as UnifiedBandRow[]).map((row) =>
      row.player_id != null ? Number(row.player_id) : null
    ),
    ...((historyResult.data ?? []) as unknown as UnifiedBandRow[]).map((row) =>
      row.player_id != null ? Number(row.player_id) : null
    )
  ].filter((value): value is number => value != null);

  const playersById = await fetchPlayersByIds(playerIds);
  const comparisonLookup = buildBandHistoryComparisonLookup(
    (comparisonHistoryResult.data ?? []) as unknown as UnifiedBandRow[]
  );

  return {
    entityType: args.entityType,
    requestedDate,
    snapshotDate,
    windowCode,
      currentRows: ((currentResult.data ?? []) as unknown as UnifiedBandRow[]).map((row) =>
      normalizeUnifiedBandRow({
        row,
        player:
          row.player_id != null ? playersById.get(Number(row.player_id)) : undefined,
        historyComparisons: comparisonLookup.get(row.metric_key)
      })
    ),
    historyRows: ((historyResult.data ?? []) as unknown as UnifiedBandRow[]).map((row) =>
      normalizeUnifiedBandRow({
        row,
        player:
          row.player_id != null ? playersById.get(Number(row.player_id)) : undefined,
        historyComparisons: comparisonLookup.get(row.metric_key)
      })
    )
  };
}

export async function fetchSandboxScoreHistory(args: {
  entityType: SandboxEntityType;
  entityId: number;
  requestedDate?: string;
  windowCode?: string;
  limit?: number;
}): Promise<SandboxScoreHistoryPayload> {
  const requestedDate = args.requestedDate ?? todayIso();
  const windowCode = args.windowCode ?? "l5";
  const limit = args.limit ?? 180;

  if (args.entityType === "skater") {
    const snapshotDate = await resolveLegacySnapshotDate({
      requestedDate,
      windowCode,
      entityId: args.entityId
    });

    if (!snapshotDate) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate: null,
        windowCode,
        rows: []
      };
    }

    const { data, error } = await supabase
      .from("sustainability_scores")
      .select("*")
      .eq("player_id", args.entityId)
      .eq("window_code", windowCode)
      .lte("snapshot_date", snapshotDate)
      .order("snapshot_date", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(
        `Failed to load skater sustainability score history: ${error.message}`
      );
    }

    const [playersById, baselinesById] = await Promise.all([
      fetchPlayersByIds([args.entityId]),
      fetchPlayerBaselinesForSnapshot(snapshotDate)
    ]);

    const player = playersById.get(args.entityId);
    const baseline = baselinesById.get(args.entityId);

    return {
      entityType: "skater",
      requestedDate,
      snapshotDate,
      windowCode,
      rows: ((data ?? []) as LegacyScoreRow[]).map((row) => {
        const normalized = normalizeLegacyScoreRow({ row, player, baseline });
        return {
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          entityName: normalized.entityName,
          entitySubtitle: normalized.entitySubtitle,
          snapshotDate: normalized.snapshotDate,
          windowCode: normalized.windowCode,
          score: normalized.score,
          rawScore: normalized.rawScore,
          expectationState: normalized.expectationState,
          baselineValue: normalized.baselineValue,
          recentValue: normalized.recentValue,
          expectedValue: normalized.expectedValue
        };
      })
    };
  }

  const snapshotDate = await resolveUnifiedSnapshotDate({
    entityType: args.entityType,
    requestedDate,
    windowCode,
    entityId: args.entityId
  });

  if (!snapshotDate) {
    return {
      entityType: args.entityType,
      requestedDate,
      snapshotDate: null,
      windowCode,
      rows: []
    };
  }

  const { data, error } = await supabase
    .from("entity_sustainability_scores_daily" as any)
    .select("*")
    .eq("entity_type", args.entityType)
    .eq("entity_id", args.entityId)
    .eq("window_code", windowCode)
    .lte("snapshot_date", snapshotDate)
    .order("snapshot_date", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load ${args.entityType} sustainability score history: ${error.message}`
    );
  }

  const playerIds = ((data ?? []) as unknown as UnifiedScoreRow[])
    .map((row) => (row.player_id != null ? Number(row.player_id) : null))
    .filter((value): value is number => value != null);
  const playersById = await fetchPlayersByIds(playerIds);

  return {
    entityType: args.entityType,
    requestedDate,
    snapshotDate,
    windowCode,
    rows: ((data ?? []) as unknown as UnifiedScoreRow[]).map((row) => {
      const normalized = normalizeUnifiedScoreRow({
        row,
        player:
          row.player_id != null ? playersById.get(Number(row.player_id)) : undefined
      });
      return {
        entityType: normalized.entityType,
        entityId: normalized.entityId,
        entityName: normalized.entityName,
        entitySubtitle: normalized.entitySubtitle,
        snapshotDate: normalized.snapshotDate,
        windowCode: normalized.windowCode,
        score: normalized.score,
        rawScore: normalized.rawScore,
        expectationState: normalized.expectationState,
        baselineValue: normalized.baselineValue,
        recentValue: normalized.recentValue,
        expectedValue: normalized.expectedValue
      };
    })
  };
}

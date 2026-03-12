import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { canonicalOrLegacyFinite } from "lib/rollingPlayerMetricCompatibility";
import type { RollingPlayerValidationPayload } from "lib/supabase/Upserts/rollingPlayerValidationPayload";
import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";
import {
  buildSustainabilityScore,
  derivePerformanceFlags,
  extractFeatureImportance,
  generateExplanationBullets,
  generateExplanationText,
  predictSustainabilityProbabilities,
  projectCountMetric,
  projectFaceoffWinPct,
  trainSustainabilityProbabilityModel,
  type ExplanationOptions,
  type ProjectableCountMetric
} from "lib/sustainability/model";
import styles from "./trendsDebug.module.scss";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type RollingMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"];

type PlayerSearchResult = {
  id: number;
  fullName: string;
  position: string | null;
};

type PlayerDebugSnapshot = {
  playerId: number;
  fullName: string;
  position: string | null;
  gameDate: string;
  metrics: Partial<RollingMetricRow>;
  faceoffWinPct: number | null;
  faceoffAttemptsPerGame: number | null;
};

type ValidationResponse = {
  success: boolean;
  payload?: RollingPlayerValidationPayload;
  error?: string;
};

type NumericInputProps = {
  id: string;
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

type StrengthState = "all" | "ev" | "pp" | "pk";

type MetricFamilyId =
  | "all"
  | "availability"
  | "toi"
  | "surface_counts"
  | "weighted_rates"
  | "finishing"
  | "on_ice_context"
  | "territorial"
  | "pp_usage"
  | "pp_role"
  | "line_context"
  | "historical"
  | "support"
  | "other";

type RowLike = Record<string, unknown>;

type RowOption = {
  key: string;
  gameDate: string;
  gameId: number | null;
  label: string;
  mismatch: boolean;
  stale: boolean;
};

const DEFAULT_SEASON = 20252026;

const STRENGTH_OPTIONS: Array<{ value: StrengthState; label: string }> = [
  { value: "all", label: "All" },
  { value: "ev", label: "EV" },
  { value: "pp", label: "PP" },
  { value: "pk", label: "PK" }
];

const METRIC_FAMILY_OPTIONS: Array<{ value: MetricFamilyId; label: string }> = [
  { value: "all", label: "All Metric Families" },
  { value: "availability", label: "Availability / Participation" },
  { value: "toi", label: "TOI" },
  { value: "surface_counts", label: "Surface Counting Stats" },
  { value: "weighted_rates", label: "/60 Rates" },
  { value: "finishing", label: "Finishing / Shooting" },
  { value: "on_ice_context", label: "On-Ice Context" },
  { value: "territorial", label: "Territorial / Possession" },
  { value: "pp_usage", label: "Power-Play Usage" },
  { value: "pp_role", label: "PP Role / Unit Context" },
  { value: "line_context", label: "Line / Role Context" },
  { value: "historical", label: "Historical Baselines" },
  { value: "support", label: "Support Fields" },
  { value: "other", label: "Other Fields" }
];

const MODEL_FEATURE_KEYS = [
  "shots_per_60",
  "ixg_per_60",
  "pp_toi_pct",
  "usage_delta",
  "pdo"
] as const;

const PROJECTION_METRICS: ProjectableCountMetric[] = [
  "goals",
  "assists",
  "shots",
  "points",
  "pp_points",
  "hits",
  "blocks"
];

const DEMO_MODEL = trainSustainabilityProbabilityModel(
  [
    { features: [-1.8, -1.5, -1.2, -0.7, -0.6], label: "cold" },
    { features: [-1.2, -1.1, -0.9, -0.5, -0.3], label: "cold" },
    { features: [-0.3, -0.2, 0.1, -0.1, 0.1], label: "normal" },
    { features: [0.1, 0.2, -0.1, 0.05, -0.1], label: "normal" },
    { features: [1.1, 1.3, 0.8, 0.4, 0.6], label: "hot" },
    { features: [1.6, 1.8, 1.2, 0.7, 0.9], label: "hot" }
  ],
  {
    iterations: 900,
    learningRate: 0.12,
    calibrationIterations: 350
  }
);

const IDENTITY_FIELDS = new Set([
  "player_id",
  "game_id",
  "game_date",
  "season",
  "team_id",
  "strength_state",
  "updated_at"
]);

const METRIC_FORMULAS: Record<string, string> = {
  pp_share_pct:
    "sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)",
  on_ice_sh_pct: "sum(on_ice_goals_for) / sum(on_ice_shots_for) * 100",
  on_ice_sv_pct:
    "sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against) * 100",
  pdo:
    "((sum(gf) / sum(sf)) * 100 + (sum(sa - ga) / sum(sa)) * 100) * 0.01",
  ipp: "sum(player_points) / sum(on_ice_goals_for) * 100",
  primary_points_pct: "sum(goals + first_assists) / sum(points)",
  expected_sh_pct: "sum(ixg) / sum(shots)",
  shooting_pct: "sum(goals) / sum(shots) * 100",
  oz_start_pct: "sum(oz_starts) / sum(oz_starts + dz_starts) * 100",
  cf_pct: "sum(cf) / sum(cf + ca) * 100",
  ff_pct: "sum(ff) / sum(ff + fa) * 100",
  sog_per_60: "sum(shots) / sum(toi_seconds) * 3600",
  ixg_per_60: "sum(ixg) / sum(toi_seconds) * 3600",
  goals_per_60: "sum(goals) / sum(toi_seconds) * 3600",
  assists_per_60: "sum(assists) / sum(toi_seconds) * 3600",
  primary_assists_per_60: "sum(primary_assists) / sum(toi_seconds) * 3600",
  secondary_assists_per_60: "sum(secondary_assists) / sum(toi_seconds) * 3600",
  hits_per_60: "sum(hits) / sum(toi_seconds) * 3600",
  blocks_per_60: "sum(blocks) / sum(toi_seconds) * 3600",
  availability_pct: "games_played / team_games_available",
  participation_pct: "participation_games / team_games_available"
};

const AVAILABILITY_FIELDS = [
  "games_played",
  "team_games_played",
  "season_games_played",
  "season_team_games_available",
  "season_availability_pct",
  "season_participation_games",
  "season_participation_pct",
  "games_played_last3_team_games",
  "games_played_last5_team_games",
  "games_played_last10_team_games",
  "games_played_last20_team_games",
  "team_games_available_last3",
  "team_games_available_last5",
  "team_games_available_last10",
  "team_games_available_last20",
  "availability_pct_last3_team_games",
  "availability_pct_last5_team_games",
  "availability_pct_last10_team_games",
  "availability_pct_last20_team_games"
] as const;

const REFRESH_PREREQUISITES: Record<string, string[]> = {
  availability: [
    "Refresh `games` if the team-game ledger is stale.",
    "Refresh `wgo_skater_stats` for the selected validation slice.",
    "Recompute `rolling_player_game_metrics` before trusting the denominator fields."
  ],
  toi: [
    "Refresh the relevant NST counts, NST rates, and NST on-ice tables for the selected strength.",
    "Confirm TOI trust warnings are clear in the freshness banner.",
    "Recompute `rolling_player_game_metrics` before validating `/60` or TOI-backed outputs."
  ],
  surface_counts: [
    "Refresh the relevant NST counts table for the selected strength.",
    "Verify WGO fallback rows are present only where NST counts are absent.",
    "Recompute `rolling_player_game_metrics` before comparing stored values."
  ],
  weighted_rates: [
    "Refresh the relevant NST counts, NST rates, and NST on-ice tables for the selected strength.",
    "Inspect the TOI trust panel for fallback or suspicious-source usage.",
    "Recompute `rolling_player_game_metrics` before comparing weighted-rate outputs."
  ],
  finishing: [
    "Refresh the relevant NST counts table for the selected strength.",
    "Refresh NST on-ice rows if the selected metric uses on-ice denominators.",
    "Recompute `rolling_player_game_metrics` before validating ratio outputs."
  ],
  on_ice_context: [
    "Refresh the relevant NST on-ice counts table for the selected strength.",
    "Verify counts-on-ice tail lag is zero in the freshness banner.",
    "Recompute `rolling_player_game_metrics` before comparing stored values."
  ],
  territorial: [
    "Refresh the relevant NST on-ice counts table for the selected strength.",
    "Verify counts-on-ice tail lag is zero in the freshness banner.",
    "Recompute `rolling_player_game_metrics` before validating territorial metrics."
  ],
  pp_usage: [
    "Refresh `powerPlayCombinations` for the selected validation games.",
    "Verify PP tail lag is zero and inspect PP builder coverage cautions.",
    "Recompute `rolling_player_game_metrics` before validating PP-share metrics."
  ],
  pp_role: [
    "Refresh `powerPlayCombinations` for the selected validation games.",
    "Verify PP tail lag is zero before trusting PP unit context.",
    "Recompute `rolling_player_game_metrics` if the stored PP contextual fields are stale."
  ],
  line_context: [
    "Refresh `lineCombinations` for the selected validation games.",
    "Verify line tail lag is zero before trusting line assignment labels.",
    "Recompute `rolling_player_game_metrics` if stored line fields are stale."
  ],
  historical: [
    "Refresh source rows for the full history slice required by the selected metric.",
    "Confirm the target rolling rows were recomputed after the latest source refresh.",
    "Treat stale target rows as blockers, not correctness evidence."
  ],
  support: [
    "Refresh the upstream sources tied to the selected metric family.",
    "Recompute `rolling_player_game_metrics` so support fields match the stored metric row.",
    "Use the diagnostics panel to confirm component completeness before copying findings."
  ],
  other: [
    "Refresh the upstream sources relevant to the selected field.",
    "Recompute `rolling_player_game_metrics` if the focused row may be stale.",
    "Use the freshness banner before treating the row as validation-ready."
  ]
};

function NumericInput({
  id,
  label,
  value,
  step = 0.01,
  min,
  max,
  onChange
}: NumericInputProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function normalizePercentLike(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function normalizePdo(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  if (value > 10) return value / 1000;
  return value;
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePercentChange(recent: number, baseline: number): number {
  if (!Number.isFinite(baseline) || Math.abs(baseline) < 1e-9) return 0;
  return (recent - baseline) / Math.abs(baseline);
}

function toPer60(countPerGame: number, toiSeconds: number): number {
  if (!Number.isFinite(toiSeconds) || toiSeconds <= 0) return 0;
  return (countPerGame * 3600) / toiSeconds;
}

function isLegacyField(field: string): boolean {
  return (
    field.includes("_avg_") ||
    field.includes("_total_") ||
    field.startsWith("gp_pct_")
  );
}

function isContextField(field: string): boolean {
  return (
    field === "pp_unit" ||
    field === "pp_share_of_team" ||
    field === "pp_unit_usage_index" ||
    field === "pp_unit_relative_toi" ||
    field === "pp_vs_unit_avg" ||
    field === "line_combo_slot" ||
    field === "line_combo_group" ||
    field === "gp_semantic_type"
  );
}

function inferMetricFamily(field: string): MetricFamilyId {
  if (IDENTITY_FIELDS.has(field)) return "other";
  if (field.includes("availability") || field.includes("participation")) {
    return "availability";
  }
  if (
    field === "games_played" ||
    field === "team_games_played" ||
    field.startsWith("games_played_last") ||
    field.startsWith("team_games_available_last") ||
    field.startsWith("season_games_played") ||
    field.startsWith("season_team_games_available") ||
    field.startsWith("three_year_games_played") ||
    field.startsWith("three_year_team_games_available") ||
    field.startsWith("career_games_played") ||
    field.startsWith("career_team_games_available") ||
    field.startsWith("gp_pct_") ||
    field === "gp_semantic_type"
  ) {
    return "availability";
  }
  if (field.startsWith("toi_seconds")) return "toi";
  if (field.includes("_per_60")) return "weighted_rates";
  if (
    field.startsWith("shooting_pct") ||
    field.startsWith("expected_sh_pct") ||
    field.startsWith("primary_points_pct")
  ) {
    return "finishing";
  }
  if (
    field.startsWith("on_ice_sh_pct") ||
    field.startsWith("on_ice_sv_pct") ||
    field.startsWith("pdo") ||
    field.startsWith("oi_") ||
    field.startsWith("ipp")
  ) {
    return "on_ice_context";
  }
  if (
    field === "cf" ||
    field === "ca" ||
    field === "cf_pct" ||
    field === "ff" ||
    field === "fa" ||
    field === "ff_pct" ||
    field.startsWith("cf_") ||
    field.startsWith("ff_") ||
    field.startsWith("oz_") ||
    field.startsWith("dz_") ||
    field.startsWith("nz_")
  ) {
    return "territorial";
  }
  if (field.startsWith("pp_share_pct")) return "pp_usage";
  if (
    field.startsWith("pp_unit") ||
    field === "pp_share_of_team" ||
    field === "pp_vs_unit_avg"
  ) {
    return "pp_role";
  }
  if (field.startsWith("line_combo")) return "line_context";
  if (
    field.endsWith("_season") ||
    field.endsWith("_3ya") ||
    field.endsWith("_career")
  ) {
    return "historical";
  }
  if (
    field.startsWith("goals") ||
    field.startsWith("assists") ||
    field.startsWith("shots") ||
    field.startsWith("hits") ||
    field.startsWith("blocks") ||
    field.startsWith("points") ||
    field.startsWith("pp_points") ||
    field.startsWith("ixg") ||
    field.startsWith("iscf") ||
    field.startsWith("ihdcf")
  ) {
    return "surface_counts";
  }
  if (field.split("_").length >= 4) return "support";
  return "other";
}

function getRowGameDate(row: RowLike | null | undefined): string | null {
  if (!row) return null;
  const gameDate = row.game_date ?? row.gameDate;
  return typeof gameDate === "string" && gameDate.length > 0 ? gameDate : null;
}

function getRowGameId(row: RowLike | null | undefined): number | null {
  if (!row) return null;
  const gameId = row.game_id ?? row.gameId;
  return typeof gameId === "number" && Number.isFinite(gameId) ? gameId : null;
}

function getRowStrength(row: RowLike | null | undefined): StrengthState | null {
  if (!row) return null;
  const strength = row.strength_state ?? row.strength;
  return strength === "all" || strength === "ev" || strength === "pp" || strength === "pk"
    ? strength
    : null;
}

function getRowKey(row: RowLike | null | undefined): string {
  return `${getRowGameDate(row) ?? "unknown"}:${getRowStrength(row) ?? "all"}:${getRowGameId(
    row
  ) ?? "nogame"}`;
}

function getNumericValue(row: RowLike | null | undefined, field: string): number | null {
  if (!row || !(field in row)) return null;
  const value = row[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(6);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringifyCompact(value: unknown): string {
  if (value == null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getMetricBaseKey(metricField: string): string {
  return metricField
    .replace(/_(all|last3|last5|last10|last20|season|3ya|career)$/, "")
    .replace(/_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/, "");
}

function getFormulaForMetric(metricField: string, metricFamily: string | null): string {
  const baseKey = getMetricBaseKey(metricField);
  return (
    METRIC_FORMULAS[metricField] ??
    METRIC_FORMULAS[baseKey] ??
    (metricFamily === "weighted_rates"
      ? "sum(raw_numerator) / sum(toi_seconds) * 3600"
      : metricFamily === "finishing" || metricFamily === "on_ice_context"
        ? "ratio of aggregated numerator and denominator support fields"
        : metricFamily === "availability"
          ? "availability or participation numerator / denominator support fields"
          : metricFamily === "surface_counts"
            ? "sum(raw source values across the selected scope)"
            : "See source and support fields for reconstruction path")
  );
}

function getWindowMembership(
  rows: RowLike[],
  focused: RowLike | null
): Record<3 | 5 | 10 | 20, RowLike[]> {
  const empty = { 3: [], 5: [], 10: [], 20: [] } as Record<3 | 5 | 10 | 20, RowLike[]>;
  if (!focused || rows.length === 0) return empty;
  const focusedKey = getRowKey(focused);
  const focusedIndex = rows.findIndex((row) => getRowKey(row) === focusedKey);
  if (focusedIndex < 0) return empty;
  return {
    3: rows.slice(Math.max(0, focusedIndex - 2), focusedIndex + 1),
    5: rows.slice(Math.max(0, focusedIndex - 4), focusedIndex + 1),
    10: rows.slice(Math.max(0, focusedIndex - 9), focusedIndex + 1),
    20: rows.slice(Math.max(0, focusedIndex - 19), focusedIndex + 1)
  };
}

function collectFieldValues(
  row: RowLike | null,
  fields: readonly string[]
): Array<{ field: string; value: unknown }> {
  return fields
    .filter((field) => row && field in row)
    .map((field) => ({
      field,
      value: row?.[field]
    }));
}

function deriveAuditStatusEmoji(args: {
  readinessStatus: RollingPlayerValidationPayload["readiness"]["status"] | null;
  diff: number | null | undefined;
}): "✅" | "❌" | "🔧" | "⚠️" {
  if (args.readinessStatus === "BLOCKED") return "⚠️";
  if (args.diff == null) {
    return args.readinessStatus === "READY_WITH_CAUTIONS" ? "🔧" : "⚠️";
  }
  if (Math.abs(args.diff) <= 0.000001) {
    return args.readinessStatus === "READY_WITH_CAUTIONS" ? "🔧" : "✅";
  }
  return args.readinessStatus === "READY_WITH_CAUTIONS" ? "🔧" : "❌";
}

async function searchPlayersByName(query: string): Promise<PlayerSearchResult[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position")
    .ilike("fullName", `%${query}%`)
    .order("fullName", { ascending: true })
    .limit(10);

  if (error) throw error;

  return ((data as PlayerRow[] | null) ?? []).map((row) => ({
    id: Number(row.id),
    fullName: row.fullName,
    position: row.position ?? null
  }));
}

async function fetchFaceoffTotals(playerId: number): Promise<{
  faceoffWinPct: number | null;
  faceoffAttemptsPerGame: number | null;
}> {
  const { data, error } = await (supabase as any)
    .from("wgo_skater_stats_totals")
    .select("fow_percentage,total_faceoffs,games_played,season")
    .eq("player_id", playerId)
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const totals = data as
    | {
        fow_percentage?: number | null;
        total_faceoffs?: number | null;
        games_played?: number | null;
      }
    | null;

  const faceoffAttemptsPerGame =
    typeof totals?.total_faceoffs === "number" &&
    typeof totals?.games_played === "number" &&
    totals.games_played > 0
      ? totals.total_faceoffs / totals.games_played
      : null;

  return {
    faceoffWinPct:
      typeof totals?.fow_percentage === "number" ? totals.fow_percentage : null,
    faceoffAttemptsPerGame
  };
}

async function fetchValidationPayload(
  request: Record<string, string | number | boolean | undefined>
): Promise<RollingPlayerValidationPayload> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const response = await fetch(
    `/api/v1/debug/rolling-player-metrics?${params.toString()}`
  );
  const body = (await response.json()) as ValidationResponse;

  if (!response.ok || !body.success || !body.payload) {
    throw new Error(body.error ?? "Failed to load validation payload.");
  }

  return body.payload;
}

export default function TrendsDebugPage() {
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerSuggestions, setPlayerSuggestions] = useState<PlayerSearchResult[]>(
    []
  );
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(
    null
  );
  const [validationPayload, setValidationPayload] =
    useState<RollingPlayerValidationPayload | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [faceoffTotals, setFaceoffTotals] = useState<{
    faceoffWinPct: number | null;
    faceoffAttemptsPerGame: number | null;
  } | null>(null);

  const [selectedSeason, setSelectedSeason] = useState(DEFAULT_SEASON);
  const [selectedStrength, setSelectedStrength] = useState<StrengthState>("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedGameDate, setSelectedGameDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMetricFamily, setSelectedMetricFamily] =
    useState<MetricFamilyId>("all");
  const [selectedMetric, setSelectedMetric] = useState("");
  const [showLegacyFields, setShowLegacyFields] = useState(false);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [showSupportColumns, setShowSupportColumns] = useState(false);

  const [shotsPer60, setShotsPer60] = useState(10.8);
  const [ixgPer60, setIxgPer60] = useState(0.92);
  const [ppToiPct, setPpToiPct] = useState(0.34);
  const [usageDelta, setUsageDelta] = useState(0.21);
  const [pdo, setPdo] = useState(1.018);
  const [recentDelta, setRecentDelta] = useState(0.58);
  const [recentZScore, setRecentZScore] = useState(1.22);
  const [toiSeconds, setToiSeconds] = useState(1040);
  const [projectionMetric, setProjectionMetric] =
    useState<ProjectableCountMetric>("shots");
  const [ratePer60, setRatePer60] = useState(10.8);
  const [foWinPct, setFoWinPct] = useState(0.56);
  const [foAttemptsPerGame, setFoAttemptsPerGame] = useState(17.5);
  const [oppXgaPer60, setOppXgaPer60] = useState(3.02);
  const [oppCaPer60, setOppCaPer60] = useState(59);
  const [oppHdcaPer60, setOppHdcaPer60] = useState(10.8);
  const [oppSvPct, setOppSvPct] = useState(0.897);
  const [oppPkTier, setOppPkTier] = useState(21);
  const [oppGamesPlayed, setOppGamesPlayed] = useState(62);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label} copied.`);
      window.setTimeout(() => {
        setCopyFeedback((current) =>
          current === `${label} copied.` ? null : current
        );
      }, 1800);
    } catch (error: any) {
      setCopyFeedback(error?.message ?? `Failed to copy ${label.toLowerCase()}.`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const trimmed = playerQuery.trim();
    if (trimmed.length < 2) {
      setPlayerSuggestions([]);
      setPlayerSearchLoading(false);
      return;
    }

    setPlayerSearchLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchPlayersByName(trimmed);
        if (!cancelled) {
          setPlayerSuggestions(results);
        }
      } catch (error: any) {
        if (!cancelled) {
          setPlayerSuggestions([]);
          setValidationError(error?.message ?? "Failed to search players.");
        }
      } finally {
        if (!cancelled) {
          setPlayerSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [playerQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadValidation() {
      if (!selectedPlayer) {
        setValidationPayload(null);
        setFaceoffTotals(null);
        return;
      }

      setValidationLoading(true);
      setValidationError(null);
      try {
        const [payload, totals] = await Promise.all([
          fetchValidationPayload({
            playerId: selectedPlayer.id,
            season: selectedSeason,
            strength: selectedStrength,
            teamId: selectedTeamId ? Number(selectedTeamId) : undefined,
            gameDate: selectedGameDate || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            metric: selectedMetric || undefined,
            metricFamily:
              selectedMetricFamily === "all" ? undefined : selectedMetricFamily,
            includeStoredRows: true,
            includeRecomputedRows: true,
            includeSourceRows: true,
            includeDiagnostics: true
          }),
          fetchFaceoffTotals(selectedPlayer.id)
        ]);

        if (cancelled) return;
        setValidationPayload(payload);
        setFaceoffTotals(totals);
      } catch (error: any) {
        if (!cancelled) {
          setValidationPayload(null);
          setValidationError(
            error?.message ?? "Failed to load rolling validation payload."
          );
        }
      } finally {
        if (!cancelled) {
          setValidationLoading(false);
        }
      }
    }

    loadValidation();
    return () => {
      cancelled = true;
    };
  }, [
    endDate,
    selectedGameDate,
    selectedMetric,
    selectedMetricFamily,
    selectedPlayer,
    selectedSeason,
    selectedStrength,
    selectedTeamId,
    startDate
  ]);

  const storedRows = validationPayload?.stored?.rowHistory ?? [];
  const recomputedRows = validationPayload?.recomputed?.rowHistory ?? [];

  const storedRowMap = useMemo(() => {
    const map = new Map<string, RowLike>();
    storedRows.forEach((row) => map.set(getRowKey(row as RowLike), row as RowLike));
    return map;
  }, [storedRows]);

  const recomputedRowMap = useMemo(() => {
    const map = new Map<string, RowLike>();
    recomputedRows.forEach((row) => map.set(getRowKey(row), row));
    return map;
  }, [recomputedRows]);

  const teamOptions = useMemo(() => {
    const uniqueIds = Array.from(
      new Set(
        storedRows
          .map((row) => row.team_id)
          .filter((teamId): teamId is number => typeof teamId === "number")
      )
    ).sort((left, right) => left - right);

    return uniqueIds.map((teamId) => ({
      value: String(teamId),
      label: `Team ${teamId}`
    }));
  }, [storedRows]);

  const latestSourceDate = validationPayload?.diagnostics?.targetFreshness?.latestSourceDate;

  const rowOptions = useMemo<RowOption[]>(() => {
    const baseRows = storedRows.length > 0 ? storedRows : (recomputedRows as RowLike[]);

    return baseRows
      .map((row) => {
        const rowLike = row as RowLike;
        const rowKey = getRowKey(rowLike);
        const gameDate = getRowGameDate(rowLike) ?? "unknown-date";
        const gameId = getRowGameId(rowLike);
        const storedMetricValue = selectedMetric
          ? getNumericValue(storedRowMap.get(rowKey), selectedMetric)
          : null;
        const recomputedMetricValue = selectedMetric
          ? getNumericValue(recomputedRowMap.get(rowKey), selectedMetric)
          : null;
        const mismatch =
          selectedMetric.length > 0 &&
          storedMetricValue != null &&
          recomputedMetricValue != null &&
          Math.abs(storedMetricValue - recomputedMetricValue) > 0.000001;
        const stale =
          latestSourceDate != null
            ? gameDate > latestSourceDate || !recomputedRowMap.has(rowKey)
            : !recomputedRowMap.has(rowKey);

        return {
          key: gameDate,
          gameDate,
          gameId,
          label: `${gameDate}${gameId ? ` | game ${gameId}` : ""}${
            mismatch ? " | mismatch" : ""
          }${stale ? " | stale" : ""}`,
          mismatch,
          stale
        };
      })
      .filter((row) => (mismatchOnly ? row.mismatch : true))
      .filter((row) => (staleOnly ? row.stale : true))
      .sort((left, right) => right.gameDate.localeCompare(left.gameDate));
  }, [
    latestSourceDate,
    mismatchOnly,
    recomputedRowMap,
    recomputedRows,
    selectedMetric,
    staleOnly,
    storedRowMap,
    storedRows
  ]);

  const focusedRow = useMemo<RowLike | null>(() => {
    if (validationPayload?.stored?.focusedRow) {
      return validationPayload.stored.focusedRow as unknown as RowLike;
    }
    if (validationPayload?.recomputed?.focusedRow) {
      return validationPayload.recomputed.focusedRow;
    }
    return null;
  }, [validationPayload]);

  const availableMetricOptions = useMemo(() => {
    const row = focusedRow ?? (storedRows[0] as unknown as RowLike | undefined) ?? recomputedRows[0];
    if (!row) return [] as Array<{ value: string; label: string }>;

    return Object.keys(row)
      .filter((field) => !IDENTITY_FIELDS.has(field))
      .filter((field) =>
        selectedMetricFamily === "all"
          ? true
          : inferMetricFamily(field) === selectedMetricFamily
      )
      .filter((field) => (showLegacyFields ? true : !isLegacyField(field)))
      .filter((field) =>
        showSupportColumns
          ? true
          : inferMetricFamily(field) !== "support"
      )
      .filter((field) => (showSupportColumns ? true : !isContextField(field) || field === "pp_unit" || field === "line_combo_slot"))
      .sort((left, right) => left.localeCompare(right))
      .map((field) => ({
        value: field,
        label: field
      }));
  }, [
    focusedRow,
    recomputedRows,
    selectedMetricFamily,
    showLegacyFields,
    showSupportColumns,
    storedRows
  ]);

  useEffect(() => {
    if (!validationPayload?.selected.focusedRow?.gameDate) return;
    if (!selectedGameDate) {
      setSelectedGameDate(validationPayload.selected.focusedRow.gameDate);
    }
  }, [selectedGameDate, validationPayload]);

  useEffect(() => {
    if (!selectedTeamId) return;
    if (!teamOptions.some((option) => option.value === selectedTeamId)) {
      setSelectedTeamId("");
    }
  }, [selectedTeamId, teamOptions]);

  useEffect(() => {
    if (!rowOptions.length) return;
    if (!selectedGameDate || !rowOptions.some((option) => option.key === selectedGameDate)) {
      setSelectedGameDate(rowOptions[0].key);
    }
  }, [rowOptions, selectedGameDate]);

  useEffect(() => {
    if (!availableMetricOptions.length) return;
    if (
      !selectedMetric ||
      !availableMetricOptions.some((option) => option.value === selectedMetric)
    ) {
      setSelectedMetric(availableMetricOptions[0].value);
    }
  }, [availableMetricOptions, selectedMetric]);

  const playerSnapshot = useMemo<PlayerDebugSnapshot | null>(() => {
    if (!validationPayload?.selected.player || !focusedRow) return null;
    const gameDate = getRowGameDate(focusedRow);
    if (!gameDate) return null;

    return {
      playerId: validationPayload.selected.player.id,
      fullName: validationPayload.selected.player.fullName,
      position: validationPayload.selected.player.position,
      gameDate,
      metrics: focusedRow as Partial<RollingMetricRow>,
      faceoffWinPct: faceoffTotals?.faceoffWinPct ?? null,
      faceoffAttemptsPerGame: faceoffTotals?.faceoffAttemptsPerGame ?? null
    };
  }, [faceoffTotals, focusedRow, validationPayload]);

  useEffect(() => {
    if (!playerSnapshot) return;

    const metrics = playerSnapshot.metrics;
    const shotsRecent = safeNumber(
      canonicalOrLegacyFinite(
        metrics.sog_per_60_last5,
        metrics.sog_per_60_avg_last5
      )
    );
    const shotsCareer = safeNumber(
      canonicalOrLegacyFinite(
        metrics.sog_per_60_career,
        metrics.sog_per_60_avg_career
      )
    );
    const ixgRecent = safeNumber(
      canonicalOrLegacyFinite(
        metrics.ixg_per_60_last5,
        metrics.ixg_per_60_avg_last5
      )
    );
    const ixgCareer = safeNumber(
      canonicalOrLegacyFinite(
        metrics.ixg_per_60_career,
        metrics.ixg_per_60_avg_career
      )
    );
    const toiRecent = safeNumber(metrics.toi_seconds_avg_last5, 900);
    const toiCareer = safeNumber(metrics.toi_seconds_avg_career, toiRecent);
    const ppRecent = normalizePercentLike(
      canonicalOrLegacyFinite(
        metrics.pp_share_pct_last5,
        metrics.pp_share_pct_avg_last5
      )
    );
    const ppCareer = normalizePercentLike(
      canonicalOrLegacyFinite(
        metrics.pp_share_pct_career,
        metrics.pp_share_pct_avg_career
      )
    );
    const pdoRecent = normalizePdo(
      canonicalOrLegacyFinite(metrics.pdo_last5, metrics.pdo_avg_last5)
    );
    const goalsRecent = toPer60(safeNumber(metrics.goals_avg_last5), toiRecent);
    const assistsRecent = toPer60(safeNumber(metrics.assists_avg_last5), toiRecent);
    const pointsRecent = toPer60(safeNumber(metrics.points_avg_last5), toiRecent);
    const ppPointsRecent = toPer60(
      safeNumber(metrics.pp_points_avg_last5),
      toiRecent
    );
    const hitsRecent = toPer60(safeNumber(metrics.hits_avg_last5), toiRecent);
    const blocksRecent = toPer60(safeNumber(metrics.blocks_avg_last5), toiRecent);

    const usage = safePercentChange(toiRecent, toiCareer);
    const aggregateDelta =
      (safePercentChange(shotsRecent, shotsCareer) +
        safePercentChange(ixgRecent, ixgCareer) +
        safePercentChange(ppRecent, ppCareer)) /
      3;
    const zLike =
      ((shotsRecent - shotsCareer) / Math.max(shotsCareer * 0.2, 0.4) +
        (ixgRecent - ixgCareer) / Math.max(ixgCareer * 0.2, 0.08)) /
      2;

    setShotsPer60(shotsRecent);
    setIxgPer60(ixgRecent);
    setPpToiPct(ppRecent);
    setUsageDelta(usage);
    setPdo(pdoRecent);
    setRecentDelta(aggregateDelta);
    setRecentZScore(zLike);
    setToiSeconds(toiRecent);
    setFoWinPct(normalizePercentLike(playerSnapshot.faceoffWinPct));
    setFoAttemptsPerGame(playerSnapshot.faceoffAttemptsPerGame ?? 0);

    const metricRateMap: Record<ProjectableCountMetric, number> = {
      goals: goalsRecent,
      assists: assistsRecent,
      shots: shotsRecent,
      points: pointsRecent,
      pp_points: ppPointsRecent,
      hits: hitsRecent,
      blocks: blocksRecent
    };
    setRatePer60(metricRateMap[projectionMetric] ?? shotsRecent);
  }, [playerSnapshot, projectionMetric]);

  const explanationOptions = useMemo<ExplanationOptions>(() => {
    if (!playerSnapshot) return { topN: 3 };
    const metrics = playerSnapshot.metrics;
    return {
      topN: 3,
      featureContexts: {
        shots_per_60: {
          recent: safeNumber(
            canonicalOrLegacyFinite(
              metrics.sog_per_60_last5,
              metrics.sog_per_60_avg_last5
            )
          ),
          baseline: safeNumber(
            canonicalOrLegacyFinite(
              metrics.sog_per_60_career,
              metrics.sog_per_60_avg_career
            )
          ),
          comparisonLabel: "career"
        },
        ixg_per_60: {
          recent: safeNumber(
            canonicalOrLegacyFinite(
              metrics.ixg_per_60_last5,
              metrics.ixg_per_60_avg_last5
            )
          ),
          baseline: safeNumber(
            canonicalOrLegacyFinite(
              metrics.ixg_per_60_career,
              metrics.ixg_per_60_avg_career
            )
          ),
          comparisonLabel: "career"
        },
        pp_toi_pct: {
          recent: normalizePercentLike(
            canonicalOrLegacyFinite(
              metrics.pp_share_pct_last5,
              metrics.pp_share_pct_avg_last5
            )
          ),
          baseline: normalizePercentLike(
            canonicalOrLegacyFinite(
              metrics.pp_share_pct_career,
              metrics.pp_share_pct_avg_career
            )
          ),
          comparisonLabel: "career",
          format: "percent"
        },
        usage_delta: {
          recent: safeNumber(metrics.toi_seconds_avg_last5),
          baseline: safeNumber(metrics.toi_seconds_avg_career),
          comparisonLabel: "career TOI"
        },
        pdo: {
          recent: normalizePdo(
            canonicalOrLegacyFinite(metrics.pdo_last5, metrics.pdo_avg_last5)
          ),
          baseline: normalizePdo(
            canonicalOrLegacyFinite(metrics.pdo_career, metrics.pdo_avg_career)
          ),
          comparisonLabel: "career"
        }
      }
    };
  }, [playerSnapshot]);

  const computed = useMemo(() => {
    const features = [shotsPer60, ixgPer60, ppToiPct, usageDelta, pdo];
    const probabilityResult = predictSustainabilityProbabilities(DEMO_MODEL, features);
    const importances = extractFeatureImportance(
      DEMO_MODEL,
      features,
      probabilityResult.label,
      [...MODEL_FEATURE_KEYS]
    );
    const countProjection = projectCountMetric({
      metric: projectionMetric,
      ratePer60,
      toiSeconds,
      opponentAdjustment: {
        gamesPlayed: oppGamesPlayed,
        xgaPer60: oppXgaPer60,
        caPer60: oppCaPer60,
        hdcaPer60: oppHdcaPer60,
        svPct: oppSvPct,
        pkTier: oppPkTier
      },
      horizons: [5, 10]
    });
    const score = buildSustainabilityScore({
      probabilities: probabilityResult.probabilities,
      recentVsBaselineDelta: recentDelta,
      recentVsBaselineZScore: recentZScore,
      usageDelta,
      opponentDefenseScore: countProjection.opponentAdjustment.defenseScore
    });
    const explicitFlags = derivePerformanceFlags({
      score: score.score,
      probabilities: probabilityResult.probabilities,
      recentVsBaselineZScore: recentZScore
    });
    const faceoffProjection = projectFaceoffWinPct({
      winPct: foWinPct,
      attemptsPerGame: foAttemptsPerGame,
      horizons: [5, 10]
    });

    return {
      probabilityResult,
      importances,
      explanations: generateExplanationText(
        importances,
        probabilityResult.label,
        explanationOptions
      ),
      explanationBullets: generateExplanationBullets(
        importances,
        probabilityResult.label,
        explanationOptions
      ),
      score,
      explicitFlags,
      countProjection,
      faceoffProjection
    };
  }, [
    explanationOptions,
    foAttemptsPerGame,
    foWinPct,
    ixgPer60,
    oppCaPer60,
    oppGamesPlayed,
    oppHdcaPer60,
    oppPkTier,
    oppSvPct,
    oppXgaPer60,
    pdo,
    ppToiPct,
    projectionMetric,
    ratePer60,
    recentDelta,
    recentZScore,
    shotsPer60,
    toiSeconds,
    usageDelta
  ]);

  const activeStateClass =
    computed.explicitFlags.state === "overperforming"
      ? styles.pillStrong
      : computed.explicitFlags.state === "underperforming"
        ? styles.pillWeak
        : styles.pillNeutral;

  const focusedMetricDiff = validationPayload?.comparisons?.focusedRow?.selectedMetric?.diff;
  const focusedMetricField =
    validationPayload?.comparisons?.focusedRow?.selectedMetric?.field ?? selectedMetric;
  const selectedMetricFamilyResolved = focusedMetricField
    ? inferMetricFamily(focusedMetricField)
    : null;
  const selectedMetricMetadata = validationPayload?.selected.metric ?? {
    key: null,
    family: null,
    canonicalField: null,
    legacyFields: [],
    supportFields: []
  };
  const focusedStoredRow =
    (validationPayload?.stored?.focusedRow as unknown as RowLike | null) ?? null;
  const focusedRecomputedRow = validationPayload?.recomputed?.focusedRow ?? null;
  const selectedSupportValues = collectFieldValues(
    focusedRow,
    selectedMetricMetadata.supportFields
  );
  const selectedLegacyValues = collectFieldValues(
    focusedRow,
    selectedMetricMetadata.legacyFields
  );
  const selectedCanonicalValues = collectFieldValues(
    focusedRow,
    [selectedMetricMetadata.canonicalField].filter(
      (field): field is string => Boolean(field)
    )
  );
  const availabilityValues = collectFieldValues(focusedRow, AVAILABILITY_FIELDS);
  const windowMembership = useMemo(
    () =>
      getWindowMembership(
        (storedRows.length > 0
          ? (storedRows as unknown as RowLike[])
          : recomputedRows) as RowLike[],
        focusedRow
      ),
    [focusedRow, recomputedRows, storedRows]
  );
  const focusedMergedGame = useMemo<RowLike | null>(() => {
    const mergedGames =
      validationPayload?.sourceRows?.selectedStrength?.mergedGames ?? [];
    const focusedKey = getRowKey(focusedRow);
    if (!focusedKey) return null;
    return (mergedGames.find((row) => getRowKey(row) === focusedKey) ?? null) as RowLike | null;
  }, [focusedRow, validationPayload]);
  const focusedWgoRow = useMemo(() => {
    const gameDate = getRowGameDate(focusedRow);
    if (!gameDate) return null;
    return (
      validationPayload?.sourceRows?.shared.wgoRows.find(
        (row) => getRowGameDate(row) === gameDate
      ) ?? null
    );
  }, [focusedRow, validationPayload]);
  const focusedFormula = focusedMetricField
    ? getFormulaForMetric(
        focusedMetricField,
        selectedMetricMetadata.family ?? selectedMetricFamilyResolved
      )
    : "Select a metric to inspect the reconstruction formula.";
  const focusedSourceContext = (focusedMergedGame?.sourceContext ?? null) as RowLike | null;
  const focusedCounts = (focusedMergedGame?.counts ?? null) as RowLike | null;
  const focusedRates = (focusedMergedGame?.rates ?? null) as RowLike | null;
  const focusedCountsOi = (focusedMergedGame?.countsOi ?? null) as RowLike | null;
  const focusedPpCombination = (focusedMergedGame?.ppCombination ?? null) as RowLike | null;
  const focusedLineCombo = (focusedMergedGame?.lineCombo ?? null) as RowLike | null;
  const refreshPrerequisites = (
    REFRESH_PREREQUISITES[
      (selectedMetricMetadata.family ?? selectedMetricFamilyResolved ?? "other") as string
    ] ?? REFRESH_PREREQUISITES.other
  );
  const auditStatusEmoji = deriveAuditStatusEmoji({
    readinessStatus: validationPayload?.readiness.status ?? null,
    diff: focusedMetricDiff
  });
  const formulaAuditEntry = focusedMetricField
    ? `- ${auditStatusEmoji} \`${focusedMetricField}\`\n  - formula: \`${focusedFormula}\``
    : "Select a metric to generate the formula-only audit entry.";
  const comparisonBlock = focusedMetricField
    ? [
        `- player: \`${validationPayload?.selected.player?.fullName ?? "unknown"}\``,
        `- season / strength: \`${selectedSeason}\` / \`${selectedStrength}\``,
        `- row: \`${validationPayload?.selected.focusedRow?.rowKey ?? "unknown"}\``,
        `- metric: \`${focusedMetricField}\``,
        `- stored value: \`${formatValue(
          validationPayload?.comparisons?.focusedRow?.selectedMetric?.storedValue
        )}\``,
        `- reconstructed value: \`${formatValue(
          validationPayload?.comparisons?.focusedRow?.selectedMetric?.recomputedValue
        )}\``,
        `- diff: \`${formatValue(focusedMetricDiff)}\``,
        `- readiness: \`${validationPayload?.readiness.status ?? "unknown"}\``
      ].join("\n")
    : "Select a metric to generate the comparison block.";
  const refreshPrerequisitesBlock = [
    `- metric family: \`${selectedMetricMetadata.family ?? selectedMetricFamilyResolved ?? "other"}\``,
    ...refreshPrerequisites.map((item) => `- ${item}`)
  ].join("\n");

  return (
    <>
      <Head>
        <title>Trends Debug | Rolling Validation Console</title>
      </Head>
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Pass-2 Validation Console</p>
            <h1>Trends Debug</h1>
            <p className={styles.lede}>
              Inspect rolling-player metrics by player, strength, season, team,
              date range, row, and metric before the deeper panel work lands.
              This page now loads the read-only validation payload instead of
              relying on browser-side rolling joins.
            </p>
          </section>

          <div className={styles.layout}>
            <aside className={`${styles.panel} ${styles.controls}`}>
              <section className={styles.section}>
                <h2>Player Search</h2>
                <p className={styles.sectionHint}>
                  Choose the player to inspect, then use the validation controls
                  below to narrow the audit scope.
                </p>
                <div className={styles.field}>
                  <label htmlFor="player-search">Find Player</label>
                  <input
                    id="player-search"
                    type="text"
                    value={playerQuery}
                    placeholder="Type at least 2 letters"
                    onChange={(event) => {
                      setPlayerQuery(event.target.value);
                      setValidationError(null);
                    }}
                  />
                </div>
                {playerSearchLoading ? (
                  <p className={styles.sectionHint}>Searching players...</p>
                ) : null}
                {playerSuggestions.length ? (
                  <div className={styles.suggestionList}>
                    {playerSuggestions.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className={styles.suggestion}
                        onClick={() => {
                          setSelectedPlayer(player);
                          setPlayerQuery(player.fullName);
                          setPlayerSuggestions([]);
                          setSelectedGameDate("");
                        }}
                      >
                        <span>{player.fullName}</span>
                        <span className={styles.subtle}>
                          {player.position ?? "N/A"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedPlayer ? (
                  <div className={styles.snapshotBanner}>
                    <strong>{selectedPlayer.fullName}</strong>
                    <span className={styles.subtle}>
                      {selectedPlayer.position ?? "N/A"}
                    </span>
                    <span className={styles.subtle}>
                      readiness {validationPayload?.readiness.status ?? "pending"}
                    </span>
                  </div>
                ) : null}
                {validationLoading ? (
                  <p className={styles.sectionHint}>Loading validation payload...</p>
                ) : null}
                {validationError ? (
                  <p className={styles.errorText}>{validationError}</p>
                ) : null}
              </section>

              <section className={styles.section}>
                <h2>Validation Scope</h2>
                <p className={styles.sectionHint}>
                  These selectors drive the server-side validation request.
                </p>
                <div className={styles.fields}>
                  <div className={styles.fieldGrid}>
                    <div className={styles.field}>
                      <label htmlFor="validation-strength">Strength</label>
                      <select
                        id="validation-strength"
                        value={selectedStrength}
                        onChange={(event) =>
                          setSelectedStrength(event.target.value as StrengthState)
                        }
                      >
                        {STRENGTH_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <NumericInput
                      id="validation-season"
                      label="Season"
                      value={selectedSeason}
                      step={1}
                      onChange={setSelectedSeason}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="validation-team">Team (Optional)</label>
                    <select
                      id="validation-team"
                      value={selectedTeamId}
                      onChange={(event) => setSelectedTeamId(event.target.value)}
                    >
                      <option value="">All teams</option>
                      {teamOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.fieldGrid}>
                    <div className={styles.field}>
                      <label htmlFor="validation-start-date">Start Date</label>
                      <input
                        id="validation-start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="validation-end-date">End Date</label>
                      <input
                        id="validation-end-date"
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="validation-row">Focused Game Date Row</label>
                    <select
                      id="validation-row"
                      value={selectedGameDate}
                      onChange={(event) => setSelectedGameDate(event.target.value)}
                    >
                      <option value="">Latest available row</option>
                      {rowOptions.map((option) => (
                        <option key={option.label} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Metric Selection</h2>
                <p className={styles.sectionHint}>
                  Use the family filter and metric selector to focus upcoming
                  validation panels and diff views.
                </p>
                <div className={styles.fields}>
                  <div className={styles.field}>
                    <label htmlFor="validation-family">Metric Family</label>
                    <select
                      id="validation-family"
                      value={selectedMetricFamily}
                      onChange={(event) =>
                        setSelectedMetricFamily(
                          event.target.value as MetricFamilyId
                        )
                      }
                    >
                      {METRIC_FAMILY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="validation-metric">Metric / Field</label>
                    <select
                      id="validation-metric"
                      value={selectedMetric}
                      onChange={(event) => setSelectedMetric(event.target.value)}
                    >
                      <option value="">Select metric</option>
                      {availableMetricOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Visibility Toggles</h2>
                <p className={styles.sectionHint}>
                  These toggles already shape the row selector and metric
                  selector ahead of the deeper validation panels.
                </p>
                <div className={styles.statePillRow}>
                  <button
                    type="button"
                    className={`${styles.pill} ${styles.toggleButton} ${
                      showLegacyFields ? styles.pillStrong : styles.pillNeutral
                    }`}
                    onClick={() => setShowLegacyFields((current) => !current)}
                  >
                    {showLegacyFields ? "Legacy View On" : "Canonical View"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${styles.toggleButton} ${
                      mismatchOnly ? styles.pillWeak : styles.pillNeutral
                    }`}
                    onClick={() => setMismatchOnly((current) => !current)}
                  >
                    {mismatchOnly ? "Mismatches Only" : "All Rows"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${styles.toggleButton} ${
                      staleOnly ? styles.pillWeak : styles.pillNeutral
                    }`}
                    onClick={() => setStaleOnly((current) => !current)}
                  >
                    {staleOnly ? "Stale Rows Only" : "All Freshness States"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${styles.toggleButton} ${
                      showSupportColumns ? styles.pillStrong : styles.pillNeutral
                    }`}
                    onClick={() => setShowSupportColumns((current) => !current)}
                  >
                    {showSupportColumns ? "Support Fields On" : "Support Fields Off"}
                  </button>
                </div>
              </section>

              <section className={styles.section}>
                <h2>Legacy Sandbox Inputs</h2>
                <p className={styles.sectionHint}>
                  These model inputs now hydrate from the focused validation row
                  instead of a separate latest-row fetch.
                </p>
                <div className={styles.fields}>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="shots-per-60"
                      label="Shots / 60"
                      value={shotsPer60}
                      step={0.1}
                      onChange={setShotsPer60}
                    />
                    <NumericInput
                      id="ixg-per-60"
                      label="ixG / 60"
                      value={ixgPer60}
                      step={0.01}
                      onChange={setIxgPer60}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="pp-toi-pct"
                      label="PP Share"
                      value={ppToiPct}
                      step={0.01}
                      min={0}
                      max={1}
                      onChange={setPpToiPct}
                    />
                    <NumericInput
                      id="usage-delta"
                      label="Usage Delta"
                      value={usageDelta}
                      step={0.01}
                      onChange={setUsageDelta}
                    />
                  </div>
                  <div className={styles.fieldGrid}>
                    <NumericInput
                      id="pdo"
                      label="PDO"
                      value={pdo}
                      step={0.001}
                      onChange={setPdo}
                    />
                    <NumericInput
                      id="recent-delta"
                      label="Aggregate Delta"
                      value={recentDelta}
                      step={0.01}
                      onChange={setRecentDelta}
                    />
                  </div>
                  <NumericInput
                    id="recent-z"
                    label="Z-Like Momentum"
                    value={recentZScore}
                    step={0.01}
                    onChange={setRecentZScore}
                  />
                </div>
              </section>
            </aside>

            <section className={`${styles.panel} ${styles.results}`}>
              <div className={`${styles.card} ${styles.bannerCard}`}>
                <h3>Freshness Banner</h3>
                <div className={styles.statePillRow}>
                  <div className={`${styles.pill} ${styles.pillNeutral}`}>
                    readiness {validationPayload?.readiness.status ?? "pending"}
                  </div>
                  <div className={`${styles.pill} ${styles.pillNeutral}`}>
                    source tail {latestSourceDate ?? "unknown"}
                  </div>
                  <div className={`${styles.pill} ${styles.pillNeutral}`}>
                    stored {validationPayload?.diagnostics?.targetFreshness?.storedRowCount ?? 0}
                  </div>
                  <div className={`${styles.pill} ${styles.pillNeutral}`}>
                    recomputed {validationPayload?.diagnostics?.targetFreshness?.recomputedRowCount ?? 0}
                  </div>
                  <div className={`${styles.pill} ${activeStateClass}`}>
                    sandbox {computed.explicitFlags.state}
                  </div>
                </div>
                {copyFeedback ? (
                  <p className={styles.sectionHint}>{copyFeedback}</p>
                ) : null}
                <div className={styles.statList}>
                  <div className={styles.statRow}>
                    <span>Blockers</span>
                    <strong className={styles.mono}>
                      {validationPayload?.readiness.blockerReasons.length
                        ? validationPayload.readiness.blockerReasons.join(" | ")
                        : "none"}
                    </strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Cautions</span>
                    <strong className={styles.mono}>
                      {validationPayload?.readiness.cautionReasons.length
                        ? validationPayload.readiness.cautionReasons.join(" | ")
                        : "none"}
                    </strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Next action</span>
                    <strong>
                      {validationPayload?.readiness.nextRecommendedAction ?? "None"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Stored Rows</span>
                  <strong className={styles.metricValue}>
                    {validationPayload?.diagnostics?.targetFreshness?.storedRowCount ?? 0}
                  </strong>
                  <span className={styles.metricDetail}>
                    latest {validationPayload?.diagnostics?.targetFreshness?.latestStoredGameDate ?? "—"}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Recomputed Rows</span>
                  <strong className={styles.metricValue}>
                    {validationPayload?.diagnostics?.targetFreshness?.recomputedRowCount ?? 0}
                  </strong>
                  <span className={styles.metricDetail}>
                    latest {validationPayload?.diagnostics?.targetFreshness?.latestRecomputedGameDate ?? "—"}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Focused Metric Diff</span>
                  <strong className={styles.metricValue}>
                    {focusedMetricDiff == null ? "—" : formatNumber(focusedMetricDiff, 6)}
                  </strong>
                  <span className={styles.metricDetail}>
                    {focusedMetricField || "No metric selected"}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Focused Row</span>
                  <strong className={styles.metricValue}>
                    {validationPayload?.selected.focusedRow?.gameDate ?? "—"}
                  </strong>
                  <span className={styles.metricDetail}>
                    {validationPayload?.selected.focusedRow?.rowKey ?? "No row selected"}
                  </span>
                </div>
              </div>

              <div className={styles.cardGrid}>
                <article className={styles.card}>
                  <h3>Stored Value Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Metric</span>
                      <strong>{focusedMetricField || "—"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Canonical field</span>
                      <strong>{selectedMetricMetadata.canonicalField ?? "—"}</strong>
                    </div>
                    {selectedCanonicalValues.map((entry) => (
                      <div key={`canonical-${entry.field}`} className={styles.statRow}>
                        <span>{entry.field}</span>
                        <strong className={styles.mono}>{formatValue(entry.value)}</strong>
                      </div>
                    ))}
                    {selectedLegacyValues.slice(0, 4).map((entry) => (
                      <div key={`legacy-${entry.field}`} className={styles.statRow}>
                        <span>{entry.field}</span>
                        <strong className={styles.mono}>{formatValue(entry.value)}</strong>
                      </div>
                    ))}
                    {!selectedCanonicalValues.length && !selectedLegacyValues.length ? (
                      <div className={styles.statRow}>
                        <span>Stored field values</span>
                        <strong>Pick a metric to inspect.</strong>
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Formula Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Metric family</span>
                      <strong>{selectedMetricMetadata.family ?? selectedMetricFamilyResolved ?? "—"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Formula</span>
                      <strong className={styles.mono}>{focusedFormula}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Support fields</span>
                      <strong className={styles.mono}>
                        {selectedMetricMetadata.supportFields.length
                          ? selectedMetricMetadata.supportFields.join(", ")
                          : "none"}
                      </strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Legacy aliases</span>
                      <strong className={styles.mono}>
                        {selectedMetricMetadata.legacyFields.length
                          ? selectedMetricMetadata.legacyFields.join(", ")
                          : "none"}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Copy Helpers</h3>
                  <div className={styles.copyActions}>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() => copyText("Formula audit entry", formulaAuditEntry)}
                      disabled={!focusedMetricField}
                    >
                      Copy Formula Audit Entry
                    </button>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() => copyText("Comparison block", comparisonBlock)}
                      disabled={!focusedMetricField}
                    >
                      Copy Comparison Block
                    </button>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={() =>
                        copyText(
                          "Refresh prerequisites",
                          refreshPrerequisitesBlock
                        )
                      }
                    >
                      Copy Refresh Prereqs
                    </button>
                  </div>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Formula audit preview</span>
                      <strong>{focusedMetricField || "Select a metric first"}</strong>
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>{formulaAuditEntry}</pre>
                  <pre className={styles.codeBlock}>{comparisonBlock}</pre>
                  <pre className={styles.codeBlock}>{refreshPrerequisitesBlock}</pre>
                </article>

                <article className={`${styles.card} ${styles.cardWide}`}>
                  <h3>Source-Input Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Focused merged source row</span>
                      <strong>{focusedMergedGame ? "available" : "missing"}</strong>
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>
                    {stringifyCompact({
                      wgo: focusedWgoRow,
                      counts: focusedCounts,
                      rates: focusedRates,
                      countsOi: focusedCountsOi,
                      ppCombination: focusedPpCombination,
                      lineCombo: focusedLineCombo
                    })}
                  </pre>
                </article>

                <article className={`${styles.card} ${styles.cardWide}`}>
                  <h3>Rolling-Window Membership Panel</h3>
                  <div className={styles.windowGrid}>
                    {([3, 5, 10, 20] as const).map((size) => (
                      <div key={size} className={styles.windowBlock}>
                        <strong className={styles.windowTitle}>{`last${size}`}</strong>
                        {windowMembership[size].length ? (
                          <div className={styles.windowList}>
                            {windowMembership[size].map((row) => (
                              <div key={getRowKey(row)} className={styles.windowRow}>
                                <span>{getRowGameDate(row) ?? "—"}</span>
                                <span className={styles.mono}>
                                  {focusedMetricField
                                    ? formatValue(row[focusedMetricField])
                                    : "select metric"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.sectionHint}>No rows in window.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Availability Denominator Panel</h3>
                  <div className={styles.statList}>
                    {availabilityValues.slice(0, 10).map((entry) => (
                      <div key={entry.field} className={styles.statRow}>
                        <span>{entry.field}</span>
                        <strong className={styles.mono}>{formatValue(entry.value)}</strong>
                      </div>
                    ))}
                    {!availabilityValues.length ? (
                      <div className={styles.statRow}>
                        <span>Availability counters</span>
                        <strong>No focused row loaded.</strong>
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Numerator / Denominator Panel</h3>
                  <div className={styles.statList}>
                    {selectedSupportValues.length ? (
                      selectedSupportValues.map((entry) => (
                        <div key={entry.field} className={styles.statRow}>
                          <span>{entry.field}</span>
                          <strong className={styles.mono}>{formatValue(entry.value)}</strong>
                        </div>
                      ))
                    ) : (
                      <div className={styles.statRow}>
                        <span>Support fields</span>
                        <strong>No support fields exposed for the selected metric.</strong>
                      </div>
                    )}
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Source Precedence / Fallback Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Counts source present</span>
                      <strong>{formatValue(focusedSourceContext?.countsSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Rates source present</span>
                      <strong>{formatValue(focusedSourceContext?.ratesSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Counts-on-ice source present</span>
                      <strong>{formatValue(focusedSourceContext?.countsOiSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Resolved TOI source</span>
                      <strong>{formatValue(focusedSourceContext?.resolvedToiSource)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Fallback TOI seed</span>
                      <strong>{formatValue(focusedSourceContext?.fallbackToiSource)}</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>TOI Trust Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>NST counts TOI</span>
                      <strong className={styles.mono}>{formatValue(focusedCounts?.toi)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>NST on-ice TOI</span>
                      <strong className={styles.mono}>{formatValue(focusedCountsOi?.toi)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>NST rates TOI/GP</span>
                      <strong className={styles.mono}>{formatValue(focusedRates?.toi_per_gp)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Fallback TOI seconds</span>
                      <strong className={styles.mono}>{formatValue(focusedMergedGame?.fallbackToiSeconds)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Trust tier</span>
                      <strong>{formatValue(focusedSourceContext?.toiTrustTier)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>WGO normalization</span>
                      <strong>{formatValue(focusedSourceContext?.wgoToiNormalization)}</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>PP Context Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Builder row present</span>
                      <strong>{focusedPpCombination ? "yes" : "no"}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>PP unit trusted</span>
                      <strong>{formatValue(focusedSourceContext?.ppUnitSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Builder PPTOI</span>
                      <strong className={styles.mono}>{formatValue(focusedPpCombination?.PPTOI)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Builder share</span>
                      <strong className={styles.mono}>{formatValue(focusedPpCombination?.pp_share_of_team)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>WGO PP TOI / share fallback</span>
                      <strong className={styles.mono}>
                        {formatValue(focusedWgoRow?.pp_toi)} / {formatValue(focusedWgoRow?.pp_toi_pct_per_game)}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Line Context Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Line source present</span>
                      <strong>{formatValue(focusedSourceContext?.lineSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Trusted assignment</span>
                      <strong>{formatValue(focusedSourceContext?.lineAssignmentSourcePresent)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Line slot</span>
                      <strong>{formatValue(focusedLineCombo?.slot)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Line group</span>
                      <strong>{formatValue(focusedLineCombo?.positionGroup)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Stored line fields</span>
                      <strong className={styles.mono}>
                        {formatValue(focusedRow?.line_combo_slot)} / {formatValue(focusedRow?.line_combo_group)}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Diagnostics Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Coverage warning count</span>
                      <strong>{validationPayload?.diagnostics?.coverage?.warnings.length ?? 0}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Unknown game IDs</span>
                      <strong>{validationPayload?.diagnostics?.coverage?.counts.unknownGameIds ?? 0}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Suspicious issues</span>
                      <strong>{validationPayload?.diagnostics?.suspiciousOutputs?.issueCount ?? 0}</strong>
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>
                    {stringifyCompact({
                      coverage: validationPayload?.diagnostics?.coverage ?? null,
                      derivedWindowCompleteness:
                        validationPayload?.diagnostics?.derivedWindowCompleteness ?? null,
                      suspiciousOutputs:
                        validationPayload?.diagnostics?.suspiciousOutputs ?? null
                    })}
                  </pre>
                </article>

                <article className={styles.card}>
                  <h3>Stored-vs-Reconstructed Diff Panel</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Stored row key</span>
                      <strong className={styles.mono}>
                        {validationPayload?.comparisons?.focusedRow?.storedRowKey ?? "—"}
                      </strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Recomputed row key</span>
                      <strong className={styles.mono}>
                        {validationPayload?.comparisons?.focusedRow?.recomputedRowKey ?? "—"}
                      </strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Stored value</span>
                      <strong className={styles.mono}>
                        {formatValue(validationPayload?.comparisons?.focusedRow?.selectedMetric?.storedValue)}
                      </strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Recomputed value</span>
                      <strong className={styles.mono}>
                        {formatValue(validationPayload?.comparisons?.focusedRow?.selectedMetric?.recomputedValue)}
                      </strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Diff</span>
                      <strong className={styles.mono}>{formatValue(focusedMetricDiff)}</strong>
                    </div>
                  </div>
                </article>

                <article className={styles.card}>
                  <h3>Legacy Sandbox Outputs</h3>
                  <div className={styles.statList}>
                    <div className={styles.statRow}>
                      <span>Predicted State</span>
                      <strong>{computed.probabilityResult.label}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Sustainability Score</span>
                      <strong>{formatNumber(computed.score.score)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>{projectionMetric} per game</span>
                      <strong>{formatNumber(computed.countProjection.expectedPerGame)}</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>FO Win %</span>
                      <strong>{formatNumber(computed.faceoffProjection.expectedWinPct * 100)}%</strong>
                    </div>
                    <div className={styles.statRow}>
                      <span>Focused player snapshot</span>
                      <strong>{playerSnapshot?.gameDate ?? "—"}</strong>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

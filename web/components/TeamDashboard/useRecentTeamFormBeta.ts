import { useEffect, useState } from "react";
import supabase from "lib/supabase";
import { seasonDateWindow } from "components/PlayerStats/playerStatsContract";
import { aggregateNstTeamCounts } from "lib/stats/percentUnits";
import {
  CTPI_VERSION_CONTRACTS,
  isDescriptiveBetaCtpiPayload,
} from "lib/trends/ctpiVersions";
import {
  RECENT_TEAM_FORM_V2_MIN_GAMES,
  RECENT_TEAM_FORM_V2_TARGET_GAMES,
  type RecentTeamFormComponentKey,
  type RecentTeamFormMetricKey,
} from "lib/trends/recentTeamFormV2";

/*
 * Recent Team Form descriptive beta (DISPLAY-PLAN, TJ 2026-11-13). Display
 * only: two small anon reads, rows read exactly as issued, nothing written and
 * nothing passed to projections, rankings or recommendations.
 */

const BETA_VERSION = 2;

/** Selected columns and payload paths only, never the whole jsonb. */
export const RECENT_TEAM_FORM_BETA_SELECT = [
  "date",
  "team",
  "ctpi_version",
  "ctpi_0_to_100",
  "offense",
  "defense",
  "goaltending",
  "special_teams",
  "computed_at",
  "publication_status:payload->>publicationStatus",
  "formula_version:payload->>formulaVersion",
  "input_version:payload->>inputVersion",
  "status:payload->>status",
  "source_game_count:payload->>sourceGameCount",
  "recent_game_count:payload->>recentGameCount",
  "source_cutoff_exclusive:payload->>sourceCutoffExclusive",
  "source_through_date:payload->>sourceThroughDate",
  "source_fingerprint:payload->>sourceFingerprint",
  "warnings:payload->warnings",
  "missing_components:payload->missingComponents",
  "missing_metrics:payload->missingMetrics",
  "unavailable_league_metrics:payload->unavailableLeagueMetrics",
  "component_coverage:payload->componentCoverage",
  "pdo_context:payload->pdoContext",
].join(",");

export type RecentTeamFormBetaRow = {
  date: string;
  team: string;
  ctpi_version: number | null;
  ctpi_0_to_100: number | null;
  offense: number | null;
  defense: number | null;
  goaltending: number | null;
  special_teams: number | null;
  computed_at: string | null;
  publication_status: string | null;
  formula_version: string | null;
  input_version: string | null;
  status: string | null;
  source_game_count: string | null;
  recent_game_count: string | null;
  source_cutoff_exclusive: string | null;
  source_through_date: string | null;
  source_fingerprint: string | null;
  warnings: unknown;
  missing_components: unknown;
  missing_metrics: unknown;
  unavailable_league_metrics: unknown;
  component_coverage: unknown;
  pdo_context: unknown;
};

export type RecentTeamFormGameRow = {
  date: string;
  gp: number | null;
  gf: number | null;
  ga: number | null;
  sf: number | null;
  sa: number | null;
};

export type RecentTeamFormBetaComponent = {
  key: RecentTeamFormComponentKey;
  label: string;
  inputs: string;
  /** League-relative SD units; null is Unknown, never 0. */
  value: number | null;
  reason: string | null;
};

export type RecentTeamFormBetaDebug = {
  fingerprint: string | null;
  warnings: string[];
  computedAt: string | null;
  coverage: Partial<Record<RecentTeamFormComponentKey, number>>;
  publicationStatus: string | null;
  sourceThroughDate: string | null;
  pdoContext: unknown;
};

export type RecentTeamFormBetaModel =
  | {
      kind: "notEnoughGames";
      gamesPlayed: number;
      minimumGames: number;
    }
  | { kind: "unavailable"; debug: RecentTeamFormBetaDebug | null }
  | {
      kind: "score";
      score: number;
      status: "ready" | "partial";
      snapshotDate: string;
      /** The score's newest game (payload sourceThroughDate). */
      sourceThroughDate: string | null;
      recentGameCount: number;
      targetGames: number;
      /**
       * The score's own game dates, oldest to newest; empty unless they are
       * confirmed against the issued row (newest date and game counts).
       */
      windowDates: string[];
      /**
       * True only when every 5-on-5 date equals a score game date. Games are
       * keyed by team + date (there are no game ids), so equal counts alone
       * are not identity (Astra #435 P2).
       */
      sameGames: boolean;
      components: RecentTeamFormBetaComponent[];
      partialNotes: string[];
      puckLuck: {
        games: number;
        /** The 5-on-5 sample's own dates, oldest to newest. */
        dates: string[];
        pdo: number | null;
        shootingPct: number | null;
        savePct: number | null;
      };
      debug: RecentTeamFormBetaDebug;
    };

const COMPONENTS: Array<{
  key: RecentTeamFormComponentKey;
  column: "offense" | "defense" | "goaltending" | "special_teams";
  label: string;
  inputs: string;
  metrics: RecentTeamFormMetricKey[];
  missingReason: string;
}> = [
  {
    key: "offense",
    column: "offense",
    label: "Offense",
    inputs: "xGF/60, high-danger chances for, GF/60",
    metrics: ["xgf_per_60", "hdcf_per_60", "gf_per_60"],
    missingReason: "Shot and goal data missing for these games",
  },
  {
    key: "defense",
    column: "defense",
    label: "Defense",
    inputs: "xGA/60, high-danger chances against, CA/60",
    metrics: ["xga_per_60", "hdca_per_60", "ca_per_60"],
    missingReason: "Shot-against data missing for these games",
  },
  {
    key: "goaltending",
    column: "goaltending",
    label: "Goaltending",
    inputs: "goals saved above expected per 60",
    metrics: ["gsax_per_60_season", "gsax_per_60_last10"],
    missingReason: "Expected goals against missing for these games",
  },
  {
    key: "specialTeams",
    column: "special_teams",
    label: "Special teams",
    inputs: "PP xGF/60 and PK xGA/60, pooled by ice time",
    metrics: ["pp_xgf_per_60", "pk_xga_per_60"],
    missingReason: "Power-play or penalty-kill ice time missing for these games",
  },
];

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const countOrNull = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function coverageOf(
  value: unknown,
): Partial<Record<RecentTeamFormComponentKey, number>> {
  if (!value || typeof value !== "object") return {};
  const coverage: Partial<Record<RecentTeamFormComponentKey, number>> = {};
  COMPONENTS.forEach(({ key }) => {
    const entry = finiteOrNull((value as Record<string, unknown>)[key]);
    if (entry !== null) coverage[key] = entry;
  });
  return coverage;
}

function debugOf(row: RecentTeamFormBetaRow): RecentTeamFormBetaDebug {
  return {
    fingerprint: row.source_fingerprint,
    warnings: stringList(row.warnings),
    computedAt: row.computed_at,
    coverage: coverageOf(row.component_coverage),
    publicationStatus: row.publication_status,
    sourceThroughDate: row.source_through_date,
    pdoContext: row.pdo_context,
  };
}

function componentReason(
  metrics: RecentTeamFormMetricKey[],
  missingMetrics: string[],
  leagueMetrics: string[],
  missingReason: string,
): string {
  if (metrics.some((metric) => missingMetrics.includes(metric))) {
    return missingReason;
  }
  if (metrics.some((metric) => leagueMetrics.includes(metric))) {
    return "League comparison unavailable on this date";
  }
  return "Not measured in enough of these games";
}

/** Today's date on the league's calendar (Eastern), as YYYY-MM-DD. */
export function easternDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The score's game dates re-read from the writer's source table
 * (`nst_team_gamelogs_as_rates`, gp = 1, before the snapshot, newest first)
 * with the exact count of the team's season games before the snapshot.
 */
export type RecentTeamFormScoreGames = {
  dates: readonly string[];
  seasonGameCount: number | null;
};

/**
 * Builds the card from one issued row, the team's 5-on-5 game rows dated
 * before its snapshot (newest first) and the score's own games.
 * `fallbackGames` is the team's game count when no usable row exists.
 */
export function buildRecentTeamFormBetaModel(
  row: RecentTeamFormBetaRow | null,
  gameRows: readonly RecentTeamFormGameRow[],
  scoreGames: RecentTeamFormScoreGames | null = null,
  fallbackGames = 0,
): RecentTeamFormBetaModel {
  const notEnough = (gamesPlayed: number): RecentTeamFormBetaModel => ({
    kind: "notEnoughGames",
    gamesPlayed,
    minimumGames: RECENT_TEAM_FORM_V2_MIN_GAMES,
  });
  if (!row) {
    return fallbackGames < RECENT_TEAM_FORM_V2_MIN_GAMES
      ? notEnough(fallbackGames)
      : { kind: "unavailable", debug: null };
  }

  const recentGameCount = countOrNull(row.recent_game_count);
  if (recentGameCount !== null && recentGameCount < RECENT_TEAM_FORM_V2_MIN_GAMES) {
    return notEnough(recentGameCount);
  }
  const score = finiteOrNull(row.ctpi_0_to_100);
  const status = row.status;
  if (
    !isDescriptiveBetaCtpiPayload({
      ctpiVersion: row.ctpi_version,
      publicationStatus: row.publication_status,
      formulaVersion: row.formula_version,
      inputVersion: row.input_version,
      sourceGameCount: row.source_game_count,
      status,
    }) ||
    recentGameCount === null ||
    score === null ||
    (status !== "ready" && status !== "partial")
  ) {
    return { kind: "unavailable", debug: debugOf(row) };
  }

  const missingComponents = stringList(row.missing_components);
  const missingMetrics = stringList(row.missing_metrics);
  const leagueMetrics = stringList(row.unavailable_league_metrics);
  const components = COMPONENTS.map((definition) => {
    const value = finiteOrNull(row[definition.column]);
    return {
      key: definition.key,
      label: definition.label,
      inputs: definition.inputs,
      value,
      reason:
        value === null
          ? componentReason(
              definition.metrics,
              missingMetrics,
              leagueMetrics,
              definition.missingReason,
            )
          : null,
    };
  });

  // The score's dates count only when they reproduce the issued row: same
  // last game, same window size and same season game count (rows added
  // after the score was written would change the count).
  const scoreDates = (scoreGames?.dates ?? []).slice(0, recentGameCount).reverse();
  const scoreDatesConfirmed =
    scoreDates.length === recentGameCount &&
    row.source_through_date !== null &&
    scoreDates[scoreDates.length - 1] === row.source_through_date &&
    scoreGames?.seasonGameCount != null &&
    scoreGames.seasonGameCount === countOrNull(row.source_game_count);
  const windowDates = scoreDatesConfirmed ? scoreDates : [];

  const windowRows = gameRows.slice(0, recentGameCount);
  const puckDates = windowRows.map((game) => game.date).reverse();
  const puckLuck = aggregateNstTeamCounts(windowRows);
  const sameGames =
    scoreDatesConfirmed &&
    puckDates.length === scoreDates.length &&
    puckDates.every((date, index) => date === scoreDates[index]);

  const partialNotes: string[] = [];
  if (status === "partial") {
    const unknown = components.filter(
      (component) =>
        component.value === null || missingComponents.includes(component.key),
    );
    if (unknown.length > 0) {
      partialNotes.push(
        `Partial: ${unknown
          .map((component) => component.label.toLowerCase())
          .join(", ")} unavailable`,
      );
    } else if (recentGameCount < RECENT_TEAM_FORM_V2_TARGET_GAMES) {
      partialNotes.push(
        `Partial: ${recentGameCount} of ${RECENT_TEAM_FORM_V2_TARGET_GAMES} games so far`,
      );
    } else {
      partialNotes.push("Partial: some inputs are missing for these games");
    }
  }

  return {
    kind: "score",
    score,
    status,
    snapshotDate: row.date,
    sourceThroughDate: row.source_through_date,
    recentGameCount,
    targetGames: RECENT_TEAM_FORM_V2_TARGET_GAMES,
    windowDates,
    sameGames,
    components,
    partialNotes,
    puckLuck: {
      games: windowRows.length,
      dates: puckDates,
      pdo: puckLuck.pdo,
      shootingPct: puckLuck.shootingPct,
      savePct: puckLuck.savePct,
    },
    debug: debugOf(row),
  };
}

type HookState =
  | { state: "loading" }
  | { state: "error" }
  | { state: "loaded"; model: RecentTeamFormBetaModel };

const GAME_ROW_SELECT = "date,gp,gf,ga,sf,sa";

async function fetchGameRows(
  teamAbbrev: string,
  seasonStart: string,
  beforeDate: string,
  limit: number,
): Promise<RecentTeamFormGameRow[]> {
  const { data, error } = await supabase
    .from("nst_team_5v5")
    .select(GAME_ROW_SELECT)
    .eq("team_abbreviation", teamAbbrev)
    .gte("date", seasonStart)
    .lt("date", beforeDate)
    // Same game filter as the last-10 metrics: known zero-game rows excluded.
    .or("gp.neq.0,gp.is.null")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as RecentTeamFormGameRow[];
}

/**
 * The score's own games: the writer reads `nst_team_gamelogs_as_rates`
 * (season, gp = 1) and scores date D from games strictly before D. A read
 * error leaves the dates unconfirmed instead of failing the card.
 */
async function fetchScoreGames(
  teamAbbrev: string,
  seasonId: number,
  beforeDate: string,
  limit: number,
): Promise<RecentTeamFormScoreGames | null> {
  const { data, error, count } = await supabase
    .from("nst_team_gamelogs_as_rates")
    .select("date", { count: "exact" })
    .eq("team_abbreviation", teamAbbrev)
    .eq("season_id", seasonId)
    .eq("gp", 1)
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Error fetching Recent Team Form score games:", error);
    return null;
  }
  return {
    dates: ((data ?? []) as Array<{ date: string }>).map((game) => game.date),
    seasonGameCount: typeof count === "number" ? count : null,
  };
}

/**
 * Reads the latest issued v2 row for the team and season (date ≤ today), the
 * score's own game dates, and the team's 5-on-5 rows before the snapshot.
 * Client-side anon reads only (`public_read` RLS on all three tables); no API
 * route.
 */
export function useRecentTeamFormBeta(
  teamAbbrev: string,
  seasonId: string | number | null | undefined,
  regularSeasonStartDate?: string | null,
  regularSeasonEndDate?: string | null,
): HookState {
  const [result, setResult] = useState<HookState>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    const window = seasonDateWindow(
      seasonId,
      regularSeasonStartDate && regularSeasonEndDate
        ? { startDate: regularSeasonStartDate, endDate: regularSeasonEndDate }
        : null,
    );
    if (!teamAbbrev || !window) {
      setResult({ state: "loaded", model: { kind: "unavailable", debug: null } });
      return;
    }
    setResult({ state: "loading" });

    (async () => {
      const today = easternDateKey();
      const { data, error } = await supabase
        .from("team_ctpi_daily")
        .select(RECENT_TEAM_FORM_BETA_SELECT)
        .eq("team", teamAbbrev)
        .eq("season_id", Number(seasonId))
        .eq("ctpi_version" as never, BETA_VERSION as never)
        .eq(
          "payload->>formulaVersion",
          CTPI_VERSION_CONTRACTS[BETA_VERSION].formulaVersion,
        )
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = ((data ?? []) as unknown as RecentTeamFormBetaRow[])[0] ?? null;
      const recentGameCount = row ? countOrNull(row.recent_game_count) : null;

      let model: RecentTeamFormBetaModel;
      if (row && recentGameCount !== null && recentGameCount > 0) {
        const [games, scoreGames] = await Promise.all([
          fetchGameRows(teamAbbrev, window.start, row.date, recentGameCount),
          fetchScoreGames(teamAbbrev, Number(seasonId), row.date, recentGameCount),
        ]);
        model = buildRecentTeamFormBetaModel(row, games, scoreGames);
      } else if (row) {
        model = buildRecentTeamFormBetaModel(row, []);
      } else {
        // No issued row: count the team's games so far to tell "too early"
        // from "not available for this season".
        const games = await fetchGameRows(
          teamAbbrev,
          window.start,
          today,
          RECENT_TEAM_FORM_V2_MIN_GAMES,
        );
        model = buildRecentTeamFormBetaModel(null, [], null, games.length);
      }
      if (!cancelled) setResult({ state: "loaded", model });
    })().catch((error: unknown) => {
      console.error("Error fetching Recent Team Form beta:", error);
      if (!cancelled) setResult({ state: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [teamAbbrev, seasonId, regularSeasonStartDate, regularSeasonEndDate]);

  return result;
}

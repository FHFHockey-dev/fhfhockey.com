import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  evaluateForgeCalibrationEligibility,
  FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
} from "lib/projections/calibrationEligibility";
import {
  SKATER_BASELINE_MODEL_VERSION,
  SKATER_CANDIDATE_MODEL_VERSION,
  SKATER_ROLLOUT_GOVERNANCE,
} from "lib/projections/skaterRollout";
import type { Database, Json } from "lib/supabase/database-generated.types";

const PAGE_SIZE = 1000;
const RUN_SAFETY_LIMIT = 1000;

type ForgeRunRow = Pick<
  Database["public"]["Tables"]["forge_runs"]["Row"],
  "run_id" | "as_of_date" | "created_at" | "status" | "metrics"
>;
type ProjectionRow = Pick<
  Database["public"]["Tables"]["forge_player_projections"]["Row"],
  "run_id" | "as_of_date" | "game_id" | "player_id"
>;
type ResultRow = Pick<
  Database["public"]["Tables"]["forge_projection_results"]["Row"],
  "source_run_id" | "actual_date" | "player_type"
>;
type GameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  "id" | "date"
>;

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

function asRecord(value: Json | unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRollout(metrics: Json): {
  modelVersion: string | null;
  mode: string | null;
} {
  const rollout = asRecord(asRecord(metrics)?.skater_rollout);
  return {
    modelVersion:
      typeof rollout?.modelVersion === "string" ? rollout.modelVersion : null,
    mode: typeof rollout?.mode === "string" ? rollout.mode : null,
  };
}

function latestSucceededPerDate(rows: ForgeRunRow[]): ForgeRunRow[] {
  const latest = new Map<string, ForgeRunRow>();
  for (const row of rows) {
    const current = latest.get(row.as_of_date);
    if (
      !current ||
      row.created_at > current.created_at ||
      (row.created_at === current.created_at && row.run_id < current.run_id)
    ) {
      latest.set(row.as_of_date, row);
    }
  }
  return [...latest.values()].sort(
    (left, right) =>
      left.as_of_date.localeCompare(right.as_of_date) ||
      left.run_id.localeCompare(right.run_id),
  );
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }
  return chunks;
}

async function fetchPaged<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message?: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "Supabase read failed.");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countsObject(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function main(): Promise<void> {
  loadEnv();
  const client = createSupabaseClient();

  const { data: runData, error: runError } = await client
    .from("forge_runs")
    .select("run_id,as_of_date,created_at,status,metrics")
    .eq("status", "succeeded")
    .order("as_of_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(RUN_SAFETY_LIMIT);
  if (runError) throw runError;
  const succeededRuns = (runData ?? []) as ForgeRunRow[];
  if (succeededRuns.length === RUN_SAFETY_LIMIT) {
    throw new Error(
      `Succeeded-run audit reached its ${RUN_SAFETY_LIMIT}-row safety limit.`,
    );
  }

  const latestRuns = latestSucceededPerDate(succeededRuns);
  const allEligibleRuns = succeededRuns.filter(
    (run) => evaluateForgeCalibrationEligibility(run.metrics).eligible,
  );
  const eligibleRuns = latestRuns.filter(
    (run) => evaluateForgeCalibrationEligibility(run.metrics).eligible,
  );
  const eligibleRunIds = eligibleRuns.map((run) => run.run_id);
  const eligibleDates = eligibleRuns.map((run) => run.as_of_date);

  const projections: ProjectionRow[] = [];
  const results: ResultRow[] = [];
  for (const runIds of chunk(eligibleRunIds, 40)) {
    projections.push(
      ...(await fetchPaged<ProjectionRow>((from, to) =>
        client
          .from("forge_player_projections")
          .select("run_id,as_of_date,game_id,player_id")
          .in("run_id", runIds)
          .eq("horizon_games", 1)
          .order("run_id", { ascending: true })
          .order("game_id", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to),
      )),
    );
    results.push(
      ...(await fetchPaged<ResultRow>((from, to) =>
        client
          .from("forge_projection_results")
          .select("source_run_id,actual_date,player_type")
          .in("source_run_id", runIds)
          .order("source_run_id", { ascending: true })
          .order("actual_date", { ascending: true })
          .range(from, to),
      )),
    );
  }

  const games: GameRow[] = [];
  for (const dates of chunk(eligibleDates, 80)) {
    const { data, error } = await client
      .from("games")
      .select("id,date")
      .in("date", dates)
      .order("date", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    games.push(...((data ?? []) as GameRow[]));
  }

  const projectionsByDate = new Map<string, number>();
  const projectionGamesByDate = new Map<string, Set<number>>();
  for (const row of projections) {
    increment(projectionsByDate, row.as_of_date);
    const gameIds = projectionGamesByDate.get(row.as_of_date) ?? new Set();
    gameIds.add(row.game_id);
    projectionGamesByDate.set(row.as_of_date, gameIds);
  }
  const scheduledGamesByDate = new Map<string, number>();
  for (const game of games) increment(scheduledGamesByDate, game.date);
  const resultsByDate = new Map<string, number>();
  for (const row of results) increment(resultsByDate, row.actual_date);

  const matchedDates = eligibleDates.filter(
    (date) =>
      (scheduledGamesByDate.get(date) ?? 0) > 0 &&
      (projectionsByDate.get(date) ?? 0) > 0,
  );
  const rolloutVersions = new Map<string, number>();
  const rolloutModes = new Map<string, number>();
  for (const run of eligibleRuns) {
    const rollout = readRollout(run.metrics);
    increment(rolloutVersions, rollout.modelVersion ?? "unversioned");
    increment(rolloutModes, rollout.mode ?? "unversioned");
  }

  const { data: yahooGameData, error: yahooGameError } = await client
    .from("yahoo_game_keys")
    .select("season,leagues")
    .order("season", { ascending: true })
    .limit(100);
  if (yahooGameError) throw yahooGameError;
  const yahooGameRows = yahooGameData ?? [];
  if (yahooGameRows.length === 100) {
    throw new Error(
      "Yahoo game-metadata audit reached its 100-row safety limit.",
    );
  }
  const globalLeagueIdentities = yahooGameRows.reduce((count, row) => {
    const leagues = Array.isArray(row.leagues) ? row.leagues : [];
    return count + leagues.length;
  }, 0);

  const { data: externalLeagueData, error: externalLeagueError } = await client
    .from("external_leagues")
    .select("provider,season_key")
    .eq("provider", "yahoo")
    .order("season_key", { ascending: true })
    .limit(100);
  if (externalLeagueError) throw externalLeagueError;
  const externalLeagueRows = externalLeagueData ?? [];
  if (externalLeagueRows.length === 100) {
    throw new Error(
      "Yahoo connected-league audit reached its 100-row safety limit.",
    );
  }
  const externalLeagueSeasons = [
    ...new Set(
      externalLeagueRows
        .map((row) => row.season_key)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();

  const blockers = [
    matchedDates.length < SKATER_ROLLOUT_GOVERNANCE.shadowMinimumDays
      ? `Only ${matchedDates.length} of ${SKATER_ROLLOUT_GOVERNANCE.shadowMinimumDays} required matched holdout dates are available.`
      : null,
    !rolloutVersions.has(SKATER_CANDIDATE_MODEL_VERSION)
      ? `No latest eligible run uses candidate ${SKATER_CANDIDATE_MODEL_VERSION}.`
      : null,
    !rolloutVersions.has(SKATER_BASELINE_MODEL_VERSION)
      ? `No latest eligible run uses baseline ${SKATER_BASELINE_MODEL_VERSION}.`
      : null,
    results.length === 0
      ? "No eligible projection-result rows are available for evaluation."
      : null,
  ].filter((value): value is string => value != null);

  console.log(
    JSON.stringify(
      {
        audit: "start-chart-release-gates",
        executedAt: new Date().toISOString(),
        persistenceApplied: false,
        requiredRollingHistoryContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
        forge: {
          succeededRuns: succeededRuns.length,
          latestSucceededDates: latestRuns.length,
          latestSucceededRange:
            latestRuns.length > 0
              ? [latestRuns[0].as_of_date, latestRuns.at(-1)?.as_of_date]
              : null,
          eligibleSucceededRuns: allEligibleRuns.length,
          eligibleLatestRuns: eligibleRuns.length,
          eligibleDateRange:
            eligibleDates.length > 0
              ? [eligibleDates[0], eligibleDates.at(-1)]
              : null,
          rolloutVersions: countsObject(rolloutVersions),
          rolloutModes: countsObject(rolloutModes),
          horizonOneProjectionRows: projections.length,
          scheduledGamesOnEligibleDates: games.length,
          eligibleProjectionResultRows: results.length,
          matchedHoldoutDates: matchedDates.length,
          matchedHoldoutDateValues: matchedDates,
          projectionsByDate: countsObject(projectionsByDate),
          projectionGamesByDate: Object.fromEntries(
            [...projectionGamesByDate.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, gameIds]) => [date, gameIds.size]),
          ),
          scheduledGamesByDate: countsObject(scheduledGamesByDate),
          resultsByDate: countsObject(resultsByDate),
          gateRunnable: blockers.length === 0,
          blockers,
        },
        yahoo: {
          gameMetadataRows: yahooGameRows.length,
          gameMetadataSeasonRange:
            yahooGameRows.length > 0
              ? [yahooGameRows[0].season, yahooGameRows.at(-1)?.season]
              : null,
          globalLeagueIdentities,
          connectedLeagueRows: externalLeagueRows.length,
          connectedLeagueSeasons: externalLeagueSeasons,
          providerEquivalenceRunnable:
            globalLeagueIdentities > 0 && externalLeagueRows.length > 0,
          blocker:
            globalLeagueIdentities === 0
              ? "Canonical Yahoo game metadata has no league identity to compare with connected leagues."
              : null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";
import type { RollingPlayerGameMetricRow, SkaterWindowStrengthState } from "./skaterWindowAggregation";
import { ROLLING_RANKING_SELECT_FIELDS } from "./rollingRankingSelectFields";
import {
  attachWindowCountSupport,
  WINDOW_COUNT_SUPPORT_SELECT,
  WINDOW_COUNT_SUPPORT_TABLE,
  type WindowCountSupportRow,
} from "./rollingWindowCountSupportReader";

const PAGE_SIZE = 1000;
const MAX_SOURCE_ROWS = 60_000;
const MAX_ROLLING_QUERIES = 40;
// Leave room for the wide select list within common 8 KiB request-URI limits.
const PLAYER_CHUNK_SIZE = 50;
const CHECK_TIMEOUT_MS = 60_000;

export type CompositeSourceCoverage = {
  verified: boolean;
  cutoffDate: string;
  expectedPlayerCount: number;
  scannedSourceRows: number;
  staleOrMissingPlayerIds: number[];
  blockers: string[];
};

// A new composite updated_at does not establish that every player was recomputed.
// Match each player's latest observed regular-season appearance, including players
// omitted entirely from the runtime ranking population. This validates WGO ->
// rolling coverage, not WGO completeness against official NHL participation.
type SourceCoverageRequest = {
  season: number;
  strength: SkaterWindowStrengthState;
  cutoffDate: string;
  usedSnapshots?: Map<number, { date: string | null; updatedAt: string | null }>;
  requireCompletePopulation?: boolean;
};

async function loadAndCheckSourceCoverage(
  client: SupabaseClient<Database>,
  args: SourceCoverageRequest,
  includeSourceValues: boolean,
): Promise<{ report: CompositeSourceCoverage; rows: RollingPlayerGameMetricRow[] }> {
  const report: CompositeSourceCoverage = {
    verified: false,
    cutoffDate: args.cutoffDate,
    expectedPlayerCount: 0,
    scannedSourceRows: 0,
    staleOrMissingPlayerIds: [],
    blockers: [],
  };
  const sourceRows: RollingPlayerGameMetricRow[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const latestDateByPlayer = new Map<number, string>();
  const seenAppearances = new Set<string>();
  const seasonStart = Math.floor(args.season / 10000);
  try {
    for (let from = 0; from < MAX_SOURCE_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client.from("wgo_skater_stats")
        .select("player_id,date,game_id")
        .eq("season_id", args.season)
        .eq("games_played", 1)
        .gte("date", `${seasonStart}-09-01`)
        .lte("date", args.cutoffDate)
        .order("date", { ascending: false })
        .order("game_id", { ascending: true })
        .order("player_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
        .abortSignal(controller.signal);
      if (error) throw new Error(`WGO coverage read failed: ${error.message}`);
      const page = data ?? [];
      report.scannedSourceRows += page.length;
      for (const row of page) {
        if (!Number.isInteger(row.player_id) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? "") ||
            !Number.isInteger(row.game_id) || Math.floor(row.game_id! / 1_000_000) !== seasonStart) {
          throw new Error("WGO appearance has missing or invalid player/date/game identity");
        }
        // Exclude preseason and playoffs explicitly; season_id alone is insufficient.
        if (Math.floor(row.game_id! / 10_000) % 100 !== 2) continue;
        const key = `${row.player_id}:${row.game_id}`;
        if (seenAppearances.has(key)) throw new Error("Duplicate WGO player/game appearance");
        seenAppearances.add(key);
        if (!latestDateByPlayer.has(row.player_id)) latestDateByPlayer.set(row.player_id, row.date);
      }
      if (page.length < PAGE_SIZE) break;
      if (from + PAGE_SIZE === MAX_SOURCE_ROWS) throw new Error("WGO coverage row budget reached; completeness unverified");
    }
    report.expectedPlayerCount = latestDateByPlayer.size;
    if (!latestDateByPlayer.size) throw new Error("No verified regular-season WGO appearances for the cutoff");
    if (args.usedSnapshots) {
      for (const playerId of args.usedSnapshots.keys()) {
        if (!latestDateByPlayer.has(playerId)) {
          report.blockers.push(`Ranked player ${playerId} has no matching regular-season WGO appearance`);
        }
      }
      if (args.requireCompletePopulation) {
        const omitted = [...latestDateByPlayer.keys()].filter((id) => !args.usedSnapshots!.has(id));
        if (omitted.length) report.blockers.push(`${omitted.length} observed players are absent from the complete ranking cohort`);
      }
    }
    const identities = [...latestDateByPlayer].map(([playerId, date]) => ({ playerId, date }));
    for (let from = 0; from < identities.length; from += PLAYER_CHUNK_SIZE) {
      if (from / PLAYER_CHUNK_SIZE >= MAX_ROLLING_QUERIES) throw new Error("Rolling coverage query budget reached; completeness unverified");
      const chunk = identities.slice(from, from + PLAYER_CHUNK_SIZE);
      // Exact pairs avoid fetching full wide history or issuing a request for
      // every distinct last-played date. Values were validated above.
      const identityFilter = chunk.map(({ playerId, date }) =>
        `and(player_id.eq.${playerId},game_date.eq.${date})`,
      ).join(",");
      const { data, error } = await client.from("rolling_player_game_metrics")
        .select(includeSourceValues ? ROLLING_RANKING_SELECT_FIELDS.join(",") : "player_id,game_date,updated_at")
        .eq("season", args.season)
        .eq("strength_state", args.strength)
        .or(identityFilter)
        .order("player_id", { ascending: true })
        .order("game_date", { ascending: true })
        .limit(chunk.length + 1)
        .abortSignal(controller.signal);
      if (error) throw new Error(`Rolling coverage read failed: ${error.message}`);
      const rows = (data ?? []) as unknown as RollingPlayerGameMetricRow[];
      const covered = new Map(rows.map((row) => [`${row.player_id}:${row.game_date}`, row]));
      if (covered.size !== rows.length) throw new Error("Duplicate rolling player/date/strength identity");
      const requestedKeys = new Set(chunk.map(({ playerId, date }) => `${playerId}:${date}`));
      if ([...covered.keys()].some((key) => !requestedKeys.has(key))) throw new Error("Rolling read returned an unrequested player/date identity");
      if (includeSourceValues && rows.length > 0) {
        // L6 window counts for the same identities (W2-P0-11); absent = unknown.
        const support = await client.from(WINDOW_COUNT_SUPPORT_TABLE as "rolling_player_metric_support_payloads")
          .select(WINDOW_COUNT_SUPPORT_SELECT)
          .eq("season", args.season)
          .eq("strength_state", args.strength)
          .or(identityFilter)
          .order("player_id", { ascending: true })
          .order("game_date", { ascending: true })
          .limit(chunk.length + 1)
          .abortSignal(controller.signal);
        if (support.error) throw new Error(`Rolling count-support read failed: ${support.error.message}`);
        sourceRows.push(...attachWindowCountSupport(rows, (support.data ?? []) as unknown as WindowCountSupportRow[]));
      }
      report.staleOrMissingPlayerIds.push(...chunk.filter(({ playerId, date }) => {
        const stored = covered.get(`${playerId}:${date}`);
        if (!stored) return true;
        const storedTime = stored.updated_at ? Date.parse(stored.updated_at) : NaN;
        if (includeSourceValues && !Number.isFinite(storedTime)) return true;
        const used = args.usedSnapshots?.get(playerId);
        if (!used) return false;
        const usedTime = used.updatedAt ? Date.parse(used.updatedAt) : NaN;
        return used.date !== date || !Number.isFinite(usedTime) || !Number.isFinite(storedTime) || used.updatedAt !== stored.updated_at;
      }).map(({ playerId }) => playerId));
    }
    if (report.staleOrMissingPlayerIds.length) {
      report.blockers.push(`${report.staleOrMissingPlayerIds.length} players lack a verified current rolling row matching the exact source snapshot used`);
    }
    report.verified = report.blockers.length === 0;
  } catch (error) {
    report.blockers.push(error instanceof Error ? error.message : "Source coverage check failed");
  } finally {
    clearTimeout(timer);
  }
  return { report, rows: sourceRows };
}

export async function checkSkaterCompositeSourceCoverage(
  client: SupabaseClient<Database>, args: SourceCoverageRequest,
): Promise<CompositeSourceCoverage> {
  return (await loadAndCheckSourceCoverage(client, args, false)).report;
}

export async function loadSkaterCompositeSeasonSources(
  client: SupabaseClient<Database>, args: SourceCoverageRequest,
) {
  return loadAndCheckSourceCoverage(client, args, true);
}

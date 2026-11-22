import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

import {
  buildEntityMetricRankingRows, defaultEntityMetricRankingMetricKeys,
  planEntityMetricRankingPublication, publishEntityMetricRankingRows,
} from "./entityMetricRankingWriter";
import { loadRankingSnapshotMetadata } from "./rankingQueries";
import {
  validateRankingPublicationBuildSources, type RankingPublicationReady,
} from "./publicationReadiness";
import { loadSkaterCompositeSeasonSources } from "./skaterCompositeSourceCoverage";
import { buildSkaterCompositeRatingRows, publishSkaterCompositeRatingRows } from "./skaterCompositeWriter";

export async function prepareDailyRankingPair(
  client: SupabaseClient<Database>, season: number, readiness: RankingPublicationReady,
) {
  const { cutoffDate, expectedPlayerIds } = readiness;
  const expected = new Set(expectedPlayerIds);
  if (!expected.size || expected.size > 1000 || expected.size !== expectedPlayerIds.length) {
    throw new Error("Daily Rankings requires 1 to 1000 distinct eligible skaters.");
  }
  const request = {
    season, asOfDate: cutoffDate, strength: "5v5", position: "all", deployment: "all",
    peerGroupType: "all_skaters", teamId: null, minGp: 1, minToiSeconds: 300,
  } as const;
  const metricKeys = defaultEntityMetricRankingMetricKeys(request);
  const expectedRankingRows = 4 * metricKeys.length * expected.size;
  if (expectedRankingRows > 68_000) throw new Error("Daily Rankings exceeds its 68,000-row write bound.");
  const loaded = await loadSkaterCompositeSeasonSources(client, {
    season, strength: request.strength, cutoffDate, includeDailyInputs: true,
  });
  if (!loaded.report.verified || loaded.report.expectedPlayerCount !== expected.size) {
    throw new Error(`Daily Rankings source coverage disagrees with readiness. ${loaded.report.blockers.join(" ")}`);
  }
  validateRankingPublicationBuildSources(readiness, loaded.rows);
  const metadata = await loadRankingSnapshotMetadata(client, loaded.rows);
  if (loaded.rows.some(row => !metadata.playersById.has(row.player_id) ||
    (row.team_id != null && !metadata.teamsById.has(row.team_id)))) {
    throw new Error("Daily Rankings player or team metadata is incomplete.");
  }
  const sources = { ...loaded, metadata };
  const rankings = await buildEntityMetricRankingRows({
    ...request, metricKeys, windows: ["season", "last5", "last10", "last20"],
  }, sources);
  const plan = planEntityMetricRankingPublication(rankings);
  if (!plan.marked || plan.windows.length !== 4 || rankings.rows.length !== expectedRankingRows ||
      plan.windows.some(window => window.snapshotDate !== cutoffDate || window.blockers.length)) {
    throw new Error("Daily Rankings cannot certify four complete default windows at the readiness cutoff.");
  }
  const composites = await buildSkaterCompositeRatingRows({ ...request, window: "season", limit: 1000 }, sources);
  const compositeIds = new Set(composites.rows.map(row => row.player_id));
  if (!composites.publication.ready || composites.snapshotDate !== cutoffDate ||
      composites.rows.length !== expected.size || compositeIds.size !== expected.size ||
      [...compositeIds].some(id => !expected.has(id))) {
    throw new Error(`Daily season composites disagree with the readiness cutoff or cohort. ${composites.publication.blockers.join(" ")}`);
  }
  return { cutoffDate, expectedPlayerCount: expected.size, expectedRankingRows, rankings, composites };
}

export async function publishDailyRankingPair(
  client: SupabaseClient<Database>, prepared: Awaited<ReturnType<typeof prepareDailyRankingPair>>,
) {
  const rankings = await publishEntityMetricRankingRows(client, prepared.rankings, { chunkSize: 100, stopOnFailure: true });
  if (!rankings.complete || rankings.dbWrittenRows !== prepared.expectedRankingRows) {
    throw new Error("Daily Rankings did not confirm all four windows.");
  }
  const composites = await publishSkaterCompositeRatingRows(client, prepared.composites, { stopOnFailure: true });
  if (composites.status !== "complete" || composites.dbWrittenRows !== prepared.expectedPlayerCount) {
    throw new Error(`Daily composite publication incomplete. ${composites.blockers.join(" ")}`);
  }
  return { rankings, composites };
}

// rebuild-score.ts

import { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import adminOnly from "utils/adminOnlyMiddleware";
import { loadPlayersForSnapshot } from "lib/sustainability/windows";
import {
  fetchSkillLeagueRef,
  buildScoreForPlayerWindow,
  upsertScores,
  DEFAULT_WEIGHTS,
} from "lib/sustainability/score";
import { PosGroup } from "lib/sustainability/priors";
import { resolveSeasonId } from "lib/sustainability/resolveSeasonId";
import {
  assertScorePrerequisites,
  isSustainabilityDependencyError,
} from "lib/sustainability/dependencyChecks";
import { countExtremeSustainabilityRows } from "lib/sustainability/observability";
import {
  compareSustainabilityDistributionDrift,
  compareSustainabilityScoreSample
} from "lib/sustainability/observability";
import supabase from "lib/supabase/server";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { detectSustainabilitySourceAdvance } from "lib/sustainability/incremental";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Record<string, unknown>>>,
) {
  const t0 = Date.now();
  const withTiming = (body: Record<string, unknown>, endedAt = Date.now()) =>
    withCronJobTiming(body, t0, endedAt);
  const phaseTimingsMs: Record<string, number> = {};
  let phaseStarted = t0;
  const finishPhase = (phase: string) => {
    const ended = Date.now();
    phaseTimingsMs[phase] = ended - phaseStarted;
    phaseStarted = ended;
  };
  try {
    const season = await resolveSeasonId(req.query.season);
    const snapshot = String(
      req.query.snapshot_date || new Date().toISOString().slice(0, 10),
    );
    const force =
      req.query.force === "1" || req.query.force === "true";
    const sourceAdvance = force
      ? null
      : await detectSustainabilitySourceAdvance(supabase);
    finishPhase("incremental_source");
    if (sourceAdvance && !sourceAdvance.shouldProcess) {
      return res.status(200).json(
        withTiming({
          success: true,
          skipped: true,
          reason: sourceAdvance.reason,
          snapshot_date: snapshot,
          source_advance: sourceAdvance,
          phase_timings_ms: phaseTimingsMs,
        }),
      );
    }
    await assertScorePrerequisites(season, snapshot);
    finishPhase("prerequisites");
    const dry = req.query.dry === "1" || req.query.dry === "true";
    const limit = Number(req.query.limit || 250);
    const offset = Number(req.query.offset || 0);
    const runAll =
      req.query.runAll === "1" ||
      req.query.runAll === "true" ||
      req.query.run_all === "1" ||
      req.query.run_all === "true";

    const { ids, posMap } = await loadPlayersForSnapshot(snapshot);
    finishPhase("load_players");
    const batchOffsets = runAll
      ? Array.from(
          { length: Math.ceil(ids.length / limit) },
          (_, index) => index * limit,
        )
      : [offset];

    // cache league skill refs by pos group
    const refs: Record<PosGroup, any> = {
      F: await fetchSkillLeagueRef(season, "F"),
      D: await fetchSkillLeagueRef(season, "D"),
    } as any;
    finishPhase("league_references");

    const windows = [
      { code: "l3", n: 3 },
      { code: "l5", n: 5 },
      { code: "l10", n: 10 },
      { code: "l20", n: 20 },
    ] as const;

    const rows: any[] = [];
    let totalPlayers = 0;

    for (const batchOffset of batchOffsets) {
      const batch = ids.slice(batchOffset, batchOffset + limit);
      totalPlayers += batch.length;

      for (const pid of batch) {
        const pg = posMap.get(pid as number) as PosGroup | undefined;
        if (!pg) continue;
        for (const w of windows) {
          const { row } = await buildScoreForPlayerWindow(
            season,
            pid,
            snapshot,
            pg,
            w,
            refs[pg],
            DEFAULT_WEIGHTS,
          );
          rows.push(row);
        }
      }
    }
    finishPhase("build_scores");

    const sampleSize = Math.max(0, Math.min(25, Number(req.query.verify_sample ?? 10)));
    const sampledRows = [...rows]
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);
    const sampledPlayerIds = Array.from(
      new Set(sampledRows.map((row) => row.player_id))
    );
    const storedResult = sampledPlayerIds.length
      ? await supabase
          .from("sustainability_scores")
          .select("player_id, snapshot_date, window_code, s_raw, s_100")
          .eq("snapshot_date", snapshot)
          .in("player_id", sampledPlayerIds)
      : { data: [], error: null };
    if (storedResult.error) throw storedResult.error;
    const recomputeVerification = compareSustainabilityScoreSample(
      sampledRows,
      storedResult.data ?? []
    );
    finishPhase("verify_sample");

    const { inserted, chunks } = await upsertScores(rows, dry);
    finishPhase("persist_scores");
    const anomalyCount = countExtremeSustainabilityRows(rows);
    let distributionDrift: Record<string, unknown> | null = null;
    if (runAll && !dry) {
      const start = new Date(`${snapshot}T00:00:00.000Z`);
      start.setUTCDate(start.getUTCDate() - 7);
      const historyRows = await fetchAllSupabasePages<{
        snapshot_date: string;
        s_100: number;
      }>(({ from, to }) =>
        supabase
          .from("sustainability_scores")
          .select("snapshot_date, s_100")
          .gte("snapshot_date", start.toISOString().slice(0, 10))
          .lte("snapshot_date", snapshot)
          .eq("window_code", "l10")
          .order("snapshot_date", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to)
      );
      const byDate = new Map<string, number[]>();
      for (const row of historyRows) {
        const values = byDate.get(row.snapshot_date) ?? [];
        values.push(row.s_100);
        byDate.set(row.snapshot_date, values);
      }
      distributionDrift = compareSustainabilityDistributionDrift(
        byDate.get(snapshot) ?? [],
        [...byDate.entries()]
          .filter(([date]) => date !== snapshot)
          .map(([, values]) => values)
      );
      finishPhase("distribution_drift");
    }
    if (recomputeVerification.alert || distributionDrift?.status === "alert") {
      console.warn("sustainability_observability_alert", {
        snapshot_date: snapshot,
        recompute_verification: recomputeVerification,
        distribution_drift: distributionDrift,
      });
    }
    const duration_s = ((Date.now() - t0) / 1000).toFixed(2);
    console.info("sustainability_rebuild_score", {
      season,
      snapshot_date: snapshot,
      dry,
      processed_players: totalPlayers,
      rows_built: rows.length,
      rows_upserted: inserted,
      anomaly_count: anomalyCount,
      recompute_verification: recomputeVerification,
      distribution_drift: distributionDrift,
      phase_timings_ms: phaseTimingsMs,
    });
    return res.status(200).json(
      withTiming({
        success: true,
        season,
        snapshot_date: snapshot,
        dry,
        force,
        source_advance: sourceAdvance,
        run_all: runAll,
        processed_players: totalPlayers,
        rows_built: rows.length,
        rows_upserted: inserted,
        write_chunks: chunks,
        anomaly_count: anomalyCount,
        recompute_verification: recomputeVerification,
        distribution_drift: distributionDrift,
        phase_timings_ms: phaseTimingsMs,
        batches_processed: batchOffsets.length,
        sample: rows.slice(0, 5),
        duration_s,
      }),
    );
  } catch (e: any) {
    if (isSustainabilityDependencyError(e)) {
      return res.status(e.statusCode).json(
        withTiming({
          success: false,
          message: e.issue.message,
          prerequisite: e.issue,
          dependencyError: {
            kind: "dependency_error",
            source: "unknown",
            classification: "structured_upstream_error",
            message: e.issue.message,
            detail: e.issue.detail,
            htmlLike: false,
          },
        }),
      );
    }
    const dependencyError = normalizeDependencyError(e);
    console.error("rebuild-score error", e?.message || e);
    return res.status(500).json(
      withTiming({
        success: false,
        message: dependencyError.message,
        dependencyError,
      }),
    );
  }
}

export default withCronJobAudit(adminOnly(handler as any));

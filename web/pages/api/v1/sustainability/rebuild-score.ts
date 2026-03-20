// rebuild-score.ts

import { NextApiRequest, NextApiResponse } from "next";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import { loadPlayersForSnapshot } from "lib/sustainability/windows";
import {
  fetchSkillLeagueRef,
  buildScoreForPlayerWindow,
  upsertScores,
  DEFAULT_WEIGHTS
} from "lib/sustainability/score";
import { PosGroup } from "lib/sustainability/priors";
import { resolveSeasonId } from "lib/sustainability/resolveSeasonId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Record<string, unknown>>>
) {
  const t0 = Date.now();
  const withTiming = (body: Record<string, unknown>, endedAt = Date.now()) =>
    withCronJobTiming(body, t0, endedAt);
  try {
    const season = await resolveSeasonId(req.query.season);
    const snapshot = String(
      req.query.snapshot_date || new Date().toISOString().slice(0, 10)
    );
    const dry = req.query.dry === "1" || req.query.dry === "true";
    const limit = Number(req.query.limit || 250);
    const offset = Number(req.query.offset || 0);
    const runAll =
      req.query.runAll === "1" ||
      req.query.runAll === "true" ||
      req.query.run_all === "1" ||
      req.query.run_all === "true";

    const { ids, posMap } = await loadPlayersForSnapshot(snapshot);
    const batchOffsets = runAll
      ? Array.from(
          { length: Math.ceil(ids.length / limit) },
          (_, index) => index * limit
        )
      : [offset];

    // cache league skill refs by pos group
    const refs: Record<PosGroup, any> = {
      F: await fetchSkillLeagueRef(season, "F"),
      D: await fetchSkillLeagueRef(season, "D")
    } as any;

    const windows = [
      { code: "l3", n: 3 },
      { code: "l5", n: 5 },
      { code: "l10", n: 10 },
      { code: "l20", n: 20 }
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
            DEFAULT_WEIGHTS
          );
          rows.push(row);
        }
      }
    }

    const { inserted } = await upsertScores(rows, dry);
    const duration_s = ((Date.now() - t0) / 1000).toFixed(2);
    return res.status(200).json(withTiming({
      success: true,
      season,
      snapshot_date: snapshot,
      dry,
      run_all: runAll,
      processed_players: totalPlayers,
      rows_built: rows.length,
      rows_upserted: inserted,
      batches_processed: batchOffsets.length,
      sample: rows.slice(0, 5),
      duration_s
    }));
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-score error", e?.message || e);
    return res
      .status(500)
      .json(withTiming({
        success: false,
        message: e?.message || String(e)
      }));
  }
}

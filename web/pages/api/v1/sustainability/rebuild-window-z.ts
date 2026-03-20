// web/pages/api/v1/sustainability/rebuild-window-z.ts

import { NextApiRequest, NextApiResponse } from "next";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import {
  rebuildBetaWindowZForSnapshot,
  loadPlayersForSnapshot,
  ensureWindowTable
} from "lib/sustainability/windows";
import { StatCode } from "lib/sustainability/priors";
import { resolveSeasonId } from "lib/sustainability/resolveSeasonId";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Record<string, unknown>>>
) {
  const started = Date.now();
  const withTiming = (body: Record<string, unknown>, endedAt = Date.now()) =>
    withCronJobTiming(body, started, endedAt);
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

    if (!dry) await ensureWindowTable();

    const { ids, posMap } = await loadPlayersForSnapshot(snapshot);
    const windows = [
      { code: "l3", n: 3 },
      { code: "l5", n: 5 },
      { code: "l10", n: 10 },
      { code: "l20", n: 20 }
    ] as const;

    // Optional filter: ?stat=shp or ?stat=ipp, supports comma list
    let statCodes: StatCode[] | undefined;
    if (req.query.stat) {
      const parts = String(req.query.stat)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as StatCode[];
      const allowed: Set<string> = new Set(["shp", "oishp", "ipp", "ppshp"]);
      statCodes = parts.filter((p) => allowed.has(p)) as StatCode[];
      if (!statCodes.length) statCodes = undefined; // fallback to all
    }

    const statList = statCodes || ["shp", "oishp", "ipp", "ppshp"];
    const batchOffsets = runAll
      ? Array.from(
          { length: Math.ceil(ids.length / limit) },
          (_, index) => index * limit
        )
      : [offset];

    let totalCount = 0;
    let totalPlayers = 0;
    let sample: any[] = [];

    for (const batchOffset of batchOffsets) {
      const batch = ids.slice(batchOffset, batchOffset + limit);
      if (!batch.length) {
        continue;
      }

      const { count, sample: batchSample } = await rebuildBetaWindowZForSnapshot(
        season,
        snapshot,
        batch,
        posMap,
        windows as any,
        statList,
        dry
      );

      totalCount += count;
      totalPlayers += batch.length;
      if (!sample.length && batchSample?.length) {
        sample = batchSample;
      }
    }

    const duration_s = ((Date.now() - started) / 1000).toFixed(2);
    return res.status(200).json(withTiming({
      success: true,
      season,
      snapshot_date: snapshot,
      dry,
      run_all: runAll,
      processed_players: totalPlayers,
      rows_upserted_or_built: totalCount,
      batches_processed: batchOffsets.length,
      sample,
      duration_s
    }));
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-window-z error", e?.message || e);
    return res
      .status(500)
      .json(withTiming({
        success: false,
        message: e?.message || String(e)
      }));
  }
}

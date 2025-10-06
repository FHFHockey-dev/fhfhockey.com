import { NextApiRequest, NextApiResponse } from "next";
import { loadPlayersForSnapshot } from "lib/sustainability/windows";
import {
  fetchSkillLeagueRef,
  buildScoreForPlayerWindow,
  upsertScores,
  DEFAULT_WEIGHTS
} from "lib/sustainability/score";
import { PosGroup } from "lib/sustainability/priors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const t0 = Date.now();
  try {
    const season = Number(req.query.season);
    const snapshot = String(
      req.query.snapshot_date || new Date().toISOString().slice(0, 10)
    );
    const dry = req.query.dry === "1" || req.query.dry === "true";
    const limit = Number(req.query.limit || 250);
    const offset = Number(req.query.offset || 0);

    if (!season || Number.isNaN(season)) {
      return res
        .status(400)
        .json({ success: false, message: "Missing or invalid ?season" });
    }

    const { ids, posMap } = await loadPlayersForSnapshot(snapshot);
    const batch = ids.slice(offset, offset + limit);

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

    const { inserted } = await upsertScores(rows, dry);
    const duration_s = ((Date.now() - t0) / 1000).toFixed(2);
    return res.status(200).json({
      success: true,
      season,
      snapshot_date: snapshot,
      dry,
      processed_players: batch.length,
      rows_built: rows.length,
      rows_upserted: inserted,
      sample: rows.slice(0, 5),
      duration_s
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-score error", e?.message || e);
    return res
      .status(500)
      .json({ success: false, message: e?.message || String(e) });
  }
}

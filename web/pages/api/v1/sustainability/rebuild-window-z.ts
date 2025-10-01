// web/pages/api/v1/sustainability/rebuild-window-z.ts

import { NextApiRequest, NextApiResponse } from "next";
import {
  rebuildBetaWindowZForSnapshot,
  loadPlayersForSnapshot,
  ensureWindowTable
} from "lib/sustainability/windows";
import { StatCode } from "lib/sustainability/priors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const started = Date.now();
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

    if (!dry) await ensureWindowTable();

    const { ids, posMap } = await loadPlayersForSnapshot(snapshot);
    const batch = ids.slice(offset, offset + limit);
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

    const { count, sample } = await rebuildBetaWindowZForSnapshot(
      season,
      snapshot,
      batch,
      posMap,
      windows as any,
      statCodes || ["shp", "oishp", "ipp", "ppshp"],
      dry
    );

    const duration_s = ((Date.now() - started) / 1000).toFixed(2);
    return res.status(200).json({
      success: true,
      season,
      snapshot_date: snapshot,
      dry,
      processed_players: batch.length,
      rows_upserted_or_built: count,
      sample,
      duration_s
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-window-z error", e?.message || e);
    return res
      .status(500)
      .json({ success: false, message: e?.message || String(e) });
  }
}

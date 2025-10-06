// rebuild-priors.ts
import { NextApiRequest, NextApiResponse } from "next";
// import supabase from "lib/supabase"; // <- remove
import {
  ensureTables,
  upsertLeaguePriors,
  upsertPlayerPosteriors,
  PosGroup,
  StatCode
} from "lib/sustainability/priors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const started = Date.now();
  try {
    const season = Number(req.query.season);
    if (!season || Number.isNaN(season)) {
      return res
        .status(400)
        .json({ success: false, message: "Missing or invalid ?season" });
    }
    const dry =
      req.query.dry === "1" ||
      req.query.dry === "true" ||
      req.query.dry === "yes";

    const k = {
      shp: Number(req.query.k_shp) || 200,
      oishp: Number(req.query.k_oishp) || 800,
      ipp: Number(req.query.k_ipp) || 60
    };

    if (!dry) await ensureTables(); // (still a no-op unless you hook it up)

    // build priors either in DB (write) or in-memory (dry)
    const posGroups: PosGroup[] = ["F", "D"];
    const priorRows: Array<{
      season_id: number;
      position_group: PosGroup;
      stat_code: StatCode;
      k: number;
      league_mu: number;
      alpha0: number;
      beta0: number;
    }> = [];

    for (const pg of posGroups) {
      const rows = await upsertLeaguePriors(season, pg, k, { dry });
      priorRows.push(...rows);
    }

    // create a map for dry mode so we don’t need to read from DB
    const dryPriorMap = dry
      ? new Map(
          priorRows.map((r) => [
            `${r.position_group}|${r.stat_code}`,
            { alpha0: r.alpha0, beta0: r.beta0 }
          ])
        )
      : undefined;

    const { inserted, sample } = await upsertPlayerPosteriors(
      season,
      k,
      dry,
      dryPriorMap
    );

    const duration_s = ((Date.now() - started) / 1000).toFixed(2);
    return res
      .status(200)
      .json({
        success: true,
        season,
        dry,
        k,
        inserted_player_rows: inserted,
        sample,
        duration_s
      });
  } catch (error: any) {
    console.error("rebuild-priors error", error?.message || error);
    return res
      .status(500)
      .json({ success: false, message: error?.message || String(error) });
  }
}

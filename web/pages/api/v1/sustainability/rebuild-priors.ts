import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import {
  ensureTables,
  upsertLeaguePriors,
  upsertPlayerPosteriors,
  PosGroup
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

    // exposures k
    const k = {
      shp: Number(req.query.k_shp) || 200,
      oishp: Number(req.query.k_oishp) || 800,
      ipp: Number(req.query.k_ipp) || 60
    };

    if (!dry) {
      await ensureTables();
    }

    const posGroups: PosGroup[] = ["F", "D"];
    for (const pg of posGroups) {
      await upsertLeaguePriors(season, pg, k);
    }

    const { inserted, sample } = await upsertPlayerPosteriors(
      season,
      k,
      dry
    );

    const duration_s = ((Date.now() - started) / 1000).toFixed(2);

    return res.status(200).json({
      success: true,
      season,
      dry,
      k,
      inserted_player_rows: inserted,
      sample,
      duration_s
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("rebuild-priors error", error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || String(error)
    });
  }
}

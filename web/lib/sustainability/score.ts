import supabase from "lib/supabase";
import { PosGroup } from "lib/sustainability/priors";
import { WindowCode } from "lib/sustainability/windows";

const EPS = 1e-9;

// Skill stabilizer codes
export type SkillCode = "ixg60" | "icf60" | "hdcf60";

// League references (mu, sigma) for each stabilizer stat per season x position group
export async function fetchSkillLeagueRef(season_id: number, pg: PosGroup) {
  const { data, error } = await (supabase as any)
    .from("player_totals_unified")
    .select(
      "position_code, nst_ixg_per_60, nst_icf_per_60, nst_hdcf_per_60, season_id"
    )
    .eq("season_id", season_id)
    .in("position_code", pg === "F" ? ["C", "LW", "RW"] : ["D"]);
  if (error) throw error;
  const vals = { ixg60: [] as number[], icf60: [] as number[], hdcf60: [] as number[] };
  for (const r of data ?? []) {
    vals.ixg60.push(Number(r.nst_ixg_per_60) || 0);
    vals.icf60.push(Number(r.nst_icf_per_60) || 0);
    vals.hdcf60.push(Number(r.nst_hdcf_per_60) || 0);
  }
  function muSig(arr: number[]) {
    if (!arr.length) return { mu: 0, sig: 1 };
    const mu = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(arr.length - 1, 1);
    return { mu, sig: Math.max(Math.sqrt(v), 1e-6) };
  }
  return {
    ixg60: muSig(vals.ixg60),
    icf60: muSig(vals.icf60),
    hdcf60: muSig(vals.hdcf60)
  };
}

// Window rates from game logs (sum counts / sum TOI -> per60)
export async function fetchSkillWindowRates(
  player_id: number,
  snapshot_date: string,
  nGames: number
): Promise<{ ixg60: number; icf60: number; hdcf60: number }> {
  const { data, error } = await (supabase as any)
    .from("player_stats_unified")
    .select("nst_ixg, nst_icf, nst_hdcf, nst_toi")
    .eq("player_id", player_id)
    .lte("date", snapshot_date)
    .order("date", { ascending: false })
    .limit(nGames);
  if (error) throw error;
  let ixg = 0,
    icf = 0,
    hdcf = 0,
    toi = 0;
  for (const r of data ?? []) {
    ixg += Number(r.nst_ixg) || 0;
    icf += Number(r.nst_icf) || 0;
    hdcf += Number(r.nst_hdcf) || 0;
    toi += Number(r.nst_toi) || 0;
  }
  const denom = Math.max(toi, EPS);
  return {
    ixg60: (3600 * ixg) / denom,
    icf60: (3600 * icf) / denom,
    hdcf60: (3600 * hdcf) / denom
  };
}

function zClip(x: number, mu: number, sig: number, clip = 3) {
  const z = (x - mu) / Math.max(sig, 1e-6);
  return Math.max(-clip, Math.min(clip, z));
}

export type WeightConfig = {
  luck: { shp: number; oishp: number; ipp: number; ppshp: number };
  skill: { ixg60: number; icf60: number; hdcf60: number };
};

export const DEFAULT_WEIGHTS: WeightConfig = {
  luck: { shp: -1.2, oishp: -1.0, ipp: -0.8, ppshp: -0.4 },
  skill: { ixg60: 0.9, icf60: 0.7, hdcf60: 0.6 }
};

export function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

// Build the sustainability score for a single player + window
export async function buildScoreForPlayerWindow(
  season_id: number,
  player_id: number,
  snapshot_date: string,
  pg: PosGroup,
  window: { code: WindowCode; n: number },
  leagueSkill: {
    ixg60: { mu: number; sig: number };
    icf60: { mu: number; sig: number };
    hdcf60: { mu: number; sig: number };
  },
  weights: WeightConfig = DEFAULT_WEIGHTS
) {
  // luck z's (pull from existing window z table)
  const { data: zrows, error } = await (supabase as any)
    .from("sustainability_window_z")
    .select("stat_code, eb_z")
    .eq("player_id", player_id)
    .eq("snapshot_date", snapshot_date)
    .eq("window_code", window.code)
    .in("stat_code", ["shp", "oishp", "ipp", "ppshp"]);
  if (error) throw error;
  const zmap: Record<string, number> = {};
  for (const r of zrows ?? []) zmap[r.stat_code] = Number(r.eb_z) || 0;

  // skill z's
  const rates = await fetchSkillWindowRates(player_id, snapshot_date, window.n);
  const z_ixg = zClip(rates.ixg60, leagueSkill.ixg60.mu, leagueSkill.ixg60.sig);
  const z_icf = zClip(rates.icf60, leagueSkill.icf60.mu, leagueSkill.icf60.sig);
  const z_hdc = zClip(rates.hdcf60, leagueSkill.hdcf60.mu, leagueSkill.hdcf60.sig);

  const sRaw =
    weights.luck.shp * (zmap["shp"] ?? 0) +
    weights.luck.oishp * (zmap["oishp"] ?? 0) +
    weights.luck.ipp * (zmap["ipp"] ?? 0) +
    weights.luck.ppshp * (zmap["ppshp"] ?? 0) +
    weights.skill.ixg60 * z_ixg +
    weights.skill.icf60 * z_icf +
    weights.skill.hdcf60 * z_hdc;
  const s100 = 100 * sigmoid(sRaw);

  return {
    row: {
      player_id,
      season_id,
      snapshot_date,
      position_group: pg,
      window_code: window.code,
      s_raw: Number(sRaw.toFixed(6)),
      s_100: Number(s100.toFixed(2)),
      components: {
        z_shp: zmap["shp"] ?? 0,
        z_oishp: zmap["oishp"] ?? 0,
        z_ipp: zmap["ipp"] ?? 0,
        z_ppshp: zmap["ppshp"] ?? 0,
        z_ixg60: z_ixg,
        z_icf60: z_icf,
        z_hdcf60: z_hdc,
        weights
      }
    },
    sample: { rates, zmap }
  };
}

export async function upsertScores(rows: any[], dry = false) {
  if (dry || !rows.length) return { inserted: 0 };
  const { error } = await (supabase as any)
    .from("sustainability_scores")
    .upsert(rows, { onConflict: "player_id,snapshot_date,window_code" });
  if (error) throw error;
  return { inserted: rows.length };
}

export default {
  fetchSkillLeagueRef,
  fetchSkillWindowRates,
  buildScoreForPlayerWindow,
  upsertScores,
  DEFAULT_WEIGHTS,
  sigmoid
};

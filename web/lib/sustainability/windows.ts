import supabase from "lib/supabase";
import { toPosGroup, PosGroup, StatCode } from "lib/sustainability/priors";

export type WindowCode = "l3" | "l5" | "l10" | "l20";
const EPS = 1e-9;

// Generic fetch of priors for all Beta proportion stats we currently support.
// Returns a mapping: stat_code -> { alpha0, beta0, k }
export async function fetchPriors(
  season_id: number,
  pg: PosGroup,
  statCodes: StatCode[]
): Promise<Record<StatCode, { alpha0: number; beta0: number; k: number }>> {
  const { data, error } = await (supabase as any)
    .from("sustainability_priors")
    .select("stat_code, alpha0, beta0, k")
    .eq("season_id", season_id)
    .eq("position_group", pg)
    .in("stat_code", statCodes);
  if (error) throw error;
  const out: any = {};
  for (const r of data ?? []) {
    out[r.stat_code] = {
      alpha0: Number(r.alpha0),
      beta0: Number(r.beta0),
      k: Number(r.k)
    };
  }
  return out;
}

// Fetch rolling window counts for all needed columns in one query.
// We derive per-stat (successes, trials):
//  - shp: goals / shots
//  - oishp: nst_oi_gf / nst_oi_sf
//  - ipp: points_5v5 / nst_oi_gf
//  - ppshp: pp_goals / pp_shots
export async function fetchWindowCountsAll(
  player_id: number,
  snapshot_date: string,
  nGames: number
): Promise<
  Record<
    StatCode,
    {
      s: number; // successes
      n: number; // trials
    }
  >
> {
  const { data, error } = await (supabase as any)
    .from("player_stats_unified")
    .select(
      [
        "goals",
        "shots",
        "nst_oi_gf",
        "nst_oi_sf",
        "points_5v5",
        "pp_goals",
        "pp_shots"
      ].join(",")
    )
    .eq("player_id", player_id)
    .lte("date", snapshot_date)
    .order("date", { ascending: false })
    .limit(nGames);
  if (error) throw error;
  let g = 0,
    sh = 0,
    gf = 0,
    sf = 0,
    p5 = 0,
    ppg = 0,
    pps = 0;
  for (const r of data ?? []) {
    g += Number(r.goals) || 0;
    sh += Number(r.shots) || 0;
    gf += Number(r.nst_oi_gf) || 0;
    sf += Number(r.nst_oi_sf) || 0;
    p5 += Number(r.points_5v5) || 0;
    ppg += Number((r as any).pp_goals) || 0;
    pps += Number((r as any).pp_shots) || 0;
  }
  return {
    shp: { s: g, n: sh },
    oishp: { s: gf, n: sf },
    ipp: { s: p5, n: gf },
    ppshp: { s: ppg, n: pps }
  } as Record<StatCode, { s: number; n: number }>;
}

export function ebZ_generic(
  s: number,
  n: number,
  alpha0: number,
  beta0: number,
  k: number
) {
  const priorMean = alpha0 / (alpha0 + beta0);
  const priorVar =
    (alpha0 * beta0) / ((alpha0 + beta0) ** 2 * (alpha0 + beta0 + 1));
  if (!n || n <= 0) {
    return {
      p_hat: priorMean,
      priorMean,
      priorVar,
      shrink: 1,
      varMixed: priorVar,
      z: 0
    };
  }
  const p_hat = s / n;
  const shrink = 1 / (1 + n / Math.max(k, EPS));
  const sampleVar = (p_hat * (1 - p_hat)) / n;
  const varMixed = priorVar * shrink + sampleVar * (1 - shrink);
  const z = (p_hat - priorMean) / Math.max(Math.sqrt(varMixed), Math.sqrt(EPS));
  return { p_hat, priorMean, priorVar, shrink, varMixed, z };
}

export async function rebuildBetaWindowZForSnapshot(
  season_id: number,
  snapshot_date: string,
  playerIds: number[],
  posByPlayer: Map<number, PosGroup>,
  windows: Array<{ code: WindowCode; n: number }>,
  statCodes: StatCode[] = ["shp", "oishp", "ipp", "ppshp"],
  dry = false
) {
  // Preload priors for both position groups
  const priorsByPos: Record<
    PosGroup,
    Record<StatCode, { alpha0: number; beta0: number; k: number }>
  > = {
    F: await fetchPriors(season_id, "F", statCodes),
    D: await fetchPriors(season_id, "D", statCodes)
  } as any;

  const rows: any[] = [];
  for (const pid of playerIds) {
    const pg = posByPlayer.get(pid);
    if (!pg) continue;
    const priors = priorsByPos[pg];
    for (const w of windows) {
      const counts = await fetchWindowCountsAll(pid, snapshot_date, w.n);
      for (const stat of statCodes) {
        const prior = priors[stat];
        if (!prior) continue; // skip if prior row missing (e.g., not yet built)
        const c = counts[stat];
        const { p_hat, priorMean, priorVar, shrink, varMixed, z } = ebZ_generic(
          c.s,
          c.n,
          prior.alpha0,
          prior.beta0,
          prior.k
        );
        rows.push({
          player_id: pid,
          season_id,
          snapshot_date,
          position_group: pg,
          window_code: w.code,
          stat_code: stat,
          successes: c.s,
          trials: c.n,
          rate: Number(p_hat.toFixed(8)),
          prior_alpha: prior.alpha0,
          prior_beta: prior.beta0,
          prior_mean: Number(priorMean.toFixed(8)),
          prior_var: Number(priorVar.toFixed(10)),
          k: prior.k,
          shrink: Number(shrink.toFixed(8)),
          var_mixed: Number(varMixed.toFixed(10)),
          eb_z: Number(z.toFixed(6))
        });
      }
    }
  }

  if (!dry && rows.length) {
    const { error } = await (supabase as any)
      .from("sustainability_window_z")
      .upsert(rows, {
        onConflict: "player_id,snapshot_date,window_code,stat_code"
      });
    if (error) throw error;
  }
  return { count: rows.length, sample: rows.slice(0, 5) };
}

export async function loadPlayersForSnapshot(snapshot_date: string) {
  const { data, error } = await (supabase as any)
    .from("player_baselines")
    .select("player_id, position_code")
    .eq("snapshot_date", snapshot_date);
  if (error) throw error;
  const ids: number[] = [];
  const posMap = new Map<number, PosGroup>();
  for (const r of data ?? []) {
    const pg = toPosGroup(r.position_code);
    if (!pg) continue;
    ids.push(Number(r.player_id));
    posMap.set(Number(r.player_id), pg);
  }
  return { ids, posMap };
}

export async function ensureWindowTable() {
  const ddl = `CREATE TABLE IF NOT EXISTS sustainability_window_z (
  player_id       INT4        NOT NULL,
  season_id       INTEGER,
  snapshot_date   DATE        NOT NULL,
  position_group  TEXT        NOT NULL,
  window_code     TEXT        NOT NULL,
  stat_code       TEXT        NOT NULL,
  successes       NUMERIC     NOT NULL,
  trials          NUMERIC     NOT NULL,
  rate            DOUBLE PRECISION NOT NULL,
  prior_alpha     DOUBLE PRECISION NOT NULL,
  prior_beta      DOUBLE PRECISION NOT NULL,
  prior_mean      DOUBLE PRECISION NOT NULL,
  prior_var       DOUBLE PRECISION NOT NULL,
  k               NUMERIC     NOT NULL,
  shrink          DOUBLE PRECISION NOT NULL,
  var_mixed       DOUBLE PRECISION NOT NULL,
  eb_z            DOUBLE PRECISION NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, snapshot_date, window_code, stat_code)
);
CREATE INDEX IF NOT EXISTS idx_suswinz_season ON sustainability_window_z (season_id);
CREATE INDEX IF NOT EXISTS idx_suswinz_player ON sustainability_window_z (player_id);`;
  // best-effort: log DDL
  // eslint-disable-next-line no-console
  console.log("ensureWindowTable DDL prepared (not executed with anon key)");
  return ddl;
}

export default {
  fetchPriors,
  fetchWindowCountsAll,
  ebZ_generic,
  rebuildBetaWindowZForSnapshot,
  loadPlayersForSnapshot,
  ensureWindowTable
};

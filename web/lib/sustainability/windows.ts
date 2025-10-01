import supabase from "lib/supabase";
import { toPosGroup, PosGroup } from "lib/sustainability/priors";

export type WindowCode = "l3" | "l5" | "l10" | "l20";
const EPS = 1e-9;

export async function fetchShpPrior(season_id: number, pg: PosGroup) {
  const { data, error } = await (supabase as any)
    .from("sustainability_priors")
    .select("alpha0, beta0, k")
    .eq("season_id", season_id)
    .eq("position_group", pg)
    .eq("stat_code", "shp")
    .single();
  if (error) throw error;
  return { alpha0: Number(data.alpha0), beta0: Number(data.beta0), k: Number(data.k) };
}

export async function fetchShpWindowCounts(
  player_id: number,
  snapshot_date: string,
  nGames: number
): Promise<{ goals: number; shots: number }> {
  const { data, error } = await (supabase as any)
    .from("player_stats_unified")
    .select("goals, shots")
    .eq("player_id", player_id)
    .lte("date", snapshot_date)
    .order("date", { ascending: false })
    .limit(nGames);
  if (error) throw error;
  let goals = 0,
    shots = 0;
  for (const r of data ?? []) {
    goals += Number(r.goals) || 0;
    shots += Number(r.shots) || 0;
  }
  return { goals, shots };
}

export function ebZ_shp(
  goals: number,
  shots: number,
  alpha0: number,
  beta0: number,
  k: number
) {
  const p_hat = shots > 0 ? goals / shots : 0;
  const priorMean = alpha0 / (alpha0 + beta0);
  const priorVar = (alpha0 * beta0) / ((alpha0 + beta0) ** 2 * (alpha0 + beta0 + 1));
  const shrink = 1 / (1 + (shots || 0) / Math.max(k, EPS));
  const sampleVar = (p_hat * (1 - p_hat)) / Math.max(shots, 1);
  const varMixed = priorVar * shrink + sampleVar * (1 - shrink);
  const z = (p_hat - priorMean) / Math.max(Math.sqrt(varMixed), Math.sqrt(EPS));
  return { p_hat, priorMean, priorVar, shrink, varMixed, z };
}

export async function rebuildShootingZForSnapshot(
  season_id: number,
  snapshot_date: string,
  playerIds: number[],
  posByPlayer: Map<number, PosGroup>,
  windows: Array<{ code: WindowCode; n: number }>,
  dry = false
) {
  // preload priors for F and D
  const priors: Record<PosGroup, { alpha0: number; beta0: number; k: number }> = {
    F: await fetchShpPrior(season_id, "F"),
    D: await fetchShpPrior(season_id, "D")
  };

  const rows: any[] = [];
  for (const pid of playerIds) {
    const pg = posByPlayer.get(pid);
    if (!pg) continue;
    const prior = priors[pg];
    for (const w of windows) {
      const { goals, shots } = await fetchShpWindowCounts(pid, snapshot_date, w.n);
      const { p_hat, priorMean, priorVar, shrink, varMixed, z } =
        ebZ_shp(goals, shots, prior.alpha0, prior.beta0, prior.k);
      rows.push({
        player_id: pid,
        season_id,
        snapshot_date,
        position_group: pg,
        window_code: w.code,
        stat_code: "shp",
        successes: goals,
        trials: shots,
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

  if (!dry && rows.length) {
    const { error } = await (supabase as any)
      .from("sustainability_window_z")
      .upsert(rows, { onConflict: "player_id,snapshot_date,window_code,stat_code" });
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
  fetchShpPrior,
  fetchShpWindowCounts,
  ebZ_shp,
  rebuildShootingZForSnapshot,
  loadPlayersForSnapshot,
  ensureWindowTable
};

// web/lib/sustainability/priors.ts

import supabase from "lib/supabase";

// Types
export type StatCode = "shp" | "oishp" | "ipp" | "ppshp"; // ppshp = power play shooting %
export type PosGroup = "F" | "D";

const FORWARDS = new Set(["C", "LW", "RW"]);
const EPS = 1e-9;

export function toPosGroup(position_code: string | null): PosGroup | null {
  if (!position_code) return null;
  if (FORWARDS.has(position_code)) return "F";
  if (position_code === "D") return "D";
  return null; // exclude goalies & anything else
}

// Helper: aggregate league means (pooled) for a season + position group
export async function fetchLeagueMeans(
  season_id: number,
  posGroup: PosGroup
): Promise<Record<StatCode, number>> {
  const posCodes = posGroup === "F" ? ["C", "LW", "RW"] : ["D"];
  const { data, error } = await (supabase as any)
    .from("player_totals_unified")
    .select(
      [
        "goals",
        "shots",
        "nst_oi_gf",
        "nst_oi_sf",
        "points_5v5",
        "pp_goals",
        "pp_shots",
        "season_id",
        "position_code"
      ].join(",")
    )
    .eq("season_id", season_id)
    .in("position_code", posCodes);
  if (error) throw error;

  let g_sum = 0,
    sh_sum = 0,
    gf_sum = 0,
    sf_sum = 0,
    p5_sum = 0,
    ppg_sum = 0,
    pps_sum = 0;
  for (const r of data ?? []) {
    g_sum += Number(r.goals) || 0;
    sh_sum += Number(r.shots) || 0;
    gf_sum += Number(r.nst_oi_gf) || 0;
    sf_sum += Number(r.nst_oi_sf) || 0;
    p5_sum += Number(r.points_5v5) || 0;
    ppg_sum += Number(r.pp_goals) || 0;
    pps_sum += Number(r.pp_shots) || 0;
  }

  const shp = sh_sum > 0 ? g_sum / sh_sum : 0;
  const oishp = sf_sum > 0 ? gf_sum / sf_sum : 0;
  const ipp = gf_sum > 0 ? p5_sum / gf_sum : 0;
  const ppshp = pps_sum > 0 ? ppg_sum / pps_sum : 0;
  return { shp, oishp, ipp, ppshp } as Record<StatCode, number>;
}

export function betaFromMuK(
  mu: number,
  k: number
): {
  alpha0: number;
  beta0: number;
} {
  if (k <= 0)
    return { alpha0: mu > 0 ? mu : EPS, beta0: mu < 1 ? 1 - mu : EPS };
  const alpha0 = Math.max(mu * k, EPS);
  const beta0 = Math.max((1 - mu) * k, EPS);
  return { alpha0, beta0 };
}

// Fetch per-player counts across last 3 seasons
export async function fetchPlayerSeasonCounts(seasonIdNow: number): Promise<
  Array<{
    player_id: number;
    position_group: PosGroup;
    seasons: Array<{
      season_id: number;
      shp: { s: number; n: number };
      oishp: { s: number; n: number };
      ipp: { s: number; n: number };
    }>;
  }>
> {
  const seasonIds = [seasonIdNow, seasonIdNow - 1, seasonIdNow - 2];
  const { data, error } = await (supabase as any)
    .from("player_totals_unified")
    .select(
      [
        "player_id",
        "season_id",
        "position_code",
        "goals",
        "shots",
        "nst_oi_gf",
        "nst_oi_sf",
        "points_5v5",
        "pp_goals",
        "pp_shots"
      ].join(",")
    )
    .in("season_id", seasonIds)
    .not("player_id", "is", null);
  if (error) throw error;

  const byPlayer: Map<
    number,
    {
      position_group: PosGroup;
      seasons: Record<
        number,
        {
          shp: { s: number; n: number };
          oishp: { s: number; n: number };
          ipp: { s: number; n: number };
          ppshp: { s: number; n: number };
        }
      >;
    }
  > = new Map();

  for (const row of data ?? []) {
    const pg = toPosGroup(row.position_code);
    if (!pg) continue; // skip goalies / unknown
    const pid = Number(row.player_id);
    if (!byPlayer.has(pid)) {
      byPlayer.set(pid, {
        position_group: pg,
        seasons: {}
      });
    }
    const bucket = byPlayer.get(pid)!;
    // Use first non-null position group (should match across seasons)
    if (bucket.position_group !== pg) {
      // keep existing; mixed positions rare; treat as forward if any forward
      if (bucket.position_group === "D" && pg === "F")
        bucket.position_group = "F"; // favor F
    }
    const sid = Number(row.season_id);
    if (!bucket.seasons[sid]) {
      bucket.seasons[sid] = {
        shp: { s: 0, n: 0 },
        oishp: { s: 0, n: 0 },
        ipp: { s: 0, n: 0 },
        ppshp: { s: 0, n: 0 }
      };
    }
    const rec = bucket.seasons[sid];
    const goals = Number(row.goals) || 0;
    const shots = Number(row.shots) || 0;
    const gf = Number(row.nst_oi_gf) || 0;
    const sf = Number(row.nst_oi_sf) || 0;
    const p5 = Number(row.points_5v5) || 0;
    const ppg = Number((row as any).pp_goals) || 0;
    const pps = Number((row as any).pp_shots) || 0;
    rec.shp.s += goals;
    rec.shp.n += shots;
    rec.oishp.s += gf;
    rec.oishp.n += sf;
    rec.ipp.s += p5;
    rec.ipp.n += gf; // denominator = on-ice goals for
    rec.ppshp.s += ppg;
    rec.ppshp.n += pps;
  }

  const result: Array<{
    player_id: number;
    position_group: PosGroup;
    seasons: Array<{
      season_id: number;
      shp: { s: number; n: number };
      oishp: { s: number; n: number };
      ipp: { s: number; n: number };
      ppshp: { s: number; n: number };
    }>;
  }> = [];

  for (const [pid, val] of byPlayer.entries()) {
    const seasonsArr = [seasonIdNow, seasonIdNow - 1, seasonIdNow - 2].map(
      (sid) => ({
        season_id: sid,
        shp: val.seasons[sid]?.shp || { s: 0, n: 0 },
        oishp: val.seasons[sid]?.oishp || { s: 0, n: 0 },
        ipp: val.seasons[sid]?.ipp || { s: 0, n: 0 },
        ppshp: val.seasons[sid]?.ppshp || { s: 0, n: 0 }
      })
    );
    result.push({
      player_id: pid,
      position_group: val.position_group,
      seasons: seasonsArr
    });
  }
  return result;
}

export function blendCounts(
  seasons: Array<{
    shp: { s: number; n: number };
    oishp: { s: number; n: number };
    ipp: { s: number; n: number };
    ppshp: { s: number; n: number };
  }>
): Record<StatCode, { s: number; n: number }> {
  const weights = [0.6, 0.3, 0.1];
  const out: Record<StatCode, { s: number; n: number }> = {
    shp: { s: 0, n: 0 },
    oishp: { s: 0, n: 0 },
    ipp: { s: 0, n: 0 },
    ppshp: { s: 0, n: 0 }
  };
  for (let i = 0; i < seasons.length && i < weights.length; i++) {
    const w = weights[i];
    out.shp.s += seasons[i].shp.s * w;
    out.shp.n += seasons[i].shp.n * w;
    out.oishp.s += seasons[i].oishp.s * w;
    out.oishp.n += seasons[i].oishp.n * w;
    out.ipp.s += seasons[i].ipp.s * w;
    out.ipp.n += seasons[i].ipp.n * w;
    out.ppshp.s += seasons[i].ppshp.s * w;
    out.ppshp.n += seasons[i].ppshp.n * w;
  }
  return out;
}

export function betaPosterior(
  alpha0: number,
  beta0: number,
  s: number,
  n: number
): {
  post_alpha: number;
  post_beta: number;
  post_mean: number;
  post_var: number;
} {
  if (n <= 0) {
    const a = alpha0;
    const b = beta0;
    const mean = a / (a + b);
    const v = (a * b) / ((a + b) ** 2 * (a + b + 1));
    return { post_alpha: a, post_beta: b, post_mean: mean, post_var: v };
  }
  const post_alpha = alpha0 + s;
  const post_beta = beta0 + (n - s);
  const post_mean = post_alpha / (post_alpha + post_beta);
  const post_var =
    (post_alpha * post_beta) /
    ((post_alpha + post_beta) ** 2 * (post_alpha + post_beta + 1));
  return { post_alpha, post_beta, post_mean, post_var };
}

// Upsert league priors
// priors.ts
export async function upsertLeaguePriors(
  season_id: number,
  posGroup: PosGroup,
  k: { shp: number; oishp: number; ipp: number; ppshp?: number },
  opts: { dry?: boolean } = {}
): Promise<
  Array<{
    season_id: number;
    position_group: PosGroup;
    stat_code: StatCode;
    k: number;
    league_mu: number;
    alpha0: number;
    beta0: number;
  }>
> {
  const means = await fetchLeagueMeans(season_id, posGroup);
  const rows = (Object.keys(means) as StatCode[]).map((stat) => {
    const mu = means[stat];
    const kVal: number = (k as any)[stat] ?? (stat === "ppshp" ? 80 : 200);
    const { alpha0, beta0 } = betaFromMuK(mu, kVal);
    return {
      season_id,
      position_group: posGroup,
      stat_code: stat,
      k: kVal,
      league_mu: mu,
      alpha0,
      beta0
    };
  });

  if (!opts.dry && rows.length) {
    const { error } = await (supabase as any)
      .from("sustainability_priors")
      .upsert(rows, { onConflict: "season_id,position_group,stat_code" });
    if (error) throw error;
  }
  return rows;
}

// Let player posteriors accept precomputed priors (so dry mode doesn’t require DB writes/reads)
export async function upsertPlayerPosteriors(
  season_id: number,
  k: { shp: number; oishp: number; ipp: number },
  dryRun = false,
  leaguePriors?: Map<string, { alpha0: number; beta0: number }> // NEW
): Promise<{ inserted: number; sample: any[] }> {
  let leagueMap = leaguePriors;
  if (!leagueMap) {
    const { data: leagueRows, error: leagueErr } = await (supabase as any)
      .from("sustainability_priors")
      .select("season_id, position_group, stat_code, alpha0, beta0")
      .eq("season_id", season_id);
    if (leagueErr) throw leagueErr;
    leagueMap = new Map();
    for (const r of leagueRows ?? []) {
      leagueMap.set(`${r.position_group}|${r.stat_code}`, {
        alpha0: r.alpha0,
        beta0: r.beta0
      });
    }
  }

  const playerSeasonCounts = await fetchPlayerSeasonCounts(season_id);
  const upsertRows: any[] = [];
  for (const rec of playerSeasonCounts) {
    const blended = blendCounts(
      rec.seasons.map((s) => ({
        shp: s.shp,
        oishp: s.oishp,
        ipp: s.ipp,
        ppshp: (s as any).ppshp || { s: 0, n: 0 }
      }))
    );
    (Object.keys(blended) as StatCode[]).forEach((stat) => {
      const b = blended[stat];
      const prior = leagueMap!.get(`${rec.position_group}|${stat}`);
      if (!prior) return;
      const post = betaPosterior(prior.alpha0, prior.beta0, b.s, b.n);
      upsertRows.push({
        player_id: rec.player_id,
        season_id,
        position_group: rec.position_group,
        stat_code: stat,
        successes_blend: Number(b.s.toFixed(6)),
        trials_blend: Number(b.n.toFixed(6)),
        post_alpha: Number(post.post_alpha.toFixed(6)),
        post_beta: Number(post.post_beta.toFixed(6)),
        post_mean: Number(post.post_mean.toFixed(8)),
        post_var: Number(post.post_var.toFixed(10)),
        n_effective: Number(b.n.toFixed(6))
      });
    });
  }

  if (!dryRun && upsertRows.length) {
    const { error: upErr } = await (supabase as any)
      .from("sustainability_player_priors")
      .upsert(upsertRows, {
        onConflict: "player_id,season_id,position_group,stat_code"
      });
    if (upErr) throw upErr;
  }

  return { inserted: upsertRows.length, sample: upsertRows.slice(0, 5) };
}

// Inline sanity: posterior mean test
function __sanity() {
  const mu = 0.1;
  const k = 200;
  const { alpha0, beta0 } = betaFromMuK(mu, k); // 20 & 180
  const { post_mean } = betaPosterior(alpha0, beta0, 10, 100); // (20+10)/(200+100)=0.10
  if (Math.abs(post_mean - 0.1) > 1e-6) {
    // eslint-disable-next-line no-console
    console.warn("Sanity check failed for betaPosterior");
  }
}
__sanity();

// Optional helpers to ensure tables exist; best-effort
export async function ensureTables() {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS sustainability_priors (
  season_id      INTEGER NOT NULL,
  position_group TEXT    NOT NULL,
  stat_code      TEXT    NOT NULL,
  k              NUMERIC NOT NULL,
  league_mu      DOUBLE PRECISION NOT NULL,
  alpha0         DOUBLE PRECISION NOT NULL,
  beta0          DOUBLE PRECISION NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, position_group, stat_code)
);`,
    `CREATE TABLE IF NOT EXISTS sustainability_player_priors (
  player_id        INT4    NOT NULL,
  season_id        INTEGER NOT NULL,
  position_group   TEXT    NOT NULL,
  stat_code        TEXT    NOT NULL,
  successes_blend  NUMERIC NOT NULL,
  trials_blend     NUMERIC NOT NULL,
  post_alpha       DOUBLE PRECISION NOT NULL,
  post_beta        DOUBLE PRECISION NOT NULL,
  post_mean        DOUBLE PRECISION NOT NULL,
  post_var         DOUBLE PRECISION NOT NULL,
  n_effective      NUMERIC NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, season_id, position_group, stat_code)
);`
  ];
  // Without a SQL execution function, we optimistically rely on tables existing.
  // If you have a custom RPC (e.g., exec_sql) you could call it here.
  // eslint-disable-next-line no-console
  console.log(
    "ensureTables: (best-effort) DDL prepared but not executed via public anon key"
  );
  return ddlStatements.join("\n\n");
}

export default {
  toPosGroup,
  fetchLeagueMeans,
  betaFromMuK,
  fetchPlayerSeasonCounts,
  blendCounts,
  betaPosterior,
  upsertLeaguePriors,
  upsertPlayerPosteriors,
  ensureTables
};

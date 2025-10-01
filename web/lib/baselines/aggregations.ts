import { SIGMA_MIN, deploymentElasticity, metricAllowlist } from "./config";

type GameRow = Record<string, any>;

export type MetricStats = {
  mu: number;
  sigma: number;
  n: number;
  numer?: number;
  denom?: number;
  toi_seconds?: number;
};

export type WindowPayload = Record<string, MetricStats>;

function safeNumber(v: any) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return 0;
  return Number(v);
}

export function per60(numer: number, toi_seconds: number) {
  if (!toi_seconds || toi_seconds <= 0) return 0;
  return (3600 * numer) / toi_seconds;
}

export function pct(success: number, trials: number) {
  if (!trials || trials <= 0) return 0;
  return success / trials;
}

export function sampleStats(values: number[]): {
  mu: number;
  sigma: number;
  n: number;
} {
  const n = values.length;
  if (n === 0) return { mu: 0, sigma: SIGMA_MIN, n: 0 };
  const mu = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mu, sigma: SIGMA_MIN, n };
  const variance = values.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1);
  const sigma = Math.max(Math.sqrt(variance), SIGMA_MIN);
  return { mu, sigma, n };
}

export function winsorize01(x: number) {
  if (x === null || x === undefined || Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function computeResiduals(row: GameRow) {
  const goals = safeNumber(row.goals || 0);
  const nst_ixg = safeNumber(row.nst_ixg || 0);
  const goals_per_60_5v5 = safeNumber(row.goals_per_60_5v5 || 0);
  const nst_ixg_per_60 = safeNumber(row.nst_ixg_per_60 || 0);
  return {
    fin_res_level: goals - nst_ixg,
    fin_res_rate_5v5: goals_per_60_5v5 - nst_ixg_per_60
  };
}

function numericFieldsForWindow(rows: GameRow[], field: string) {
  return rows.map((r) => safeNumber(r[field]));
}

export function buildWindowPayload(rows: GameRow[]): WindowPayload {
  // rows are ordered newest -> oldest or any; we treat as set
  const payload: WindowPayload = {};

  // Helper to compute per-game or per-60 metrics
  // For metrics that require per-60, we need numerators and toi_seconds

  // example metrics mapping
  const metrics = [
    // percentages
    "shooting_percentage",
    "shooting_percentage_5v5",
    "pp_shooting_percentage",
    // nst on-ice
    "nst_oi_shooting_pct",
    "nst_oi_save_pct",
    "nst_oi_pdo",
    "nst_ipp",
    "nst_ixg",
    // per-60
    "nst_ixg_per_60",
    "nst_icf_per_60",
    "nst_hdcf_per_60",
    "points_per_60_5v5",
    "points_per_60", // All - Strengths
    "goals_per_60", // All - Strengths
    "pp_points_per_60",
    "pp_goals_per_60",
    "pp_shots_per_60",
    "nst_oi_xgf_pct",
    "nst_oi_cf_pct",
    "nst_oi_scf_pct",
    "shots",
    "nst_shots_per_60"
  ];

  // compute residuals per row
  const fin_res_vals: number[] = [];
  const fin_res_rate_vals: number[] = [];
  for (const r of rows) {
    const res = computeResiduals(r);
    fin_res_vals.push(res.fin_res_level);
    fin_res_rate_vals.push(res.fin_res_rate_5v5);
  }

  // generic: for named metric, collect numeric values and compute sample stats
  for (const m of metrics) {
    let values: number[] = [];
    // For derived percentages, recompute from counts per spec
    if (m === "shooting_percentage") {
      values = rows.map((r) => {
        const g = safeNumber(r.goals ?? r.goals_5v5 ?? 0);
        const s = safeNumber(r.shots ?? 0);
        return pct(g, s);
      });
    } else if (m === "shooting_percentage_5v5") {
      values = rows.map((r) =>
        winsorize01(safeNumber(r.shooting_percentage_5v5 || 0))
      );
    } else if (m === "pp_shooting_percentage") {
      values = rows.map((r) =>
        pct(safeNumber(r.pp_goals || 0), safeNumber(r.pp_shots || 0))
      );
    } else if (m === "nst_oi_shooting_pct") {
      values = rows.map((r) =>
        pct(
          safeNumber(r.nst_oi_gf || 0),
          safeNumber(r.nst_oi_sf || r.nst_oi_shots || 0)
        )
      );
    } else if (m === "nst_oi_save_pct") {
      values = rows.map((r) =>
        pct(
          safeNumber((r.nst_oi_sa || 0) - safeNumber(r.nst_oi_ga || 0)),
          safeNumber(r.nst_oi_sa || 0)
        )
      );
    } else if (m === "nst_oi_pdo") {
      values = rows.map((r) => {
        const sh = pct(
          safeNumber(r.nst_oi_gf || 0),
          safeNumber(r.nst_oi_sf || r.nst_oi_shots || 0)
        );
        const sv = pct(
          safeNumber((r.nst_oi_sa || 0) - safeNumber(r.nst_oi_ga || 0)),
          safeNumber(r.nst_oi_sa || 0)
        );
        return sh + sv;
      });
    } else if (m === "nst_ixg") {
      values = rows.map((r) => safeNumber(r.nst_ixg || 0));
    } else if (m === "points_per_60_5v5") {
      values = rows.map((r) => {
        return per60(
          safeNumber(r.points_5v5 || 0),
          safeNumber(r.toi_per_game_5v5 || r.ev_time_on_ice || 0)
        );
      });
    } else if (
      m === "pp_points_per_60" ||
      m === "pp_goals_per_60" ||
      m === "pp_shots_per_60"
    ) {
      const map: Record<string, string> = {
        pp_points_per_60: "pp_points",
        pp_goals_per_60: "pp_goals",
        pp_shots_per_60: "pp_shots"
      };
      const numerKey = map[m] || "pp_points";
      values = rows.map((r) =>
        per60(safeNumber(r[numerKey] || 0), safeNumber(r.pp_toi || 0))
      );
    } else if (m === "nst_ixg_per_60") {
      values = rows.map((r) =>
        per60(safeNumber(r.nst_ixg || 0), safeNumber(r.nst_toi || 0))
      );
    } else if (m === "nst_icf_per_60") {
      values = rows.map((r) =>
        per60(safeNumber(r.nst_icf || 0), safeNumber(r.nst_toi || 0))
      );
    } else if (m === "nst_hdcf_per_60") {
      values = rows.map((r) =>
        per60(safeNumber(r.nst_hdcf || 0), safeNumber(r.nst_toi || 0))
      );
    } else if (m === "points_per_60") {
      // all-sits
      values = rows.map((r) =>
        per60(safeNumber(r.points || 0), safeNumber(r.toi_per_game || 0))
      );
    } else if (m === "goals_per_60") {
      // all-sits
      values = rows.map((r) =>
        per60(safeNumber(r.goals || 0), safeNumber(r.toi_per_game || 0))
      );
    } else if (m === "nst_shots_per_60") {
      // Use provided NST rate if present; we can't recompute without nst_shots
      values = numericFieldsForWindow(rows, "nst_shots_per_60");
    } else if (m === "shots") {
      values = rows.map((r) => safeNumber(r.shots || 0));
    } else if (
      m === "nst_oi_xgf_pct" ||
      m === "nst_oi_cf_pct" ||
      m === "nst_oi_scf_pct"
    ) {
      // recompute as on-ice shares
      if (m === "nst_oi_cf_pct")
        values = rows.map((r) =>
          pct(
            safeNumber(r.nst_oi_cf || 0),
            safeNumber((r.nst_oi_cf || 0) + (r.nst_oi_ca || 0))
          )
        );
      if (m === "nst_oi_xgf_pct")
        values = rows.map((r) =>
          pct(
            safeNumber(r.nst_oi_xgf || 0),
            safeNumber((r.nst_oi_xgf || 0) + (r.nst_oi_xga || 0))
          )
        );
      if (m === "nst_oi_scf_pct")
        values = rows.map((r) =>
          pct(
            safeNumber(r.nst_oi_scf || 0),
            safeNumber((r.nst_oi_scf || 0) + (r.nst_oi_sca || 0))
          )
        );
    } else {
      values = numericFieldsForWindow(rows, m);
    }
    // for percentages, winsorize
    const processed = values.map((v) => {
      if (
        m.includes("percentage") ||
        m.includes("pct") ||
        m === "pp_shooting_percentage"
      ) {
        return winsorize01(v);
      }
      return v;
    });
    const stat = sampleStats(processed);
    payload[m] = {
      mu: Number(stat.mu.toFixed(6)),
      sigma: Number(stat.sigma.toFixed(6)),
      n: stat.n
    };
    // store numer/denom for percentage metrics
    if (m === "shooting_percentage") {
      const goalsSum = rows.reduce((s, r) => s + safeNumber(r.goals || 0), 0);
      const shotsSum = rows.reduce((s, r) => s + safeNumber(r.shots || 0), 0);
      payload[m].numer = goalsSum;
      payload[m].denom = shotsSum;
    }
    if (m === "shooting_percentage_5v5") {
      // We only have the rate per game; store a weighted mu/sigma above.
      // add shots_5v5 later, you can fill numer/denom here.
    }
    if (m === "pp_shooting_percentage") {
      const goalsSum = rows.reduce(
        (s, r) => s + safeNumber(r.pp_goals || 0),
        0
      );
      const shotsSum = rows.reduce(
        (s, r) => s + safeNumber(r.pp_shots || 0),
        0
      );
      payload[m].numer = goalsSum;
      payload[m].denom = shotsSum;
    }
    if (m === "nst_oi_shooting_pct") {
      const gf = rows.reduce((s, r) => s + safeNumber(r.nst_oi_gf || 0), 0);
      const sf = rows.reduce(
        (s, r) => s + safeNumber(r.nst_oi_sf || r.nst_oi_shots || 0),
        0
      );
      payload[m].numer = gf;
      payload[m].denom = sf;
    }
    if (m === "nst_oi_save_pct") {
      const sa = rows.reduce((s, r) => s + safeNumber(r.nst_oi_sa || 0), 0);
      const ga = rows.reduce((s, r) => s + safeNumber(r.nst_oi_ga || 0), 0);
      payload[m].numer = sa - ga;
      payload[m].denom = sa;
    }
    // store numer/denom for per-60 and percentage metrics when available
    if (m === "nst_ixg_per_60") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.nst_ixg || 0), 0);
      const denom = rows.reduce((s, r) => s + safeNumber(r.nst_toi || 0), 0);
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (m === "nst_icf_per_60") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.nst_icf || 0), 0);
      const denom = rows.reduce((s, r) => s + safeNumber(r.nst_toi || 0), 0);
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (m === "nst_hdcf_per_60") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.nst_hdcf || 0), 0);
      const denom = rows.reduce((s, r) => s + safeNumber(r.nst_toi || 0), 0);
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (m === "points_per_60_5v5") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.points_5v5 || 0), 0);
      const denom = rows.reduce(
        (s, r) => s + safeNumber(r.toi_per_game_5v5 || r.ev_time_on_ice || 0),
        0
      );
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (m === "points_per_60") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.points || 0), 0);
      const denom = rows.reduce(
        (s, r) => s + safeNumber(r.toi_per_game || 0),
        0
      );
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (m === "goals_per_60") {
      const numer = rows.reduce((s, r) => s + safeNumber(r.goals || 0), 0);
      const denom = rows.reduce(
        (s, r) => s + safeNumber(r.toi_per_game || 0),
        0
      );
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
    if (
      m === "pp_points_per_60" ||
      m === "pp_goals_per_60" ||
      m === "pp_shots_per_60"
    ) {
      const key =
        m === "pp_points_per_60"
          ? "pp_points"
          : m === "pp_goals_per_60"
            ? "pp_goals"
            : "pp_shots";
      const numer = rows.reduce((s, r) => s + safeNumber(r[key] || 0), 0);
      const denom = rows.reduce((s, r) => s + safeNumber(r.pp_toi || 0), 0);
      Object.assign(payload[m], { numer, denom, toi_seconds: denom });
    }
  }

  payload["fin_res_level"] = sampleStats(fin_res_vals);
  payload["fin_res_rate_5v5"] = sampleStats(fin_res_rate_vals);

  // For per-60 metrics that require toi_seconds sums, also store toi_seconds
  const toi_sum = rows.reduce(
    (s, r) => s + safeNumber(r.nst_toi || r.toi_per_game || 0),
    0
  );
  if (payload["nst_ixg_per_60"]) {
    payload["nst_ixg_per_60"].toi_seconds = toi_sum;
  }
  if (payload["nst_icf_per_60"])
    payload["nst_icf_per_60"].toi_seconds = toi_sum;
  if (payload["nst_hdcf_per_60"])
    payload["nst_hdcf_per_60"].toi_seconds = toi_sum;
  if (payload["points_per_60_5v5"])
    payload["points_per_60_5v5"].toi_seconds = rows.reduce(
      (s, r) => s + safeNumber(r.toi_per_game_5v5 || 0),
      0
    );
  if (payload["pp_points_per_60"])
    payload["pp_points_per_60"].toi_seconds = rows.reduce(
      (s, r) => s + safeNumber(r.pp_toi || 0),
      0
    );
  if (payload["pp_goals_per_60"])
    payload["pp_goals_per_60"].toi_seconds = rows.reduce(
      (s, r) => s + safeNumber(r.pp_toi || 0),
      0
    );
  if (payload["pp_shots_per_60"])
    payload["pp_shots_per_60"].toi_seconds = rows.reduce(
      (s, r) => s + safeNumber(r.pp_toi || 0),
      0
    );

  return payload;
}

export function buildWinFromRows(rows: GameRow[]) {
  return buildWindowPayload(rows);
}

export function computePPControls(
  recentRows: GameRow[],
  lastSeasonShare: number | null
) {
  // recentRows ordered newest->oldest
  // Derive team PP seconds and filter tiny PP games (< minTeamPPSeconds)
  const teamPP = (r: GameRow) => {
    const share = winsorize01(safeNumber(r.pp_toi_pct_per_game || 0));
    const ppTOI = safeNumber(r.pp_toi || 0);
    return share > 0 ? ppTOI / Math.max(share, 1e-6) : 0;
  };
  const rowsFiltered = (() => {
    const keep = recentRows.filter(
      (r) => teamPP(r) >= deploymentElasticity.minTeamPPSeconds
    );
    return keep.length ? keep : recentRows; // fallback if all were filtered
  })();
  const L10 = rowsFiltered.slice(0, 10);
  const L20 = rowsFiltered.slice(0, 20);
  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const l10_vals = L10.map((r) =>
    winsorize01(safeNumber(r.pp_toi_pct_per_game || 0))
  );
  const l20_vals = L20.map((r) =>
    winsorize01(safeNumber(r.pp_toi_pct_per_game || 0))
  );

  const meanL10 = mean(l10_vals);
  const meanL20 = mean(l20_vals);
  const ref = lastSeasonShare ?? (meanL10 || meanL20) ?? 0;

  const {
    L10: w10,
    L20: w20,
    lastSeason: wLast
  } = deploymentElasticity.smoothWeights;
  const pp_share_sm = w10 * meanL10 + w20 * meanL20 + wLast * ref;
  const pp_share_ref = ref;
  const pp_share_delta = pp_share_sm - pp_share_ref;
  const pp_share_rel = Math.max(
    -deploymentElasticity.capRel,
    Math.min(
      deploymentElasticity.capRel,
      pp_share_delta / Math.max(pp_share_ref, 1e-6)
    )
  );
  // Hysteresis (optional): if you have a previous PP1 state in the DB, use it; otherwise default to threshold
  const enter =
    deploymentElasticity.pp1Enter ?? deploymentElasticity.pp1Threshold;
  const exit =
    deploymentElasticity.pp1Exit ?? deploymentElasticity.pp1Threshold;
  const pp1_ref = pp_share_ref >= enter;
  // Hysteresis using ref as prior: if previously PP1, require share to stay above EXIT to remain PP1; else require ENTER to flip to PP1.
  const pp1_flag = pp1_ref ? pp_share_sm >= exit : pp_share_sm >= enter;

  const band_widen_factor =
    1 + deploymentElasticity.varianceAlpha * Math.abs(pp_share_rel);

  return {
    pp_share_sm: Number(pp_share_sm.toFixed(6)),
    pp_share_ref: Number(pp_share_ref.toFixed(6)),
    pp_share_delta: Number(pp_share_delta.toFixed(6)),
    pp_share_rel: Number(pp_share_rel.toFixed(6)),
    pp1_flag,
    pp1_flag_ref: pp1_ref,
    band_widen_factor: Number(band_widen_factor.toFixed(6))
  };
}

export function computeBlendFromSeasons(
  seasons: Record<string, any>[],
  metricNumerKey: string,
  metricDenomKey?: string
) {
  // seasons: array of season-level totals (newest first or any order)
  // if metricDenomKey provided, we will blend numerators/denominators then compute rate; else we treat metricNumerKey as a rate and weight by gp
  const result: any = {};
  if (!seasons || seasons.length === 0) return null;

  // helper to sum last N seasons
  const sumSeasons = (n: number) => {
    const sel = seasons.slice(0, n);
    let numer = 0;
    let denom = 0;
    for (const s of sel) {
      numer += safeNumber(s[metricNumerKey] ?? 0);
      if (metricDenomKey) denom += safeNumber(s[metricDenomKey] ?? 0);
    }
    return { numer, denom };
  };

  // current, last, prev2
  const curr = sumSeasons(1);
  const last = sumSeasons(2); // includes current + previous; we'll compute prev as last-curr
  const prev2 = sumSeasons(3);

  // compute per-window blended numer/denom using weights 0.6/0.3/0.1 on seasons (current, last-season, prev2)
  // We need numerators and denominators from distinct seasons; to get per-season numerators we use differences
  // Simpler approach: use top-3 seasons individually if available
  const top3 = seasons.slice(0, 3);
  const weights = [0.6, 0.3, 0.1];
  let blendedNumer = 0;
  let blendedDenom = 0;
  for (let i = 0; i < top3.length; i++) {
    const s = top3[i];
    const w = weights[i] ?? 0;
    const numer = safeNumber(s[metricNumerKey] ?? 0);
    const denom = metricDenomKey
      ? safeNumber(s[metricDenomKey] ?? 0)
      : safeNumber(s.games_played ?? 0);
    blendedNumer += w * numer;
    blendedDenom += w * denom;
  }

  const rate = metricDenomKey
    ? blendedDenom > 0
      ? blendedNumer / blendedDenom
      : 0
    : blendedDenom > 0
      ? blendedNumer / blendedDenom
      : 0;
  return { numer: blendedNumer, denom: blendedDenom, rate };
}

export function buildBaselinePayload(params: {
  player_id: string;
  season_id?: number | null;
  snapshot_date: string;
  position_code?: string | null;
  player_name?: string | null;
  rows_all: GameRow[]; // all game logs newest->oldest
  last_season_totals?: Record<string, any> | null;
  seasonTotals?: Record<string, any>[]; // per-player season totals, newest first
}) {
  const { rows_all, last_season_totals, seasonTotals } = params;

  const win_l3 = buildWinFromRows(rows_all.slice(0, 3));
  const win_l5 = buildWinFromRows(rows_all.slice(0, 5));
  const win_l10 = buildWinFromRows(rows_all.slice(0, 10));
  const win_l20 = buildWinFromRows(rows_all.slice(0, 20));

  // season prev: copy last season totals but ensure fields exist and placeholders for stats
  const win_season_prev: any =
    (last_season_totals && { ...last_season_totals }) || {};
  // insert empty mu/sigma placeholders for keys in allowlist
  for (const k of [
    ...metricAllowlist.hi,
    ...metricAllowlist.med,
    ...metricAllowlist.low
  ]) {
    if (!win_season_prev[k]) win_season_prev[k] = null;
  }

  // 3yr blend and career aggregates using seasonTotals (array of season-level totals, newest first)
  let win_3yr: any = {};
  let win_career: any = {};
  if (seasonTotals && seasonTotals.length > 0) {
    // generic mapping for HI metrics -> numerator/denominator keys when available
    const hiMetricMap: Record<string, { numer?: string; denom?: string }> = {
      nst_ixg_per_60: { numer: "nst_ixg", denom: "nst_toi" },
      nst_icf_per_60: { numer: "nst_icf", denom: "nst_toi" },
      nst_hdcf_per_60: { numer: "nst_hdcf", denom: "nst_toi" },
      points_per_60_5v5: { numer: "points_5v5", denom: "ev_time_on_ice" },
      pp_points_per_60: { numer: "pp_points", denom: "pp_toi" },
      pp_goals_per_60: { numer: "pp_goals", denom: "pp_toi" },
      pp_shots_per_60: { numer: "pp_shots", denom: "pp_toi" },
      nst_shots_per_60: { numer: "shots", denom: "nst_toi" },
      shooting_percentage: { numer: "goals", denom: "shots" },
      shooting_percentage_5v5: { numer: "goals_5v5", denom: "shots" },
      pp_shooting_percentage: { numer: "pp_goals", denom: "pp_shots" },
      nst_oi_shooting_pct: { numer: "nst_oi_gf", denom: "nst_oi_shots" },
      nst_oi_save_pct: {},
      nst_oi_pdo: {},
      nst_ipp: {},
      nst_oi_xgf_pct: {},
      nst_oi_cf_pct: {},
      nst_oi_scf_pct: {}
    };

    for (const m of metricAllowlist.hi) {
      try {
        const map = hiMetricMap[m] || {};
        if (map.numer && map.denom) {
          const blend = computeBlendFromSeasons(
            seasonTotals,
            map.numer,
            map.denom
          );
          if (blend) {
            // per-60 metrics should be converted if denom is time
            const isTimeDenom =
              map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time");
            const val = isTimeDenom
              ? (3600 * blend.numer) / Math.max(blend.denom, 1)
              : blend.rate;
            win_3yr[m] = {
              mu: Number(Number(val).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }

          // career aggregate: sum numerators/denominators across seasons
          const numerKey = map.numer!;
          const denomKey = map.denom!;
          const careerNumer = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[numerKey] ?? 0),
            0
          );
          const careerDenom = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[denomKey] ?? 0),
            0
          );
          const careerVal =
            map.denom &&
            (map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time"))
              ? (3600 * careerNumer) / Math.max(careerDenom, 1)
              : careerDenom > 0
                ? careerNumer / careerDenom
                : 0;
          win_career[m] = {
            mu: Number(Number(careerVal).toFixed(6)),
            sigma: Number(SIGMA_MIN.toFixed(6)),
            n: seasonTotals.length,
            numer: careerNumer,
            denom: careerDenom
          };
        } else {
          // fallback: if metric exists as a rate in seasonTotals, blend it directly
          const blendRate = computeBlendFromSeasons(seasonTotals, m);
          if (blendRate) {
            win_3yr[m] = {
              mu: Number(Number(blendRate.rate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
            // career: average the season-level rate weighted by games_played
            const careerWeightedNumer = seasonTotals.reduce(
              (s: number, r: any) =>
                s + safeNumber(r[m] ?? 0) * safeNumber(r.games_played ?? 0),
              0
            );
            const careerGames = seasonTotals.reduce(
              (s: number, r: any) => s + safeNumber(r.games_played ?? 0),
              0
            );
            const careerRate =
              careerGames > 0 ? careerWeightedNumer / careerGames : 0;
            win_career[m] = {
              mu: Number(Number(careerRate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }
        }
      } catch (err) {
        // ignore per-metric failures to keep baseline building robust
      }
    }
    // MED metrics
    const medMetricMap: Record<string, { numer?: string; denom?: string }> = {
      nst_icf_per_60: { numer: "nst_icf", denom: "nst_toi" },
      nst_hdcf_per_60: { numer: "nst_hdcf", denom: "nst_toi" },
      nst_icf: { numer: "nst_icf", denom: "nst_toi" },
      nst_hdcf: { numer: "nst_hdcf", denom: "nst_toi" }
    };

    for (const m of metricAllowlist.med) {
      try {
        const map = medMetricMap[m] || {};
        if (map.numer && map.denom) {
          const blend = computeBlendFromSeasons(
            seasonTotals,
            map.numer,
            map.denom
          );
          if (blend) {
            const isTimeDenom =
              map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time");
            const val = isTimeDenom
              ? (3600 * blend.numer) / Math.max(blend.denom, 1)
              : blend.rate;
            win_3yr[m] = {
              mu: Number(Number(val).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }
          const numerKey = map.numer!;
          const denomKey = map.denom!;
          const careerNumer = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[numerKey] ?? 0),
            0
          );
          const careerDenom = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[denomKey] ?? 0),
            0
          );
          const careerVal =
            map.denom &&
            (map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time"))
              ? (3600 * careerNumer) / Math.max(careerDenom, 1)
              : careerDenom > 0
                ? careerNumer / careerDenom
                : 0;
          win_career[m] = {
            mu: Number(Number(careerVal).toFixed(6)),
            sigma: Number(SIGMA_MIN.toFixed(6)),
            n: seasonTotals.length,
            numer: careerNumer,
            denom: careerDenom
          };
        } else {
          const blendRate = computeBlendFromSeasons(seasonTotals, m);
          if (blendRate) {
            win_3yr[m] = {
              mu: Number(Number(blendRate.rate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
            const careerWeightedNumer = seasonTotals.reduce(
              (s: number, r: any) =>
                s + safeNumber(r[m] ?? 0) * safeNumber(r.games_played ?? 0),
              0
            );
            const careerGames = seasonTotals.reduce(
              (s: number, r: any) => s + safeNumber(r.games_played ?? 0),
              0
            );
            const careerRate =
              careerGames > 0 ? careerWeightedNumer / careerGames : 0;
            win_career[m] = {
              mu: Number(Number(careerRate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }
        }
      } catch (err) {
        // ignore
      }
    }

    // LOW metrics
    const lowMetricMap: Record<string, { numer?: string; denom?: string }> = {
      nst_iff_per_60: { numer: "nst_iff", denom: "nst_toi" },
      nst_iscfs_per_60: { numer: "nst_iscfs", denom: "nst_toi" },
      nst_rush_attempts_per_60: { numer: "nst_rush_attempts", denom: "nst_toi" }
    };

    for (const m of metricAllowlist.low) {
      try {
        const map = lowMetricMap[m] || {};
        if (map.numer && map.denom) {
          const blend = computeBlendFromSeasons(
            seasonTotals,
            map.numer,
            map.denom
          );
          if (blend) {
            const isTimeDenom =
              map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time");
            const val = isTimeDenom
              ? (3600 * blend.numer) / Math.max(blend.denom, 1)
              : blend.rate;
            win_3yr[m] = {
              mu: Number(Number(val).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }
          const numerKey = map.numer!;
          const denomKey = map.denom!;
          const careerNumer = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[numerKey] ?? 0),
            0
          );
          const careerDenom = seasonTotals.reduce(
            (s: number, r: any) => s + safeNumber(r[denomKey] ?? 0),
            0
          );
          const careerVal =
            map.denom &&
            (map.denom.includes("toi") ||
              map.denom.includes("time_in") ||
              map.denom.includes("ev_time"))
              ? (3600 * careerNumer) / Math.max(careerDenom, 1)
              : careerDenom > 0
                ? careerNumer / careerDenom
                : 0;
          win_career[m] = {
            mu: Number(Number(careerVal).toFixed(6)),
            sigma: Number(SIGMA_MIN.toFixed(6)),
            n: seasonTotals.length,
            numer: careerNumer,
            denom: careerDenom
          };
        } else {
          const blendRate = computeBlendFromSeasons(seasonTotals, m);
          if (blendRate) {
            win_3yr[m] = {
              mu: Number(Number(blendRate.rate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
            const careerWeightedNumer = seasonTotals.reduce(
              (s: number, r: any) =>
                s + safeNumber(r[m] ?? 0) * safeNumber(r.games_played ?? 0),
              0
            );
            const careerGames = seasonTotals.reduce(
              (s: number, r: any) => s + safeNumber(r.games_played ?? 0),
              0
            );
            const careerRate =
              careerGames > 0 ? careerWeightedNumer / careerGames : 0;
            win_career[m] = {
              mu: Number(Number(careerRate).toFixed(6)),
              sigma: Number(SIGMA_MIN.toFixed(6)),
              n: seasonTotals.length
            };
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  return {
    win_l3,
    win_l5,
    win_l10,
    win_l20,
    win_season_prev,
    win_3yr,
    win_career
  };
}

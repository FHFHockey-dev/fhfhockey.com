/**
 * Fit and evaluate FORGE count dispersion (tasks 8.1/8.2).
 *
 * Offline: reads aggregate JSON produced by the read-only SQL below (no DB
 * client, no writes). Re-run the SQL with any read-only client and save each
 * result as a JSON array of row objects (or {columns, rows} arrays).
 *
 *   NODE_PATH=. npx ts-node --transpile-only \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/fit-forge-dispersion.ts --fit-bins FIT.json --holdout HOLDOUT.json [--json OUT.json]
 *   ... scripts/fit-forge-dispersion.ts --print-sql
 *
 * FIT_SQL (and the same query restricted to goalie shots against, stat "sa")
 * produces per (stat, position, season, mean-bin) sums for a method-of-moments
 * fit inside player-seasons (>= 20 games), so between-player rate differences
 * never count as overdispersion. Two variants:
 *   unconditional  nu = sum n (s^2 - m), du = sum n (m^2 - s^2/n)
 *   TOI-cond.      nc = sum (RSS n/(n-1) - sum mu_g), dc = sum mu_g^2,
 *                  mu_g = (player-season count per second) * game TOI
 * and Var - mu = a mu^2 + b mu is fitted by non-negative least squares
 * through the origin over bins (sx = sum n m carries the linear term).
 *
 * HOLDOUT_SQL scores 2025-26 regular-season games against a predictive mean
 * equal to the player's prior up-to-40-game mean (>= 10 prior games).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { countPmf } from "../lib/projections/uncertainty";
import { FORGE_DISPERSION, type DispersionKey } from "../lib/projections/dispersion";

const SEASON_FILTER = `season_id in (20232024, 20242025)
    and date between make_date(season_id / 10000, 10, 1) and make_date(season_id % 10000, 4, 30)`;

export const FIT_SQL = `with sk as (
  select distinct on (player_id, date) player_id, date, season_id,
    case when position_code = 'D' then 'D' else 'F' end as pos,
    toi_per_game::float8 as toi, shots::float8 as sog, hits::float8 as hit, blocked_shots::float8 as blk,
    goals::float8 as g, assists::float8 as a
  from wgo_skater_stats
  where ${SEASON_FILTER}
    and games_played = 1 and toi_per_game > 0 and position_code in ('C','L','R','D')
  order by player_id, date
), gk as (
  select distinct on (goalie_id, date) goalie_id as player_id, season_id, 'G'::text as pos,
    time_on_ice::float8 as toi, saves::float8 as x
  from wgo_goalie_stats
  where ${SEASON_FILTER}
    and games_started = 1 and time_on_ice > 0 and saves is not null
  order by goalie_id, date
), long as (
  select player_id, season_id, pos, toi, s.stat, s.x
  from sk cross join lateral (values ('sog', sk.sog), ('hit', sk.hit), ('blk', sk.blk), ('g', sk.g), ('a', sk.a)) as s(stat, x)
  where s.x is not null
  union all
  select player_id, season_id, pos, toi, 'sv', x from gk
), ps as (
  select stat, pos, season_id, player_id, count(*)::float8 as n, avg(x) as m, var_samp(x) as s2,
    sum(x) / sum(toi) as r, avg(toi) as mt, var_samp(toi) as vt
  from long group by 1, 2, 3, 4 having count(*) >= 20
), pg as (
  select l.stat, l.pos, l.season_id, l.player_id,
    sum((l.x - p.r * l.toi) ^ 2) as rss, sum(p.r * l.toi) as smu, sum((p.r * l.toi) ^ 2) as smu2
  from long l join ps p using (stat, pos, season_id, player_id) group by 1, 2, 3, 4
), b as (
  select ps.*, pg.rss, pg.smu, pg.smu2, ntile(6) over (partition by ps.stat, ps.pos order by ps.m) as bin
  from ps join pg using (stat, pos, season_id, player_id)
)
select stat, pos, season_id as season, bin, count(*) as nps, sum(n)::int as ng,
  round(min(m)::numeric, 3) as mlo, round(max(m)::numeric, 3) as mhi,
  round(sum(n * m)::numeric, 2) as sx,
  round(sum(n * (s2 - m))::numeric, 3) as nu, round(sum(n * (m * m - s2 / n))::numeric, 3) as du,
  round(sum(rss * n / (n - 1) - smu)::numeric, 3) as nc, round(sum(smu2)::numeric, 3) as dc,
  round((sum(n * vt) / sum(n * mt * mt))::numeric, 5) as tcv2
from b group by 1, 2, 3, 4 order by 1, 2, 3, 4`;
// Goalie shots against ("sa"): FIT_SQL with gk selecting shots_against and only the gk branch in "long".

export const HOLDOUT_SQL = `with sk as (
  select distinct on (player_id, date) player_id, date, season_id,
    case when position_code = 'D' then 'D' else 'F' end as pos,
    shots::float8 as sog, hits::float8 as hit, blocked_shots::float8 as blk, goals::float8 as g, assists::float8 as a
  from wgo_skater_stats
  where season_id in (20232024, 20242025, 20252026)
    and date between make_date(season_id / 10000, 10, 1) and make_date(season_id % 10000, 4, 30)
    and games_played = 1 and toi_per_game > 0 and position_code in ('C','L','R','D')
  order by player_id, date
), gk as (
  select distinct on (goalie_id, date) goalie_id as player_id, date, season_id, saves::float8 as sv, shots_against::float8 as sa
  from wgo_goalie_stats
  where season_id in (20232024, 20242025, 20252026)
    and date between make_date(season_id / 10000, 10, 1) and make_date(season_id % 10000, 4, 30)
    and games_started = 1 and time_on_ice > 0 and saves is not null and shots_against is not null
  order by goalie_id, date
), long as (
  select player_id, date, season_id, pos, s.stat, s.x
  from sk cross join lateral (values ('sog', sk.sog), ('hit', sk.hit), ('blk', sk.blk), ('g', sk.g), ('a', sk.a)) as s(stat, x)
  where s.x is not null
  union all
  select player_id, date, season_id, 'G', s.stat, s.x
  from gk cross join lateral (values ('sv', gk.sv), ('sa', gk.sa)) as s(stat, x)
), w as (
  select stat, pos, season_id, x,
    avg(x) over (partition by stat, player_id order by date rows between 40 preceding and 1 preceding) as mu,
    count(*) over (partition by stat, player_id order by date rows between 40 preceding and 1 preceding) as np
  from long
), bk as (
  select stat, pos, x, mu, ntile(20) over (partition by stat, pos order by mu) as b
  from w where season_id = 20252026 and np >= 10 and mu > 0
), cells as (
  select stat, pos, b, x, count(*) as c, sum(mu) as smu from bk group by 1, 2, 3, 4
)
select stat, pos, b, round((sum(smu) / sum(c))::numeric, 4) as mu, sum(c)::int as n,
  string_agg(x::int || ':' || c, ',' order by x) as h
from cells group by 1, 2, 3 order by 1, 2, 3`;

type FitBin = {
  stat: string;
  pos: string;
  season: number;
  bin: number;
  ng: number;
  mlo: number;
  mhi: number;
  sx: number;
  nu: number;
  du: number;
  nc: number;
  dc: number;
  tcv2: number;
};

type HoldoutCell = { stat: string; pos: string; mu: number; counts: Map<number, number> };

type Coefficients = { a: number; b: number };

function loadRows(path: string): Record<string, unknown>[] {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (Array.isArray(parsed)) return parsed;
  const { columns, rows } = parsed as { columns: string[]; rows: unknown[][] };
  return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

const num = (v: unknown) => Number(v);

function loadFitBins(path: string): FitBin[] {
  return loadRows(path).map((r) => ({
    stat: String(r.stat),
    pos: String(r.pos),
    season: num(r.season),
    bin: num(r.bin),
    ng: num(r.ng),
    mlo: num(r.mlo),
    mhi: num(r.mhi),
    sx: num(r.sx),
    nu: num(r.nu),
    du: num(r.du),
    nc: num(r.nc),
    dc: num(r.dc),
    tcv2: num(r.tcv2)
  }));
}

function loadHoldout(path: string): HoldoutCell[] {
  return loadRows(path).map((r) => {
    const counts = new Map<number, number>();
    for (const part of String(r.h).split(",")) {
      const [x, c] = part.split(":").map(Number);
      counts.set(x, (counts.get(x) ?? 0) + c);
    }
    const total = [...counts.values()].reduce((s, c) => s + c, 0);
    if (r.n != null && total !== num(r.n)) throw new Error(`Histogram total mismatch for ${r.stat}/${r.pos}/${r.b}`);
    return { stat: String(r.stat), pos: String(r.pos), mu: num(r.mu), counts };
  });
}

/** Non-negative least squares through the origin for y = a*x1 + b*x2. */
export function fitQuadraticLinear(rows: Array<{ y: number; x1: number; x2: number }>): Coefficients {
  const s = rows.reduce(
    (acc, r) => ({
      x1x1: acc.x1x1 + r.x1 * r.x1,
      x2x2: acc.x2x2 + r.x2 * r.x2,
      x1x2: acc.x1x2 + r.x1 * r.x2,
      x1y: acc.x1y + r.x1 * r.y,
      x2y: acc.x2y + r.x2 * r.y
    }),
    { x1x1: 0, x2x2: 0, x1x2: 0, x1y: 0, x2y: 0 }
  );
  const det = s.x1x1 * s.x2x2 - s.x1x2 * s.x1x2;
  if (det > 0) {
    const a = (s.x1y * s.x2x2 - s.x2y * s.x1x2) / det;
    const b = (s.x2y * s.x1x1 - s.x1y * s.x1x2) / det;
    if (a >= 0 && b >= 0) return { a, b };
  }
  const aOnly = s.x1x1 > 0 ? Math.max(0, s.x1y / s.x1x1) : 0;
  const bOnly = s.x2x2 > 0 ? Math.max(0, s.x2y / s.x2x2) : 0;
  const sse = (c: Coefficients) => rows.reduce((t, r) => t + (r.y - c.a * r.x1 - c.b * r.x2) ** 2, 0);
  return sse({ a: aOnly, b: 0 }) <= sse({ a: 0, b: bOnly }) ? { a: aOnly, b: 0 } : { a: 0, b: bOnly };
}

export type ScoreSummary = {
  n: number;
  logScore: number;
  rps: number;
  pitTv: number;
  pitLow: number;
  pitHigh: number;
};

/** Mean negative log score, mean RPS and randomized-PIT histogram flatness. */
export function scoreCells(
  cells: Array<{ mu: number; counts: Map<number, number> }>,
  alphaFor: (mu: number) => number
): ScoreSummary {
  let n = 0;
  let logScore = 0;
  let rps = 0;
  const pit = new Array(10).fill(0);
  for (const cell of cells) {
    const pmf = countPmf(cell.mu, alphaFor(cell.mu));
    const cdf: number[] = [];
    pmf.reduce((acc, p, k) => (cdf[k] = acc + p), 0);
    const F = (k: number) => (k < 0 ? 0 : k >= cdf.length ? 1 : Math.min(1, cdf[k]));
    for (const [x, c] of cell.counts) {
      n += c;
      const px = Math.max(F(x) - F(x - 1), 1e-300);
      logScore -= c * Math.log(px);
      let r = 0;
      for (let k = 0; k < Math.max(cdf.length, x + 1); k += 1) r += (F(k) - (x <= k ? 1 : 0)) ** 2;
      rps += c * r;
      const lo = F(x - 1);
      const hi = F(x);
      for (let j = 0; j < 10; j += 1) {
        const overlap = Math.max(0, Math.min(hi, (j + 1) / 10) - Math.max(lo, j / 10));
        pit[j] += hi > lo ? (c * overlap) / (hi - lo) : j === Math.min(9, Math.floor(lo * 10)) ? c : 0;
      }
    }
  }
  const freq = pit.map((v) => v / n);
  return {
    n,
    logScore: logScore / n,
    rps: rps / n,
    pitTv: freq.reduce((t, f) => t + Math.abs(f - 0.1), 0) / 2,
    pitLow: freq[0],
    pitHigh: freq[9]
  };
}

const f = (v: number, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");

export function runFit(args: string[]) {
  const opt = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--print-sql") opt.set("--print-sql", "1");
    else if (args[i].startsWith("--")) opt.set(args[i], args[(i += 1)]);
  }
  if (opt.has("--print-sql")) {
    console.log(`-- FIT_SQL\n${FIT_SQL};\n\n-- HOLDOUT_SQL\n${HOLDOUT_SQL};`);
    return null;
  }
  if (!opt.get("--fit-bins") || !opt.get("--holdout"))
    throw new Error("Use --fit-bins FILE --holdout FILE [--json OUT] or --print-sql");
  const bins = loadFitBins(opt.get("--fit-bins")!);
  const holdout = loadHoldout(opt.get("--holdout")!);
  const keys = [...new Set(bins.map((b) => `${b.stat}:${b.pos}`))].sort();
  const output: Record<string, unknown> = {};
  const lines: string[] = [];

  lines.push("## Fit (2023-24 + 2024-25, within player-season MoM)");
  lines.push("| stat:pos | games | alpha_U pooled | alpha_U 23-24 | alpha_U 24-25 | U a | U b | alpha_C pooled | C a | C b | TOI CV^2 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  const binLines: string[] = ["", "## alpha by player-season mean bin (pooled seasons; U = unconditional, C = TOI-conditional)", "| stat:pos | bin | mean range | games | alpha_U | alpha_C |", "|---|---|---|---|---|---|"];
  const fits = new Map<string, { pooledU: number; u: Coefficients; c: Coefficients; tcv2: number }>();
  for (const key of keys) {
    const rows = bins.filter((b) => `${b.stat}:${b.pos}` === key);
    const sum = (sel: (b: FitBin) => number, rs = rows) => rs.reduce((t, b) => t + sel(b), 0);
    const pooledU = sum((b) => b.nu) / sum((b) => b.du);
    const pooledC = sum((b) => b.nc) / sum((b) => b.dc);
    const bySeason = (season: number) => {
      const rs = rows.filter((b) => b.season === season);
      return sum((b) => b.nu, rs) / sum((b) => b.du, rs);
    };
    const u = fitQuadraticLinear(rows.map((b) => ({ y: b.nu, x1: b.du, x2: b.sx })));
    const c = fitQuadraticLinear(rows.map((b) => ({ y: b.nc, x1: b.dc, x2: b.sx })));
    const games = sum((b) => b.ng);
    const tcv2 = sum((b) => b.ng * b.tcv2) / games;
    fits.set(key, { pooledU, u, c, tcv2 });
    lines.push(`| ${key} | ${games} | ${f(pooledU)} | ${f(bySeason(20232024))} | ${f(bySeason(20242025))} | ${f(u.a)} | ${f(u.b)} | ${f(pooledC)} | ${f(c.a)} | ${f(c.b)} | ${f(tcv2)} |`);
    for (const bin of [...new Set(rows.map((b) => b.bin))].sort((x, y) => x - y)) {
      const rs = rows.filter((b) => b.bin === bin);
      binLines.push(`| ${key} | ${bin} | ${f(Math.min(...rs.map((b) => b.mlo)), 2)}-${f(Math.max(...rs.map((b) => b.mhi)), 2)} | ${sum((b) => b.ng, rs)} | ${f(sum((b) => b.nu, rs) / sum((b) => b.du, rs))} | ${f(sum((b) => b.nc, rs) / sum((b) => b.dc, rs))} |`);
    }
    output[key] = { games, pooledU, pooledC, u, c, tcv2, seasonU: { 20232024: bySeason(20232024), 20242025: bySeason(20242025) } };
  }
  lines.push(...binLines);

  lines.push("", "## Holdout 2025-26 (predictive mean = prior up-to-40-game mean); lower log/RPS/PIT-TV is better");
  lines.push("| stat:pos | n | model | log score | RPS | PIT TV | PIT 0-0.1 | PIT 0.9-1 |");
  lines.push("|---|---|---|---|---|---|---|---|");
  const evaluation: Record<string, unknown> = {};
  for (const key of [...new Set(holdout.map((c) => `${c.stat}:${c.pos}`))].sort()) {
    const cells = holdout.filter((c) => `${c.stat}:${c.pos}` === key);
    const fit = fits.get(key);
    const shipped = FORGE_DISPERSION[key as DispersionKey];
    const candidates: Array<[string, (mu: number) => number]> = [["poisson", () => 0]];
    if (fit) {
      candidates.push([`nb2 a=${f(Math.max(0, fit.pooledU), 3)}`, () => Math.max(0, fit.pooledU)]);
      candidates.push([`nb a=${f(fit.u.a, 3)} b=${f(fit.u.b, 3)}`, (mu) => fit.u.a + fit.u.b / mu]);
    }
    if (shipped) {
      candidates.push(["shipped", (mu) => shipped.unconditional.a + shipped.unconditional.b / mu]);
    }
    // Diagnostic only (fitted on the holdout itself): best constant alpha by log score.
    let best = { alpha: 0, log: Infinity };
    for (let a = 0; a <= 0.4 + 1e-9; a += 0.005) {
      const s = scoreCells(cells, () => a);
      if (s.logScore < best.log) best = { alpha: a, log: s.logScore };
    }
    candidates.push([`holdout-best a=${f(best.alpha, 3)} (diag)`, () => best.alpha]);
    evaluation[key] = candidates.map(([name, alphaFor]) => {
      const s = scoreCells(cells, alphaFor);
      lines.push(`| ${key} | ${s.n} | ${name} | ${f(s.logScore)} | ${f(s.rps)} | ${f(s.pitTv, 3)} | ${f(s.pitLow, 3)} | ${f(s.pitHigh, 3)} |`);
      return { name, ...s };
    });
  }
  console.log(lines.join("\n"));
  if (opt.get("--json")) writeFileSync(resolve(opt.get("--json")!), JSON.stringify({ fit: output, evaluation }, null, 2));
  return { fit: output, evaluation };
}

if (require.main === module) {
  try {
    runFit(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

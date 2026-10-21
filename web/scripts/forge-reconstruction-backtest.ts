import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { clusterBootstrap, summarize, topDecile, type ScoredRow } from "./forge-counterfactual-backtest";

/**
 * Offline scoring of FORGE reconstruction captures from four code variants on identical games:
 * a (master), b (master + sidecar hydration), a0 (a without the R18 ES-assist refit), b0 (b without R18).
 * Reads `<recon-dir>/<variant>/<DATE>-<GAME>.json` captures plus local actuals; writes only --output.
 */
type Json = Record<string, any>;
export const RECON_VARIANTS = ["a", "b", "a0", "b0"] as const;
export type ReconVariant = (typeof RECON_VARIANTS)[number];
export const RECON_HEADS = ["G", "A", "PPP", "SOG", "HIT", "BLK"] as const;
export type ReconHead = (typeof RECON_HEADS)[number];
export const RECON_PAIRS: [ReconVariant, ReconVariant, string][] = [
  ["b", "a", "hydration effect, R18 on"], ["b0", "a0", "hydration effect, R18 off"],
  ["a", "a0", "R18 effect without hydration"], ["b", "b0", "R18 effect with hydration"],
];
export type ReconRow = ScoredRow & { date: string; heads: ReconHead[]; preds: Record<ReconVariant, Record<ReconHead, number>> };
export type Checks = Record<string, number>;
const MAX_BYTES = 64 * 1024 * 1024;
const bump = (checks: Checks, key: string, by = 1) => { checks[key] = (checks[key] ?? 0) + by; };
const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || typeof v === "boolean" || !Number.isFinite(Number(v)) ? null : Number(v);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Every row upserted by a chain that starts with from("forge_player_projections"). */
export function extractPlayerRows(capture: Json): Json[] {
  const rows: Json[] = [];
  for (const chain of Array.isArray(capture?.intendedWrites) ? capture.intendedWrites : []) {
    if (!Array.isArray(chain) || chain[0]?.method !== "from" || chain[0]?.args?.[0] !== "forge_player_projections") continue;
    for (const op of chain.slice(1)) if (op?.method === "upsert" && Array.isArray(op.args?.[0])) rows.push(...op.args[0]);
  }
  return rows;
}

/** Head values from one projection row; a head with any null component is null. */
export function headValues(row: Json): Record<ReconHead, number | null> {
  const sum = (...keys: string[]) => (keys.some((k) => num(row[k]) == null) ? null : keys.reduce((s, k) => s + num(row[k])!, 0));
  return { G: sum("proj_goals_es", "proj_goals_pp"), A: sum("proj_assists_es", "proj_assists_pp"),
    PPP: sum("proj_goals_pp", "proj_assists_pp"), SOG: sum("proj_shots_es", "proj_shots_pp"),
    HIT: sum("proj_hits"), BLK: sum("proj_blocks") };
}

/** Joins captures (variant -> stem -> rows) to actuals; keeps games in all variants and dressed player-games only. */
export function buildRows(input: { captures: Record<ReconVariant, Map<string, Json[]>>; actuals: Json[]; hitsBlocks: Json[] }) {
  const checks: Checks = {};
  const stems = new Set(RECON_VARIANTS.flatMap((v) => [...input.captures[v].keys()]));
  const kept = [...stems].filter((s) => RECON_VARIANTS.every((v) => input.captures[v].has(s))).sort();
  const dropped = [...stems].filter((s) => !kept.includes(s)).sort()
    .map((s) => `${s} (missing: ${RECON_VARIANTS.filter((v) => !input.captures[v].has(s)).join(", ")})`);
  const actuals = new Map(input.actuals.map((a) => [`${a.game_id}:${a.player_id}`, a]));
  const hb = new Map(input.hitsBlocks.map((a) => [`${a.game_id}:${a.player_id}`, a]));
  const rows: ReconRow[] = [];
  for (const stem of kept) {
    const date = stem.slice(0, 10);
    const byVariant = {} as Record<ReconVariant, Map<string, Json>>;
    for (const v of RECON_VARIANTS) {
      byVariant[v] = new Map();
      for (const row of input.captures[v].get(stem)!) {
        if (num(row.horizon_games) !== 1) { bump(checks, `skip_horizon_not_1_${v}`); continue; }
        const key = `${row.game_id}:${row.player_id}`;
        if (byVariant[v].has(key)) bump(checks, `duplicate_player_row_${v}`);
        byVariant[v].set(key, row);
      }
    }
    for (const key of [...byVariant.a.keys()].sort()) {
      bump(checks, "player_games_projected_a");
      if (RECON_VARIANTS.some((v) => !byVariant[v].has(key))) { bump(checks, "drop_player_not_in_all_variants"); continue; }
      const actual = actuals.get(key);
      if (!actual || String(actual.date ?? date).slice(0, 10) !== date) { bump(checks, "drop_no_actual_not_dressed"); continue; }
      const values = Object.fromEntries(RECON_VARIANTS.map((v) => [v, headValues(byVariant[v].get(key)!)])) as Record<ReconVariant, Record<ReconHead, number | null>>;
      const extra = hb.get(key);
      const truth: Record<ReconHead, number | null> = { G: num(actual.goals), A: num(actual.assists), PPP: num(actual.pp_points),
        SOG: num(actual.shots), HIT: num(extra?.hits), BLK: num(extra?.blocked_shots) };
      const heads = RECON_HEADS.filter((h) => {
        if (RECON_VARIANTS.some((v) => values[v][h] == null)) { bump(checks, `head_null_component_${h}`); return false; }
        if (truth[h] == null) { bump(checks, `head_no_actual_${h}`); return false; }
        return true;
      });
      const zero = (line: Record<ReconHead, number | null>) => Object.fromEntries(RECON_HEADS.map((h) => [h, line[h] ?? NaN])) as Record<ReconHead, number>;
      const [gameId, playerId] = key.split(":").map(Number);
      rows.push({ gameId, playerId, date, heads, actual: zero(truth),
        preds: Object.fromEntries(RECON_VARIANTS.map((v) => [v, zero(values[v])])) as ReconRow["preds"] });
    }
  }
  checks.games_kept = kept.length;
  checks.games_dropped = dropped.length;
  checks.rows_used = rows.length;
  return { rows, checks, kept, dropped };
}

/** A pair as the bootstrap expects it: the reference variant becomes "baseline". */
export function pairRows(rows: ReconRow[], variant: ReconVariant, reference: ReconVariant): ScoredRow[] {
  return rows.map((r) => ({ ...r, preds: { baseline: r.preds[reference], [variant]: r.preds[variant] } }));
}

const f = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const signed = (x: number, d = 4) => (Number.isFinite(x) ? `${x >= 0 ? "+" : ""}${x.toFixed(d)}` : "n/a");
const ci = (d: number, c: number[]) => `${signed(d)} [${signed(c[0])}, ${signed(c[1])}]`;

export function renderReport(args: { rows: ReconRow[]; checks: Checks; kept: string[]; dropped: string[];
  inputs: { name: string; path: string; sha256: string }[]; seed: number; reps: number }) {
  const { rows, seed, reps } = args;
  const metrics = ["| variant | head | n | MAE | bias | RMSE |", "|---|---|---|---|---|---|"];
  for (const h of RECON_HEADS) for (const v of RECON_VARIANTS) {
    const s = summarize(rows, v, h);
    metrics.push(`| ${v} | ${h} | ${s.n} | ${f(s.mae)} | ${signed(s.bias)} | ${f(s.rmse)} |`);
  }
  const pairs = ["| pair | effect | head | n | ΔMAE [95% CI] | Δbias [95% CI] | ΔRMSE [95% CI] |", "|---|---|---|---|---|---|---|"];
  for (const [v, ref, label] of RECON_PAIRS) for (const h of RECON_HEADS) {
    const paired = pairRows(rows, v, ref), b = clusterBootstrap(paired, v, h, seed, reps);
    pairs.push(`| ${v} vs ${ref} | ${label} | ${h} | ${summarize(paired, v, h).n} | ${ci(b.dMae, b.dMaeCi)} | ${ci(b.dBias, b.dBiasCi)} | ${ci(b.dRmse, b.dRmseCi)} |`);
  }
  const fixed = topDecile(rows, "a");
  const calibration = ["| variant | head | bin | n | Σactual/Σpred | mean pred | mean actual |", "|---|---|---|---|---|---|---|"];
  const calRow = (set: ScoredRow[], v: string, h: string, bin: string) => {
    const s = summarize(set, v, h);
    return `| ${v} | ${h} | ${bin} | ${s.n} | ${f(s.sumActual / s.sumPred, 3)} | ${f(s.sumPred / s.n)} | ${f(s.sumActual / s.n)} |`;
  };
  for (const v of RECON_VARIANTS) {
    for (const h of RECON_HEADS) calibration.push(calRow(fixed, v, h, "variant-a G top decile"));
    calibration.push(calRow(topDecile(rows, v), v, "G", "own top decile"));
  }
  return [
    "# FORGE reconstruction backtest (variants a, b, a0, b0)", "",
    "a = master; b = master + sidecar hydration; a0 = a without the R18 ES-assist refit; b0 = b without R18.",
    `Games in all four variants only; dressed player-games (actual row present). Seed ${seed}, ${reps} paired cluster-bootstrap reps by game_id; Δ = first minus second variant.`, "",
    "## Inputs", "", "| input | path | sha256 |", "|---|---|---|", ...args.inputs.map((i) => `| ${i.name} | ${i.path} | ${i.sha256} |`), "",
    `Games kept: ${args.kept.length}; dropped (not in all four variants): ${args.dropped.length ? args.dropped.join("; ") : "none"}.`, "",
    "## Metrics per variant", "", ...metrics, "",
    "## Paired deltas", "", ...pairs, "",
    "## Top-decile calibration (bins fixed by variant a predicted G)", "", ...calibration, "",
    "## Check counts", "", "| check | count |", "|---|---|",
    ...Object.entries(args.checks).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `| ${k} | ${v} |`),
  ].join("\n");
}

function readJson(path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error(`${path} exceeds 64 MiB`);
  const bytes = new Uint8Array(readFileSync(path));
  return { sha256: sha(bytes), value: JSON.parse(Buffer.from(bytes).toString("utf8")) };
}

/** Loads `<dir>/<variant>/<DATE>-<GAME>.json`; other files are ignored. One combined hash per variant. */
export function loadCaptures(dir: string) {
  const captures = {} as Record<ReconVariant, Map<string, Json[]>>, hashes: { name: string; path: string; sha256: string }[] = [];
  for (const v of RECON_VARIANTS) {
    const vdir = join(dir, v), files = readdirSync(vdir).filter((n) => /^\d{4}-\d{2}-\d{2}-\d+\.json$/.test(n)).sort();
    captures[v] = new Map();
    const parts: string[] = [];
    for (const name of files) {
      const { sha256, value } = readJson(join(vdir, name));
      captures[v].set(name.replace(/\.json$/, ""), extractPlayerRows(value));
      parts.push(`${name}:${sha256}`);
    }
    hashes.push({ name: `captures ${v} (${files.length} files)`, path: vdir, sha256: sha(new TextEncoder().encode(parts.join("\n"))) });
  }
  return { captures, hashes };
}

const USAGE = "Use --recon-dir DIR --actuals FILE --hits-blocks FILE --output NEW_FILE [--seed N] [--reps N]";
export function runReconstructionBacktest(argv: string[]) {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--recon-dir", "--actuals", "--hits-blocks", "--output", "--seed", "--reps"].includes(argv[i]) || !argv[i + 1] || opts.has(argv[i])) throw new Error(USAGE);
    opts.set(argv[i], argv[i + 1]);
  }
  for (const k of ["--recon-dir", "--actuals", "--hits-blocks", "--output"]) if (!opts.has(k)) throw new Error(USAGE);
  const seed = Number(opts.get("--seed") ?? 1), reps = Number(opts.get("--reps") ?? 2000);
  if (!Number.isInteger(seed) || !Number.isInteger(reps) || reps < 1) throw new Error(USAGE);
  const { captures, hashes } = loadCaptures(resolve(opts.get("--recon-dir")!));
  const [actuals, hitsBlocks] = (["--actuals", "--hits-blocks"] as const).map((k) => ({ path: resolve(opts.get(k)!), ...readJson(resolve(opts.get(k)!)) }));
  if (!Array.isArray(actuals.value) || !Array.isArray(hitsBlocks.value)) throw new Error("actuals and hits-blocks must be JSON arrays");
  const built = buildRows({ captures, actuals: actuals.value, hitsBlocks: hitsBlocks.value });
  const report = renderReport({ ...built, seed, reps, inputs: [...hashes,
    { name: "actuals", path: actuals.path, sha256: actuals.sha256 }, { name: "hits-blocks", path: hitsBlocks.path, sha256: hitsBlocks.sha256 }] });
  // A new output is required so prior reports are never overwritten.
  writeFileSync(resolve(opts.get("--output")!), report + "\n", { flag: "wx" });
  return { report, ...built };
}

if (require.main === module) {
  try {
    const { checks } = runReconstructionBacktest(process.argv.slice(2));
    console.log(JSON.stringify(checks));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

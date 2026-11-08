// @vitest-environment node
/** Opt-in local evaluation of TJ's decision-1 personal baseline. Skipped unless every input path is set.
 * Reads frozen local files only, each verified by SHA-256; writes only to BLSH_BASELINE_EVAL_OUT.
 * No database, provider or network access. Development evidence only: 2025-26 is an untouched reserve.
 *
 * BLSH_DEV_HISTORY        2022-23/2023-24 dev-history.jsonl (export_dev_history.py)
 * BLSH_DB_HISTORY         2024-25 db-history.jsonl (export_db_history.py)
 * BLSH_CURRENT_REQUEST    optional 2026-27 CURRENT-REQUEST.json, for the current-season cutoff counts
 * BLSH_BASELINE_EVAL_OUT  new output directory
 *
 * Design: at each origin date, each player's window is their last five games on or before it (last game
 * within seven days). Every baseline uses only games strictly before the window. The target is the
 * player's next 10 to 20 games of the same season after the origin. Errors compare each baseline's rate
 * with the target's rate in the same unit (per game, per 60).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { devSlot, type DevRow, type Slot } from "../../lib/buyLowSellHigh/currentWindows";
import { INSUFFICIENT_HISTORY_GAMES, outcomes, PRODUCTION_TRACKS, weightedBaseline, type BaselineGame } from "../../lib/buyLowSellHigh/productionReference";

const PINS = {
  "dev-history.jsonl": "da32a473923e7b9940032c7ee22c1292e73798c7dc242a956a0244233d020106",
  "db-history.jsonl": "3b4e6429d04caa97e63bc37e3ff570b84cd0cd19a00b6248e28d5440b5f5fb3a",
  "CURRENT-REQUEST.json": "dcba14c2253d82bc70690d3c21112d926c1cdfc4f361024aa8a02f117e262465",
};
const env = process.env, ready = ["BLSH_DEV_HISTORY", "BLSH_DB_HISTORY", "BLSH_BASELINE_EVAL_OUT"].every(k => env[k]);
const COVERED = [20222023, 20232024, 20242025];
const ORIGIN_DAYS = ["11-15", "12-15", "01-15", "02-15", "03-15"];
const EVAL_SEASONS = [20232024, 20242025];
const TARGET_MAX = 20, TARGET_MIN = 10, FRESH_DAYS = 7, BOOTSTRAP = 1000;
const UNITS = ["per_game", "per_60"] as const;
type Rates = { perGame: (number | null)[]; per60: (number | null)[] };

const sha256 = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const days = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
const usable = (s: BaselineGame) => s.gamesPlayed === 1 && s.seconds !== null && s.seconds > 0 && s.tracks[0] !== null;
/** Unweighted rates over usable games; a track missing in a game is left out of that track only. */
function rates(games: BaselineGame[]): Rates {
  const used = games.filter(usable);
  const perGame: (number | null)[] = [], per60: (number | null)[] = [];
  for (let j = 0; j < 3; j++) {
    const rows = used.filter(g => g.tracks[j] !== null), y = rows.reduce((a, g) => a + (g.tracks[j] as number), 0), t = rows.reduce((a, g) => a + (g.seconds as number), 0);
    perGame.push(rows.length ? y / rows.length : null);
    per60.push(t > 0 ? (3600 * y) / t : null);
  }
  return { perGame, per60 };
}
/** Seeded generator so the bootstrap is reproducible. */
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

/** Candidate baselines, each given the player's games strictly before the window. */
const weighted = (current: number) => (before: BaselineGame[], season: number, start: string) => {
  const b = weightedBaseline(before, season, start, COVERED, { prior: [0.6, 0.3, 0.1], current });
  return b.games ? b : null;
};
const BASELINES: Record<string, (before: BaselineGame[], season: number, start: string) => Rates | null> = {
  weighted_0_6_0_3_0_1_current_1_0: weighted(1.0),
  last_82_games: before => { const used = before.filter(usable).slice(-82); return used.length ? rates(used) : null; },
  prior_season: (before, season) => { const used = before.filter(g => g.season === season - 10001 && usable(g)); return used.length ? rates(used) : null; },
  last_50_games_arms_A_B: before => { const used = before.filter(usable).slice(-50); return used.length ? rates(used) : null; },
  sensitivity_current_0_3: weighted(0.3),
  sensitivity_current_0_6_a_priori: weighted(0.6),
  sensitivity_current_1_5: weighted(1.5),
};
/** The frozen default (TJ, 2026-11-04, from the first development run). */
const PRIMARY = "weighted_0_6_0_3_0_1_current_1_0";

describe.skipIf(!ready)("BLSH personal-baseline evaluation (local, development seasons only)", () => {
  it("compares the weighted baseline with the 82-game and prior-season baselines chronologically", () => {
    const read = (path: string, pin: string) => {
      const bytes = readFileSync(path);
      if (sha256(bytes) !== pin) throw new Error(`Pin mismatch: ${path}`);
      return bytes.toString("utf8");
    };
    const out = env.BLSH_BASELINE_EVAL_OUT!;
    if (existsSync(out)) throw new Error("Output directory must be new");
    const rows = [read(env.BLSH_DEV_HISTORY!, PINS["dev-history.jsonl"]), read(env.BLSH_DB_HISTORY!, PINS["db-history.jsonl"])]
      .flatMap(text => text.split("\n").filter(Boolean).map(l => JSON.parse(l) as DevRow));
    if (rows.some(r => !COVERED.includes(r.season_id))) throw new Error("Unexpected season: 2025-26 is reserved");
    const players = new Map<number, Slot[]>();
    for (const r of rows) { const s = devSlot(r); if (!players.has(s.playerId)) players.set(s.playerId, []); players.get(s.playerId)!.push(s); }
    players.forEach(g => g.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));

    type Case = { playerId: number; season: number; origin: string; windowStart: string; targetGames: number; truth: Rates; predictions: Record<string, Rates | null>;
      weightedGames: number; weightedStatus: string; missingSeasons: number[]; position: string | null };
    const cases: Case[] = [];
    const originRows: { season: number; origin: string; windows: number; withTarget: number }[] = [];
    for (const season of EVAL_SEASONS) {
      const y = Math.floor(season / 10000);
      for (const md of ORIGIN_DAYS) {
        const origin = `${md < "07" ? y + 1 : y}-${md}`;
        let windows = 0, withTarget = 0;
        for (const [pid, games] of players) {
          const seasonGames = games.filter(g => g.season === season);
          const upTo = seasonGames.filter(g => g.date <= origin);
          if (upTo.length < 5) continue;
          const w = upTo.slice(-5);
          if (days(w[4].date, origin) > FRESH_DAYS || !w.every(usable)) continue;
          windows++;
          const target = seasonGames.filter(g => g.date > origin && usable(g)).slice(0, TARGET_MAX);
          if (target.length < TARGET_MIN) continue;
          withTarget++;
          // Strictly before the window: the baselines never see the window or anything later.
          const before = games.filter(g => g.date < w[0].date);
          const predictions = Object.fromEntries(Object.entries(BASELINES).map(([k, f]) => [k, f(before, season, w[0].date)]));
          const b = weightedBaseline(before, season, w[0].date, COVERED);
          cases.push({ playerId: pid, season, origin, windowStart: w[0].date, targetGames: target.length, truth: rates(target), predictions,
            weightedGames: b.games, weightedStatus: b.status, missingSeasons: b.missingSeasons, position: w[4].position });
        }
        originRows.push({ season, origin, windows, withTarget });
      }
    }

    /** Errors on the windows every baseline can score, so all baselines are compared on the same cases. */
    const score = (subset: Case[], label: string) => {
      const common = subset.filter(c => Object.values(c.predictions).every(p => p !== null));
      const result: Record<string, unknown> = { label, windows: subset.length, commonWindows: common.length, players: new Set(common.map(c => c.playerId)).size };
      for (const unit of UNITS) for (let j = 0; j < 3; j++) {
        const key = unit === "per_game" ? "perGame" : "per60";
        const rowsFor = (b: string) => common.map(c => ({ pid: c.playerId, e: (c.predictions[b]![key][j] ?? NaN) - (c.truth[key][j] ?? NaN) })).filter(r => Number.isFinite(r.e));
        const table: Record<string, unknown> = {};
        const primary = new Map<number, { se: number; n: number }>();
        rowsFor(PRIMARY).forEach(r => { const p = primary.get(r.pid) ?? { se: 0, n: 0 }; p.se += r.e ** 2; p.n++; primary.set(r.pid, p); });
        for (const b of Object.keys(BASELINES)) {
          const r = rowsFor(b);
          const mse = r.reduce((a, x) => a + x.e ** 2, 0) / r.length;
          const entry: Record<string, unknown> = { n: r.length, mae: r.reduce((a, x) => a + Math.abs(x.e), 0) / r.length, rmse: Math.sqrt(mse), bias: r.reduce((a, x) => a + x.e, 0) / r.length };
          if (b !== PRIMARY) {
            // Paired MSE difference (this baseline minus the primary), players resampled with replacement.
            const per = new Map<number, { se: number; n: number }>();
            r.forEach(x => { const p = per.get(x.pid) ?? { se: 0, n: 0 }; p.se += x.e ** 2; p.n++; per.set(x.pid, p); });
            const ids = [...per.keys()].filter(id => primary.has(id)), rand = mulberry32(20261104 + j + (unit === "per_60" ? 10 : 0));
            const diff = (sample: number[]) => {
              let a = 0, p = 0, n = 0;
              for (const id of sample) { a += per.get(id)!.se; p += primary.get(id)!.se; n += per.get(id)!.n; }
              return (a - p) / n;
            };
            const draws = Array.from({ length: BOOTSTRAP }, () => diff(ids.map(() => ids[Math.floor(rand() * ids.length)]))).sort((x, y) => x - y);
            entry.mseMinusPrimary = diff(ids);
            entry.mseMinusPrimaryCI95 = [quantile(draws, 0.025), quantile(draws, 0.975)];
          }
          table[b] = entry;
        }
        result[`${unit}:${PRODUCTION_TRACKS[j]}`] = table;
      }
      return result;
    };

    const cutoff = (subset: { weightedGames: number; weightedStatus: string }[]) => ({
      windows: subset.length,
      belowCutoff: subset.filter(c => c.weightedGames < INSUFFICIENT_HISTORY_GAMES).length,
      byStatus: subset.filter(c => c.weightedGames < INSUFFICIENT_HISTORY_GAMES).reduce<Record<string, number>>((a, c) => {
        const k = c.weightedGames === 0 ? c.weightedStatus : "personal_1_to_19"; a[k] = (a[k] ?? 0) + 1; return a; }, {}),
    });
    const withPrediction = cases.filter(c => c.predictions[PRIMARY] !== null);
    const summary: Record<string, unknown> = {
      version: "blsh-baseline-evaluation-v2", pins: PINS, coveredSeasons: COVERED, reservedSeason: 20252026, evalSeasons: EVAL_SEASONS, originDays: ORIGIN_DAYS,
      design: { window: "last 5 usable games on or before the origin, last within 7 days", baselines: "games strictly before the window start",
        target: `next ${TARGET_MIN}-${TARGET_MAX} usable games of the same season after the origin`, errors: "baseline rate minus target rate, same unit; windows every baseline can score",
        bootstrap: `${BOOTSTRAP} player-cluster resamples, seeded` },
      origins: originRows,
      overall: score(cases, "all development origins"),
      bySeason: EVAL_SEASONS.map(s => score(cases.filter(c => c.season === s), `origins in ${s}`)),
      byHistory: [score(withPrediction.filter(c => c.weightedGames < INSUFFICIENT_HISTORY_GAMES), "weighted baseline below 20 games"),
        score(withPrediction.filter(c => c.weightedGames >= INSUFFICIENT_HISTORY_GAMES), "weighted baseline 20+ games")],
      byPosition: ["F", "D"].map(pos => score(cases.filter(c => c.position === pos), `position ${pos}`)),
      cutoff: { all: cutoff(cases), bySeason: EVAL_SEASONS.map(s => ({ season: s, ...cutoff(cases.filter(c => c.season === s)) })),
        missingSeasons: cases.reduce<Record<string, number>>((a, c) => { const k = c.missingSeasons.join("+") || "none"; a[k] = (a[k] ?? 0) + 1; return a; }, {}) },
    };

    // Current season: how many 2026-27 windows the cutoff would withhold with 2025-26 still reserved.
    if (env.BLSH_CURRENT_REQUEST) {
      const request = JSON.parse(read(env.BLSH_CURRENT_REQUEST, PINS["CURRENT-REQUEST.json"])) as { eventThroughDate: string; wgo: { rows: { id: number; player_id: number; season_id: number; date: string; games_played: number | null; toi_per_game: number | null; counts: Record<string, number | null> }[] } };
      const current = new Map<number, BaselineGame[]>();
      for (const r of request.wgo.rows) {
        const g = { id: r.id, season: r.season_id, date: r.date, gamesPlayed: r.games_played, seconds: r.toi_per_game, tracks: r.games_played === 1 ? outcomes(r.counts).map(m => m.value) : [null, null, null] };
        if (!current.has(r.player_id)) current.set(r.player_id, []);
        current.get(r.player_id)!.push(g);
      }
      const rowsNow = [...current].map(([pid, games]) => {
        games.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
        const w = games.slice(-5), b = weightedBaseline([...(players.get(pid) ?? []), ...games.slice(0, -5)], w[0].season, w[0].date, COVERED);
        return { weightedGames: b.games, weightedStatus: b.status, fullWindow: games.length >= 5, seasons: b.seasons };
      });
      const full = rowsNow.filter(r => r.fullWindow);
      summary.current2026 = { eventThroughDate: request.eventThroughDate, players: rowsNow.length, fullWindowPlayers: full.length,
        method: "WGO rows only (no current input qualification); window = last five recorded games", missingSeasons: [20252026],
        cutoff: cutoff(full), shareOfWeightFromCurrentSeasonMedian: quantile(full.map(r => r.seasons.find(s => s.season === 20262027)!.share).sort((a, b) => a - b), 0.5) };
    }
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "EVALUATION.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every(c => c.windowStart <= c.origin)).toBe(true);
  }, 900_000);
});

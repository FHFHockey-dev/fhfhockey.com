/**
 * FORGE pregame slate queue — planning and offline rehearsal only. There is no live mode yet.
 *
 * Modes (exactly one):
 *   (default) --plan   Print the dispatch plan for the given games. No environment, credentials or network.
 *                      --games 2026020328@2026-11-16T00:00:00Z,2026020329@2026-11-16T00:00:00Z  (or --slate-file <json array>)
 *                      [--now <ISO>] [--concurrency 2] [--lead-min 10] [--stagger-sec 30] [--slate-date YYYY-MM-DD]
 *   --rehearse         Offline simulation of a whole slate through the real queue and custody path: in-memory custody per
 *                      game, a virtual clock and the test-only TSA. Network is trapped and counted.
 *
 * Run from web/:  NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *                   scripts/forge-pregame-slate.ts [--rehearse]
 */
import { readFileSync } from "node:fs";
import { DEFAULT_SLATE_SETTINGS, planSlate, slotOccupancyMs, type SlateGame, type SlatePlan, type SlateQueueConfig } from "../lib/projections/pregameCapture/slateQueue";

/** Same numbers as the one-game pilot (forge-pregame-capture.ts PILOT_BUDGET); duplicated to keep this script import-light. */
export const SLATE_BUDGET = { readMs: 120_000, saveWaitMs: 20_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 10_000, requiredMs: 240_000 } as const;

export interface SlateOptions { mode: "plan" | "rehearse"; games: SlateGame[]; now?: number; concurrency: number; leadMs: number; staggerMs: number }

export function parseSlateArgs(argv: string[]): SlateOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valued = new Set(["--games", "--slate-file", "--now", "--concurrency", "--lead-min", "--stagger-sec", "--slate-date"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued.has(arg)) { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); values.set(arg, argv[++i]); }
    else if (arg === "--plan" || arg === "--rehearse") flags.add(arg);
    else if (arg === "--execute") throw new Error("--execute is not available: the slate queue has no live mode yet");
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (flags.size > 1) throw new Error("Choose one mode, not --plan + --rehearse");
  const slateDate = values.get("--slate-date") ?? "";
  if (slateDate && !/^\d{4}-\d{2}-\d{2}$/.test(slateDate)) throw new Error("--slate-date must be YYYY-MM-DD (ET)");
  let games: SlateGame[] = [];
  if (values.has("--games") && values.has("--slate-file")) throw new Error("Use --games or --slate-file, not both");
  if (values.has("--games")) {
    games = values.get("--games")!.split(",").map((entry) => {
      const [id, start] = entry.split("@");
      const gameId = Number(id);
      if (!Number.isSafeInteger(gameId) || gameId <= 0 || !start || Number.isNaN(Date.parse(start))) throw new Error(`Bad --games entry: ${entry} (want <gameId>@<ISO start>)`);
      return { gameId, slateDate, scheduledStart: start, status: "FUT" };
    });
  } else if (values.has("--slate-file")) {
    games = JSON.parse(readFileSync(values.get("--slate-file")!, "utf8")) as SlateGame[];
  }
  const number = (key: string, fallback: number) => {
    if (!values.has(key)) return fallback;
    const value = Number(values.get(key));
    if (!Number.isFinite(value)) throw new Error(`${key} must be a number`);
    return value;
  };
  const now = values.has("--now") ? Date.parse(values.get("--now")!) : undefined;
  if (now !== undefined && Number.isNaN(now)) throw new Error("--now must be an ISO instant");
  return {
    mode: flags.has("--rehearse") ? "rehearse" : "plan", games, now,
    concurrency: number("--concurrency", DEFAULT_SLATE_SETTINGS.concurrency),
    leadMs: number("--lead-min", DEFAULT_SLATE_SETTINGS.leadMs / 60_000) * 60_000,
    staggerMs: number("--stagger-sec", DEFAULT_SLATE_SETTINGS.staggerMs / 1000) * 1000,
  };
}

export function slateConfig(options: Pick<SlateOptions, "concurrency" | "leadMs" | "staggerMs">): SlateQueueConfig {
  return { budget: { ...SLATE_BUDGET }, concurrency: options.concurrency, leadMs: options.leadMs, staggerMs: options.staggerMs };
}

export function planSlateText(options: SlateOptions, now: number): { plan: SlatePlan | null; text: string } {
  const config = slateConfig(options);
  const header = [
    "FORGE pregame slate queue — plan only (no environment, credentials or network).",
    `budget: pin ≤ ${SLATE_BUDGET.readMs} ms + claim requires ${SLATE_BUDGET.requiredMs} ms before T−60; slot held ${slotOccupancyMs(config.budget)} ms`,
    `concurrency ${config.concurrency}, lead ${config.leadMs / 60_000} min, stagger ${config.staggerMs / 1000} s; planned at ${new Date(now).toISOString()}`,
  ];
  if (!options.games.length) return { plan: null, text: [...header, "no games given: pass --games <id>@<ISO start>[,…] or --slate-file <json>"].join("\n") };
  const plan = planSlate(options.games, config, now);
  const rows = plan.dispatches.map((d) => `  ${d.game.gameId}  start ${d.game.scheduledStart}  dispatch ${new Date(d.dispatchAt).toISOString()}  `
    + `latest ${new Date(d.latestDispatchAt).toISOString()}  T−60 ${new Date(d.deadlineMs).toISOString()}  slot ${d.slot}`);
  const skipped = plan.skipped.map((s) => `  ${s.game.gameId}  never_dispatched: ${s.reason}`);
  return { plan, text: [...header, "dispatches:", ...(rows.length ? rows : ["  (none)"]), ...(skipped.length ? ["skipped:", ...skipped] : [])].join("\n") };
}

// ---------------------------------------------------------------------------------------------------------------
// Offline rehearsal
// ---------------------------------------------------------------------------------------------------------------

export interface SlateRehearsalCase { name: string; outcomes: Record<number, string | null>; expected: Record<number, string>; invariants: string[]; ok: boolean; maxInFlight: number }

export async function rehearseSlate(): Promise<{ ok: boolean; cases: SlateRehearsalCase[]; networkAttempts: number }> {
  const { SlateSim, minutes } = await import("../lib/projections/pregameCapture/slateSimulator");
  const { runSlate } = await import("../lib/projections/pregameCapture/slateQueue");
  const start = Date.parse("2026-11-21T00:30:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();
  const realFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = (async () => { networkAttempts += 1; throw new Error("network_forbidden_in_rehearsal"); }) as typeof fetch;
  const cases: SlateRehearsalCase[] = [];

  type Sim = InstanceType<typeof SlateSim>;
  async function scenario(name: string, expected: Record<number, string>, build: (sim: Sim) => void, crashFirst = false) {
    const sim = new SlateSim(start - minutes(180));
    build(sim);
    if (crashFirst) {
      const first = await sim.clock.drive(runSlate(sim.executorDeps(), sim.slate()));
      if (first.settled) throw new Error(`${name}: expected the first process to hang`);
      sim.clock.kill();
      for (const id of sim.scenarios.keys()) sim.scenarios.set(id, {});
      sim.maxInFlight = 0;
    }
    const run = await sim.clock.drive(runSlate(sim.executorDeps(), sim.slate()));
    if (!run.settled) throw new Error(`${name}: executor stalled`);
    const outcomes = Object.fromEntries(run.value.results.map((r) => [r.gameId, r.outcome]));
    const invariants = sim.invariants();
    if (sim.maxInFlight > 2) invariants.push(`max_in_flight:${sim.maxInFlight}`);
    const ok = invariants.length === 0 && Object.entries(expected).every(([id, outcome]) => outcomes[Number(id)] === outcome);
    cases.push({ name, outcomes, expected, invariants, ok, maxInFlight: sim.maxInFlight });
  }

  try {
    await scenario("three-simultaneous-cap-2", { 1: "qualified", 2: "qualified", 3: "qualified" }, (sim) => {
      for (const id of [1, 2, 3]) sim.addGame({ gameId: id, start: iso(start) }, { readMs: 110_000 });
    });
    await scenario("mixed-failures", { 1: "saved_without_valid_witness", 2: "source_failed", 3: "never_dispatched", 4: "qualified" }, (sim) => {
      sim.addGame({ gameId: 1, start: iso(start) }, { tsaDown: true });
      sim.addGame({ gameId: 2, start: iso(start) }, { transportRefusal: "http_status:503" });
      sim.addGame({ gameId: 3, start: iso(start + minutes(30)), status: "PPD" });
      sim.addGame({ gameId: 4, start: iso(start + minutes(30)) }, { saveResponseLost: true });
    });
    await scenario("crash-after-claim-and-after-save-reentry", { 1: "save_unknown", 2: "saved_without_valid_witness" }, (sim) => {
      sim.addGame({ gameId: 1, start: iso(start) }, { killAt: "after_claim" });
      sim.addGame({ gameId: 2, start: iso(start) }, { killAt: "after_save_commit" });
    }, true);
  } finally { globalThis.fetch = realFetch; }
  return { ok: networkAttempts === 0 && cases.every((c) => c.ok), cases, networkAttempts };
}

async function main() {
  const options = parseSlateArgs(process.argv.slice(2));
  if (options.mode === "plan") { console.log(planSlateText(options, options.now ?? Date.now()).text); return; }
  const result = await rehearseSlate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

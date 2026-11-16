/**
 * FORGE pregame slate queue — plan, offline rehearsal, and the gated live run.
 *
 * Modes (exactly one):
 *   (default) --plan   Print the dispatch plan for the given games. No environment, credentials or network.
 *                      --games 2026020329@2026-11-16T02:00:00Z,2026020330@2026-11-16T02:00:00Z  (or --slate-file <json array>)
 *                      [--now <ISO>] [--concurrency 2] [--lead-min 10] [--stagger-sec 30] [--slate-date YYYY-MM-DD]
 *   --rehearse         Offline: whole slates through the real queue and custody path (in-memory custody per game, virtual
 *                      clock, test-only TSA), plus the --execute wiring (gates, schedule reader, shell gate, receipts) on
 *                      fakes. Network is trapped and counted.
 *   --execute          LIVE: runs the queue for exactly the confirmed games. Needs every gate (assertSlateLiveGates):
 *                      FORGE_PREGAME_CAPTURE_ENABLED="true"; --approval equal to FORGE_PREGAME_CAPTURE_APPROVAL;
 *                      --confirm-game-ids equal to the --games ids; --slate-date; --code-version (40-hex candidate commit);
 *                      --tsa-profile (policy pinned); --out (new private directory); --gate (operator gate.sh); cap ≤ 2.
 *                      Launch only through operator/launch-slate.sh. Credentials are loaded only by --execute.
 *
 * Run from web/:  NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *                   scripts/forge-pregame-slate.ts [--rehearse]
 */
import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_SLATE_SETTINGS, planSlate, runSlate, slotOccupancyMs, type LoadGate, type SlateCustody, type SlateGame, type SlatePlan,
  type SlateQueueConfig, type SlateRunResult } from "../lib/projections/pregameCapture/slateQueue";
import type { CaptureDeps } from "../lib/projections/pregameCapture/custody";
import { tsaProfile, trustFromProfile, type TsaProfile } from "../lib/projections/pregameCapture/tsaProfiles";
import { PILOT_BUDGET, PILOT_TRANSPORT_LIMITS, POLICY_ID } from "./forge-pregame-capture";

/** The one-game pilot's budget, unchanged. */
export const SLATE_BUDGET = PILOT_BUDGET;
export const SLATE_MAX_CONCURRENCY = 2;
export const SLATE_MAX_GAMES = 16;

export interface SlateOptions {
  mode: "plan" | "rehearse" | "execute"; games: SlateGame[]; slateDate: string; now?: number; concurrency: number; leadMs: number; staggerMs: number;
  confirmGameIds?: number[]; approval?: string; codeVersion?: string; tsaProfile?: string; out?: string; gate?: string;
}

export function parseSlateArgs(argv: string[]): SlateOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valued = new Set(["--games", "--slate-file", "--now", "--concurrency", "--lead-min", "--stagger-sec", "--slate-date",
    "--confirm-game-ids", "--approval", "--code-version", "--tsa-profile", "--out", "--gate"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued.has(arg)) { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); values.set(arg, argv[++i]); }
    else if (arg === "--plan" || arg === "--rehearse" || arg === "--execute") flags.add(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (flags.size > 1) throw new Error(`Choose one mode, not ${[...flags].join(" + ")}`);
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
  const confirm = values.get("--confirm-game-ids");
  return {
    mode: flags.has("--rehearse") ? "rehearse" : flags.has("--execute") ? "execute" : "plan", games, slateDate, now,
    concurrency: number("--concurrency", DEFAULT_SLATE_SETTINGS.concurrency),
    leadMs: number("--lead-min", DEFAULT_SLATE_SETTINGS.leadMs / 60_000) * 60_000,
    staggerMs: number("--stagger-sec", DEFAULT_SLATE_SETTINGS.staggerMs / 1000) * 1000,
    confirmGameIds: confirm === undefined ? undefined : confirm.split(",").map((id) => Number(id)),
    approval: values.get("--approval"), codeVersion: values.get("--code-version"), tsaProfile: values.get("--tsa-profile"),
    out: values.get("--out"), gate: values.get("--gate"),
  };
}

export function slateConfig(options: Pick<SlateOptions, "concurrency" | "leadMs" | "staggerMs">): SlateQueueConfig {
  return { budget: { ...SLATE_BUDGET }, concurrency: options.concurrency, leadMs: options.leadMs, staggerMs: options.staggerMs };
}

const etFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const both = (ms: number) => `${new Date(ms).toISOString().slice(11, 19)}Z / ${etFormat.format(ms)} ET`;

export function planSlateText(options: SlateOptions, now: number): { plan: SlatePlan | null; text: string } {
  const config = slateConfig(options);
  const header = [
    "FORGE pregame slate queue — plan only (no environment, credentials or network).",
    `budget: pin ≤ ${SLATE_BUDGET.readMs} ms + claim requires ${SLATE_BUDGET.requiredMs} ms before T−60; slot held ${slotOccupancyMs(config.budget)} ms`,
    `concurrency ${config.concurrency}, lead ${config.leadMs / 60_000} min, stagger ${config.staggerMs / 1000} s; planned at ${new Date(now).toISOString()}`,
  ];
  if (!options.games.length) return { plan: null, text: [...header, "no games given: pass --games <id>@<ISO start>[,…] or --slate-file <json>"].join("\n") };
  const plan = planSlate(options.games, config, now);
  const rows = plan.dispatches.map((d) => `  ${d.game.gameId}  start ${d.game.scheduledStart}  dispatch ${both(d.dispatchAt)}  `
    + `latest ${both(d.latestDispatchAt)}  T−60 ${both(d.deadlineMs)}  slot ${d.slot}`);
  const skipped = plan.skipped.map((s) => `  ${s.game.gameId}  never_dispatched: ${s.reason}`);
  return { plan, text: [...header, "dispatches:", ...(rows.length ? rows : ["  (none)"]), ...(skipped.length ? ["skipped:", ...skipped] : [])].join("\n") };
}

// ---------------------------------------------------------------------------------------------------------------
// Live gates and wiring (exercised offline by --rehearse on fakes; never run here)
// ---------------------------------------------------------------------------------------------------------------

/** Throws unless every live gate holds. Pure apart from checking that --out is new and --gate exists. */
export function assertSlateLiveGates(options: SlateOptions, env: Record<string, string | undefined>,
  resolveProfile: (id: string) => TsaProfile = tsaProfile): void {
  const problems: string[] = [];
  if (env.FORGE_PREGAME_CAPTURE_ENABLED !== "true") problems.push('FORGE_PREGAME_CAPTURE_ENABLED is not "true"');
  if (!options.slateDate) problems.push("--slate-date missing (YYYY-MM-DD, ET)");
  const ids = options.games.map((g) => g.gameId);
  if (!ids.length) problems.push("--games missing");
  if (ids.length > SLATE_MAX_GAMES) problems.push(`more than ${SLATE_MAX_GAMES} games`);
  if (new Set(ids).size !== ids.length) problems.push("--games repeats a game");
  const confirm = options.confirmGameIds ?? [];
  if (!confirm.length) problems.push("--confirm-game-ids missing");
  else if (confirm.length !== ids.length || new Set(confirm).size !== confirm.length || ids.some((id) => !confirm.includes(id))) {
    problems.push("--confirm-game-ids does not equal the --games ids exactly");
  }
  if (options.games.some((g) => g.slateDate !== options.slateDate)) problems.push("a game's slate date differs from --slate-date");
  if (!options.approval || options.approval !== env.FORGE_PREGAME_CAPTURE_APPROVAL) problems.push("--approval missing or not equal to FORGE_PREGAME_CAPTURE_APPROVAL");
  if (!options.codeVersion || !/^[0-9a-f]{40}$/.test(options.codeVersion)) problems.push("--code-version must be the 40-hex candidate commit");
  if (!options.tsaProfile) problems.push("--tsa-profile is required");
  else {
    try { trustFromProfile(resolveProfile(options.tsaProfile), "capture"); }
    catch (error) { problems.push(`--tsa-profile not usable for a capture: ${error instanceof Error ? error.message : String(error)}`); }
  }
  if (!options.out || existsSync(options.out)) problems.push("--out must name a new directory");
  if (!options.gate || !existsSync(options.gate) || !statSync(options.gate).isFile()) problems.push("--gate must name the operator gate.sh");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > SLATE_MAX_CONCURRENCY) problems.push(`--concurrency must be 1–${SLATE_MAX_CONCURRENCY}`);
  if (problems.length) throw new Error(`Live slate refused:\n- ${problems.join("\n- ")}`);
}

/** gate.sh fails closed: exit 0 opens the gate; anything else (or a timeout) keeps it closed, with its message as the reason. */
export function shellLoadGate(script: string, timeoutMs = 60_000): LoadGate {
  return () => new Promise((resolveGate) => {
    execFile("/bin/zsh", [script], { timeout: timeoutMs, env: process.env }, (error, stdout, stderr) => {
      if (!error) resolveGate({ open: true, reason: String(stdout).trim().slice(0, 200) });
      else resolveGate({ open: false, reason: (String(stderr).trim() || error.message).slice(0, 200) });
    });
  });
}

type ReadClient = { from(table: string): any };
/**
 * Read-only schedule for exactly these games: `games` (start, date, season) and `roster_optimizer_team_games` (status,
 * current start). Anything incomplete throws, so the queue keeps its last schedule instead of closing a game.
 */
export function scheduleReader(client: ReadClient, gameIds: number[], slateDate: string): () => Promise<SlateGame[]> {
  return async () => {
    const games = await client.from("games").select("id,date,seasonId,startTime").in("id", gameIds).order("id");
    if (games.error) throw new Error(`schedule_games:${games.error.message ?? games.error}`);
    const gameRows = (games.data ?? []) as Array<{ id: number; date: string; seasonId: number; startTime: string }>;
    if (gameRows.length !== gameIds.length || gameRows.some((row) => !gameIds.includes(row.id) || Number.isNaN(Date.parse(row.startTime)))) {
      throw new Error("schedule_games_incomplete");
    }
    const seasons = [...new Set(gameRows.map((row) => row.seasonId))];
    if (seasons.length !== 1) throw new Error("schedule_mixed_seasons");
    const teams = await client.from("roster_optimizer_team_games").select("source_game_id,team_id,start_time,game_status,schedule_status")
      .eq("source_season_id", seasons[0]).in("source_game_id", gameIds).order("source_game_id").order("team_id");
    if (teams.error) throw new Error(`schedule_team_games:${teams.error.message ?? teams.error}`);
    const teamRows = (teams.data ?? []) as Array<{ source_game_id: number; team_id: number; start_time: string; game_status: string; schedule_status: string }>;
    return gameIds.map((gameId) => {
      const game = gameRows.find((row) => row.id === gameId)!;
      const rows = teamRows.filter((row) => Number(row.source_game_id) === gameId);
      if (new Set(rows.map((row) => row.team_id)).size < 2 || rows.some((row) => Number.isNaN(Date.parse(row.start_time)))) throw new Error(`schedule_team_rows_incomplete:${gameId}`);
      const gameStatuses = [...new Set(rows.map((row) => String(row.game_status ?? "").trim().toUpperCase()))];
      const scheduleStatuses = [...new Set(rows.map((row) => String(row.schedule_status ?? "").trim().toUpperCase()))];
      const status = game.date !== slateDate ? `MOVED:${game.date}`
        : scheduleStatuses.some((value) => value !== "OK") ? `SCHEDULE:${scheduleStatuses.join("|")}`
          : gameStatuses.length === 1 ? gameStatuses[0] : `MIXED:${gameStatuses.join("|")}`;
      const earliest = rows.map((row) => row.start_time).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      return { gameId, slateDate: game.date, scheduledStart: game.startTime, currentScheduledStart: earliest, status };
    });
  };
}

export interface SlateLiveParts {
  custody: SlateCustody; captureDeps: (game: SlateGame) => CaptureDeps; refreshSlate: () => Promise<SlateGame[]>; loadGate: LoadGate;
  now: () => number; sleepUntil: (ms: number) => Promise<void>;
}

/** Production parts: three Supabase clients (writer, verifier, queue custody), a plain read client for the schedule. */
export async function buildLiveParts(options: SlateOptions, env: Record<string, string | undefined>): Promise<SlateLiveParts> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Live slate refused: Supabase URL or service role key missing.");
  const { createClient } = await import("@supabase/supabase-js");
  const { captureDeps, httpTsaClient } = await import("../lib/projections/pregameCapture/runner");
  const { supabaseCaptureRpc } = await import("../lib/projections/pregameCapture/rpc");
  const { DEFAULT_TRANSPORT_BUDGET } = await import("../lib/projections/pregameCapture/transport");
  const { collectNativePregameInputs } = await import("../lib/projections/pregameCapture/nativeInputs");
  const { forgeSeasonBootstrapApplies, projectionModelEnvironment } = await import("../lib/projections/run-forge-projections");
  const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
  const client = () => createClient(supabaseUrl, serviceRoleKey, { auth }) as any;
  const profile = tsaProfile(options.tsaProfile!);
  // One wiring for every game: the writer and verifier stay separate clients, as in runPrivatePregameCapture.
  const deps = captureDeps({
    writer: supabaseCaptureRpc(client()), verifier: supabaseCaptureRpc(client()),
    tsa: httpTsaClient(profile.url), trust: trustFromProfile(profile, "capture"),
    restBaseUrl: `${supabaseUrl.replace(/\/+$/, "")}/rest/v1`,
    createReadClient: (guarded) => createClient(supabaseUrl, serviceRoleKey, { auth, global: { fetch: guarded } }) as any,
    collectNative: collectNativePregameInputs,
    seasonBootstrap: ({ slateDate, inputCutoff }) => forgeSeasonBootstrapApplies({ compute: true, explicitCutoff: true, horizonGames: 1,
      asOfDate: slateDate, decisionAsOf: inputCutoff }),
    modelEnvironment: projectionModelEnvironment, budget: { ...SLATE_BUDGET },
    transportLimits: { ...DEFAULT_TRANSPORT_BUDGET, ...PILOT_TRANSPORT_LIMITS }, now: Date.now,
  });
  return {
    custody: supabaseCaptureRpc(client()),
    captureDeps: () => deps,
    refreshSlate: scheduleReader(client(), options.games.map((g) => g.gameId), options.slateDate),
    loadGate: shellLoadGate(options.gate!),
    now: Date.now,
    sleepUntil: (ms) => new Promise((done) => setTimeout(done, Math.max(0, ms - Date.now()))),
  };
}

export interface SlateReceipt { slateDate: string; codeVersion: string; policyId: string; games: number[]; startedAt: string; finishedAt: string; result: SlateRunResult }

/** The live run. `parts` is injectable so --rehearse can drive this exact function on fakes. */
export async function executeSlate(options: SlateOptions, env: Record<string, string | undefined>,
  parts: (options: SlateOptions) => Promise<SlateLiveParts>, resolveProfile: (id: string) => TsaProfile = tsaProfile): Promise<SlateReceipt> {
  assertSlateLiveGates(options, env, resolveProfile);
  const live = await parts(options);
  // The schedule must still say what the operator approved: same games, same starts.
  const schedule = await live.refreshSlate();
  for (const stated of options.games) {
    const found = schedule.find((g) => g.gameId === stated.gameId);
    if (!found || Date.parse(found.scheduledStart) !== Date.parse(stated.scheduledStart)) {
      throw new Error(`Live slate refused: schedule for ${stated.gameId} differs from --games (${found?.scheduledStart ?? "missing"})`);
    }
  }
  mkdirSync(options.out!, { recursive: false, mode: 0o700 });
  const events = resolve(options.out!, "slate-events.jsonl");
  const startedAt = new Date(live.now()).toISOString();
  const result = await runSlate({
    policyId: POLICY_ID, codeVersion: options.codeVersion!, config: slateConfig(options),
    now: live.now, sleepUntil: live.sleepUntil, custody: live.custody, captureDeps: live.captureDeps, loadGate: live.loadGate,
    refreshSlate: live.refreshSlate,
    log: (event) => appendFileSync(events, `${JSON.stringify({ t: new Date(live.now()).toISOString(), ...event })}\n`, { mode: 0o600 }),
  }, schedule);
  // Metadata only: outcomes, reasons, claim ids, timings. Packets stay in the private database.
  const receipt: SlateReceipt = { slateDate: options.slateDate, codeVersion: options.codeVersion!, policyId: POLICY_ID,
    games: options.games.map((g) => g.gameId), startedAt, finishedAt: new Date(live.now()).toISOString(), result };
  writeFileSync(resolve(options.out!, "slate-receipt.json"), `${JSON.stringify(receipt, null, 1)}\n`, { mode: 0o600 });
  return receipt;
}

// ---------------------------------------------------------------------------------------------------------------
// Offline rehearsal
// ---------------------------------------------------------------------------------------------------------------

export interface SlateRehearsalCase { name: string; outcomes: Record<number, string | null>; expected: Record<number, string>; invariants: string[]; ok: boolean; maxInFlight: number }
export interface ExecuteRehearsal { name: string; ok: boolean; detail: string }

const SYNTHETIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://rehearsal.invalid", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: "synthetic-public-key",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-key",
} as const;

export async function rehearseSlate(): Promise<{ ok: boolean; cases: SlateRehearsalCase[]; execute: ExecuteRehearsal[]; networkAttempts: number }> {
  // Never real credentials: synthetic values for modules that build clients at import; fetch is trapped and counted.
  const savedEnv = Object.fromEntries(Object.keys(SYNTHETIC_ENV).map((key) => [key, process.env[key]]));
  Object.assign(process.env, SYNTHETIC_ENV);
  const realFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = (async () => { networkAttempts += 1; throw new Error("network_forbidden_in_rehearsal"); }) as typeof fetch;
  try {
    const cases = await rehearseQueue();
    const execute = await rehearseExecuteWiring();
    return { ok: networkAttempts === 0 && cases.every((c) => c.ok) && execute.every((c) => c.ok), cases, execute, networkAttempts };
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

async function rehearseQueue(): Promise<SlateRehearsalCase[]> {
  const { SlateSim, minutes } = await import("../lib/projections/pregameCapture/slateSimulator");
  const start = Date.parse("2026-11-21T00:30:00Z");
  const iso = (ms: number) => new Date(ms).toISOString();
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
  await scenario("stop-on-save-unknown-pauses-later-games", { 1: "save_unknown", 2: "never_dispatched" }, (sim) => {
    sim.addGame({ gameId: 1, start: iso(start) }).hooks.beforeSave = () => { throw new Error("fetch failed: ETIMEDOUT"); };
    sim.addGame({ gameId: 2, start: iso(start + minutes(120)) });
  });
  return cases;
}

/** Fake read client over the simulator's schedule, answering exactly the two queries scheduleReader makes. */
function fakeScheduleClient(rows: () => { games: any[]; teams: any[] }, reads: string[]) {
  const query = (table: string) => {
    const filters: Array<(row: any) => boolean> = [];
    const chain: any = {
      select: () => chain,
      in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return chain; },
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return chain; },
      order: () => chain,
      then: (resolveRead: (value: unknown) => void) => {
        reads.push(table);
        const source = table === "games" ? rows().games : table === "roster_optimizer_team_games" ? rows().teams : null;
        resolveRead(source ? { data: source.filter((row) => filters.every((f) => f(row))), error: null } : { data: null, error: { message: `table_not_allowed:${table}` } });
      },
    };
    return chain;
  };
  return { from: query };
}

async function rehearseExecuteWiring(): Promise<ExecuteRehearsal[]> {
  const { SlateSim, minutes } = await import("../lib/projections/pregameCapture/slateSimulator");
  const { TEST_TSA_POLICY } = await import("../lib/projections/pregameCapture/__fixtures__/testTsa");
  const { createHash, X509Certificate } = await import("node:crypto");
  const { u8 } = await import("../lib/projections/pregameCapture/der");
  const dir = mkdtempSync(join(tmpdir(), "forge-slate-rehearsal-"));
  const fixtureCa = readFileSync(join(__dirname, "..", "lib", "projections", "pregameCapture", "__fixtures__", "tsa", "ca.crt"), "utf8");
  const profile: TsaProfile = { id: "test-tsa-pinned", url: "https://tsa.invalid", anchorsPem: [fixtureCa], policies: [TEST_TSA_POLICY], extraCertsSha256: [],
    anchorSha256: [createHash("sha256").update(u8(new X509Certificate(fixtureCa).raw)).digest("hex")] };
  const resolveProfile = (id: string) => (id === profile.id ? profile : tsaProfile(id));
  const openGate = join(dir, "gate-open.sh"), closedGate = join(dir, "gate-closed.sh");
  writeFileSync(openGate, "echo 'gate ok active=0'\nexit 0\n", { mode: 0o700 });
  writeFileSync(closedGate, "echo 'GATE FAIL: busy (active=9 longest=12s lock_waits=0)' >&2\nexit 7\n", { mode: 0o700 });
  const out: ExecuteRehearsal[] = [];
  const check = (name: string, ok: boolean, detail = "") => out.push({ name, ok, detail });

  const start = Date.parse("2026-11-16T02:00:00Z");
  const ids = [2026020329, 2026020330];
  const env = { FORGE_PREGAME_CAPTURE_ENABLED: "true", FORGE_PREGAME_CAPTURE_APPROVAL: "rehearsal-token" };
  const base = (outDir: string, gate = openGate): SlateOptions => ({
    ...parseSlateArgs(["--execute", "--games", ids.map((id) => `${id}@2026-11-16T02:00:00Z`).join(","), "--slate-date", "2026-11-15",
      "--confirm-game-ids", ids.join(","), "--approval", "rehearsal-token", "--code-version", "a".repeat(40),
      "--tsa-profile", profile.id, "--out", outDir, "--gate", gate]),
  });

  // 1. Gates refuse every missing or mismatched piece before any part is built.
  let built = 0;
  const refusals: Array<[string, SlateOptions, Record<string, string | undefined>]> = [
    ["enabled", base(join(dir, "r1")), { ...env, FORGE_PREGAME_CAPTURE_ENABLED: undefined }],
    ["confirm-ids", { ...base(join(dir, "r2")), confirmGameIds: [ids[0]] }, env],
    ["approval", base(join(dir, "r3")), { ...env, FORGE_PREGAME_CAPTURE_APPROVAL: "other" }],
    ["code-version", { ...base(join(dir, "r4")), codeVersion: "HEAD" }, env],
    ["out-exists", base(dir), env],
    ["cap", { ...base(join(dir, "r6")), concurrency: 3 }, env],
  ];
  for (const [name, options, gateEnv] of refusals) {
    let refused = false;
    try { await executeSlate(options, gateEnv, async () => { built += 1; throw new Error("parts built"); }, resolveProfile); }
    catch (error) { refused = String(error).includes("Live slate refused"); }
    check(`gate-refuses-${name}`, refused && built === 0);
  }

  // 2. The shell gate fails closed and passes its message through.
  const opened = await shellLoadGate(openGate)({ gameId: 1, slateDate: "", scheduledStart: "", status: "FUT" });
  const closed = await shellLoadGate(closedGate)({ gameId: 1, slateDate: "", scheduledStart: "", status: "FUT" });
  const missing = await shellLoadGate(join(dir, "nope.sh"))({ gameId: 1, slateDate: "", scheduledStart: "", status: "FUT" });
  check("shell-gate-exit-codes", opened.open && !closed.open && /busy/.test(closed.reason ?? "") && !missing.open, JSON.stringify({ opened, closed: closed.reason }));

  // 3. The full execute path on fakes: schedule reader over games + roster_optimizer_team_games, simulated custody per game.
  async function run(name: string, gate: string, mutate: (sim: InstanceType<typeof SlateSim>) => void = () => {}) {
    const sim = new SlateSim(start - minutes(120));
    for (const id of ids) sim.addGame({ gameId: id, start: "2026-11-16T02:00:00Z", slateDate: "2026-11-15" });
    mutate(sim);
    const reads: string[] = [];
    const rows = () => ({
      games: [...sim.dbs.entries()].map(([id, db]) => ({ id, date: "2026-11-15", seasonId: 20262027, startTime: db.game.scheduledStart })),
      teams: [...sim.dbs.entries()].flatMap(([id, db]) => [6, 30].map((team) => ({ source_game_id: id, source_season_id: 20262027, team_id: team,
        start_time: db.game.scheduledStart, game_status: sim.status.get(id), schedule_status: "OK" }))),
    });
    const options = base(join(dir, name), gate);
    const deps = sim.executorDeps();
    // The real gate is a child process (real I/O), which the virtual clock cannot wait on: run it once for real, then replay.
    const gateAnswer = await shellLoadGate(gate)({ gameId: ids[0], slateDate: "2026-11-15", scheduledStart: "", status: "FUT" });
    const work = executeSlate(options, env, async () => ({
      custody: deps.custody, captureDeps: deps.captureDeps, refreshSlate: scheduleReader(fakeScheduleClient(rows, reads), ids, "2026-11-15"),
      loadGate: async () => gateAnswer, now: deps.now, sleepUntil: deps.sleepUntil,
    }), resolveProfile);
    const settled = await sim.clock.drive(work);
    if (!settled.settled) throw new Error(`${name}: stalled`);
    return { sim, receipt: settled.value, reads, options };
  }
  const ok = await run("execute-ok", openGate);
  const receiptFile = JSON.parse(readFileSync(join(ok.options.out!, "slate-receipt.json"), "utf8")) as SlateReceipt;
  check("execute-qualifies-both", ok.receipt.result.results.every((r) => r.outcome === "qualified") && ok.sim.invariants().length === 0,
    JSON.stringify(ok.receipt.result.results.map((r) => [r.gameId, r.outcome])));
  check("schedule-reads-only-two-tables", ok.reads.length > 0 && ok.reads.every((t) => t === "games" || t === "roster_optimizer_team_games"));
  check("receipt-written-metadata-only", receiptFile.games.join() === ids.join() && !JSON.stringify(receiptFile).includes("packetBase64")
    && existsSync(join(ok.options.out!, "slate-events.jsonl")));
  const gated = await run("execute-gate-closed", closedGate);
  check("closed-gate-stops-without-claims", gated.receipt.result.stopped?.trigger === "load_gate_closed_twice"
    && ids.every((id) => gated.sim.claimCalls(id) === 0) && gated.sim.invariants().length === 0);
  let refusedMoved = false;
  try { await run("execute-moved", openGate, (sim) => sim.moveStart(ids[1], "2026-11-16T01:30:00Z")); }
  catch (error) { refusedMoved = String(error).includes("differs from --games"); }
  check("refuses-schedule-not-as-approved", refusedMoved);
  return out;
}

async function main() {
  const options = parseSlateArgs(process.argv.slice(2));
  if (options.mode === "plan") { console.log(planSlateText(options, options.now ?? Date.now()).text); return; }
  if (options.mode === "rehearse") {
    const result = await rehearseSlate();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  // LIVE. Credentials come from web/.env.local (loaded only here), via operator/launch-slate.sh.
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(resolve(__dirname, ".."));
  const receipt = await executeSlate(options, process.env, (o) => buildLiveParts(o, process.env));
  console.log(JSON.stringify({ stopped: receipt.result.stopped, results: receipt.result.results.map((r) => ({ gameId: r.gameId, outcome: r.outcome, source: r.source, reason: r.reason })) }, null, 1));
}

if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

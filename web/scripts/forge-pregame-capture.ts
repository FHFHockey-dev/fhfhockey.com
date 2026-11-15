/**
 * Private FORGE pregame capture — one exact game, operator-run pilot.
 *
 * Modes (exactly one):
 *   (default) --plan       Print what a run would do. No environment, credentials or network.
 *   --rehearse             Offline rehearsal on the fixture world: real runner wiring, collector, strict transport,
 *                          verifier and RFC 3161 checks; in-memory custody and a test-only TSA. Network is trapped.
 *   --tsa-probe            LIVE external call: one timestamp request over a random digest (no FHFH data) to check the
 *                          TSA's token, chain, EKU and accuracy. Needs --confirm-probe. No database access.
 *   --execute              LIVE capture of one game: strict reads, one claim, one save, independent verification and
 *                          RFC 3161 witness, one outcome. Needs every gate below. Never scores, writes forecasts or
 *                          publishes revisions.
 *
 * Live gates (--execute): FORGE_PREGAME_CAPTURE_ENABLED="true"; --confirm-game-id equal to --game-id; --approval equal to
 * FORGE_PREGAME_CAPTURE_APPROVAL; --code-version (40-hex commit of the exact candidate); --tsa-url and --tsa-anchor (PEM);
 * --out (new private directory). Credentials are loaded only in live modes.
 *
 * Run from web/:  NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *                   scripts/forge-pregame-capture.ts [--rehearse]
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const POLICY_ID = "pregame-native-v1";
/** Pilot read limits (refusal caps; exceeding one fails the capture as source_failed, never a partial packet). */
export const PILOT_TRANSPORT_LIMITS = {
  maxCalls: 600, maxRows: 400_000, maxBytes: 96 * 1024 * 1024, maxResponseBytes: 24 * 1024 * 1024, stampToleranceMs: 5_000,
} as const;
export const PILOT_BUDGET = { readMs: 120_000, saveWaitMs: 20_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000, rpcMs: 10_000, requiredMs: 240_000 } as const;

type Mode = "plan" | "rehearse" | "tsa-probe" | "execute";
export interface PilotOptions {
  mode: Mode; gameId?: number; slateDate?: string; confirmGameId?: number; approval?: string; codeVersion?: string;
  tsaUrl?: string; tsaAnchor?: string; tsaPolicy?: string; out?: string; confirmProbe: boolean;
}

export function parsePilotArgs(argv: string[]): PilotOptions {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const valued = new Set(["--game-id", "--slate-date", "--confirm-game-id", "--approval", "--code-version", "--tsa-url", "--tsa-anchor", "--tsa-policy", "--out"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued.has(arg)) { if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`); values.set(arg, argv[++i]); }
    else if (["--plan", "--rehearse", "--tsa-probe", "--execute", "--confirm-probe"].includes(arg)) flags.add(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const modes = (["--plan", "--rehearse", "--tsa-probe", "--execute"] as const).filter((flag) => flags.has(flag));
  if (modes.length > 1) throw new Error(`Choose one mode, not ${modes.join(" + ")}`);
  const mode = (modes[0]?.slice(2) ?? "plan") as Mode;
  const num = (key: string) => (values.has(key) ? Number(values.get(key)) : undefined);
  return {
    mode, gameId: num("--game-id"), slateDate: values.get("--slate-date"), confirmGameId: num("--confirm-game-id"),
    approval: values.get("--approval"), codeVersion: values.get("--code-version"), tsaUrl: values.get("--tsa-url"),
    tsaAnchor: values.get("--tsa-anchor"), tsaPolicy: values.get("--tsa-policy"), out: values.get("--out"),
    confirmProbe: flags.has("--confirm-probe"),
  };
}

/** Throws unless every live gate holds. Pure: takes the environment explicitly. */
export function assertLiveGates(options: PilotOptions, env: Record<string, string | undefined>): void {
  const problems: string[] = [];
  if (env.FORGE_PREGAME_CAPTURE_ENABLED !== "true") problems.push('FORGE_PREGAME_CAPTURE_ENABLED is not "true"');
  if (!Number.isSafeInteger(options.gameId) || (options.gameId ?? 0) <= 0) problems.push("--game-id missing");
  if (options.confirmGameId !== options.gameId) problems.push("--confirm-game-id does not equal --game-id");
  if (!options.slateDate || !/^\d{4}-\d{2}-\d{2}$/.test(options.slateDate)) problems.push("--slate-date missing (YYYY-MM-DD, ET)");
  if (!options.approval || options.approval !== env.FORGE_PREGAME_CAPTURE_APPROVAL) problems.push("--approval missing or not equal to FORGE_PREGAME_CAPTURE_APPROVAL");
  if (!options.codeVersion || !/^[0-9a-f]{40}$/.test(options.codeVersion)) problems.push("--code-version must be the 40-hex candidate commit");
  if (!options.tsaUrl || !options.tsaAnchor) problems.push("--tsa-url and --tsa-anchor are required");
  if (!options.out || existsSync(options.out)) problems.push("--out must name a new directory");
  if (problems.length) throw new Error(`Live capture refused:\n- ${problems.join("\n- ")}`);
}

export function planText(options: PilotOptions): string {
  return [
    "FORGE pregame capture — plan only (no environment, credentials or network).",
    `game ${options.gameId ?? "<--game-id>"} on slate ${options.slateDate ?? "<--slate-date>"} (ET), policy ${POLICY_ID}`,
    `claim requires ${PILOT_BUDGET.requiredMs} ms before T−60 (read ${PILOT_BUDGET.readMs}, save wait ${PILOT_BUDGET.saveWaitMs}, TSA ${PILOT_BUDGET.tsaTimeoutMs})`,
    `read limits: ${JSON.stringify(PILOT_TRANSPORT_LIMITS)}`,
    "live modes: --tsa-probe (one external TSA call, no data) and --execute (the capture); both are gated and off by default.",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Offline rehearsal
// ---------------------------------------------------------------------------------------------------------------

export interface RehearsalCase { name: string; outcome: string | null; reason: string | null; saveCalls: number; checks: Record<string, boolean> }

const SYNTHETIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://rehearsal.invalid", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: "synthetic-public-key",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-key",
} as const;

export async function rehearsePilot(): Promise<{ ok: boolean; cases: RehearsalCase[]; networkAttempts: number }> {
  // A rehearsal never holds real credentials: force synthetic values (modules that build clients at import need some),
  // and trap fetch below so any network attempt is counted and refused.
  const savedEnv = Object.fromEntries(Object.keys(SYNTHETIC_ENV).map((key) => [key, process.env[key]]));
  Object.assign(process.env, SYNTHETIC_ENV);
  try { return await rehearseWithSyntheticEnv(); } finally {
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

async function rehearseWithSyntheticEnv(): Promise<{ ok: boolean; cases: RehearsalCase[]; networkAttempts: number }> {
  const { buildLeague, TARGET } = await import("../lib/projections/pregameCapture/__fixtures__/world/league");
  const { createWorldClient } = await import("../lib/projections/pregameCapture/__fixtures__/world/store");
  const { FakeClock, FakeCustodyDb } = await import("../lib/projections/pregameCapture/__fixtures__/fakeCustody");
  const { mintTimeStampResponse, testTsaTrust } = await import("../lib/projections/pregameCapture/__fixtures__/testTsa");
  const { captureDeps } = await import("../lib/projections/pregameCapture/runner");
  const { runPregameCapture } = await import("../lib/projections/pregameCapture/custody");
  const { collectNativePregameInputs } = await import("../lib/projections/pregameCapture/nativeInputs");
  const { forgeSeasonBootstrapApplies, projectionModelEnvironment } = await import("../lib/projections/run-forge-projections");
  const { decodePacket } = await import("../lib/projections/pregameCapture/packet");
  const { u8 } = await import("../lib/projections/pregameCapture/der");
  const { reverifyStoredWitness } = await import("../lib/projections/pregameCapture/verifier");
  const { CAPTURE_RELATIONS, CAPTURE_RPCS, DEFAULT_TRANSPORT_BUDGET } = await import("../lib/projections/pregameCapture/transport");
  const { parseInstantMicros } = await import("../lib/projections/pregameCapture/time");

  const startMs = Date.parse(TARGET.startTime);
  const MIN = 60_000;
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  let networkAttempts = 0;
  globalThis.fetch = (async () => { networkAttempts += 1; throw new Error("network_forbidden_in_rehearsal"); }) as typeof fetch;
  const cases: RehearsalCase[] = [];
  const FORECAST_SURFACES = /forge_(player|team|goalie|reserve)_projections|forge_runs|forge_game_revisions|publish_forge|player_prediction_outputs|game_prediction_outputs|model_market_flags_daily/;

  type Tsa = { beforeMint?: (clock: InstanceType<typeof FakeClock>) => void; latencyMs?: number };
  async function run(name: string, setup: (ctx: { clock: InstanceType<typeof FakeClock>; db: InstanceType<typeof FakeCustodyDb> }) => void,
    offsetMs = 0, tsaTiming: Tsa = {}) {
    const world = buildLeague({});
    const worldWrites: string[] = [];
    world.onWrite = (table) => { worldWrites.push(table); };
    const clock = new FakeClock(startMs - 70 * MIN + offsetMs);
    const db = new FakeCustodyDb(clock, { gameId: TARGET.gameId, scheduledStart: TARGET.startTime, homeTeamId: TARGET.homeTeamId,
      awayTeamId: TARGET.awayTeamId, homeAbbrev: TARGET.homeAbbrev, awayAbbrev: TARGET.awayAbbrev });
    setup({ clock, db });
    Date.now = () => clock.ms; // the collector checks its deadline against Date.now
    try {
      const report = await runPregameCapture(captureDeps({
        writer: db.rpc(), verifier: db.rpc(), trust: testTsaTrust(),
        tsa: { stamp: async (request) => {
          clock.advance(400);
          tsaTiming.beforeMint?.(clock);
          const genTimeMs = clock.ms;
          clock.advance(tsaTiming.latencyMs ?? 0); // reply latency: the final readback happens after this
          return mintTimeStampResponse(request, { genTimeMicros: BigInt(genTimeMs) * BigInt(1000) });
        } },
        createReadClient: () => createWorldClient(world) as any, restBaseUrl: "https://fixture.invalid/rest/v1",
        collectNative: collectNativePregameInputs,
        seasonBootstrap: ({ slateDate, inputCutoff }) => forgeSeasonBootstrapApplies({ compute: true, explicitCutoff: true, horizonGames: 1,
          asOfDate: slateDate, decisionAsOf: inputCutoff }),
        modelEnvironment: projectionModelEnvironment, budget: { ...PILOT_BUDGET },
        transportLimits: { ...DEFAULT_TRANSPORT_BUDGET, ...PILOT_TRANSPORT_LIMITS }, now: () => clock.ms,
      }), { gameId: TARGET.gameId, slateDate: TARGET.slateDate, policyId: POLICY_ID, codeVersion: "0123456789abcdef0123456789abcdef01234567" });
      const checks: Record<string, boolean> = {
        noWritesReachedInputSources: worldWrites.length === 0,
        custodyCallsOnly: db.calls.every((call) => ["claim", "save", "settle", "read", "lookup", "recordWitness", "recordOutcome"].includes(call)),
        noForecastOrRevisionSurface: !db.calls.concat(worldWrites).some((name) => FORECAST_SURFACES.test(name)),
        neverRetriedSave: db.calls.filter((call) => call === "save").length <= 1,
      };
      if (report.claimId && db.artifacts.has(report.claimId)) {
        const { packet } = decodePacket(u8(db.artifacts.get(report.claimId)!.bytes));
        checks.oneExactGame = packet.binding.gameId === TARGET.gameId && packet.binding.slateDate === TARGET.slateDate
          && packet.binding.homeTeamId === TARGET.homeTeamId && packet.binding.awayTeamId === TARGET.awayTeamId;
        checks.readsOnlyAllowlisted = packet.reads.every((read) => {
          const [first] = read.request as Array<{ method: string; args: unknown[] }>;
          return first.method === "from" ? CAPTURE_RELATIONS.has(String(first.args[0])) : CAPTURE_RPCS.has(String(first.args[0]));
        });
        checks.packetHasNoOutputs = !("writes" in packet) && !("outputHash" in packet);
        checks.packetCoversCandidates = packet.candidates.skaters.length > 0 && packet.candidates.goalies.length > 0;
      }
      if (report.outcome === "qualified") {
        const row = (await db.rpc().read(report.claimId!))!;
        const reverified = reverifyStoredWitness(row, testTsaTrust());
        checks.independentlyReverified = reverified.withinDeadline;
        checks.ackAtOrBeforeTminus60 = parseInstantMicros(report.verify!.ackUpper!) <= BigInt(startMs - 60 * MIN) * BigInt(1000);
      }
      cases.push({ name, outcome: report.outcome, reason: report.reason, saveCalls: report.saveCalls, checks });
      return report;
    } finally { Date.now = realNow; }
  }

  try {
    await run("qualified-one-game", () => {});
    await run("late-start-refused", () => {}, 11 * MIN);
    await run("ambiguous-save-committed-then-settled", ({ clock, db }) => {
      db.hooks.afterSaveCommit = () => { clock.advance(21_000); throw new Error("fetch failed: socket hang up"); };
    });
    await run("ambiguous-save-not-committed-fenced", ({ db }) => { db.hooks.beforeSave = () => { throw new Error("fetch failed: ETIMEDOUT"); }; });
    await run("ambiguous-claim-left-for-sweeper", ({ db }) => { db.hooks.afterClaimCommit = () => { throw new Error("fetch failed"); }; });
    await run("commit-after-cutoff-not-qualified", ({ clock, db }) => { db.hooks.afterSaveCommit = () => { clock.advance(8 * MIN); }; }, 5 * MIN);
    // Token bound inside T−60, but the reply arrives late, so the final committed readback is after T−60.
    await run("token-in-time-final-readback-late", () => {}, 0,
      { beforeMint: (clock) => { clock.ms = startMs - 60 * MIN - 2_000; }, latencyMs: 10_000 });
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
  }
  const expected: Record<string, string | null> = {
    "qualified-one-game": "qualified", "late-start-refused": "never_dispatched", "ambiguous-save-committed-then-settled": "qualified",
    "ambiguous-save-not-committed-fenced": "save_unknown", "ambiguous-claim-left-for-sweeper": null,
    "commit-after-cutoff-not-qualified": "saved_without_valid_witness",
    "token-in-time-final-readback-late": "saved_without_valid_witness",
  };
  const ok = networkAttempts === 0 && cases.every((c) => c.outcome === expected[c.name] && Object.values(c.checks).every(Boolean));
  return { ok, cases, networkAttempts };
}

// ---------------------------------------------------------------------------------------------------------------
// Live modes (never exercised offline; each refuses unless its gates hold)
// ---------------------------------------------------------------------------------------------------------------

async function tsaProbe(options: PilotOptions) {
  if (!options.confirmProbe) throw new Error("TSA probe refused: pass --confirm-probe (one external call, random digest, no data).");
  if (!options.tsaUrl || !options.tsaAnchor) throw new Error("TSA probe refused: --tsa-url and --tsa-anchor are required.");
  const { httpTsaClient } = await import("../lib/projections/pregameCapture/runner");
  const { buildTimeStampRequest, extractToken, verifyTimeStampToken } = await import("../lib/projections/pregameCapture/rfc3161");
  const digest = randomBytes(32);
  const nonce = BigInt(`0x${randomBytes(8).toString("hex")}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PILOT_BUDGET.tsaTimeoutMs);
  const started = Date.now();
  try {
    const response = await httpTsaClient(options.tsaUrl).stamp(buildTimeStampRequest(digest, nonce), controller.signal);
    const elapsedMs = Date.now() - started;
    const stamped = verifyTimeStampToken(extractToken(response), { sha256Digest: digest, nonce },
      { anchorsPem: [readFileSync(options.tsaAnchor, "utf8")], policies: options.tsaPolicy ? [options.tsaPolicy] : [] });
    return { elapsedMs, genTime: stamped.genTime, accuracyMicros: stamped.accuracyMicros.toString(), accuracySource: stamped.accuracySource,
      policy: stamped.policy, signerSha256: stamped.signerSha256, tokenSha256: stamped.tokenSha256 };
  } finally { clearTimeout(timer); }
}

async function executeLive(options: PilotOptions) {
  assertLiveGates(options, process.env);
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(resolve(__dirname, ".."));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Live capture refused: Supabase URL or service role key missing.");
  const { runPrivatePregameCapture } = await import("../lib/projections/pregameCapture/runner");
  const { collectNativePregameInputs } = await import("../lib/projections/pregameCapture/nativeInputs");
  const { forgeSeasonBootstrapApplies, projectionModelEnvironment } = await import("../lib/projections/run-forge-projections");
  const trust = { anchorsPem: [readFileSync(options.tsaAnchor!, "utf8")], policies: options.tsaPolicy ? [options.tsaPolicy] : [] };
  mkdirSync(options.out!, { recursive: false, mode: 0o700 });
  const report = await runPrivatePregameCapture({
    supabaseUrl, serviceRoleKey, tsaUrl: options.tsaUrl!, tsaTrust: trust,
    collectNative: collectNativePregameInputs,
    seasonBootstrap: ({ slateDate, inputCutoff }) => forgeSeasonBootstrapApplies({ compute: true, explicitCutoff: true, horizonGames: 1,
      asOfDate: slateDate, decisionAsOf: inputCutoff }),
    modelEnvironment: projectionModelEnvironment, budget: { ...PILOT_BUDGET }, transportLimits: { ...PILOT_TRANSPORT_LIMITS },
  }, { gameId: options.gameId!, slateDate: options.slateDate!, policyId: POLICY_ID, codeVersion: options.codeVersion! });
  // Metadata-only receipt; the packet itself stays in the private database.
  const receipt = { ...report, verify: report.verify ? { ...report.verify, timestamp: report.verify.timestamp
    ? { ...report.verify.timestamp, accuracyMicros: report.verify.timestamp.accuracyMicros.toString() } : null } : undefined };
  writeFileSync(resolve(options.out!, "capture-receipt.json"), `${JSON.stringify(receipt, null, 1)}\n`, { mode: 0o600 });
  return receipt;
}

async function main() {
  const options = parsePilotArgs(process.argv.slice(2));
  if (options.mode === "plan") { console.log(planText(options)); return; }
  if (options.mode === "rehearse") {
    const result = await rehearsePilot();
    console.log(JSON.stringify(result, null, 1));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (options.mode === "tsa-probe") { console.log(JSON.stringify(await tsaProbe(options), null, 1)); return; }
  console.log(JSON.stringify(await executeLive(options), null, 1));
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}

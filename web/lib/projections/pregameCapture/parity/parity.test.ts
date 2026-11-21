// @vitest-environment node
/**
 * Offline parity for the FORGE load/compute split. Every scenario runs the production writer on its captured
 * path against the fixture world with a frozen clock. Set RECORD_FORGE_ORACLE=1 only to record the oracle,
 * which was done on the unmodified writer (1216f6e17, 52c3b6919); the oracle must never be re-recorded to fit a change.
 * One TJ-approved re-record (2026-11-15, trend-band reader integration) changed only the trend read and the renamed
 * counter; every difference is listed in tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/ORACLE-DIFF-20261115.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureProjectionInputs, projectionInputHash, type ProjectionInputRead } from "lib/projections/inputCapture";
import { candidatesFromWrites, CUTOFF, oracleRecord, runWriterScenario, SCENARIOS, type OracleRecord, type Scenario } from "./scenarios";
import { isGoalieInputRead, readTokens, type RecordedRead } from "./readOrder";
import { createCaptureTransport, DEFAULT_TRANSPORT_BUDGET } from "../transport";
import { createWorldClient } from "../__fixtures__/world/store";
import { fetchTeamRestDays } from "lib/projections/queries/team-context-queries";
import { CODE_VERSION, FROZEN_NOW, replayWrites, savedSnapshots, activateWorld, withScenarioEnv, writerCaptures } from "./harness";
import { buildLeague, TARGET } from "../__fixtures__/world/league";
import type { World } from "../__fixtures__/world/store";
import { skaterStageLoaders, type SkaterTeamInputs } from "lib/projections/stages/skater-stage";
import { goalieStageLoaders, type GoalieGameInputs } from "lib/projections/stages/goalie-stage";

vi.mock("lib/supabase/server", async () => (await import("./harness")).worldServerModule());
vi.mock("lib/projections/inputCapture", async (importOriginal) => {
  const original = await importOriginal<typeof import("lib/projections/inputCapture")>();
  const { writerCaptures, replayWrites } = await import("./harness");
  return {
    ...original,
    captureProjectionInputs: async (work: any, options: any) => {
      const result = await original.captureProjectionInputs(work, options);
      writerCaptures.push({ reads: result.reads, writes: result.writes });
      return result;
    },
    replayProjectionInputs: async (reads: any, work: any) => {
      const result = await original.replayProjectionInputs(reads, work);
      replayWrites.push(result.writes);
      return result;
    },
  };
});
vi.mock("lib/projections/gameRevisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/projections/gameRevisions")>()),
  saveForgeInputSnapshot: async (snapshot: unknown) => {
    (await import("./harness")).savedSnapshots.push(snapshot);
    return "fixture-snapshot";
  },
  publishForgeGameRevisions: async () => 1,
}));

const ORACLE_DIR = join(__dirname, "..", "__fixtures__", "world", "oracle");
const RECORD = process.env.RECORD_FORGE_ORACLE === "1";
const RESERVED_RUN_ID = "00000000-0000-4000-8000-0000000000aa";
/** Scenarios in which the model ranks a goalie other than the first candidate: only the goalie-input block reorders. */
const GOALIE_REORDER_SCENARIOS = new Set(["goalie-model-reorders-candidates"]);
const CAPTURE_RPCS = new Set(["forge_latest_rolling_rows", "forge_league_skater_physical_totals", "forge_latest_trend_bands"]);

const loadOracle = (name: string): OracleRecord => JSON.parse(readFileSync(join(ORACLE_DIR, `${name}.json`), "utf8"));
const recorded = (reads: ProjectionInputRead[]): RecordedRead[] => oracleRecord("", reads, []).reads;
/** Result hashes of an empty page in each shape the readers receive. */
const EMPTY_RESULT_HASHES = new Set([null, 0].flatMap((count) => [[], null].map((data) =>
  projectionInputHash({ data, error: null, count, status: 200 }))));

const cutoffOf = (scenario: Scenario) => scenario.decisionAsOf ?? FROZEN_NOW;
const bootstrapOf = (scenario: Scenario) => !scenario.decisionAsOf && scenario.env.STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED === "true";
const sorted = (ids: Iterable<number>) => [...new Set(ids)].sort((a, b) => a - b);

/** Observes the bundles the stage loaders return, for the writer and the collector alike. */
function observeLoaders() {
  const teams: SkaterTeamInputs[] = [];
  const goalieGames: GoalieGameInputs[] = [];
  const team = skaterStageLoaders.team, game = goalieStageLoaders.game;
  vi.spyOn(skaterStageLoaders, "team").mockImplementation(async (...args) => {
    const inputs = await team(...args);
    if (inputs) teams.push(inputs);
    return inputs;
  });
  vi.spyOn(goalieStageLoaders, "game").mockImplementation(async (...args) => {
    const inputs = await game(...args);
    goalieGames.push(inputs);
    return inputs;
  });
  return {
    teams, goalieGames,
    candidates: () => ({
      skaters: sorted(teams.flatMap((t) => t.lineupPlayerIds)),
      goalies: sorted(goalieGames.flatMap((g) => [...g.goalieIdsByTeamId.values()].flat())),
      reserves: sorted(teams.flatMap((t) => t.reserveCandidates.map((c) => c.playerId))),
    }),
    reset: () => { teams.length = 0; goalieGames.length = 0; },
  };
}

async function collect(scenario: Scenario, options: { strict?: boolean } = {}) {
  const world = buildLeague(scenario.world);
  activateWorld(world);
  const { collectNativePregameInputs } = await import("../nativeInputs");
  const deadlineMs = Date.parse(FROZEN_NOW) + 600_000;
  // Chef's strict transport with the world as its client: chain validation and result inspection run; the HTTP
  // guard does not (the world is not an HTTP server).
  const transport = options.strict ? createCaptureTransport({
    target: { gameId: TARGET.gameId, slateDate: TARGET.slateDate, homeTeamId: TARGET.homeTeamId, awayTeamId: TARGET.awayTeamId,
      homeAbbrev: TARGET.homeAbbrev, awayAbbrev: TARGET.awayAbbrev },
    budget: { ...DEFAULT_TRANSPORT_BUDGET, deadlineMs }, restBaseUrl: "https://fixture.invalid/rest/v1",
    createClient: () => createWorldClient(world), now: () => Date.now(),
  }) : undefined;
  const run = await withScenarioEnv(scenario.env, () => captureProjectionInputs(() => collectNativePregameInputs({
    slateDate: TARGET.slateDate, gameId: TARGET.gameId, inputCutoff: cutoffOf(scenario),
    deadlineMs, seasonBootstrap: bootstrapOf(scenario),
  }), transport ? { transport, deadlineMs } : undefined));
  return { ...run, transport };
}

/** Replays the writer (`replayForgeSnapshot`) against captured reads; it must consume every read. */
async function replayWriter(scenario: Scenario, reads: ProjectionInputRead[], issuedContextAfter: unknown, outputHash: string) {
  const forge = await import("lib/projections/run-forge-projections");
  const { resolveSkaterRolloutConfig } = await import("lib/projections/skaterRollout");
  return withScenarioEnv(scenario.env, async () => {
    const snapshot: any = {
      version: "forge-inputs-v1", runId: RESERVED_RUN_ID, slateDate: TARGET.slateDate, inputCutoff: cutoffOf(scenario),
      decisionAsOf: cutoffOf(scenario), capturedAt: FROZEN_NOW, codeVersion: CODE_VERSION, modelMode: resolveSkaterRolloutConfig().mode,
      modelEnvironment: forge.projectionModelEnvironment(), seasonBootstrapApplied: bootstrapOf(scenario),
      inputProvenance: { issuedContexts: [issuedContextAfter] }, deterministicSeed: 0, horizonGames: 1, gameIds: [TARGET.gameId],
      replayClassification: "captured_live", reads, goalieStarts: [], outputHash,
    };
    return forge.replayForgeSnapshot(snapshot, projectionInputHash(snapshot));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FORGE writer against the recorded oracle", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: reads and writes match the oracle`, async () => {
      const run = await runWriterScenario(scenario);
      const record = oracleRecord(scenario.name, run.reads, run.writes);
      if (RECORD) {
        if (!existsSync(ORACLE_DIR)) mkdirSync(ORACLE_DIR, { recursive: true });
        writeFileSync(join(ORACLE_DIR, `${scenario.name}.json`), `${JSON.stringify(record, null, 1)}\n`);
        return;
      }
      const oracle = loadOracle(scenario.name);
      expect(record.reads.length).toBe(oracle.reads.length);
      expect(readTokens(record.reads)).toEqual(readTokens(oracle.reads));
      if (GOALIE_REORDER_SCENARIOS.has(scenario.name)) {
        // The fixture must keep exercising the one tolerated difference: the model's top goalie is not first.
        expect(record.reads).not.toEqual(oracle.reads);
      } else {
        expect(record.reads).toEqual(oracle.reads);
      }
      expect(record.writes).toEqual(oracle.writes);
      expect(record.outputHash).toBe(oracle.outputHash);
      expect(record.candidates).toEqual(oracle.candidates);
    });
  }
});

describe.skipIf(RECORD)("native input collector", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: same reads and candidates as the writer, and the writer replays on them`, async () => {
      const observed = observeLoaders();
      const writer = await runWriterScenario(scenario);
      const writerCandidates = observed.candidates();
      observed.reset();

      const collected = await collect(scenario);
      expect(collected.writes).toEqual([]);
      const rpcs = collected.reads.filter((read) => read.request[0].method === "rpc").map((read) => String(read.request[0].args[0]));
      expect(rpcs.every((name) => CAPTURE_RPCS.has(name))).toBe(true);
      // Same reads, same results, same order as the writer's own capture.
      expect(recorded(collected.reads)).toEqual(recorded(writer.reads));
      expect(collected.result.candidates).toEqual(writerCandidates);

      // Consistent with the oracle's outputs: every lineup row, goalie candidate and reserve row was selected.
      const oracle = loadOracle(scenario.name);
      expect(collected.result.candidates.skaters).toEqual(sorted(Object.values(oracle.candidates.skaters).flat()));
      // Goalies are pinned to the unmodified writer: exactly the goalies whose inputs it read.
      const goalieIdOf = (read: RecordedRead) => Number(read.request.find((op) => op.method === "eq" && op.args[0] === "goalie_id")!.args[1]);
      expect(collected.result.candidates.goalies).toEqual(sorted(oracle.reads.filter((read) => isGoalieInputRead(read.request)).map(goalieIdOf)));
      for (const id of Object.values(oracle.candidates.goalies).flat()) expect(collected.result.candidates.goalies).toContain(id);
      for (const id of Object.values(oracle.candidates.reserves).flat()) {
        expect([...collected.result.candidates.reserves, ...collected.result.candidates.goalies]).toContain(id);
      }

      replayWrites.length = 0;
      await expect(replayWriter(scenario, collected.reads, collected.result.issuedContextAfter, oracle.outputHash))
        .resolves.toMatchObject({ matched: true });
      expect(replayWrites).toHaveLength(1);
      expect(oracleRecord(scenario.name, [], replayWrites[0]).writes).toEqual(oracle.writes);
      expect(candidatesFromWrites(replayWrites[0])).toEqual(oracle.candidates);
    });
  }
});

describe.skipIf(RECORD)("mutation checks", () => {
  const oracle = () => loadOracle("goalie-model-reorders-candidates");

  it("a dropped read fails the oracle comparison", () => {
    const reads = oracle().reads;
    const dropped = [...reads.slice(0, 20), ...reads.slice(21)];
    expect(readTokens(dropped)).not.toEqual(readTokens(reads));
  });

  it("a reordered read outside the goalie-input block fails the oracle comparison", () => {
    const reads = oracle().reads;
    const index = reads.findIndex((read, i) => i > 0 && JSON.stringify(read) !== JSON.stringify(reads[i - 1])
      && readTokens([read]).length === 1 && !readTokens([read])[0].startsWith("goalie-input-block"));
    const swapped = [...reads];
    [swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]];
    expect(readTokens(swapped)).not.toEqual(readTokens(reads));
  });

  it("a goalie-input read moved out of its block fails the oracle comparison", () => {
    const reads = oracle().reads;
    const first = readTokens(reads).findIndex((token) => token.startsWith("goalie-input-block"));
    expect(first).toBeGreaterThan(0);
    const blockStart = reads.findIndex((read) => readTokens([read])[0].startsWith("goalie-input-block"));
    const moved = [...reads];
    const [read] = moved.splice(blockStart, 1);
    moved.splice(blockStart - 1, 0, read);
    expect(readTokens(moved)).not.toEqual(readTokens(reads));
  });

  it("a dropped or duplicated goalie-input read fails the oracle comparison; reordering inside the block does not", () => {
    const reads = oracle().reads;
    const start = reads.findIndex((read) => isGoalieInputRead(read.request));
    expect(start).toBeGreaterThan(0);
    const dropped = reads.filter((_, index) => index !== start + 1);
    expect(readTokens(dropped)).not.toEqual(readTokens(reads));
    const duplicated = [...reads.slice(0, start + 1), reads[start + 1], ...reads.slice(start + 1)];
    expect(readTokens(duplicated)).not.toEqual(readTokens(reads));
    const swapped = [...reads];
    const other = swapped.findIndex((read, index) => index > start && isGoalieInputRead(read.request)
      && JSON.stringify(read) !== JSON.stringify(reads[start]));
    [swapped[start], swapped[other]] = [swapped[other], swapped[start]];
    expect(readTokens(swapped)).toEqual(readTokens(reads));
  });

  it("replay refuses a capture with one read dropped", async () => {
    const scenario = SCENARIOS.find((item) => item.name === "normal-one-game")!;
    const collected = await collect(scenario);
    const dropped = collected.reads.filter((_, index) => index !== 12);
    await expect(replayWriter(scenario, dropped, collected.result.issuedContextAfter, loadOracle(scenario.name).outputHash))
      .rejects.toThrow(/Unrecorded projection input|did not consume/);
  });

  it("replay refuses a capture with an extra read", async () => {
    const scenario = SCENARIOS.find((item) => item.name === "normal-one-game")!;
    const collected = await collect(scenario);
    await expect(replayWriter(scenario, [...collected.reads, collected.reads[12]], collected.result.issuedContextAfter,
      loadOracle(scenario.name).outputHash)).rejects.toThrow(/did not consume/);
  });
});

describe.skipIf(RECORD)("collector mutations", () => {
  const scenario = () => SCENARIOS.find((item) => item.name === "normal-one-game")!;
  // Mutates the collector itself through the loader seam: a pre-seeded cache drops a read; an early fetch reorders one.
  const tamper = (mode: "drop" | "reorder") => {
    const team = skaterStageLoaders.team;
    vi.spyOn(skaterStageLoaders, "team").mockImplementation(async (args, scope, teamId) => {
      const key = `${teamId}:${args.asOfDate}`;
      if (teamId === TARGET.homeTeamId && !args.teamRestDaysCache.has(key)) {
        args.teamRestDaysCache.set(key, mode === "drop" ? 1 : await fetchTeamRestDays(teamId, args.asOfDate));
      }
      return team(args, scope, teamId);
    });
  };

  it("a collector that drops one read no longer matches the writer, and replay refuses its capture", async () => {
    const writer = await runWriterScenario(scenario());
    tamper("drop");
    const collected = await collect(scenario());
    vi.restoreAllMocks();
    expect(collected.reads.length).toBe(writer.reads.length - 1);
    expect(recorded(collected.reads)).not.toEqual(recorded(writer.reads));
    await expect(replayWriter(scenario(), collected.reads, collected.result.issuedContextAfter, loadOracle(scenario().name).outputHash))
      .rejects.toThrow(/Unrecorded projection input/);
  });

  it("a collector that reorders one read no longer matches the writer", async () => {
    const writer = await runWriterScenario(scenario());
    tamper("reorder");
    const collected = await collect(scenario());
    vi.restoreAllMocks();
    expect(collected.reads.length).toBe(writer.reads.length);
    expect(recorded(collected.reads)).not.toEqual(recorded(writer.reads));
    expect(readTokens(recorded(collected.reads))).not.toEqual(readTokens(recorded(writer.reads)));
  });
});

/** Strict-transport refusals the collector meets today, routed to Chef (transport owner); empty means none expected. */
const KNOWN_STRICT_REFUSALS: Record<string, RegExp> = {
  // season-bootstrap (games!inner embed) was refused until the transport admitted allowlisted embeds (dc6c4cb7c).
};

describe.skipIf(RECORD)("collector under the strict capture transport", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.name}: ${KNOWN_STRICT_REFUSALS[scenario.name] ? "refused as known" : "no refusal, same reads"}`, async () => {
      const plain = await collect(scenario);
      const known = KNOWN_STRICT_REFUSALS[scenario.name];
      if (known) {
        await expect(collect(scenario, { strict: true })).rejects.toThrow(known);
        return;
      }
      const strict = await collect(scenario, { strict: true });
      expect(strict.transport!.usage.refusals).toEqual([]);
      expect(strict.writes).toEqual([]);
      expect(recorded(strict.reads)).toEqual(recorded(plain.reads));
      expect(strict.result.candidates).toEqual(plain.result.candidates);
    });
  }
});

describe.skipIf(RECORD)("snapshot decisionAsOf", () => {
  it("takes the latest read by parsed instant, not by string order", async () => {
    // 19:55Z written with a +05:00 offset sorts after every "2026-11-14T…Z" read as a string.
    const offsetCutoff = "2026-11-15T00:55:00.000+05:00";
    expect(Date.parse(offsetCutoff)).toBe(Date.parse(CUTOFF));
    savedSnapshots.length = 0;
    await runWriterScenario({ ...SCENARIOS[0], decisionAsOf: offsetCutoff });
    expect(savedSnapshots).toHaveLength(1);
    const snapshot = savedSnapshots[0] as { decisionAsOf: string; inputCutoff: string };
    expect(snapshot.inputCutoff).toBe(offsetCutoff);
    expect(snapshot.decisionAsOf).toBe(FROZEN_NOW);
  });
});

describe.skipIf(RECORD)("snapshot model identity (TJ D3, codeVersion amended 2026-11-21)", () => {
  const BUILD_CONSTANT = "__FORGE_PRODUCER_CLOSURE_SHA256__", CLOSURE = "c1".repeat(32);
  afterEach(() => { delete (globalThis as Record<string, unknown>)[BUILD_CONSTANT]; });
  const identityOf = async () => {
    savedSnapshots.length = 0;
    await runWriterScenario(SCENARIOS[0]);
    expect(savedSnapshots).toHaveLength(1);
    return savedSnapshots[0] as { codeVersion: string; modelEnvironment: Record<string, string | null>;
      inputProvenance: { modelIdentity: Record<string, unknown> } };
  };
  it("keys the identity to the build's producer closure and keeps the release pin in codeVersion", async () => {
    (globalThis as Record<string, unknown>)[BUILD_CONSTANT] = CLOSURE;
    const snapshot = await identityOf();
    const configurationHash = projectionInputHash(snapshot.modelEnvironment);
    expect(snapshot.codeVersion).toBe(CODE_VERSION);
    expect(snapshot.inputProvenance.modelIdentity).toEqual({ version: "forge-model-identity-v2", artifact: "no_fitted_artifact",
      codeVersion: CLOSURE, configurationHash, artifactHash: projectionInputHash({ codeVersion: CLOSURE, configurationHash }) });
  });
  it("binds no code or artifact when unbuilt code has no closure", async () => {
    const snapshot = await identityOf();
    expect(snapshot.inputProvenance.modelIdentity).toMatchObject({ version: "forge-model-identity-v2", codeVersion: null, artifactHash: null });
  });
});

describe.skipIf(RECORD)("season bootstrap decision", () => {
  it("is the writer's rule, and matches each scenario's writer run", async () => {
    const { forgeSeasonBootstrapApplies } = await import("lib/projections/run-forge-projections");
    const base = { compute: true, explicitCutoff: false, horizonGames: 1, asOfDate: TARGET.slateDate, decisionAsOf: FROZEN_NOW,
      env: { STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED: "true" } };
    expect(forgeSeasonBootstrapApplies(base)).toBe(true);
    expect(forgeSeasonBootstrapApplies({ ...base, explicitCutoff: true })).toBe(false);
    expect(forgeSeasonBootstrapApplies({ ...base, compute: false })).toBe(false);
    expect(forgeSeasonBootstrapApplies({ ...base, horizonGames: 3 })).toBe(false);
    expect(forgeSeasonBootstrapApplies({ ...base, env: {} })).toBe(false);
    expect(forgeSeasonBootstrapApplies({ ...base, asOfDate: "2026-11-13" })).toBe(false);
    for (const scenario of SCENARIOS) {
      expect(forgeSeasonBootstrapApplies({ ...base, explicitCutoff: Boolean(scenario.decisionAsOf), decisionAsOf: cutoffOf(scenario),
        env: { STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED: scenario.env.STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED } })).toBe(bootstrapOf(scenario));
    }
  });
});

/** Relations the fixture leaves empty on purpose; every other read relation must return rows in some scenario. */
const INTENTIONALLY_EMPTY: Record<string, string> = {
  market_prices_daily: "markets feed output flags only, never projections",
  prop_market_prices_daily: "markets feed output flags only, never projections",
  pbp_plays: "the target game is pregame: no plays may exist",
  nst_team_stats: "fallback read only when nst_team_all has no row",
  player_forecast_goalie_start_observations: "goalie confirmations are covered by the roster-event override",
  player_forecast_observation_conflicts: "no conflicts in the fixture",
  player_forecast_conflict_resolutions: "no conflicts in the fixture",
};

describe.skipIf(RECORD)("fixture world coverage", () => {
  it("every read relation returns rows in at least one scenario", () => {
    const seen = new Map<string, boolean>();
    for (const scenario of SCENARIOS) {
      for (const read of loadOracle(scenario.name).reads) {
        const relation = String(read.request[0].args[0]);
        seen.set(relation, seen.get(relation) === true || !EMPTY_RESULT_HASHES.has(read.resultHash));
      }
    }
    expect(seen.get("market_prices_daily")).toBe(false);
    const empty = [...seen].filter(([relation, nonEmpty]) => !nonEmpty && !(relation in INTENTIONALLY_EMPTY)).map(([relation]) => relation);
    expect(empty).toEqual([]);
  });

  // Write parity can only see a mis-wired input when that input moves the output.
  const PERTURB: Record<string, (row: Record<string, any>) => void> = {
    wgo_skater_stats: (row) => { row.toi_per_game *= 1.3; row.es_toi_per_game *= 1.3; row.pp_toi_per_game *= 1.6; row.pp_toi *= 1.6; },
    player_stats_unified: (row) => { row.nst_shots_per_60 *= 1.5; row.nst_ixg_per_60 *= 1.5; row.nst_oi_xgf_per_60 *= 1.4; },
    sustainability_trend_bands: (row) => { row.value += 6; },
    nhl_team_data: (row) => { row.xga *= 1.4; row.xga_per_game *= 1.4; row.xgf *= 0.7; row.xgf_per_game *= 0.7; },
    wgo_team_stats: (row) => { row.save_pct_5v5 -= 0.03; row.shooting_plus_save_pct_5v5 -= 0.04; },
    nst_team_all: (row) => { row.xga *= 1.6; },
    forge_team_game_strength: (row) => { row.shots_es += 8; row.toi_pp_seconds += 200; },
    forge_goalie_game: (row) => { row.goals_allowed += 2; row.saves -= 2; },
    goalie_start_projections: (row) => { row.start_probability = 1 - row.start_probability; },
    lineCombinations: (row) => { row.forwards = [...row.forwards].reverse(); },
    skatersGameStats: (row) => { row.shots += 3; },
  };
  for (const [relation, perturb] of Object.entries(PERTURB)) {
    it(`perturbing ${relation} changes the writer output`, async () => {
      const scenario = SCENARIOS.find((item) => item.name === (relation === "skatersGameStats" ? "season-bootstrap" : "normal-one-game"))!;
      const run = await runWriterScenario(scenario, (world: World) => {
        const rows = world.tables[relation] ?? [];
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach(perturb);
      });
      expect(oracleRecord(scenario.name, run.reads, run.writes).outputHash).not.toBe(loadOracle(scenario.name).outputHash);
    });
  }
});

describe.skipIf(RECORD)("trend-band reads through the writer", () => {
  const scenario = SCENARIOS.find((item) => item.name === "normal-one-game")!;
  const diffPaths = (a: unknown, b: unknown, path = "", out: string[] = []): string[] => {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) out.push(`${path}.length`);
      a.slice(0, Math.min(a.length, b.length)).forEach((item, index) => diffPaths(item, b[index], `${path}[${index}]`, out));
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths((a as any)[key], (b as any)[key], `${path}.${key}`, out);
    } else if (!Object.is(a, b)) out.push(path);
    return out;
  };
  const playerRows = (writes: unknown[][]) => (writes as Array<Array<{ method: string; args: any[] }>>)
    .filter((ops) => ops[0]?.args[0] === "forge_player_projections")
    .flatMap((ops) => ops.filter((op) => op.method === "upsert" || op.method === "insert").flatMap((op) => [op.args[0]].flat()));

  it("a player whose only bands are hard-stale is reported as stale: only trend metadata, counters and the warning change", async () => {
    const base = await runWriterScenario(scenario);
    const target = playerRows(base.writes).find((row) => row.uncertainty?.model?.skater_selection?.trend_adjustment?.selected === false);
    expect(target).toBeTruthy();
    const staleDate = new Date(Date.parse(`${TARGET.slateDate}T00:00:00Z`) - 40 * 86_400_000).toISOString().slice(0, 10);
    const stale = await runWriterScenario(scenario, (world: World) => {
      for (const metric_key of ["fantasy_score", "ixg_per_60", "shots_per_60", "points_per_60_5v5"]) {
        for (const window_code of ["l5", "l10"]) {
          (world.tables.sustainability_trend_bands ??= []).push({ player_id: target.player_id, snapshot_date: staleDate, metric_key,
            window_code, value: 9, ci_lower: 4, ci_upper: 6, n_eff: 6 });
        }
      }
    });
    const after = playerRows(stale.writes).find((row) => row.player_id === target.player_id);
    expect(after.uncertainty.model.skater_selection.trend_adjustment).toMatchObject({ selected: true, recency_class: "hard_stale",
      snapshot_date: staleDate, effect_state: "neutralized_by_recency",
      multipliers: { shot_rate: 1, goal_rate: 1, assist_rate: 1, uncertainty_volatility: 1 } });
    const paths = diffPaths(base.writes, stale.writes);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !/\.skater_selection\.trend_adjustment\.|\.metrics\.data_quality\.trend_adjustment_|\.metrics\.warnings/.test(path))).toEqual([]);
    expect(JSON.stringify(stale.writes)).toContain("included 1 hard-stale rows");
  });

  const failures: Record<string, () => unknown> = {
    timeout: () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }),
    "short response": () => ({ data: [], error: null }),
  };
  for (const [kind, rpc] of Object.entries(failures)) {
    it(`${kind}: the writer runs on without trend modifiers, and native input collection refuses`, async () => {
      const run = await runWriterScenario(scenario, (world: World) => { world.rpc.forge_latest_trend_bands = rpc as any; });
      expect(JSON.stringify(run.writes)).toMatch(/"trend_adjustment_fetch_failures":2\b/);
      const world = buildLeague(scenario.world);
      world.rpc.forge_latest_trend_bands = rpc as any;
      activateWorld(world);
      const { collectNativePregameInputs } = await import("../nativeInputs");
      await expect(withScenarioEnv(scenario.env, () => captureProjectionInputs(() => collectNativePregameInputs({
        slateDate: TARGET.slateDate, gameId: TARGET.gameId, inputCutoff: cutoffOf(scenario),
        deadlineMs: Date.parse(FROZEN_NOW) + 600_000, seasonBootstrap: bootstrapOf(scenario),
      })))).rejects.toThrow("Native input collection refuses: the sustainability trend-band read failed for 2 team(s).");
    });
  }
});

// The writer's capture list is shared across tests; keep it from growing across the suite.
afterEach(() => {
  writerCaptures.length = 0;
});

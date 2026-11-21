// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { currentRsoUsePolicy, deniedRsoUses } from "lib/player-forecasts/rsoUsePolicy";
import { compactBridgeForecasts, FORGE_DAILY_BRIDGE_VERSION } from "lib/rosterScheduleData/bridgeForecastWire";
import { loadForgeDailyBridgeForecasts } from "lib/rosterScheduleData/forgeDailyBridge";
import { loadPlanningData } from "lib/rosterScheduleData/planning";
import { loadPlanningInputs } from "lib/rosterScheduleData/planningInputs";
import { encodePlanningDataTransport } from "lib/rosterScheduleData/planningDataTransport";
import { withCurrentPlanningRead } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { evaluatePlan, playerAssignedPoints } from "lib/rosterScheduleOptimizer/planning";
import type { PlanIntent, PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { buildSkaterModeledHeadTotals } from "../modeledHeadTotals";
import { publicationDbAvailable, publicationFixtureKey, publicationFixtureUrl, startPublicationDb } from "./__fixtures__/publicationConsumerDb";
import { mintTimeStampResponse, testTsaTrust } from "./__fixtures__/testTsa";
import { prospectiveLeague } from "./__fixtures__/prospectiveLeague";
import { TARGET } from "./__fixtures__/world/league";
import { createWorldClient, type Row } from "./__fixtures__/world/store";
import { runPregameCapture } from "./custody";
import { u8 } from "./der";
import { runHostedPregameGame } from "./hostedGame";
import { HOSTED_RSO_CONTEXT, readHostedRsoConsumers } from "./hostedReaders";
import { decodePacket } from "./packet";
import { DEFAULT_CAPTURE_BUDGET, PILOT_TRANSPORT_LIMITS } from "./policy";
import { publishQualifiedPregameCapture } from "./publication";
import { supabaseCaptureRpc } from "./rpc";
import { CAPTURE_ENABLED_ENV, captureDeps } from "./runner";
import { scheduleReader } from "./scheduleReader";
import { parseInstantMicros } from "./time";

const codeVersion = "0123456789abcdef0123456789abcdef01234567";
const calendar = forecastCalendarPolicy();
const candidateId = 8471001; // The synthetic home roster's first center.
const goalieId = 8471031;
const pointsWeights = { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.5 };
const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk",
  goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };

function roundHead(head: number | null) {
  expect(head).not.toBeNull();
  return Math.round(head! * 10000) / 10000;
}

const planningInstant = (micros: bigint) => new Date(Number((micros + BigInt(999)) / BigInt(1000)));

async function evaluateCurrentLineup(candidate: PlanningPlayer, game: PlanningGame, asOf: Date, forecasts: PlanningData["forecasts"]) {
  const now = asOf.toISOString();
  const evidence: PlanningData["evidence"] = { schedule: { source: "synthetic schedule", asOf: now,
    seasonId: TARGET.seasonId, completeness: "complete", limitations: [] } };
  const snapshot: PlanningSnapshot = { id: "synthetic-publication", context: { provider: "manual", leagueId: "fixture", teamId: "fixture",
    seasonId: TARGET.seasonId, startDate: game.date, endDate: game.date, timeZone: "America/New_York", asOf: now },
  players: [candidate], games: [game], forecasts: [], roster: [{ playerId: candidate.id, position: "active" }],
  lockedAssignments: [], realized: {}, opponent: null, evidence,
  rules: { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1, periods: [],
    scoring: { mode: "points", weights: pointsWeights, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] } };
  const policy = currentRsoUsePolicy();
  const revisions = [...new Set(forecasts.map(row => row.revisionId))];
  const data = encodePlanningDataTransport({ players: snapshot.players, games: snapshot.games, forecasts: [], evidence,
    forecastManifest: { version: "planning-forecasts-v1", id: "synthetic-publication", seasonId: TARGET.seasonId, asOf: now,
      scheduleRevision: game.scheduleRevision!, rosterRevision: candidate.rosterRevision!, issuedRevisionIds: revisions,
      requiredOpportunities: 1, forecastedOpportunities: forecasts.length, baselineChecksum: null, exclusionCounts: {},
      rsoUsePolicy: { version: policy.version, revision: policy.revision, bridgeRevisionIds: revisions } } });
  const { wire } = compactBridgeForecasts(forecasts, snapshot, TARGET.seasonId);
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    expect(path).toMatch(/^\/api\/v1\/roster-schedule-optimizer\/data\?/);
    return Response.json({ success: true, data, bridgeForecasts: wire,
      read: { nonce: new Headers(init.headers).get("X-RSO-Read-Nonce"), evaluatedAt: now } });
  });
  return withCurrentPlanningRead(snapshot, {}, policy.revision, new AbortController().signal, (current, _data, error) => {
    expect(error).toBeNull();
    const plan = evaluatePlan(current, intent, "outcome");
    return { plan, assignedPoints: playerAssignedPoints(current, plan, candidate.id) };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.skipIf(!publicationDbAvailable)("qualified capture to RSO (disposable PostgreSQL)", () => {
  it("uses one real pregame projection only after its committed SQL observation", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("network forbidden in this fixture"); });
    vi.stubEnv("FORGE_SKATER_MODEL_MODE", "baseline");
    vi.stubEnv("FORGE_RESERVE_PASS_ENABLED", "false");
    vi.stubEnv("STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED", "false");
    vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_SERVING_ENABLED", "true");
    vi.stubEnv("RSO_FORGE_DAILY_BRIDGE", "on");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", String(TARGET.gameId));
    vi.stubEnv("PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID", undefined);
    vi.stubEnv("RSO_LATER_IMPACT_SCENARIO", "off");
    const db = await startPublicationDb();
    try {
      const { world, request } = prospectiveLeague(codeVersion);
      await db.seed(world, request.gameId);
      const query = { seasonId: TARGET.seasonId, startDate: request.slateDate, endDate: request.slateDate };
      const inputs = await loadPlanningInputs(createWorldClient(world) as never, query, new Date());
      const game = inputs.games.find(row => row.teamAbbreviation === TARGET.homeAbbrev)!;
      const candidate = { ...inputs.players.find(row => row.nhlId === candidateId)!, eligibilityVerified: true, availability: "rostered" as const };
      const goalie = inputs.players.find(row => row.nhlId === goalieId)!;
      const sql = db.sdk();
      const readPrimary = async () => {
        const { data, error } = await sql.rpc("read_forge_game_revisions", { p_slate_date: request.slateDate });
        expect(error).toBeNull();
        return data;
      };
      const planningClient = async () => {
        const fixture = createWorldClient(await db.readBridgeTables(world));
        return { ...fixture, rpc: (name: string, args: Record<string, unknown>) => name === "read_forge_game_revisions"
          ? sql.rpc(name, args) : fixture.rpc(name, args) } as unknown as typeof sql;
      };
      const loadPrimary = async (at: Date) => loadPlanningData(await planningClient(), query, { consumer: "rso", now: at,
        forecastsEnabled: true, forgeDailyBridge: true, skipOwnership: true, skipRecentForm: true });
      const load = async (at: Date) => loadForgeDailyBridgeForecasts(createWorldClient(await db.readBridgeTables(world)) as never,
        [candidate], [game], at, TARGET.seasonId, Date.now() + 5000, calendar);
      const custody = supabaseCaptureRpc(db.sdk(), 5000);
      const trust = testTsaTrust();
      const captured = await runHostedPregameGame(request, {
        env: { [CAPTURE_ENABLED_ENV]: "true", NEXT_PUBLIC_SUPABASE_URL: publicationFixtureUrl, SUPABASE_SERVICE_ROLE_KEY: publicationFixtureKey },
        readSchedule: async (_url, _key, target) => scheduleReader(createWorldClient(world), [target.gameId], target.slateDate)(),
        runCapture: (config, target) => runPregameCapture(captureDeps({
          writer: custody, verifier: supabaseCaptureRpc(db.sdk(), 5000), trust,
          tsa: { stamp: async query => {
            const { rows } = await db.owner.query<{ now: string }>("select clock_timestamp()::text as now");
            return mintTimeStampResponse(query, { genTimeMicros: parseInstantMicros(rows[0].now) });
          } },
          createReadClient: () => createWorldClient(world), restBaseUrl: `${publicationFixtureUrl}/rest/v1`,
          collectNative: config.collectNative, seasonBootstrap: config.seasonBootstrap, modelEnvironment: config.modelEnvironment,
          budget: { ...DEFAULT_CAPTURE_BUDGET, ...config.budget }, transportLimits: { ...PILOT_TRANSPORT_LIMITS, ...config.transportLimits }, now: Date.now,
        }), target),
      });
      expect(captured).toMatchObject({ outcome: "qualified", reason: null });
      const claimId = captured.claimId!;
      const sealed = (await custody.read(claimId))!;
      const { packet } = decodePacket(u8(Buffer.from(sealed.packetBase64!, "base64")));
      const beforeAt = new Date();
      const before = await load(beforeAt);
      expect(before.forecasts).toEqual([]);
      expect(await readPrimary()).toEqual([]);
      expect((await loadPrimary(beforeAt)).forecasts).toEqual([]);
      await expect(publishQualifiedPregameCapture({ claimId, gameId: request.gameId, codeVersion: "a".repeat(40) }, { db: db.sdk(), trust }))
        .rejects.toThrow("claim_binding_mismatch");
      expect((await load(new Date())).forecasts).toEqual([]);
      expect((await db.readBridgeTables(world)).tables.forge_runs).toEqual([]);
      expect((await db.owner.query("select id from public.forge_game_revisions")).rows).toEqual([]);

      let awaitingReceipt: { bridge: Awaited<ReturnType<typeof load>>; primary: unknown } | undefined;
      const publisher = db.sdk(async name => {
        if (name !== "forge_pregame_publish_v1") return;
        const { rows } = await db.owner.query<{ available_at: string }>("select available_at::text from public.player_forecast_source_observations");
        awaitingReceipt = { bridge: await load(planningInstant(parseInstantMicros(rows[0].available_at))), primary: await readPrimary() };
      });
      const result = await publishQualifiedPregameCapture({ claimId, gameId: request.gameId, codeVersion }, { db: publisher, trust });
      expect(result).toMatchObject({ runId: claimId, alreadyPublished: false });
      expect(awaitingReceipt?.bridge.forecasts).toEqual([]);
      expect(awaitingReceipt?.primary).toEqual([]);
      const retry = await publishQualifiedPregameCapture({ claimId, gameId: request.gameId, codeVersion }, { db: publisher, trust });
      expect(retry).toEqual({ ...result, alreadyPublished: true });
      expect((await db.owner.query("select id, game_id::int, run_id from public.forge_game_revisions")).rows)
        .toEqual([{ id: result.revisionId, game_id: request.gameId, run_id: claimId }]);

      const tables = (await db.readBridgeTables(world)).tables;
      const [run] = tables.forge_runs;
      const [snapshot] = tables.player_forecast_source_observations;
      expect(run).toMatchObject({ run_id: claimId, status: "succeeded", git_sha: codeVersion, metrics: { horizon_games: 1,
        execution_scope: { mode: "selected_games", requested_game_ids: [request.gameId] } } });
      expect(snapshot).toMatchObject({ entity_key: claimId, payload: { runId: claimId, gameIds: [request.gameId],
        inputCutoff: sealed.inputCutoff, decisionAsOf: packet.statedCutoff, replayClassification: "captured_live" } });
      const observed = parseInstantMicros(run.metrics.succeeded_observed_at);
      const available = parseInstantMicros(snapshot.available_at);
      expect(observed).toBeGreaterThanOrEqual(available);
      expect(available).toBeGreaterThan(parseInstantMicros(sealed.inputCutoff));
      const firstVisibleAt = planningInstant(observed);
      const preObservation = new Date(firstVisibleAt.getTime() - 1);
      expect((await load(preObservation)).forecasts).toEqual([]);
      expect((await loadPrimary(preObservation)).forecastManifest?.exclusions).toContainEqual({ gameId: game.id, reasons: ["future_input"] });
      const [primaryRevision] = await readPrimary();
      expect(primaryRevision).toMatchObject({ id: result.revisionId, run_id: claimId, game_id: request.gameId });
      expect(parseInstantMicros(primaryRevision.published_at)).toBe(observed);
      const primary = await loadPrimary(firstVisibleAt);
      expect(primary.forecastManifest?.issuedRevisionIds).toEqual([result.revisionId]);
      expect(primary.forecastManifest?.rsoUsePolicy).toMatchObject({ revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [] });
      expect(primary.forecastManifest?.exclusions).toContainEqual({ gameId: game.id, playerId: candidate.id, reasons: ["missing_participation"] });
      const admittedGoalie = primary.forecasts.find(row => row.playerId === goalie.id);
      expect(admittedGoalie).toMatchObject({ revisionId: result.revisionId, playerId: goalie.id, gameId: game.id,
        sourceKind: "detailed", stats: { SAVES_GOALIE: expect.any(Number) }, issuedContext: { nhlPlayerId: goalieId },
        rsoTargetBindings: { SAVES_GOALIE: { component: "forge-detailed-goalie", codeVersion, conditioning: "start_only_zero_relief",
          configurationHash: expect.stringMatching(/^[a-f0-9]{64}$/), artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/) } },
        targetAllowedUses: { SAVES_GOALIE: deniedRsoUses() } });
      expect(primary.forecastManifest?.exclusions).toContainEqual({ gameId: game.id, playerId: goalie.id, targetKey: "SAVES_GOALIE", reasons: ["use_not_approved"] });
      const after = await load(firstVisibleAt);
      expect(after.runProofs).toEqual([expect.objectContaining({ runId: claimId, basis: "captured_snapshot" })]);
      expect(after.forecasts).toHaveLength(1);
      const [forecast] = after.forecasts;
      expect(forecast).toMatchObject({ playerId: candidate.id, gameId: game.id, revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:${claimId}`,
        sourceKind: "detailed", conditioning: "unconditional", issuedAt: firstVisibleAt.toISOString(),
        issuedContext: { nhlPlayerId: candidateId, teamId: TARGET.homeTeamId, scheduledAt: request.scheduledStart } });
      expect(parseInstantMicros(forecast.cutoffAt!)).toBe(parseInstantMicros(snapshot.payload.decisionAsOf));
      const row = tables.forge_player_projections.find((item: Row) => item.player_id === candidateId)!;
      expect(row.uncertainty.availability).toMatchObject({ game_id: request.gameId, state: "projected_lineup",
        line_conditioning: "if_plays", participation_probability: null, participation_qualified: false });
      expect(row).toMatchObject({ run_id: claimId, game_id: request.gameId, team_id: TARGET.homeTeamId, horizon_games: 1 });
      const heads = buildSkaterModeledHeadTotals(row);
      expect(heads.pkBasis).toBe("pk_head");
      const expectedStats = { GOALS: roundHead(heads.goals), ASSISTS: roundHead(heads.assists), SHOTS_ON_GOAL: roundHead(heads.shots) };
      expect(forecast.stats).toMatchObject(expectedStats);
      const expectedPoints = Object.entries(pointsWeights).reduce((sum, [key, weight]) => sum + expectedStats[key as keyof typeof expectedStats] * weight, 0);
      expect(expectedPoints).toBeGreaterThan(0);

      const unavailable = await evaluateCurrentLineup(candidate, game, beforeAt, before.forecasts);
      expect(unavailable.plan.legal).toBe(true);
      expect(unavailable.assignedPoints).toBeNull();
      const accepted = await evaluateCurrentLineup(candidate, game, firstVisibleAt, after.forecasts);
      expect(accepted.plan).toMatchObject({ legal: true, selectionMethod: "quality", activeGames: 1,
        assignments: [expect.objectContaining({ playerId: candidate.id, gameId: game.id, slotId: "C#1" })] });
      expect(accepted.assignedPoints).toBeCloseTo(expectedPoints);
      expect(accepted.plan.projectedValue).toBeCloseTo(expectedPoints);

      const target = { ...request, claimId, revisionId: result.revisionId, observedAt: result.observedAt,
        contextId: HOSTED_RSO_CONTEXT, seasonId: TARGET.seasonId, playerNhlId: candidateId };
      const client = await planningClient();
      const read = (overrides: Partial<typeof target> = {}, at = firstVisibleAt) => readHostedRsoConsumers(client, { ...target, ...overrides }, at);
      const hosted = await read();
      expect(hosted.daily).toEqual({ selectedRun: claimId, revisionId: forecast.revisionId, playerId: candidate.id,
        points: accepted.assignedPoints, legalSlot: "C#1", reason: null });
      expect(hosted.detailed).toEqual({ selectedRun: claimId, revisionId: result.revisionId, playerId: candidate.id,
        points: null, legalSlot: null, reason: "missing_participation" });
      for (const [value, reason] of [
        [await read({ claimId: "00000000-0000-4000-8000-000000000001" }), "run_mismatch"],
        [await read({ codeVersion: "f".repeat(40) }), "release_mismatch"],
        [await read({}, preObservation), "publication_not_observed"],
        [await read({}, new Date(request.scheduledStart)), "stale_source"],
        [await read({ playerNhlId: goalieId }), "ineligible_position"],
      ] as const) {
        for (const reader of [value.daily, value.detailed]) expect(reader).toMatchObject({ reason, points: null, legalSlot: null });
      }
    } finally {
      await db.close();
    }
  }, 20_000);
});

import { createClient } from "@supabase/supabase-js";
import { captureForgeIssuedContexts, type ForgeIssuedContextV1 } from "../issuedContext";
import { captureProjectionInputs, projectionInputHash } from "../inputCapture";
import { runPregameCapture, type CaptureBudget, type CaptureDeps, type CaptureReport, type CaptureRequest, type Collected, type PinnedGame } from "./custody";
import type { CaptureBinding } from "./packet";
import { DEFAULT_CAPTURE_BUDGET } from "./policy";
import type { TsaTrust } from "./rfc3161";
import { supabaseCaptureRpc, type CaptureRpc } from "./rpc";
import { createCaptureTransport, DEFAULT_TRANSPORT_BUDGET, type CaptureClientFactory, type CaptureTarget, type TransportBudget } from "./transport";
import type { TsaClient } from "./verifier";

/**
 * Production wiring for one private pregame capture. Disabled unless FORGE_PREGAME_CAPTURE_ENABLED is "true".
 * Reads go through the strict transport only; custody writes go only to the forge_pregame_capture RPCs.
 */

export const CAPTURE_ENABLED_ENV = "FORGE_PREGAME_CAPTURE_ENABLED";
export { DEFAULT_CAPTURE_BUDGET };

/**
 * The worker-owned collector (nativeInputs.ts) satisfies this signature. It performs exactly the writer's reads
 * (including the issued-context reads before and after) and returns the closing issued context, so the runner
 * adds no read of its own to the packet: replay must consume every captured read.
 */
export type NativeCollector = (args: { slateDate: string; gameId: number; inputCutoff: string; deadlineMs: number; seasonBootstrap: boolean }) =>
  Promise<{ candidates: Collected["candidates"]; issuedContextAfter: ForgeIssuedContextV1 }>;

export function calendarRevisionOf(schedule: Array<{ revision: string }>): string {
  return projectionInputHash(schedule.map((row) => row.revision));
}

export function httpTsaClient(url: string, fetchImpl: typeof fetch = fetch): TsaClient {
  const target = new URL(url);
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("tsa_url");
  return {
    async stamp(request, signal) {
      const response = await fetchImpl(target, {
        method: "POST", body: new Uint8Array(request), signal,
        headers: { "content-type": "application/timestamp-query", accept: "application/timestamp-reply" },
      });
      if (response.status !== 200) throw new Error(`tsa_http_${response.status}`);
      if (!String(response.headers.get("content-type") ?? "").includes("timestamp-reply")) throw new Error("tsa_content_type");
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength === 0 || body.byteLength > 65_536) throw new Error("tsa_body_size");
      return body;
    },
  };
}

export interface RunnerConfig {
  supabaseUrl: string; serviceRoleKey: string;
  tsaUrl: string; tsaTrust: TsaTrust;
  collectNative: NativeCollector;
  /** The writer's own season-bootstrap decision (exported from run-forge-projections), so capture reads what the writer would. */
  seasonBootstrap: (args: { slateDate: string; gameId: number; inputCutoff: string }) => boolean;
  modelEnvironment: () => Record<string, string | null>;
  budget?: Partial<CaptureBudget>;
  transportLimits?: Partial<Omit<TransportBudget, "deadlineMs">>;
  env?: Record<string, string | undefined>;
  /** The hosted invocation reserves time for its dispatch receipt after all capture I/O ends. */
  signal?: AbortSignal;
}

/** Everything the capture needs; the live runner builds it from Supabase/TSA, the rehearsal from fixtures. */
export interface CaptureWiring {
  writer: CaptureRpc; verifier: CaptureRpc; tsa: TsaClient; trust: TsaTrust;
  /** Client for strict input reads; it must route every request through the guarded fetch it receives. */
  createReadClient: CaptureClientFactory;
  restBaseUrl: string;
  collectNative: NativeCollector;
  seasonBootstrap: RunnerConfig["seasonBootstrap"];
  modelEnvironment: () => Record<string, string | null>;
  budget: CaptureBudget;
  transportLimits: Omit<TransportBudget, "deadlineMs">;
  now: () => number;
  fetchImpl?: typeof fetch;
  nonce?: () => bigint;
}

/**
 * Readers wrap transport failures in their own errors (e.g. "Issued FORGE context read was incomplete"), which hides the
 * cause. Prefix the transport's recorded refusals (bounded) so the receipt says what actually failed.
 */
async function withRefusals<T>(transport: { usage: { refusals: string[] } }, work: Promise<T>): Promise<T> {
  try { return await work; } catch (error) {
    const refusals = transport.usage.refusals.slice(0, 3).map((r) => r.slice(0, 90));
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(refusals.length ? `[transport ${refusals.join(" | ")}] ${message}` : message);
  }
}

export function captureDeps(w: CaptureWiring): CaptureDeps {
  const transportFor = (target: CaptureTarget, deadlineMs: number) => createCaptureTransport({
    target, restBaseUrl: w.restBaseUrl, budget: { ...w.transportLimits, deadlineMs }, createClient: w.createReadClient, now: w.now,
    fetchImpl: w.fetchImpl,
  });
  return {
    writer: w.writer, verifier: w.verifier, tsa: w.tsa, trust: w.trust, budget: w.budget,
    modelEnvironment: w.modelEnvironment, now: w.now, nonce: w.nonce,
    async pin(gameId, slateDate, deadlineMs): Promise<PinnedGame> {
      const transport = transportFor({ gameId, slateDate, homeTeamId: -1, awayTeamId: -2, homeAbbrev: "", awayAbbrev: "" }, deadlineMs);
      const run = await withRefusals(transport, captureProjectionInputs(() => captureForgeIssuedContexts(slateDate, [gameId]), { transport }));
      if (transport.usage.refusals.length) throw new Error(`pin_refused:${transport.usage.refusals[0]}`);
      if (run.writes.length) throw new Error("pin_wrote");
      const [context] = run.result;
      if (!context || context.game.id !== gameId) throw new Error("pin_context_missing");
      const abbrev = (teamId: number) => context.schedule.find((row) => row.teamId === teamId)?.teamAbbreviation;
      const homeAbbrev = abbrev(context.game.homeTeamId), awayAbbrev = abbrev(context.game.awayTeamId);
      if (!homeAbbrev || !awayAbbrev) throw new Error("pin_sides_missing");
      return {
        gameId, slateDate: context.game.date, homeTeamId: context.game.homeTeamId, awayTeamId: context.game.awayTeamId,
        homeAbbrev, awayAbbrev, scheduledStart: context.game.startTime, calendarRevision: calendarRevisionOf(context.schedule),
        teamGameStatuses: context.schedule.map((row) => `${row.teamAbbreviation}:${row.gameStatus}:${row.scheduleStatus}`),
      };
    },
    async collect(binding: CaptureBinding, deadlineMs): Promise<Collected> {
      const transport = transportFor({
        gameId: binding.gameId, slateDate: binding.slateDate, homeTeamId: binding.homeTeamId, awayTeamId: binding.awayTeamId,
        homeAbbrev: binding.homeAbbrev, awayAbbrev: binding.awayAbbrev,
      }, deadlineMs);
      const seasonBootstrap = w.seasonBootstrap({ slateDate: binding.slateDate, gameId: binding.gameId, inputCutoff: binding.inputCutoff });
      const run = await withRefusals(transport, captureProjectionInputs(
        () => w.collectNative({ slateDate: binding.slateDate, gameId: binding.gameId, inputCutoff: binding.inputCutoff, deadlineMs, seasonBootstrap }),
        { transport, deadlineMs }));
      const after = run.result.issuedContextAfter;
      if (!after || after.game.id !== binding.gameId) throw new Error("collector_context_missing");
      return {
        reads: run.reads, candidates: run.result.candidates,
        seasonBootstrapApplied: seasonBootstrap,
        transport: { calls: transport.usage.calls, httpCalls: transport.usage.httpCalls, rows: transport.usage.rows, bytes: transport.usage.bytes,
          stampToleranceMs: w.transportLimits.stampToleranceMs,
          // Strict capture throws before recording a write; any recorded write is still a refusal.
          refusals: [...transport.usage.refusals, ...(run.writes.length ? [`writes_recorded:${run.writes.length}`] : [])] },
        // The closing context from inside the packet must still match the pinned calendar revision.
        calendarRevision: calendarRevisionOf(after.schedule),
      };
    },
  };
}

export async function runPrivatePregameCapture(config: RunnerConfig, request: CaptureRequest): Promise<CaptureReport> {
  const env = config.env ?? process.env;
  if (env[CAPTURE_ENABLED_ENV] !== "true") throw new Error(`${CAPTURE_ENABLED_ENV} is not "true"; pregame capture is disabled.`);
  const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
  const budget = { ...DEFAULT_CAPTURE_BUDGET, ...config.budget };
  const invocationSignal = config.signal;
  const fetchImpl: typeof fetch = invocationSignal ? (input, init) => fetch(input, {
    ...init, signal: init?.signal ? AbortSignal.any([init.signal, invocationSignal]) : invocationSignal,
  }) : fetch;
  const client = () => createClient(config.supabaseUrl, config.serviceRoleKey, { auth, global: { fetch: fetchImpl } });
  // Two independent clients: the verifier never shares the writer's connection state.
  const rpcTimeout = invocationSignal ? budget.rpcMs : undefined;
  const writer = supabaseCaptureRpc(client(), rpcTimeout);
  const verifier = supabaseCaptureRpc(client(), rpcTimeout);
  return runPregameCapture(captureDeps({
    writer, verifier, tsa: httpTsaClient(config.tsaUrl, fetchImpl), trust: config.tsaTrust, fetchImpl,
    restBaseUrl: `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1`,
    createReadClient: (guarded) => createClient(config.supabaseUrl, config.serviceRoleKey, { auth, global: { fetch: guarded } }) as any,
    collectNative: config.collectNative, seasonBootstrap: config.seasonBootstrap, modelEnvironment: config.modelEnvironment,
    budget,
    transportLimits: { ...DEFAULT_TRANSPORT_BUDGET, ...config.transportLimits },
    now: Date.now,
  }), request);
}

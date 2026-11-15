import { createClient } from "@supabase/supabase-js";
import { captureForgeIssuedContexts, type ForgeIssuedContextV1 } from "../issuedContext";
import { captureProjectionInputs, projectionInputHash } from "../inputCapture";
import { runPregameCapture, type CaptureBudget, type CaptureReport, type Collected, type PinnedGame } from "./custody";
import type { CaptureBinding } from "./packet";
import type { TsaTrust } from "./rfc3161";
import { supabaseCaptureRpc } from "./rpc";
import { createCaptureTransport, DEFAULT_TRANSPORT_BUDGET, type CaptureTarget } from "./transport";
import type { TsaClient } from "./verifier";

/**
 * Production wiring for one private pregame capture. Disabled unless FORGE_PREGAME_CAPTURE_ENABLED is "true".
 * Reads go through the strict transport only; custody writes go only to the forge_pregame_capture RPCs.
 */

export const CAPTURE_ENABLED_ENV = "FORGE_PREGAME_CAPTURE_ENABLED";
export const DEFAULT_CAPTURE_BUDGET: CaptureBudget = {
  readMs: 120_000, saveWaitMs: 20_000, tsaTimeoutMs: 10_000, skewToleranceMs: 2_000,
  // read + save wait + settle + two reads + TSA + margin; T−60 itself never moves.
  requiredMs: 240_000,
};

/**
 * The worker-owned collector (nativeInputs.ts) satisfies this signature. It performs exactly the writer's reads
 * (including the issued-context reads before and after) and returns the closing issued context, so the runner
 * adds no read of its own to the packet: replay must consume every captured read.
 */
export type NativeCollector = (args: { slateDate: string; gameId: number; inputCutoff: string; deadlineMs: number }) =>
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
  modelEnvironment: () => Record<string, string | null>;
  budget?: Partial<CaptureBudget>;
  env?: Record<string, string | undefined>;
}

export async function runPrivatePregameCapture(config: RunnerConfig, request: {
  gameId: number; slateDate: string; policyId: string; codeVersion: string; scheduledLaunchAt?: string;
}): Promise<CaptureReport> {
  const env = config.env ?? process.env;
  if (env[CAPTURE_ENABLED_ENV] !== "true") throw new Error(`${CAPTURE_ENABLED_ENV} is not "true"; pregame capture is disabled.`);
  const budget: CaptureBudget = { ...DEFAULT_CAPTURE_BUDGET, ...config.budget };
  const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
  // Two independent clients: the verifier never shares the writer's connection state.
  const writer = supabaseCaptureRpc(createClient(config.supabaseUrl, config.serviceRoleKey, { auth }) as any);
  const verifier = supabaseCaptureRpc(createClient(config.supabaseUrl, config.serviceRoleKey, { auth }) as any);
  const transportFor = (target: CaptureTarget, deadlineMs: number) => createCaptureTransport({
    target, restBaseUrl: `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1`,
    budget: { ...DEFAULT_TRANSPORT_BUDGET, deadlineMs },
    createClient: (guarded) => createClient(config.supabaseUrl, config.serviceRoleKey, { auth, global: { fetch: guarded } }) as any,
  });

  return runPregameCapture({
    writer, verifier, tsa: httpTsaClient(config.tsaUrl), trust: config.tsaTrust, budget,
    modelEnvironment: config.modelEnvironment, now: Date.now,
    async pin(gameId, slateDate, deadlineMs): Promise<PinnedGame> {
      const transport = transportFor({ gameId, slateDate, homeTeamId: -1, awayTeamId: -2, homeAbbrev: "", awayAbbrev: "" }, deadlineMs);
      const run = await captureProjectionInputs(() => captureForgeIssuedContexts(slateDate, [gameId]), { transport });
      if (transport.usage.refusals.length) throw new Error(`pin_refused:${transport.usage.refusals[0]}`);
      const [context] = run.result;
      if (!context || context.game.id !== gameId) throw new Error("pin_context_missing");
      const abbrev = (teamId: number) => context.schedule.find((row) => row.teamId === teamId)?.teamAbbreviation;
      const homeAbbrev = abbrev(context.game.homeTeamId), awayAbbrev = abbrev(context.game.awayTeamId);
      if (!homeAbbrev || !awayAbbrev) throw new Error("pin_sides_missing");
      return {
        gameId, slateDate: context.game.date, homeTeamId: context.game.homeTeamId, awayTeamId: context.game.awayTeamId,
        homeAbbrev, awayAbbrev, scheduledStart: context.game.startTime, calendarRevision: calendarRevisionOf(context.schedule),
      };
    },
    async collect(binding: CaptureBinding, deadlineMs): Promise<Collected> {
      const transport = transportFor({
        gameId: binding.gameId, slateDate: binding.slateDate, homeTeamId: binding.homeTeamId, awayTeamId: binding.awayTeamId,
        homeAbbrev: binding.homeAbbrev, awayAbbrev: binding.awayAbbrev,
      }, deadlineMs);
      const run = await captureProjectionInputs(
        () => config.collectNative({ slateDate: binding.slateDate, gameId: binding.gameId, inputCutoff: binding.inputCutoff, deadlineMs }),
        { transport, deadlineMs });
      const after = run.result.issuedContextAfter;
      if (!after || after.game.id !== binding.gameId) throw new Error("collector_context_missing");
      return {
        reads: run.reads, candidates: run.result.candidates,
        transport: { calls: transport.usage.calls, httpCalls: transport.usage.httpCalls, rows: transport.usage.rows, bytes: transport.usage.bytes,
          // Strict capture throws before recording a write; any recorded write is still a refusal.
          refusals: [...transport.usage.refusals, ...(run.writes.length ? [`writes_recorded:${run.writes.length}`] : [])] },
        // The closing context from inside the packet must still match the pinned calendar revision.
        calendarRevision: calendarRevisionOf(after.schedule),
      };
    },
  }, request);
}

import { createClient } from "@supabase/supabase-js";
import { forgeSeasonBootstrapApplies, projectionModelEnvironment } from "../run-forge-projections";
import { starterBoardCanaryGameIds, starterBoardFlags } from "../starterBoardFlags";
import type { CaptureReport } from "./custody";
import { collectNativePregameInputs } from "./nativeInputs";
import { DEFAULT_CAPTURE_BUDGET, HOSTED_V2_BUDGET, HOSTED_V2_TIMING, PILOT_TRANSPORT_LIMITS, POLICY_ID } from "./policy";
import type { TerminalOutcome } from "./rpc";
import { CAPTURE_ENABLED_ENV, runPrivatePregameCapture } from "./runner";
import { scheduleReader } from "./scheduleReader";
import { latestDispatchAtOf, PREGAME_STATUSES, STATEMENT_TIMEOUT, type SlateGame, type StopTrigger } from "./slateQueue";
import { parseInstantMicros } from "./time";
import { tsaProfile, trustFromProfile } from "./tsaProfiles";

export interface HostedPregameRequest {
  gameId: number;
  slateDate: string;
  scheduledStart: string;
  /** Earliest start the dispatcher has observed for this game. */
  safeStart?: string;
  codeVersion: string;
  hostedV2?: { dispatchId: string; workDeadlineMs: number };
}

export type HostedPregameReason =
  | "capture_disabled" | "capture_configuration_invalid" | "invalid_dispatch_binding" | "dispatch_window_closed"
  | "schedule_unavailable" | "schedule_changed" | "game_no_longer_pregame" | "pin_failed"
  | "capture_unconfirmed" | "statement_timeout" | "source_failed" | "save_unknown" | "saved_without_valid_witness";

export interface HostedPregameResult {
  claimId: string | null;
  /** Stored terminal custody outcome, or a definitive pre-claim never_dispatched for the dispatcher to record. */
  outcome: TerminalOutcome | null;
  reason: HostedPregameReason | null;
  stopTrigger: StopTrigger | null;
}

export interface HostedPregameDeps {
  now?: () => number;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  readSchedule?: (supabaseUrl: string, serviceRoleKey: string, request: HostedPregameRequest, signal: AbortSignal) => Promise<SlateGame[]>;
  runCapture?: typeof runPrivatePregameCapture;
}

/** The DB compares this singleton to the enrolled game before it consumes a dispatch. */
export function hostedComputeGameId(env: Record<string, string | undefined>): number | null {
  const { capture, compute } = starterBoardFlags(env);
  if (!capture || !compute) return null;
  try {
    const ids = starterBoardCanaryGameIds(env);
    return ids?.length === 1 ? ids[0] : null;
  } catch {
    return null;
  }
}

const SCHEDULE_READ_MS = 10_000;
const MAX_CAPTURE_RUNTIME_MS = 375_000;

const skipped = (reason: HostedPregameReason, stopTrigger: StopTrigger | null = null): HostedPregameResult =>
  ({ claimId: null, outcome: "never_dispatched", reason, stopTrigger });

const unknown = (claimId: string | null, timedOut: boolean): HostedPregameResult => ({
  claimId, outcome: null, reason: timedOut ? "statement_timeout" : "capture_unconfirmed",
  stopTrigger: timedOut ? "statement_timeout" : "ambiguous_game",
});

function captureResult(report: CaptureReport): HostedPregameResult {
  const { outcome, claimId, reason, outcomeRecorded } = report;
  const timedOut = STATEMENT_TIMEOUT.test(reason ?? "");
  if (outcomeRecorded && outcome) {
    return {
      claimId, outcome, reason: timedOut ? "statement_timeout"
        : outcome === "qualified" ? null : outcome === "never_dispatched" ? "dispatch_window_closed" : outcome,
      stopTrigger: timedOut ? "statement_timeout" : outcome === "save_unknown" ? "save_unknown" : null,
    };
  }
  if (!claimId && !outcome) {
    if (reason === "claim_window_closed") return skipped("dispatch_window_closed");
    if (reason === "pin_schedule_changed" || reason === "claim_refused:binding_mismatch") return skipped("schedule_changed");
    if (reason?.startsWith("pin_failed:")) return skipped(timedOut ? "statement_timeout" : "pin_failed", timedOut ? "statement_timeout" : null);
  }
  return unknown(claimId, timedOut);
}

/** The route calls this only for a dispatch admitted by the database's earliest-start, load, and shared-stop gates. */
export async function runHostedPregameGame(request: HostedPregameRequest, deps: HostedPregameDeps = {}): Promise<HostedPregameResult> {
  const env = deps.env ?? process.env;
  if (env[CAPTURE_ENABLED_ENV] !== "true") return skipped("capture_disabled");
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return skipped("capture_configuration_invalid");

  const v2 = request.hostedV2;
  if (v2 && hostedComputeGameId(env) !== request.gameId) return skipped("capture_disabled");
  const now = deps.now ?? Date.now;
  const budget = v2 ? HOSTED_V2_BUDGET : DEFAULT_CAPTURE_BUDGET;
  const hasPinBudget = () => !v2 || now() + HOSTED_V2_BUDGET.pinMs + budget.rpcMs + budget.requiredMs <= v2.workDeadlineMs;
  if (!hasPinBudget()) return skipped("dispatch_window_closed");
  let scheduledStart: bigint;
  const requestedGame = { ...request, status: "FUT" };
  try {
    if (!Number.isSafeInteger(request.gameId) || request.gameId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(request.slateDate)
      || !/^[a-f0-9]{40}$/i.test(request.codeVersion)) return skipped("invalid_dispatch_binding");
    scheduledStart = parseInstantMicros(request.scheduledStart);
    if (request.safeStart !== undefined && parseInstantMicros(request.safeStart) !== scheduledStart) return skipped("schedule_changed");
    if (now() > latestDispatchAtOf(requestedGame, budget)) return skipped("dispatch_window_closed");
  } catch {
    return skipped("invalid_dispatch_binding");
  }

  const deadline = AbortSignal.timeout(v2 ? Math.max(0, v2.workDeadlineMs - now()) : MAX_CAPTURE_RUNTIME_MS);
  const signal = deps.signal ? AbortSignal.any([deps.signal, deadline]) : deadline;
  if (signal.aborted) return skipped("dispatch_window_closed");
  const scheduleSignal = AbortSignal.any([signal, AbortSignal.timeout(v2 ? HOSTED_V2_TIMING.scheduleMs : SCHEDULE_READ_MS)]);
  try {
    const games = deps.readSchedule
      ? await deps.readSchedule(supabaseUrl, serviceRoleKey, request, scheduleSignal)
      : await scheduleReader(createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      }), [request.gameId], request.slateDate, scheduleSignal)();
    if (scheduleSignal.aborted || games.length !== 1) return skipped("schedule_unavailable");
    const [game] = games;
    if (game.gameId !== request.gameId || game.slateDate !== request.slateDate
      || !game.currentScheduledStart || parseInstantMicros(game.scheduledStart) !== scheduledStart
      || parseInstantMicros(game.currentScheduledStart) !== scheduledStart) return skipped("schedule_changed");
    if (!PREGAME_STATUSES.has(game.status)) return skipped("game_no_longer_pregame");
    if (!hasPinBudget() || now() > latestDispatchAtOf(game, budget)) return skipped("dispatch_window_closed");
  } catch (error) {
    return STATEMENT_TIMEOUT.test(String(error)) ? skipped("statement_timeout", "statement_timeout") : skipped("schedule_unavailable");
  }

  try {
    if (signal.aborted) return skipped("dispatch_window_closed");
    const profile = tsaProfile("digicert-g4-v1");
    const trust = trustFromProfile(profile, "capture");
    return captureResult(await (deps.runCapture ?? runPrivatePregameCapture)({
      supabaseUrl, serviceRoleKey, signal, env, tsaUrl: profile.url, tsaTrust: trust,
      collectNative: collectNativePregameInputs,
      seasonBootstrap: ({ slateDate, inputCutoff }) => forgeSeasonBootstrapApplies({
        compute: true, explicitCutoff: true, horizonGames: 1, asOfDate: slateDate, decisionAsOf: inputCutoff,
      }),
      modelEnvironment: projectionModelEnvironment, budget, hostedDispatchId: v2?.dispatchId, transportLimits: PILOT_TRANSPORT_LIMITS,
    }, {
      gameId: request.gameId, slateDate: request.slateDate, policyId: POLICY_ID, codeVersion: request.codeVersion,
      expectedScheduledStart: request.scheduledStart, workDeadlineMs: v2?.workDeadlineMs,
    }));
  } catch (error) {
    return unknown(null, STATEMENT_TIMEOUT.test(String(error)));
  }
}

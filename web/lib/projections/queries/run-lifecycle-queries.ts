import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import supabase from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";
import { isOffReleaseGitSha, LOCAL_UNKNOWN_GIT_SHA } from "lib/projections/releasedRunFence";
import { producerIdentityStamp, type ForgeProducerIdentityStamp } from "lib/projections/forgeProducerIdentity";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export const RUN_ACTIVE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Resumable runs keep one run_id per as_of_date and scope across invocations.
 * `metrics.resume` holds the lease and the finished game ids. A run stopped by
 * its deadline stays `running` with the lease released, so the next invocation
 * projects only the remaining games. Readers only select `succeeded` runs.
 */
export const RUN_RESUME_VERSION = "forge-run-resume-v1";
// A paused run older than this is failed rather than resumed with newer inputs.
export const RUN_RESUME_MAX_AGE_MS = 2 * 60 * 60 * 1000;
// The lease outlives the invocation deadline, so a run whose invocation was
// killed frees up shortly after the kill.
export const RUN_LEASE_GRACE_MS = 60_000;
// Quiescent-only takeover. A run its owner released (every write awaited, then
// `released_by` stored) is adopted at once. A run whose owner stopped without
// releasing it is adopted only after its lease has been expired for the grace.
// The owner sends no output write within the safety margin before its lease
// expires, so a write it sent would have to stay in flight for margin + grace
// to land after a takeover. That bounds, but cannot prove, quiescence: this is
// not crash safety. It also assumes invocation clocks agree to well within the
// margin.
export const RUN_WRITE_SAFETY_MARGIN_MS = 30_000;
export const RUN_TAKEOVER_GRACE_MS = 2 * 60_000;

type RunResumeState = {
  version: typeof RUN_RESUME_VERSION;
  scope_key: string;
  lease_owner: string;
  lease_expires_at: string;
  completed_game_ids: number[];
  invocations: number;
  // The owner that released the lease after its last write settled.
  released_by?: string | null;
};

export type ForgeRunClaim = {
  runId: string;
  scopeKey: string;
  leaseOwner: string;
  leaseExpiresAt: string;
  resumed: boolean;
  invocations: number;
  completedGameIds: number[];
  priorMetrics: { [key: string]: Json | undefined };
  /** Each invocation's producer closure, this one last (forgeProducerIdentity.ts); readers admit one invocation. */
  producerIdentity?: ForgeProducerIdentityStamp;
};

type ForgeRunLifecycleRow = {
  run_id: string;
  as_of_date: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  git_sha?: string | null;
  metrics: Json | null;
};

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | null): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRunActivityTimestamp(row: {
  updated_at: string | null;
  created_at: string | null;
}): number | null {
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : null;
}

export function getRunActivityAgeMs(
  row: Pick<ForgeRunLifecycleRow, "updated_at" | "created_at">,
  nowMs = Date.now()
): number | null {
  const activityTs = parseRunActivityTimestamp(row);
  if (activityTs == null) return null;
  return Math.max(0, nowMs - activityTs);
}

export function isRunningRunStale(
  row: Pick<ForgeRunLifecycleRow, "updated_at" | "created_at">,
  nowMs = Date.now(),
  staleAfterMs = RUN_ACTIVE_WINDOW_MS
): boolean {
  const ageMs = getRunActivityAgeMs(row, nowMs);
  return ageMs == null || ageMs > staleAfterMs;
}

function buildStaleRunMetrics(
  metrics: Json | null,
  staleAgeMs: number | null
): JsonObject {
  return {
    ...(isJsonObject(metrics) ? metrics : {}),
    finished_at: new Date().toISOString(),
    timed_out: true,
    stale_running_row_cleaned_up: true,
    stale_running_age_ms: staleAgeMs,
    error:
      "Projection run was marked failed after remaining in running status beyond the allowed active window."
  };
}

async function failStaleRunningRun(row: ForgeRunLifecycleRow, nowMs: number) {
  const staleAgeMs = getRunActivityAgeMs(row, nowMs);
  const { error } = await supabase
    .from("forge_runs")
    .update({
      status: "failed",
      metrics: buildStaleRunMetrics(row.metrics, staleAgeMs),
      updated_at: new Date(nowMs).toISOString()
    })
    .eq("run_id", row.run_id);
  if (error) throw error;
}

export function readRunResumeState(metrics: Json | null): RunResumeState | null {
  const resume = isJsonObject(metrics) ? (metrics.resume ?? null) : null;
  if (
    !isJsonObject(resume) ||
    resume.version !== RUN_RESUME_VERSION ||
    typeof resume.scope_key !== "string" ||
    typeof resume.lease_owner !== "string" ||
    typeof resume.lease_expires_at !== "string" ||
    !Array.isArray(resume.completed_game_ids)
  ) {
    return null;
  }
  return {
    version: RUN_RESUME_VERSION,
    scope_key: resume.scope_key,
    lease_owner: resume.lease_owner,
    lease_expires_at: resume.lease_expires_at,
    completed_game_ids: resume.completed_game_ids
      .map(Number)
      .filter(Number.isSafeInteger),
    invocations: Number.isSafeInteger(resume.invocations)
      ? Number(resume.invocations)
      : 1,
    released_by:
      typeof resume.released_by === "string" ? resume.released_by : null
  };
}

/** A resumable run is active while its lease holds; any other by recent activity. */
export function isRunLeaseActive(
  row: Pick<ForgeRunLifecycleRow, "updated_at" | "created_at" | "metrics">,
  nowMs = Date.now()
): boolean {
  const resume = readRunResumeState(row.metrics);
  if (!resume) return !isRunningRunStale(row, nowMs, RUN_ACTIVE_WINDOW_MS);
  const expiresAtMs = Date.parse(resume.lease_expires_at);
  return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
}

/** Its owner released it, or its lease has been expired past the takeover grace. */
function isRunQuiescent(row: ForgeRunLifecycleRow, nowMs: number) {
  const resume = readRunResumeState(row.metrics);
  if (!resume) return false;
  if (resume.released_by === resume.lease_owner) return true;
  const expiresAtMs = Date.parse(resume.lease_expires_at);
  return Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs + RUN_TAKEOVER_GRACE_MS;
}

/** A paused resumable run waits for its next invocation instead of being failed. */
function isPausedResumableRun(row: ForgeRunLifecycleRow, nowMs: number) {
  const createdAtMs = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return (
    readRunResumeState(row.metrics) != null &&
    !isRunLeaseActive(row, nowMs) &&
    Number.isFinite(createdAtMs) &&
    nowMs - createdAtMs <= RUN_RESUME_MAX_AGE_MS
  );
}

export function buildResumableRunScopeKey(
  horizonGames: number,
  gameIds: readonly number[] = []
) {
  const ids = [...new Set(gameIds)].sort((a, b) => a - b);
  return `h${horizonGames}:${ids.length ? ids.join(",") : "full"}`;
}

export function resumableRunLeaseExpiresAt(
  deadlineMs: number | undefined,
  nowMs = Date.now()
) {
  return new Date(
    deadlineMs != null && Number.isFinite(deadlineMs)
      ? deadlineMs + RUN_LEASE_GRACE_MS
      : nowMs + RUN_ACTIVE_WINDOW_MS
  ).toISOString();
}

async function readRunningRuns(asOfDate: string) {
  const { data: runningRows, error: runningError } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date,status,created_at,updated_at,git_sha,metrics")
    .eq("as_of_date", asOfDate)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(20);
  if (runningError) throw runningError;
  return ((runningRows ?? []) as ForgeRunLifecycleRow[]).filter(
    (row) => row.status === "running"
  );
}

function activeRunError(
  asOfDate: string,
  activeRow: ForgeRunLifecycleRow,
  nowMs: number,
  state = "active"
) {
  const activeAgeMs = getRunActivityAgeMs(activeRow, nowMs);
  const activeMinutes =
    activeAgeMs == null
      ? "unknown"
      : `${Math.max(1, Math.round(activeAgeMs / 60_000))}m`;
  const error = new Error(
    `Projection run already ${state} for ${asOfDate} (run ${activeRow.run_id}, last activity ${activeMinutes} ago).`
  ) as Error & {
    code?: string;
    statusCode?: number;
    resumeInProgress?: boolean;
  };
  error.code = "ACTIVE_RUN_EXISTS";
  error.statusCode = 409;
  // Another invocation holds a resumable run's lease: unfinished, not failed.
  error.resumeInProgress = readRunResumeState(activeRow.metrics) != null;
  return error;
}

// No deployment SHA means an off-release (local) run: never stamp null.
function currentRunGitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || LOCAL_UNKNOWN_GIT_SHA;
}

async function insertRunningRun(asOfDate: string, metrics: JsonObject,
  producerIdentity: ForgeProducerIdentityStamp = producerIdentityStamp()) {
  const { data, error } = await supabase
    .from("forge_runs")
    .insert({
      as_of_date: asOfDate,
      status: "running",
      git_sha: currentRunGitSha(),
      // Stamped beside git_sha: the closure that executed this invocation, which git_sha alone cannot prove.
      metrics: { ...metrics, producer_identity: producerIdentity }
    })
    .select("run_id")
    .single<{ run_id: string }>();
  if (error) throw error;
  return data.run_id;
}

// Readers pick runs by metrics.horizon_games (releasedRunFence), so every run
// carries it from creation; the pipeline's later metrics writes keep it.
export async function createRun(asOfDate: string, horizonGames = 1): Promise<string> {
  assertSupabase();
  const nowMs = Date.now();
  const rows = await readRunningRuns(asOfDate);
  const activeRows = rows.filter((row) => isRunLeaseActive(row, nowMs));

  for (const row of rows) {
    if (!isRunLeaseActive(row, nowMs) && !isPausedResumableRun(row, nowMs)) {
      await failStaleRunningRun(row, nowMs);
    }
  }

  if (activeRows.length > 0) {
    throw activeRunError(asOfDate, activeRows[0], nowMs);
  }

  return insertRunningRun(asOfDate, { horizon_games: horizonGames });
}

/**
 * Takes the newest paused run for this date and scope, or starts a new one.
 * The takeover only succeeds while the run still has the lease owner read
 * here, so two invocations cannot both continue the same run.
 */
export async function claimResumableRun(
  asOfDate: string,
  args: { scopeKey: string; leaseExpiresAt: string }
): Promise<ForgeRunClaim> {
  assertSupabase();
  const nowMs = Date.now();
  const rows = await readRunningRuns(asOfDate);
  const activeRow = rows.find((row) => isRunLeaseActive(row, nowMs));
  const offRelease = isOffReleaseGitSha(currentRunGitSha());
  let candidate: ForgeRunLifecycleRow | null = null;
  let settling: ForgeRunLifecycleRow | null = null;

  for (const row of rows) {
    if (isRunLeaseActive(row, nowMs)) continue;
    if (isPausedResumableRun(row, nowMs)) {
      // Paused runs of another scope wait for their own resume. So do runs from
      // the other side of the release path: adopting one would publish this
      // invocation's work under the other's git_sha.
      if (readRunResumeState(row.metrics)?.scope_key !== args.scopeKey
        || isOffReleaseGitSha(row.git_sha) !== offRelease) continue;
      if (!candidate && !settling) {
        // An unreleased run may still have a write in flight: wait it out.
        if (isRunQuiescent(row, nowMs)) candidate = row;
        else settling = row;
        continue;
      }
    }
    await failStaleRunningRun(row, nowMs);
  }

  if (activeRow) throw activeRunError(asOfDate, activeRow, nowMs);
  if (settling) throw activeRunError(asOfDate, settling, nowMs, "settling");

  const leaseOwner = randomUUID();
  const previous = candidate ? readRunResumeState(candidate.metrics) : null;
  if (candidate && previous) {
    const resume: RunResumeState = {
      ...previous,
      lease_owner: leaseOwner,
      lease_expires_at: args.leaseExpiresAt,
      invocations: previous.invocations + 1,
      released_by: null
    };
    const priorMetrics = candidate.metrics as JsonObject;
    // A resume appends this invocation's closure, so a run finished by another release never reads as one producer.
    const producerIdentity = producerIdentityStamp(priorMetrics.producer_identity, true);
    const { data, error } = await supabase
      .from("forge_runs")
      .update({
        metrics: { ...priorMetrics, resume, producer_identity: producerIdentity },
        updated_at: new Date(nowMs).toISOString()
      })
      .eq("run_id", candidate.run_id)
      .eq("status", "running")
      .eq("metrics->resume->>lease_owner", previous.lease_owner)
      .eq("metrics->resume->>lease_expires_at", previous.lease_expires_at)
      .select("run_id");
    if (error) throw error;
    if (!data?.length) throw activeRunError(asOfDate, candidate, nowMs);
    return {
      runId: candidate.run_id,
      scopeKey: args.scopeKey,
      leaseOwner,
      leaseExpiresAt: args.leaseExpiresAt,
      resumed: true,
      invocations: resume.invocations,
      completedGameIds: previous.completed_game_ids,
      priorMetrics,
      producerIdentity
    };
  }

  const resume: RunResumeState = {
    version: RUN_RESUME_VERSION,
    scope_key: args.scopeKey,
    lease_owner: leaseOwner,
    lease_expires_at: args.leaseExpiresAt,
    completed_game_ids: [],
    invocations: 1,
    released_by: null
  };
  const producerIdentity = producerIdentityStamp();
  return {
    runId: await insertRunningRun(asOfDate, {
      horizon_games: Number(/^h(\d+):/.exec(args.scopeKey)?.[1] ?? 1),
      resume
    }, producerIdentity),
    scopeKey: args.scopeKey,
    leaseOwner,
    leaseExpiresAt: args.leaseExpiresAt,
    resumed: false,
    invocations: 1,
    completedGameIds: [],
    priorMetrics: {},
    producerIdentity
  };
}

function runLeaseLostError(runId: string, reason: string) {
  const lost = new Error(
    `Projection run ${runId} is no longer held by this invocation (${reason}).`
  ) as Error & { code?: string };
  lost.code = "RUN_LEASE_LOST";
  return lost;
}

/**
 * Stores progress (`running`) or the final status of a claimed run. Only the
 * lease owner may write; a lost lease throws `RUN_LEASE_LOST`. Omitting
 * `leaseExpiresAt` releases the lease, so the next invocation can resume: the
 * caller must have awaited every write first, since the release lets the next
 * invocation take over at once.
 */
export async function writeClaimedRun(
  claim: ForgeRunClaim,
  args: {
    status: "running" | "succeeded" | "failed";
    metrics: Record<string, unknown>;
    completedGameIds: number[];
    leaseExpiresAt?: string;
  }
) {
  assertSupabase();
  const nowIso = new Date().toISOString();
  const resume: RunResumeState = {
    version: RUN_RESUME_VERSION,
    scope_key: claim.scopeKey,
    lease_owner: claim.leaseOwner,
    lease_expires_at: args.leaseExpiresAt ?? nowIso,
    completed_game_ids: args.completedGameIds,
    invocations: claim.invocations,
    released_by: args.leaseExpiresAt ? null : claim.leaseOwner
  };
  const { data, error } = await supabase
    .from("forge_runs")
    .update({
      status: args.status,
      metrics: { ...args.metrics, resume, producer_identity: claim.producerIdentity
        ?? producerIdentityStamp(claim.priorMetrics.producer_identity, claim.resumed) } as Json,
      updated_at: nowIso
    })
    .eq("run_id", claim.runId)
    .eq("status", "running")
    .eq("metrics->resume->>lease_owner", claim.leaseOwner)
    .select("run_id");
  if (error) throw error;
  if (!data?.length) throw runLeaseLostError(claim.runId, "lease taken over");
  // A renewal moves this invocation's own write deadline too.
  if (args.leaseExpiresAt) claim.leaseExpiresAt = args.leaseExpiresAt;
}

/** In memory: no output write within the safety margin of the lease's expiry. */
function assertBeforeWriteDeadline(claim: ForgeRunClaim) {
  if (!(Date.now() < Date.parse(claim.leaseExpiresAt) - RUN_WRITE_SAFETY_MARGIN_MS)) {
    throw runLeaseLostError(claim.runId, "past its write deadline");
  }
}

/**
 * Throws `RUN_LEASE_LOST` unless this invocation is before its write deadline
 * and the stored run is still running under its lease, unreleased. Checked at
 * game, stage and cleanup boundaries; single writes check only the deadline.
 * A write already sent is not recalled (see the takeover grace).
 */
export async function assertClaimedRunWritable(claim: ForgeRunClaim) {
  assertSupabase();
  assertBeforeWriteDeadline(claim);
  const { data, error } = await supabase
    .from("forge_runs")
    .select("status,resume:metrics->resume")
    .eq("run_id", claim.runId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { status?: string; resume?: Json } | null;
  const resume = isJsonObject(row?.resume ?? null) ? (row!.resume as JsonObject) : null;
  if (
    row?.status !== "running" ||
    resume?.lease_owner !== claim.leaseOwner ||
    resume?.released_by === claim.leaseOwner
  ) {
    throw runLeaseLostError(claim.runId, "lease taken over");
  }
}

// The claim whose lease guards output writes in the current async context.
const claimedRunWrites = new AsyncLocalStorage<ForgeRunClaim>();

/** Runs `fn` with every guarded output write checked against `claim`'s lease. */
export function runWithClaimedRunWrites<T>(claim: ForgeRunClaim, fn: () => Promise<T>) {
  return claimedRunWrites.run(claim, fn);
}

/** Output writers call this before each write (no query); a no-op outside a claimed run. */
export function assertRunWriteAllowed() {
  const claim = claimedRunWrites.getStore();
  if (claim) assertBeforeWriteDeadline(claim);
}

/** At game, stage and cleanup boundaries: re-confirms ownership in the database. */
export async function assertRunStillOwned() {
  const claim = claimedRunWrites.getStore();
  if (claim) await assertClaimedRunWritable(claim);
}

/** Removes a paused run's rows for games it will project again. */
export async function clearRunGameRows(runId: string, gameIds: number[]) {
  assertSupabase();
  if (gameIds.length === 0) return;
  await assertRunStillOwned();
  for (const table of [
    "forge_player_projections",
    "forge_team_projections",
    "forge_goalie_projections"
  ] as const) {
    assertRunWriteAllowed();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("run_id", runId)
      .in("game_id", gameIds);
    if (error) throw error;
  }
}

export async function finalizeRun(
  runId: string,
  status: "succeeded" | "failed",
  metrics: Json
) {
  assertSupabase();
  // An unclaimed run is written by one invocation, which stamps its closure on the final metrics.
  const stamped = isJsonObject(metrics) ? { ...metrics, producer_identity: producerIdentityStamp() } : metrics;
  const { error } = await supabase
    .from("forge_runs")
    .update({ status, metrics: stamped as Json, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (error) throw error;
}

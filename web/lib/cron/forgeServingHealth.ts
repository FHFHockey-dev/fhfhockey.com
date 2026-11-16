// Daily cron report: does today's ET slate have a fresh FORGE run that readers will serve? (C1 prevention, H2;
// 2026-11-16.) C1 withheld every scheduled run for three days with no alert: each day's run was refused by the serving
// gate while older listed runs still covered the date, so "is any run servable" stayed true. This check asks instead
// whether a full-slate run created today is servable, and says why not: the gate withheld it (unlisted producer
// closure, `local:unknown` SHA, ...), no run was created, or the rolling pipeline is still running or failed.
//
// Pure. The verdict reuses the readers' own admission (externalInputProof.ts verifiedRunAttribution, plus an optional
// loadExternalInputProof confirmation for runs with captured snapshots); the reasons only explain it.
import { verifiedRunAttribution } from "lib/projections/externalInputProof";
import { parseProducerIdentity } from "lib/projections/forgeProducerIdentity";
import { isOffReleaseGitSha } from "lib/projections/releasedRunFence";
import { verifiedForgeProducerClosure, verifiedForgeRelease } from "lib/projections/verifiedForgeReleases";
import { getRollingForgeStagesForMode } from "lib/rollingForgePipeline";

/** A `forge_runs` row as the report selects it (attribution columns as in externalInputProof.ts, plus scope). */
export type ForgeServingRunRow = {
  run_id: string;
  status: string | null;
  git_sha: string | null;
  created_at: string;
  invocations: string | null;
  producer_identity: unknown;
  rolling_player_history_contract?: string | null;
  execution_mode: string | null;
  scope_key: string | null;
};
/** One rolling pipeline stage row (lib/rollingForgePipelineRunState.ts readRollingForgeRunState). */
export type ForgeServingStageState = {
  status: "running" | "complete" | "failed";
  lastError: string | null;
  leaseExpiresAt: string | null;
  updatedAt: string | null;
};

export type ForgeServingStatus = "ok" | "warning" | "critical" | "unknown" | "not_applicable";
export type ForgeServingRun = {
  runId: string;
  createdAt: string;
  /** ET calendar date the run was created on. */
  createdOn: string;
  status: string | null;
  gitSha: string | null;
  closureSha256: string | null;
  fullSlate: boolean;
  servable: boolean;
  /** Why readers withhold a succeeded run; null when servable or not succeeded. */
  withheldReason: string | null;
};
export type ForgePipelineState = "complete" | "running" | "stuck" | "handed_off" | "stalled" | "failed" | "not_started"
  | "unknown";
export type ForgeServingPipeline = { scopeKey: string; state: ForgePipelineState; stage: string | null; detail: string };
export type ForgeServingHealth = {
  status: ForgeServingStatus;
  /** Today's ET slate date. */
  date: string;
  checkedAt: string;
  /** The newest servable full-slate run for the date: what readers serve as its base slate. */
  servedRun: ForgeServingRun | null;
  /** Full-slate runs for the date created today, newest first. */
  todayRuns: ForgeServingRun[];
  pipeline: ForgeServingPipeline;
  /** Every reason that applies, most important first. Empty when status is ok. */
  problems: string[];
  /** Read limitations; they never raise the status on their own. */
  notes: string[];
};

export const FORGE_SERVING_PIPELINE_MODE = "daily_incremental" as const;
/** Stages that must finish before today's runs exist; later stages (consumers, monitoring) don't affect serving. */
const SERVING_STAGES = (() => {
  const ids = getRollingForgeStagesForMode(FORGE_SERVING_PIPELINE_MODE).map(stage => stage.id);
  return ids.slice(0, ids.indexOf("projection_execution") + 1);
})();
const HANDOFF_CODE = "stage_handoff";
const FULL_SHA = /^[0-9a-f]{40}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const etParts = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", ...options }).format(new Date(iso));
/** The ET calendar date of an instant (YYYY-MM-DD). */
export function etDate(instant: Date | string): string {
  return etParts(typeof instant === "string" ? instant : instant.toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });
}
const etTime = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso))
  ? `${etDate(iso).slice(5)} ${etParts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} ET` : "an unknown time");
const shortId = (runId: string) => runId.slice(0, 8);

function isFullSlate(row: ForgeServingRunRow): boolean {
  if (row.execution_mode) return row.execution_mode === "full_slate";
  return row.scope_key == null || row.scope_key.endsWith(":full");
}

/** Why the readers' gate refuses a succeeded snapshot-less run, in the order verifiedRunAttribution checks it. Only an
 * explanation: the verdict is verifiedRunAttribution's (or a snapshot proof's). */
export function explainWithheldRun(row: ForgeServingRunRow): string {
  if (isOffReleaseGitSha(row.git_sha)) {
    return `git_sha is ${row.git_sha == null ? "null" : `'${row.git_sha}'`}, so every reader drops it as an off-release `
      + "run (the deployment had neither VERCEL_GIT_COMMIT_SHA nor GIT_SHA at runtime)";
  }
  if (!FULL_SHA.test(row.git_sha ?? "")) return `git_sha '${row.git_sha}' is not a full 40-character SHA`;
  if (row.producer_identity == null) {
    return verifiedForgeRelease(row.git_sha) ? "an unstamped run of a verified release must be a single invocation"
      : `it has no producer-closure stamp and release ${row.git_sha!.slice(0, 10)} is not in VERIFIED_FORGE_RELEASES`;
  }
  const stamp = parseProducerIdentity(row.producer_identity);
  if (!stamp || !Array.isArray((row.producer_identity as { code_versions?: unknown }).code_versions)) {
    return "its producer-closure stamp is malformed or predates code_versions";
  }
  if (String(stamp.invocations.length) !== row.invocations) {
    return `its stamp covers ${stamp.invocations.length} invocation(s) but the run recorded ${row.invocations ?? "none"}`;
  }
  if (stamp.code_versions.some(version => version?.startsWith("local:"))) return "a local runner wrote it (local: code version)";
  const closures = [...new Set(stamp.invocations)];
  if (closures.length > 1) return `its invocations ran different producer closures (${closures.map(c => c?.slice(0, 8) ?? "unknown").join(", ")})`;
  const closure = closures[0];
  if (closure == null) return "its producer closure is unknown (the build did not compute one)";
  if (!verifiedForgeProducerClosure(closure)) {
    return `producer closure ${closure} is not in VERIFIED_FORGE_PRODUCER_CLOSURES (lib/projections/verifiedForgeReleases.ts)`;
  }
  return "it is not attributed to verified producer code (externalInputProof.ts verifiedRunAttribution)";
}

function summarizeRun(row: ForgeServingRunRow, proven: ReadonlySet<string>): ForgeServingRun {
  const succeeded = row.status === "succeeded";
  const servable = succeeded && !isOffReleaseGitSha(row.git_sha)
    && (proven.has(row.run_id) || verifiedRunAttribution(row) !== null);
  const stamp = parseProducerIdentity(row.producer_identity);
  return { runId: row.run_id, createdAt: row.created_at, createdOn: etDate(row.created_at), status: row.status,
    gitSha: row.git_sha, closureSha256: stamp?.invocations[0] ?? null, fullSlate: isFullSlate(row), servable,
    withheldReason: succeeded && !servable ? explainWithheldRun(row) : null };
}

/** Pure: where today's rolling pipeline stands, from its stage rows (`<mode>:<date>`), up to projection_execution. */
export function assessForgeServingPipeline(date: string, stages: ReadonlyMap<string, ForgeServingStageState> | null,
  now: Date): ForgeServingPipeline {
  const scopeKey = `${FORGE_SERVING_PIPELINE_MODE}:${date}`;
  if (!stages) return { scopeKey, state: "unknown", stage: null, detail: "Rolling pipeline state could not be read." };
  if (!SERVING_STAGES.some(stage => stages.has(stage))) {
    return { scopeKey, state: "not_started", stage: null, detail: `The rolling pipeline has not started today (no ${scopeKey} stage rows).` };
  }
  let previous: string | null = null;
  for (const stage of SERVING_STAGES) {
    const state = stages.get(stage);
    if (state?.status === "complete") { previous = stage; continue; }
    const notReached = stage === "projection_execution" ? "" : "; projection_execution was not reached";
    if (!state) {
      return { scopeKey, state: "stalled", stage, detail: `The rolling pipeline finished ${previous} but never started ${stage}${notReached}.` };
    }
    if (state.status === "running") {
      const expires = Date.parse(state.leaseExpiresAt ?? "");
      return Number.isFinite(expires) && expires > now.getTime()
        ? { scopeKey, state: "running", stage, detail: `The rolling pipeline is still running ${stage} (lease until ${etTime(state.leaseExpiresAt)})${notReached}.` }
        : { scopeKey, state: "stuck", stage, detail: `The rolling pipeline is stuck: ${stage} has been running since ${etTime(state.updatedAt)} `
          + `with ${state.leaseExpiresAt ? "an expired" : "no"} lease, and no invocation can take it over without operator reconciliation${notReached}.` };
    }
    return state.lastError === HANDOFF_CODE
      ? { scopeKey, state: "handed_off", stage, detail: `The rolling pipeline handed ${stage} off for resumption at ${etTime(state.updatedAt)} and no invocation has resumed it${notReached}.` }
      : { scopeKey, state: "failed", stage, detail: `The rolling pipeline failed at ${stage} (${state.lastError ?? "no error recorded"}, ${etTime(state.updatedAt)})${notReached}.` };
  }
  return { scopeKey, state: "complete", stage: null, detail: "The rolling pipeline finished through projection_execution." };
}

/**
 * Pure. Status:
 *   - critical: readers have no servable run for the date, or today's newest full-slate run is withheld by the gate
 *     while readers fall back to an older run (the C1 signature);
 *   - warning: no servable run was created today and readers serve an older one (pipeline running, stuck or failed),
 *     or a newer run today is withheld while an earlier one today is served;
 *   - ok: readers serve a full-slate run created today;
 *   - not_applicable off season; unknown when the runs could not be read.
 */
export function assessForgeServingHealth(input: {
  date: string;
  now: Date;
  seasonState: "in_season" | "off_season" | "unknown";
  /** Runs for the date (h1, any status), or null when the read failed. */
  runs: ForgeServingRunRow[] | null;
  stages: ReadonlyMap<string, ForgeServingStageState> | null;
  /** Run ids a snapshot read proved (loadExternalInputProof), beyond closure attribution. */
  provenRunIds?: ReadonlySet<string>;
  notes?: string[];
}): ForgeServingHealth {
  const { date, now } = input;
  const notes = [...(input.notes ?? [])];
  const pipeline = assessForgeServingPipeline(date, input.stages, now);
  const base = { date, checkedAt: now.toISOString(), pipeline, notes };
  if (input.seasonState === "off_season") {
    return { ...base, status: "not_applicable", servedRun: null, todayRuns: [], problems: [] };
  }
  if (!input.runs) return { ...base, status: "unknown", servedRun: null, todayRuns: [], problems: [] };
  const proven = input.provenRunIds ?? new Set<string>();
  const runs = [...input.runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map(row => summarizeRun(row, proven));
  const fullSlate = runs.filter(run => run.fullSlate);
  const servedRun = fullSlate.find(run => run.servable) ?? null;
  const todayRuns = fullSlate.filter(run => run.createdOn === date);
  const problems: string[] = [];
  let status: ForgeServingStatus = "ok";
  const raise = (level: "warning" | "critical") => { if (status !== "critical") status = level; };

  const withheldToday = todayRuns.filter(run => run.withheldReason);
  for (const run of withheldToday) {
    problems.push(`Today's run ${shortId(run.runId)} (created ${etTime(run.createdAt)}) is withheld from every reader: ${run.withheldReason}.`);
  }
  for (const run of todayRuns.filter(run => run.status !== "succeeded")) {
    problems.push(`Today's run ${shortId(run.runId)} (created ${etTime(run.createdAt)}) is ${run.status ?? "in an unknown state"}, not succeeded.`);
  }
  const servedToday = servedRun?.createdOn === date;
  if (!todayRuns.length && !servedToday) problems.push(`No full-slate FORGE run for ${date} was created today.`);
  if (!servedToday && pipeline.state !== "complete") problems.push(pipeline.detail);
  if (!servedRun) {
    const noRunsAtAll = runs.length === 0 && pipeline.state === "complete";
    problems.push(noRunsAtAll
      ? `No FORGE run exists for ${date} although the pipeline finished; expected only on a day with no games.`
      : `Readers have no servable FORGE run for ${date}: Start Chart, RSO and the forecast pages show nothing for it.`);
    const olderWithheld = fullSlate.find(run => run.withheldReason && run.createdOn !== date);
    if (olderWithheld) {
      problems.push(`The newest earlier run, ${shortId(olderWithheld.runId)} (created ${etTime(olderWithheld.createdAt)}), is withheld: ${olderWithheld.withheldReason}.`);
    }
    raise(noRunsAtAll ? "warning" : "critical");
  } else if (!servedToday) {
    const age = Math.round((Date.parse(date) - Date.parse(servedRun.createdOn)) / DAY_MS);
    problems.push(`Readers fall back to run ${shortId(servedRun.runId)}, created ${etTime(servedRun.createdAt)} (${age} day${age === 1 ? "" : "s"} old).`);
    raise(withheldToday.length ? "critical" : "warning");
  } else if (withheldToday.some(run => Date.parse(run.createdAt) > Date.parse(servedRun.createdAt))) {
    raise("warning");
  }
  return { ...base, status, servedRun, todayRuns, problems };
}

/** The report subject with the FORGE verdict: a critical verdict always shows; a warning downgrades an all-clear. */
export function withForgeServingSubject(subject: string, health: ForgeServingHealth | null | undefined): string {
  if (!health || (health.status !== "critical" && health.status !== "warning")) return subject;
  const rest = subject.replace(/^(✅|⚠️|❌)\s*/u, "");
  if (health.status === "critical") return `❌ ${rest} · FORGE not served for ${health.date}`;
  return `${subject.startsWith("❌") ? "❌" : "⚠️"} ${rest} · FORGE stale for ${health.date}`;
}

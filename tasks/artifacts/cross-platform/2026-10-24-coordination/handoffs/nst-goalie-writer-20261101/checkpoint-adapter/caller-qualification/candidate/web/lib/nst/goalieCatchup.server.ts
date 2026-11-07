import { withGoalieJob } from "./jobLifecycle.server";
import { NstExecutionLimitError, type NstRequestControl } from "./requestBudget";
import {
  acknowledgeGoalieUnit, GOALIE_DATASETS, goalieDateMillis, planGoalieCatchupStep,
  type GoalieCatchupManifest, type GoalieCompletionReceipt, type GoalieWorkUnit,
} from "./goalieCatchup";

/** Adapter for the disabled-by-default transactional checkpoint contract.
 * The caller supplies its server client and fetch/parse-only source. Never retry a write
 * after losing its acknowledgement; read/reconcile the durable claim instead. */
export type GoalieCheckpointClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};
export type GoalieSourceResult = {
  rows: readonly Record<string, unknown>[];
  parsedRows: number;
  mappedRows: number;
  validatedEmpty: boolean;
  sourceFingerprint: string;
};
export type GoalieCatchupResult = {
  status: "complete" | "progress" | "deferred" | "held";
  scope: string;
  committedUnitKeys: string[];
  attemptsUsed: number;
  requiresReview: boolean;
  holdAcknowledged: boolean | null;
  reason: string | null;
};

const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object = (value: unknown): Record<string, any> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const sameKeys = (left: unknown, right: readonly string[]) => Array.isArray(left) &&
  left.length === right.length && left.every((key, index) => key === right[index]);

function manifestFrom(value: unknown, scope: string): GoalieCatchupManifest {
  const manifest = object(value);
  if (!manifest || manifest.version !== 1 || manifest.scope !== scope || !HASH.test(scope) ||
      !/^\d{8}$/.test(manifest.season) || typeof manifest.sourceVersion !== "string" || !manifest.sourceVersion.trim() ||
      !Number.isSafeInteger(manifest.plannedRequestCount) || manifest.plannedRequestCount < 0 ||
      !Array.isArray(manifest.units) || manifest.units.length > 140) throw new Error("Invalid checkpoint manifest.");
  const start = goalieDateMillis(manifest.startDate);
  const end = goalieDateMillis(manifest.endDate);
  const expectedUnits = Math.max(0, (end - start) / 86_400_000 + 1) * GOALIE_DATASETS.length;
  if (end - start > 13 * 86_400_000 || manifest.units.length !== expectedUnits ||
      manifest.plannedRequestCount > manifest.units.length) throw new Error("Invalid checkpoint aperture.");
  const keys = new Set<string>();
  for (const unit of manifest.units) {
    if (!unit || !GOALIE_DATASETS.includes(unit.dataset) ||
        !["pending", "complete", "empty_valid", "no_games", "held"].includes(unit.state) ||
        goalieDateMillis(unit.date) < start || goalieDateMillis(unit.date) > end ||
        unit.key !== `${manifest.season}/${unit.date}/${unit.dataset}` || keys.has(unit.key)) {
      throw new Error("Invalid checkpoint unit.");
    }
    keys.add(unit.key);
  }
  if (manifest.units.filter((unit: GoalieWorkUnit) => unit.state === "pending").length > manifest.plannedRequestCount) {
    throw new Error("Checkpoint expanded its original request plan.");
  }
  return manifest as GoalieCatchupManifest;
}

async function bounded<T>(operation: (signal: AbortSignal) => PromiseLike<T>, deadlineAt: number, now: () => number): Promise<T> {
  const remaining = deadlineAt - now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Checkpoint deadline exhausted.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Checkpoint acknowledgement timed out.")); }, remaining);
    })]);
  } finally { clearTimeout(timer); }
}

async function rpc(client: GoalieCheckpointClient, name: string, args: Record<string, unknown>, deadlineAt: number, now: () => number) {
  const response = await bounded(signal => {
    const query = client.rpc(name, args) as ReturnType<GoalieCheckpointClient["rpc"]> &
      { abortSignal?: (signal: AbortSignal) => ReturnType<GoalieCheckpointClient["rpc"]> };
    return query.abortSignal ? query.abortSignal(signal) : query;
  }, Math.min(deadlineAt, now() + 5_000), now);
  const data = object(response?.data);
  if (response?.error != null || !data) throw new Error("Checkpoint acknowledgement unavailable.");
  return data;
}

export async function ensureGoalieCatchupCohort(input: {
  client: GoalieCheckpointClient; manifest: GoalieCatchupManifest; deadlineAt: number; now?: () => number;
}): Promise<{ scope: string; jobId: string | null }> {
  const manifest = manifestFrom(input.manifest, input.manifest.scope);
  // This one transaction owns both manifest creation and idempotent enqueue.
  // No separate runner insert is safe after an uncertain response.
  const receipt = await rpc(input.client, "nst_goalie_ensure_cohort_v1", { p_manifest: manifest }, input.deadlineAt, input.now ?? Date.now);
  const needsJob = manifest.units.some(unit => unit.state === "pending");
  if (receipt.status !== "ensured" || receipt.scope !== manifest.scope ||
      receipt.plannedRequestCount !== manifest.plannedRequestCount ||
      (needsJob ? typeof receipt.jobId !== "string" || !UUID.test(receipt.jobId) : receipt.jobId !== null)) {
    throw new Error("Cohort/enqueue receipt is inconsistent; reconcile before retrying.");
  }
  return { scope: receipt.scope, jobId: receipt.jobId };
}

function validateSource(source: GoalieSourceResult, unit: GoalieWorkUnit, manifest: GoalieCatchupManifest) {
  if (!source || !Array.isArray(source.rows) || source.rows.length > 100 || !HASH.test(source.sourceFingerprint) ||
      source.parsedRows !== source.rows.length || source.mappedRows !== source.rows.length ||
      (source.rows.length === 0 && source.validatedEmpty !== true)) throw new Error("Source or identity evidence is incomplete.");
  const ids = new Set<number>();
  for (const row of source.rows) {
    if (!object(row) || !Number.isSafeInteger(row.player_id) || Number(row.player_id) <= 0 ||
        row.date_scraped !== unit.date || String(row.season) !== manifest.season || ids.has(Number(row.player_id)) ||
        typeof row.player_name !== "string" || !row.player_name.trim() || typeof row.team !== "string" || !row.team.trim() ||
        !Number.isSafeInteger(row.gp) || Number(row.gp) <= 0 || typeof row.toi !== "number" || !Number.isFinite(row.toi) || row.toi < 0 ||
        Object.values(row).some(value => value !== null && typeof value !== "string" &&
          (typeof value !== "number" || !Number.isFinite(value)))) throw new Error("Output rows have invalid or duplicate identity.");
    const fields = unit.dataset.endsWith("Counts")
      ? ["shots_against", "saves", "goals_against", "xg_against", "hd_shots_against", "hd_saves"]
      : Number(row.toi) > 0 ? ["toi_per_gp", "shots_against_per_60", "saves_per_60", "gaa", "xg_against_per_60", "hd_shots_against_per_60", "hd_saves_per_60"] : [];
    if (fields.some(field => typeof row[field] !== "number" || !Number.isFinite(row[field]) || Number(row[field]) < 0)) {
      throw new Error("Source core fields are incomplete.");
    }
    ids.add(Number(row.player_id));
  }
}

export async function runGoalieCatchupStep(input: {
  client: GoalieCheckpointClient;
  scope: string;
  /** Fetch/parse/map only; this callback must never write output/checkpoints. */
  source: (unit: GoalieWorkUnit, control: NstRequestControl, signal: AbortSignal) => Promise<GoalieSourceResult>;
  deadlineAt: number;
  now?: () => number;
}): Promise<GoalieCatchupResult> {
  const now = input.now ?? Date.now;
  const result: GoalieCatchupResult = { status: "deferred", scope: input.scope, committedUnitKeys: [],
    attemptsUsed: 0, requiresReview: false, holdAcknowledged: null, reason: null };
  let manifest: GoalieCatchupManifest;
  let decision: ReturnType<typeof planGoalieCatchupStep>;
  try {
    if (!HASH.test(input.scope)) throw new Error("Invalid cohort scope.");
    const state = await rpc(input.client, "nst_goalie_read_state_v1", { p_scope: input.scope }, input.deadlineAt, now);
    manifest = manifestFrom(state.manifest, input.scope);
    if (!object(state.budget) || typeof state.sharedJobActive !== "boolean" || typeof state.reviewRequired !== "boolean" ||
        (state.lastDirectJobFinishedAt !== null && typeof state.lastDirectJobFinishedAt !== "string")) throw new Error("Checkpoint state is incomplete.");
    if (state.reviewRequired) return { ...result, status: "held", requiresReview: true,
      reason: "A durable claim or unit requires reconciliation, including prior cohorts/days." };
    decision = planGoalieCatchupStep({ manifest, now: new Date(now()), budget: state.budget,
      sharedJobActive: state.sharedJobActive, lastDirectJobFinishedAt: state.lastDirectJobFinishedAt });
  } catch {
    return { ...result, reason: "Checkpoint state unavailable; no provider work started." };
  }
  if (!decision.allowed) return { ...result,
    status: manifest.units.some(unit => unit.state === "held") ? "held"
      : decision.reason === "Goalie cohort complete." ? "complete" : "deferred",
    requiresReview: manifest.units.some(unit => unit.state === "held"), reason: decision.reason };

  let claim: Record<string, any>;
  const proposedDeadline = Math.min(input.deadlineAt, decision.deadlineAt);
  try {
    claim = await rpc(input.client, "nst_goalie_claim_step_v1", { p_scope: input.scope,
      p_unit_keys: decision.units.map(unit => unit.key), p_max_attempts: decision.maxAttempts,
      p_deadline_at: new Date(proposedDeadline).toISOString() }, proposedDeadline, now);
    if (claim.status === "deferred" && claim.scope === input.scope) return { ...result, reason: "Atomic claim deferred; no provider work started." };
    if (claim.status !== "claimed" || claim.scope !== input.scope || typeof claim.claimId !== "string" || !UUID.test(claim.claimId) ||
        claim.utcDate !== new Date(now()).toISOString().slice(0, 10) ||
        !sameKeys(claim.unitKeys, decision.units.map(unit => unit.key)) ||
        claim.plannedRequestCount !== manifest.plannedRequestCount || claim.attemptsReserved !== decision.maxAttempts ||
        !Number.isFinite(Date.parse(claim.deadlineAt)) || Date.parse(claim.deadlineAt) > proposedDeadline) throw new Error("Invalid claim receipt.");
  } catch {
    return { ...result, status: "held", requiresReview: true, holdAcknowledged: false,
      reason: "Claim acknowledgement is uncertain; reconcile the durable claim before another attempt." };
  }
  const control: NstRequestControl = { deadlineAt: Date.parse(claim.deadlineAt), maxAttempts: claim.attemptsReserved,
    attemptsStarted: 0, minIntervalMs: decision.minIntervalMs, plannedRequestCount: manifest.plannedRequestCount };
  const validAccounting = (previous: number) => Number.isSafeInteger(control.attemptsStarted) &&
    control.attemptsStarted >= previous && control.attemptsStarted <= claim.attemptsReserved &&
    control.maxAttempts === claim.attemptsReserved && control.plannedRequestCount === manifest.plannedRequestCount &&
    control.minIntervalMs === decision.minIntervalMs && control.deadlineAt === Date.parse(claim.deadlineAt);
  const hold = async (reason: string): Promise<GoalieCatchupResult> => {
    let acknowledged = false;
    try {
      const receipt = await rpc(input.client, "nst_goalie_hold_step_v1", { p_scope: input.scope,
        p_claim_id: claim.claimId, p_reason: reason }, input.deadlineAt, now);
      acknowledged = receipt.status === "held" && receipt.scope === input.scope && receipt.claimId === claim.claimId;
    } catch { /* An unacknowledged hold never releases its claim or attempt reservation. */ }
    return { ...result, status: "held", attemptsUsed: control.attemptsStarted,
      requiresReview: true, holdAcknowledged: acknowledged, reason };
  };

  let deferred = false;
  for (const unit of decision.units) {
    if (now() + 35_000 >= control.deadlineAt || control.attemptsStarted >= control.maxAttempts) { deferred = true; break; }
    const previousAttempts = control.attemptsStarted;
    let source: GoalieSourceResult;
    try {
      source = await withGoalieJob(claim.claimId, control.deadlineAt, () =>
        bounded(signal => input.source(unit, control, signal), control.deadlineAt - 20_000, now));
      if (!validAccounting(previousAttempts)) throw new Error("Source attempt accounting is invalid.");
      validateSource(source, unit, manifest);
    } catch (error) {
      if (error instanceof NstExecutionLimitError && !error.dispatchStarted && validAccounting(previousAttempts)) { deferred = true; break; }
      return hold("Source dispatch, parsing or identity evidence is uncertain.");
    }
    try {
      // Output and completion checkpoint must commit in this single RPC.
      const receipt = await rpc(input.client, "nst_goalie_commit_unit_v1", { p_scope: input.scope,
        p_claim_id: claim.claimId, p_unit_key: unit.key, p_rows: source.rows,
        p_source_fingerprint: source.sourceFingerprint, p_validated_empty: source.validatedEmpty,
        p_parsed_rows: source.parsedRows, p_mapped_rows: source.mappedRows }, control.deadlineAt, now);
      const status = source.rows.length ? "complete" : "empty_valid";
      if (receipt.status !== "committed" || receipt.scope !== input.scope || receipt.claimId !== claim.claimId ||
          receipt.unitKey !== unit.key || receipt.sourceFingerprint !== source.sourceFingerprint ||
          receipt.completionStatus !== status || !UUID.test(receipt.receiptId ?? "") ||
          [receipt.parsedRows, receipt.mappedRows, receipt.writtenRows].some(count => count !== source.rows.length) ||
          (unit.dataset === "allCounts" && receipt.allCountsCoverage !== "complete")) throw new Error("Invalid completion receipt.");
      const completion: GoalieCompletionReceipt = { season: manifest.season, date: unit.date, dataset: unit.dataset,
        sourceVersion: manifest.sourceVersion, status, parsedRows: source.parsedRows, mappedRows: source.mappedRows,
        writtenRows: receipt.writtenRows, outputAcknowledged: true, checkpointAcknowledged: true };
      manifest = acknowledgeGoalieUnit(manifest, completion, "complete");
      result.committedUnitKeys.push(unit.key);
    } catch {
      return hold("Output/checkpoint acknowledgement is uncertain; do not replay this unit.");
    }
  }
  try {
    const receipt = await rpc(input.client, "nst_goalie_finish_step_v1", { p_scope: input.scope,
      p_claim_id: claim.claimId, p_attempts_used: control.attemptsStarted,
      p_committed_unit_keys: result.committedUnitKeys }, input.deadlineAt, now);
    if (receipt.status !== "finished" || receipt.scope !== input.scope || receipt.claimId !== claim.claimId ||
        receipt.attemptsUsed !== control.attemptsStarted || receipt.attemptsCharged !== claim.attemptsReserved || receipt.unusedReleased !== 0 ||
        !sameKeys(receipt.committedUnitKeys, result.committedUnitKeys)) throw new Error("Invalid budget settlement receipt.");
  } catch {
    return hold("Attempt settlement is uncertain; keep the reservation until reconciliation.");
  }
  const held = manifest.units.some(unit => unit.state === "held");
  return { ...result, attemptsUsed: control.attemptsStarted, requiresReview: held,
    status: deferred ? "deferred" : held ? "held" : manifest.units.some(unit => unit.state === "pending") ? "progress" : "complete",
    reason: deferred ? "Step budget reached; unstarted units remain pending." : held ? "Persisted units still require review." : null };
}

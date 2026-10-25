import { createHash } from "node:crypto";
import { z } from "zod";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(), z.array(jsonValue), z.record(jsonValue),
]));
const positive = z.number().int().positive().safe();
const instant = z.number().int().nonnegative().safe(); // Explicit epoch milliseconds for this new contract.
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reference = z.object({ versionId: z.string().uuid(), contentHash: hash }).strict();
export const RUN_PHASES = ["history", "fitting", "prediction", "evaluation"] as const;

export class RunnerError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "RunnerError"; }
}

export const experimentPlanSchema = z.object({
  version: z.literal("forge-testing-grounds-run-v1"),
  baseline: reference,
  candidate: reference,
  inputManifest: z.object({
    ...reference.shape,
    historyClass: z.enum(["synthetic", "original_snapshot", "reconstructed_history_diagnostic"]),
    knowledgeCutoffMs: instant,
    snapshots: z.array(z.object({ ...reference.shape, availableAtMs: instant.nullable(), capturedAtMs: instant }).strict()).min(1),
  }).strict(),
  preflightReportHash: hash,
  chronologyContractHash: hash,
  evaluationContractHash: hash,
  work: z.array(z.object({ phase: z.enum(RUN_PHASES), key: z.string().regex(/^[a-z0-9][a-z0-9_:-]{0,95}$/) }).strict()).min(1),
  reveal: z.object({ rule: z.literal("owner_after_completion_and_time"), notBeforeMs: instant }).strict(),
  limits: z.object({
    maxUnits: positive, stepTimeoutMs: positive, leaseMs: positive, maxRunMs: positive,
    maxExecutionsPerUnit: positive, maxFailuresPerUnit: positive, retryDelayMs: positive,
    // Omitted v1 field uses maxExecutionsPerUnit as an independent check cap;
    // no default is inserted into the accepted manifest or its hash.
    maxOutcomeChecksPerUnit: positive.optional(),
    maxOutputBytes: positive, maxCheckpointBytes: positive, maxStoredBytes: positive,
  }).strict(),
}).strict().superRefine((plan, context) => {
  const reject = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
  if (plan.work.length > plan.limits.maxUnits) reject("Work exceeds the declared unit budget.");
  if (plan.limits.stepTimeoutMs >= plan.limits.leaseMs || plan.limits.leaseMs > plan.limits.maxRunMs) reject("Step, lease and run bounds must be ordered.");
  if (plan.limits.stepTimeoutMs > 2_147_483_647) reject("Step timeout exceeds the timer range.");
  if (plan.limits.maxFailuresPerUnit > plan.limits.maxExecutionsPerUnit) reject("Failures cannot exceed execution budget.");
  if (new Set(plan.work.map(unit => `${unit.phase}:${unit.key}`)).size !== plan.work.length) reject("Duplicate logical work unit.");
  if (plan.work.some((unit, index) => index > 0 && RUN_PHASES.indexOf(unit.phase) < RUN_PHASES.indexOf(plan.work[index - 1].phase))) reject("Work must follow phase order.");
  if (!plan.work.some(unit => unit.phase === "evaluation")) reject("An experiment needs a declared evaluation stage.");
  for (const source of plan.inputManifest.snapshots) {
    if (source.availableAtMs !== null && source.availableAtMs > plan.inputManifest.knowledgeCutoffMs) reject("Source is not available by cutoff.");
    if (plan.inputManifest.historyClass === "original_snapshot" && (source.availableAtMs === null
      || source.capturedAtMs > plan.inputManifest.knowledgeCutoffMs)) reject("Original history requires contemporaneous source clocks.");
  }
});
export type ExperimentPlan = z.infer<typeof experimentPlanSchema>;
export type RunState = "queued" | "running" | "cancellation_requested" | "cancelled" | "failed"
  | "completed_awaiting_reveal" | "completed_revealed";
const stepResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed"), payload: jsonValue, outcomeStatus: z.enum(["settled", "not_applicable"]) }).strict(),
  z.object({ kind: z.literal("checkpoint"), payload: jsonValue }).strict(),
  z.object({ kind: z.literal("pending_outcomes") }).strict(),
  z.object({ kind: z.literal("failed"), code: z.enum(["executor_failed", "step_timeout"]) }).strict(),
]);
export type StepResult = z.infer<typeof stepResultSchema>;
export function parseStepResult(value: unknown): StepResult {
  try { return stepResultSchema.parse(value); }
  catch { throw new RunnerError("invalid_step_result"); }
}

export function freezeCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value));
  const freeze = (item: unknown): unknown => {
    if (item && typeof item === "object") { Object.values(item).forEach(freeze); Object.freeze(item); }
    return item;
  };
  return freeze(copy) as T;
}

function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function contentHash(value: JsonValue): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function parsePlan(value: unknown): ExperimentPlan {
  const parsed = experimentPlanSchema.safeParse(value);
  if (!parsed.success) throw new RunnerError("invalid_plan");
  return freezeCopy(parsed.data);
}
export function checkedIdentity(value: string): string {
  if (!z.string().uuid().safeParse(value).success) throw new RunnerError("invalid_identity");
  return value.toLowerCase();
}
export function checkedInstant(value: number): number {
  if (!instant.safeParse(value).success) throw new RunnerError("invalid_clock");
  return value;
}
export function boundedPayload(value: unknown, maxBytes: number) {
  try {
    const parsed = jsonValue.parse(value);
    const bytes = Buffer.byteLength(canonical(parsed));
    if (bytes > maxBytes) throw new RunnerError("payload_limit");
    return { value: freezeCopy(parsed), hash: contentHash(parsed), bytes };
  } catch { throw new RunnerError("invalid_or_oversized_payload"); }
}
export function workUnitId(planHash: string, index: number): string {
  return contentHash({ planHash, index });
}

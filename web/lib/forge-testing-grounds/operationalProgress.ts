import { z } from "zod";

const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const stageStatus = z.enum(["queued", "running", "cancellation_requested", "cancelled", "failed", "completed"]);

// Match the existing datetime contract: optional seconds, arbitrary fractional
// precision, and Z or numeric offsets. Date.parse is used only for whole UTC
// seconds; no ordering decision rounds the supplied decimal fraction.
function clockParts(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):?(\d{2}))$/.exec(value);
  if (!match) return null; // A dirty Zod string can still reach superRefine.
  const offsetSeconds = match[4] === "Z" ? 0
    : (match[5] === "+" ? 1 : -1) * (Number(match[6]) * 3600 + Number(match[7]) * 60);
  const seconds = Date.parse(`${match[1]}:${match[2] ?? "00"}Z`) / 1000 - offsetSeconds;
  return Number.isSafeInteger(seconds) ? { seconds, fraction: match[3] ?? "" } : null;
}

function laterThan(left: string, right: string, offsetMs = 0): boolean {
  const a = clockParts(left), b = clockParts(right);
  if (!a || !b) return false; // Invalid syntax is rejected by the timestamp schema.
  const precision = Math.max(a.fraction.length, b.fraction.length, 3);
  const scale = BigInt(`1${"0".repeat(precision)}`);
  const difference = BigInt(a.seconds - b.seconds) * scale
    + BigInt(a.fraction.padEnd(precision, "0")) - BigInt(b.fraction.padEnd(precision, "0"));
  return difference > BigInt(offsetMs) * (scale / BigInt(1000));
}

// Numeric durations are display values with normal floating-point precision.
// Chronology and heartbeat-threshold decisions use laterThan, never this value.
function durationMs(end: string, start: string): number {
  const a = clockParts(end)!, b = clockParts(start)!;
  return (a.seconds - b.seconds) * 1000 + (Number(`0.${a.fraction}`) - Number(`0.${b.fraction}`)) * 1000;
}

export const testingGroundsRunState = z.enum([
  "draft", "preflight_blocked", "queued", "running", "cancellation_requested",
  "cancelled", "failed", "completed_awaiting_reveal", "completed_revealed",
]);

const stageFields = {
  stageId: z.string().uuid(),
  status: stageStatus,
  startedAt: timestamp.nullable(),
  finishedAt: timestamp.nullable(),
  heartbeatAt: timestamp.nullable(),
};

/** Only accepted terminal work counts. Retried computation is not another unit. */
export const workStageSchema = z.discriminatedUnion("kind", [
  z.object({
    ...stageFields,
    kind: z.enum(["historical_games", "player_game_predictions", "evaluation_tasks"]),
    denominator: z.object({
      manifestHash: hash,
      eligibilityRuleHash: hash,
      eligible: count,
      excludedBeforeStage: count,
    }).strict(),
    counts: z.object({ successful: count, skipped: count, failed: count, pending: count }).strict(),
  }).strict(),
  z.object({ ...stageFields, kind: z.literal("fitting") }).strict(),
]).superRefine((stage, context) => {
  const reject = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
  const start = stage.startedAt;
  const finish = stage.finishedAt;
  const heartbeat = stage.heartbeatAt;
  const terminal = ["completed", "failed", "cancelled"].includes(stage.status);
  if (stage.status === "queued" && (start !== null || finish !== null || heartbeat !== null)) {
    reject("A queued stage has no execution timestamps.");
  }
  if (["running", "cancellation_requested", "completed"].includes(stage.status) && start === null) {
    reject("An active or completed stage requires its start time.");
  }
  if (terminal !== (finish !== null)) reject("Only a terminal stage has a finish time.");
  if (start === null && heartbeat !== null || start !== null && (
    finish !== null && laterThan(start, finish) || heartbeat !== null && laterThan(start, heartbeat)
  ) || finish !== null && heartbeat !== null && laterThan(heartbeat, finish)) {
    reject("Stage timestamps must be chronologically consistent.");
  }
  if (stage.kind !== "fitting") {
    const { successful, skipped, failed, pending } = stage.counts;
    const total = successful + skipped + failed + pending;
    if (!Number.isSafeInteger(total) || total !== stage.denominator.eligible) {
      reject("Every eligible unit must be successful, skipped, failed or pending exactly once.");
    }
    if (stage.status === "queued" && pending !== total) reject("Queued work has no accepted outputs.");
    if (stage.status === "completed" && (pending !== 0 || failed !== 0)) {
      reject("A completed stage cannot contain unresolved or failed work.");
    }
  }
});

export type WorkStage = z.infer<typeof workStageSchema>;

export const operationalSnapshotSchema = z.object({
  version: z.literal("forge-testing-grounds-progress-v1"),
  runId: z.string().uuid(),
  state: testingGroundsRunState,
  revision: count,
  recordedAt: timestamp,
  stages: z.array(workStageSchema),
}).strict().superRefine((snapshot, context) => {
  const reject = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
  if (new Set(snapshot.stages.map(stage => stage.stageId)).size !== snapshot.stages.length) {
    reject("Stage identities must be unique.");
  }
  for (const stage of snapshot.stages) {
    if ([stage.startedAt, stage.finishedAt, stage.heartbeatAt].some(at => at !== null && laterThan(at, snapshot.recordedAt))) {
      reject("A stage timestamp cannot be later than the saved snapshot.");
    }
  }
  if (["completed_awaiting_reveal", "completed_revealed"].includes(snapshot.state)
    && (!snapshot.stages.length || snapshot.stages.some(stage => stage.status !== "completed"))) {
    reject("Completion requires all declared stages to be completed.");
  }
});

export type OperationalSnapshot = z.infer<typeof operationalSnapshotSchema>;

const unitNames = {
  historical_games: "games",
  player_game_predictions: "player-games",
  evaluation_tasks: "evaluation tasks",
} as const;

/**
 * Pure monitoring boundary, not a store or authorization check. Pass only the
 * persisted operational envelope; unknown fields (including scores, outcome
 * payloads and arbitrary log text) are rejected rather than reflected.
 * Staleness is an explicit caller policy, never evidence that a worker failed.
 */
export function projectOperationalProgress(value: unknown, clock: { now: string; staleAfterMs: number }) {
  const snapshot = operationalSnapshotSchema.parse(value);
  const now = timestamp.parse(clock.now);
  const staleAfterMs = z.number().int().positive().safe().parse(clock.staleAfterMs);
  if (laterThan(snapshot.recordedAt, now)) throw new Error("Monitoring clock precedes the persisted snapshot.");
  return {
    ...snapshot,
    // Reveal authorization belongs to the server service, never this state label.
    overallPercent: null,
    stages: snapshot.stages.map(stage => {
      const active = stage.status === "running" || stage.status === "cancellation_requested";
      const heartbeatAgeMs = stage.heartbeatAt === null ? null : durationMs(now, stage.heartbeatAt);
      const elapsedMs = stage.startedAt === null ? null
        : durationMs(stage.finishedAt ?? now, stage.startedAt);
      const heartbeatStatus = !active ? "inactive" as const : heartbeatAgeMs === null ? "not_received" as const
        : laterThan(now, stage.heartbeatAt!, staleAfterMs) ? "stale" as const : "recent" as const;
      const completed = stage.kind === "fitting" ? null
        : stage.counts.successful + stage.counts.skipped + stage.counts.failed;
      return {
        ...stage,
        unit: stage.kind === "fitting" ? null : unitNames[stage.kind],
        completed,
        percent: stage.kind === "fitting" || stage.denominator.eligible === 0 ? null
          : completed! / stage.denominator.eligible * 100,
        progressMeaning: stage.kind === "fitting" ? "Fitting has no measured internal percentage."
          : "Terminal work units / declared eligible units. Successful, skipped and failed units remain separate; pending units are incomplete.",
        elapsedMs,
        heartbeatAgeMs,
        heartbeatStatus,
      };
    }),
  };
}

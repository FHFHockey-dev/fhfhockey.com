import { checkInputFieldHealth, type HealthCheckSpecification, type InputHealthRow } from "../dataHealth";
import { type OperationalSnapshot, type WorkStage } from "../operationalProgress";
import { type runProgressSchema } from "../runProjection";
import type { z } from "zod";

export const previewScenarios = [
  { id: "predicting", label: "Prediction in progress" },
  { id: "fitting", label: "Fitting · no percentage" },
  { id: "blocked", label: "Preflight blocked" },
  { id: "queued", label: "Queued" },
  { id: "stale", label: "Stale heartbeat" },
  { id: "cancelling", label: "Cancellation requested" },
  { id: "cancelled", label: "Cancelled" },
  { id: "failed", label: "Failed work" },
  { id: "sealed", label: "Completed · results sealed" },
  { id: "empty", label: "No run selected" },
] as const;
export type PreviewScenario = typeof previewScenarios[number]["id"];
export const PREVIEW_NOW = "2026-09-02T12:08:00Z";
const uuid = (n: number) => `04000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = (minute: string) => `2026-09-02T12:${minute}:00Z`;

function countedStage(index: number, kind: "historical_games" | "player_game_predictions" | "evaluation_tasks", eligible: number): WorkStage {
  return { stageId: uuid(index), kind, status: "queued", startedAt: null, finishedAt: null, heartbeatAt: null,
    denominator: { manifestHash: "a".repeat(64), eligibilityRuleHash: "b".repeat(64), eligible, excludedBeforeStage: index === 1 ? 2 : 0 },
    counts: { successful: 0, skipped: 0, failed: 0, pending: eligible } };
}

/** Local display scenarios, never a worker or fabricated response from a hosted service. */
export function createPreviewFixture(scenario: PreviewScenario): { snapshot: OperationalSnapshot | null; now: string; health: ReturnType<typeof checkInputFieldHealth> | null } {
  if (scenario === "empty") return { snapshot: null, now: PREVIEW_NOW, health: null };
  const history = countedStage(1, "historical_games", 48);
  const fitting: WorkStage = { stageId: uuid(2), kind: "fitting", status: "queued", startedAt: null, finishedAt: null, heartbeatAt: null };
  const predictions = countedStage(3, "player_game_predictions", 720);
  const evaluation = countedStage(4, "evaluation_tasks", 12);
  if (history.kind === "fitting" || predictions.kind === "fitting" || evaluation.kind === "fitting") throw new Error("Invalid fixture definition.");
  const stages = [history, fitting, predictions, evaluation];
  const snapshot: OperationalSnapshot = { version: "forge-testing-grounds-progress-v1", runId: uuid(10),
    revision: 8, state: "running", recordedAt: PREVIEW_NOW, stages };
  if (scenario === "blocked" || scenario === "queued") snapshot.state = scenario === "blocked" ? "preflight_blocked" : "queued";
  else {
    Object.assign(history, { status: "completed", startedAt: stamp("00"), finishedAt: stamp("01"), heartbeatAt: stamp("01"),
      counts: { successful: 48, skipped: 0, failed: 0, pending: 0 } });
    Object.assign(fitting, { status: scenario === "fitting" ? "running" : "completed", startedAt: stamp("01"),
      finishedAt: scenario === "fitting" ? null : stamp("04"), heartbeatAt: scenario === "fitting" ? stamp("07") : stamp("04") });
    if (scenario !== "fitting") Object.assign(predictions, { status: "running", startedAt: stamp("04"), heartbeatAt: stamp("07"),
      counts: { successful: 420, skipped: 12, failed: 0, pending: 288 } });
    if (scenario === "stale") predictions.heartbeatAt = stamp("04");
    if (scenario === "cancelling") { snapshot.state = "cancellation_requested"; predictions.status = "cancellation_requested"; }
    if (scenario === "cancelled" || scenario === "failed") {
      snapshot.state = scenario; predictions.status = scenario; predictions.finishedAt = stamp("07");
      if (scenario === "failed") predictions.counts = { successful: 420, skipped: 12, failed: 1, pending: 287 };
    }
    if (scenario === "sealed") {
      snapshot.state = "completed_awaiting_reveal";
      Object.assign(predictions, { status: "completed", finishedAt: stamp("07"), counts: { successful: 708, skipped: 12, failed: 0, pending: 0 } });
      Object.assign(evaluation, { status: "completed", startedAt: stamp("07"), heartbeatAt: stamp("08"), finishedAt: stamp("08"),
        counts: { successful: 12, skipped: 0, failed: 0, pending: 0 } });
    }
  }
  const spec: HealthCheckSpecification = {
    reportId: uuid(11), inputManifestId: uuid(12), cohortId: uuid(13), policyHash: "c".repeat(64), checkedAt: PREVIEW_NOW,
    predictionCutoff: "2026-09-01T12:00:00Z", maxAgeMs: 86_400_000, requireAuthenticHistory: false,
    blockingCodes: ["missing", "null", "malformed", "duplicate", "identity", "units", "strength", "source_mismatch"],
    field: { source: "synthetic", table: "fixture_inputs", field: "prior_count", unit: "count", strength: "all", minimum: 0, maximum: null, allowFractional: true },
    supersedes: null,
  };
  const row = (id: number): InputHealthRow => ({ identity: { playerId: id, gameId: 9001 },
    source: "synthetic", table: "fixture_inputs", field: "prior_count", unit: "count", strength: "all", value: 0.35,
    observedAt: "2026-09-01T10:00:00Z", availableAt: "2026-09-01T10:05:00Z", capturedAt: "2026-09-01T10:10:00Z", revisionId: "synthetic-r1" });
  const rows: InputHealthRow[] = [row(1), { ...row(2), value: 0 },
    { ...row(3), availableAt: null, capturedAt: "2026-09-01T13:00:00Z" }];
  if (scenario === "blocked") rows.push(
    { ...row(4), value: undefined }, { ...row(5), value: null }, { ...row(6), value: "unsafe-raw-fixture-value" },
    row(7), row(7), { ...row(8), observedAt: "2026-08-29T10:00:00Z" },
    { ...row(9), identity: { playerId: "unsafe-private-identity", gameId: 9001 } },
    { ...row(10), unit: "unsafe-private-unit" }, { ...row(11), strength: "unknown" },
    { ...row(12), availableAt: "2026-09-01T13:00:00Z", capturedAt: "2026-09-01T13:05:00Z" },
  );
  return { snapshot, now: PREVIEW_NOW, health: checkInputFieldHealth(spec, rows) };
}

const at = (minute: number) => Date.UTC(2026, 8, 2, 12, minute);
const listedRun = (n: number, run: Partial<z.input<typeof runProgressSchema>>): z.input<typeof runProgressSchema> => ({
  runId: uuid(20 + n), planHash: String(n).repeat(64), storageMode: "memory_reference", state: "queued", revision: 1,
  createdAtMs: at(n), finishedAtMs: null, heartbeatAtMs: null, notBeforeMs: at(n), lastEvent: "accepted",
  stages: [{ phase: "prediction", total: 2, successful: 0, failed: 0, pending: 2, skipped: 0, percent: 0 },
    { phase: "evaluation", total: 1, successful: 0, failed: 0, pending: 1, skipped: 0, percent: 0 }],
  ...run,
});
/** Saved-run listing as the owner collection route returns it: projections only, newest first. */
export function createHistoryFixture(): { runs: Array<z.input<typeof runProgressSchema>> } {
  return { runs: [
    listedRun(3, { state: "running", revision: 4, heartbeatAtMs: at(7), lastEvent: "step_claimed",
      stages: [{ phase: "prediction", total: 2, successful: 1, failed: 0, pending: 1, skipped: 0, percent: 50 },
        { phase: "evaluation", total: 1, successful: 0, failed: 0, pending: 1, skipped: 0, percent: 0 }] }),
    listedRun(2, { state: "completed_awaiting_reveal", revision: 6, finishedAtMs: at(5), heartbeatAtMs: at(5), lastEvent: "completed_sealed",
      stages: [{ phase: "prediction", total: 2, successful: 2, failed: 0, pending: 0, skipped: 0, percent: 100 },
        { phase: "evaluation", total: 1, successful: 1, failed: 0, pending: 0, skipped: 0, percent: 100 }] }),
    listedRun(1, { state: "cancelled", revision: 3, finishedAtMs: at(2), lastEvent: "cancelled" }),
  ] };
}

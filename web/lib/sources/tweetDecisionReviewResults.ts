import { isDeepStrictEqual } from "node:util";
import { timestampMicros } from "lib/projections/evidenceTime";
import { DECISION_REVIEW_BINDING_VERSION, REVIEW_ONLY_AUTHORITY, type MappedDecisionReview } from "./tweetDecisionReviewMapping";
import type { ReferenceQuestion } from "./decisionsReference/adapter.mjs";

type Assessment = { status: "unknown"; reason: string } | { status: "scored"; type: "predicate"; probability: number }
  | { status: "scored"; type: "choice"; choice: string; confidence: number; probabilities: { value: string; probability: number }[] };
const record = (value: unknown): Record<string, any> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const probability = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const unknown = (reason: string): Assessment => ({ status: "unknown", reason });
function assess(question: ReferenceQuestion, results: unknown[]): Assessment {
  const matches = results.filter(r => record(r)?.name === question.name);
  if (matches.length !== 1) return unknown("missing_or_duplicate_answer");
  const r = record(matches[0])!;
  if (r.status === "unknown") return unknown(typeof r.reason === "string" && r.reason ? r.reason : "reference_unknown");
  if (r.status !== "scored" || r.type !== question.type) return unknown("invalid_answer_type");
  if (question.type === "predicate") return probability(r.probability)
    ? { status: "scored", type: "predicate", probability: r.probability } : unknown("invalid_probability");
  const options = question.choices!.map(c => c.value), values = r.probabilities;
  if (!options.includes(r.choice) || !probability(r.confidence) || !Array.isArray(values) || values.length !== options.length
    || new Set(values.map(p => record(p)?.value)).size !== options.length
    || values.some(p => !record(p) || !options.includes(p.value) || !probability(p.probability))
    || Math.abs(values.reduce((sum, p) => sum + p.probability, 0) - 1) > 0.001) return unknown("invalid_choice_distribution");
  return { status: "scored", type: "choice", choice: r.choice, confidence: r.confidence,
    probabilities: values.map(p => ({ value: p.value, probability: p.probability })) };
}

/** Checks a reference sidecar against a trusted, locally mapped plan. The caller
 * must retain/load that plan independently of the result. Hashes bind content;
 * they do not authenticate a provider or turn source support into factual truth.
 * No result field can grant status/publication authority or perform a write.
 */
export function validateTweetDecisionReviewResult(plan: MappedDecisionReview, value: unknown) {
  let reviewReasons: string[] = ["uncalibrated_shadow_only"];
  const finish = (reason: string | null, answers: Assessment[]) => ({ ...REVIEW_ONLY_AUTHORITY,
    bindingVersion: DECISION_REVIEW_BINDING_VERSION, planHash: plan.planHash, packetHash: plan.packetHash,
    sourceSupportMeaning: "assessment_of_supplied_statement_only" as const,
    calibrationStatus: "uncalibrated_shadow_only" as const, reviewReasons: [...reviewReasons],
    status: reason ? "unknown" as const : answers.some(a => a.status === "unknown") || plan.heldCandidates.length || plan.unboundStatements.length
      ? "partial_or_unknown" as const : "bound_review" as const,
    reason, post: answers[0], claims: plan.bindings.map((b, index) => ({ ...b, support: answers[1 + index * 2], wording: answers[2 + index * 2] })),
    heldCandidates: structuredClone(plan.heldCandidates), unboundStatements: structuredClone(plan.unboundStatements) });
  const fail = (reason: string) => finish(reason, plan.request.questions.map(() => unknown(reason)));
  try {
    const envelope = record(value), sidecar = record(envelope?.sidecar), audit = record(sidecar?.audit);
    if (envelope?.bindingVersion !== DECISION_REVIEW_BINDING_VERSION || envelope.planHash !== plan.planHash
      || envelope.packetHash !== plan.packetHash) return fail("application_binding_mismatch");
    if (!sidecar || !audit) return fail("reference_sidecar_unavailable");
    if (audit.mode !== "shadow" || audit.promptVersion !== plan.promptVersion || audit.modelRequested !== plan.model
      || (audit.modelReturned !== undefined && audit.modelReturned !== null && audit.modelReturned !== plan.model)
      || audit.extractionVersion !== plan.extractionVersion || audit.asOf !== plan.input.source.ingestedAt
      || audit.calibration !== null || !Array.isArray(audit.invalidClaims) || audit.invalidClaims.length
      || !isDeepStrictEqual(audit.claimBindings, plan.referenceAudit.claimBindings)) return fail("reference_binding_mismatch");
    for (const key of ["sourceId", "sourceHash", "claimsHash", "evidenceHash", "requestHash", "idempotencyKey"] as const) {
      if (audit[key] !== plan.referenceAudit[key]) return fail("reference_binding_mismatch");
    }
    const createdAt = typeof audit.createdAt === "string" ? timestampMicros(audit.createdAt) : null;
    const receivedAt = timestampMicros(plan.input.source.ingestedAt);
    if (createdAt === null || receivedAt === null || createdAt < receivedAt) return fail("reference_clock_mismatch");
    if (["disabled", "invalid_input", "skipped", "unknown"].includes(sidecar.status)) {
      return fail(`reference_${typeof sidecar.reason === "string" ? sidecar.reason : sidecar.status}`);
    }
    if (Array.isArray(sidecar.reviewReasons) && sidecar.reviewReasons.every((r: unknown) => typeof r === "string")) {
      reviewReasons = [...new Set([...reviewReasons, ...sidecar.reviewReasons])];
    }
    if (audit.budgetWarning || !record(audit.usage) || !Number.isSafeInteger(audit.usage.inputTokens)
      || audit.usage.inputTokens < 0) return fail("reference_budget_accounting_unresolved");
    if (!["scored", "partial_or_unknown"].includes(sidecar.status) || !Array.isArray(sidecar.results)) return fail("invalid_reference_result");
    const names = new Set(plan.request.questions.map(q => q.name));
    if (sidecar.results.some((r: unknown) => !record(r) || !names.has(record(r)!.name))) return fail("unexpected_answer_name");
    return finish(null, plan.request.questions.map(q => assess(q, sidecar.results)));
  } catch {
    return fail("invalid_reference_result");
  }
}

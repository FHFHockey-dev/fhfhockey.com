import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const name = z.string().trim().min(1).max(80);
const count = z.number().int().nonnegative();
const finite = z.number().finite();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const metric = z.enum(["mae", "brier", "log_loss", "crps", "interval_score", "opportunity_loss"]);
export const boardValidationPolicySchema = z.object({
  version: z.literal("starter-board-policy-v1"), featureDefinitionHash: hash, candidateRuleHash: hash, refitPolicyHash: hash,
  components: z.array(z.object({ component: name, baselineId: name, primaryTarget: name, primaryMetric: metric,
    protectedMetrics: z.array(z.object({ target: name, metric }).strict()).min(1).max(20),
    probability: z.boolean() }).strict()).min(1).max(20),
}).strict().refine((value) => new Set(value.components.map((row) => row.component)).size === value.components.length,
  "Duplicate policy component");
export const boardReleaseSchema = z.object({ releaseKey: name, codeVersion: z.string().trim().min(1).max(128),
  modelIdentity: z.literal("FORGE"), evaluationVersion: name, policy: boardValidationPolicySchema }).strict();
export const boardReviewSchema = z.object({
  contractVersion: z.literal("starter-board-review-v1"), evaluationVersion: name, policyHash: hash, dataHash: hash, forecastHash: hash,
  asOf: z.string().datetime({ offset: true }), windowStart: date, windowEnd: date,
  evidenceClass: z.enum(["captured_live", "historical_reconstruction"]), gameType: z.enum(["regular_season", "preseason"]),
  settledGames: count, settledSlates: count, settledForecasts: count,
  metrics: z.array(z.object({ target: name, metric, value: finite.nonnegative(), samples: count.positive() }).strict()).max(50),
  comparisons: z.array(z.object({
    component: name, candidateId: name, baselineId: name, games: count, slates: count,
    primaryTarget: name, primaryMetric: metric, baselineLoss: finite.nonnegative(), candidateLoss: finite.nonnegative(),
    improvementLow95: finite, improvementHigh95: finite,
    secondary: z.array(z.object({ target: name, metric, relativeDegradation: finite, lower95: finite, upper95: finite }).strict()).min(1).max(20),
    positiveLabels: count.nullable(), negativeLabels: count.nullable(),
  }).strict()).max(20),
}).strict().superRefine((value, ctx) => {
  if (value.windowStart > value.windowEnd || value.windowEnd > value.asOf.slice(0, 10)) ctx.addIssue({ code: "custom", message: "Invalid evaluation window" });
  if (value.windowStart <= "2026-04-16" && value.windowEnd >= "2026-01-03") ctx.addIssue({ code: "custom", message: "Protected research holdout" });
  if (new Set(value.comparisons.map((row) => row.component)).size !== value.comparisons.length) ctx.addIssue({ code: "custom", message: "Duplicate component comparison" });
  if (value.settledSlates > value.settledGames || value.settledGames > value.settledForecasts) ctx.addIssue({ code: "custom", message: "Inconsistent settled samples" });
  for (const row of value.comparisons) {
    if (row.games > value.settledGames || row.slates > value.settledSlates || row.improvementLow95 > row.improvementHigh95
      || row.secondary.some((entry) => entry.lower95 > entry.upper95)
      || (row.positiveLabels ?? 0) + (row.negativeLabels ?? 0) > value.settledForecasts
      || new Set(row.secondary.map((entry) => `${entry.target}:${entry.metric}`)).size !== row.secondary.length) {
      ctx.addIssue({ code: "custom", message: "Inconsistent comparison evidence" });
    }
  }
  if (value.metrics.some((row) => row.samples > value.settledForecasts || (["brier"].includes(row.metric) && row.value > 1))) {
    ctx.addIssue({ code: "custom", message: "Inconsistent metric samples or range" });
  }
});
export type BoardValidationPolicy = z.infer<typeof boardValidationPolicySchema>;
export type BoardValidationReview = z.infer<typeof boardReviewSchema>;

/** Eligibility is an evidence decision; it never activates a model or intervals. */
export function boardComponentDecisions(report: BoardValidationReview, policy: BoardValidationPolicy) {
  return policy.components.map((component) => {
    const comparison = report.comparisons.find((row) => row.component === component.component);
    const reasons: string[] = [];
    if (report.evidenceClass !== "captured_live" || report.gameType !== "regular_season") reasons.push("prospective_regular_season_evidence_required");
    if (!comparison) reasons.push("comparison_missing");
    else {
      if (comparison.games < 200 || comparison.slates < 30) reasons.push("minimum_prospective_sample_not_met");
      if (comparison.baselineId !== component.baselineId) reasons.push("baseline_differs_from_frozen_policy");
      if (comparison.primaryMetric !== component.primaryMetric || comparison.primaryTarget !== component.primaryTarget) reasons.push("primary_metric_differs_from_frozen_policy");
      if (comparison.baselineLoss <= 0 || (comparison.baselineLoss - comparison.candidateLoss) / comparison.baselineLoss < 0.01) reasons.push("primary_improvement_below_one_percent");
      if (comparison.improvementLow95 <= 0) reasons.push("paired_interval_includes_no_improvement");
      for (const protectedMetric of component.protectedMetrics) {
        const measured = comparison.secondary.find((row) => row.metric === protectedMetric.metric && row.target === protectedMetric.target);
        if (!measured) reasons.push(`protected_metric_missing:${protectedMetric.target}:${protectedMetric.metric}`);
        else if (measured.relativeDegradation > 0.02 && measured.lower95 > 0) reasons.push(`protected_metric_degraded:${protectedMetric.target}:${protectedMetric.metric}`);
      }
      if (component.probability && (!(comparison.positiveLabels! > 0) || !(comparison.negativeLabels! > 0))) reasons.push("both_probability_labels_required");
    }
    return { component: component.component, candidateId: comparison?.candidateId ?? null,
      decision: reasons.length ? "retain_serving_component" as const : "eligible_for_promotion_review" as const, reasons };
  });
}

export type BoardValidationDisclosure = {
  status: "awaiting_prospective_evidence" | "collecting_evidence" | "review_available" | "unavailable";
  servingDecision: "forge_retained_pending_review"; distributionStatus: "means_only_unvalidated";
  release: { id: string; key: string; codeVersion: string; modelIdentity: string; evaluationVersion: string } | null;
  startedOn: string | null; elapsedDays: number | null; liveRegularSlates: number | null;
  evaluatedGames: number | null; evaluatedSlates: number | null; evaluatedForecasts: number | null;
  reviewDays: [14, 30]; milestones: Array<{ day: 14 | 30; dueOn: string | null; status: "awaiting_launch" | "scheduled" | "due" | "published" }>;
  latestReview: { id: string; kind: string; asOf: string; reportHash: string; metrics: BoardValidationReview["metrics"];
    decisions: ReturnType<typeof boardComponentDecisions>; evidenceClass: BoardValidationReview["evidenceClass"]; gameType: BoardValidationReview["gameType"] } | null;
};

export function buildBoardValidationDisclosure(registry: any, today: string, unavailable = false): BoardValidationDisclosure {
  const start = date.safeParse(registry?.startedOn);
  const startedOn = start.success && start.data <= today ? start.data : null;
  const elapsedDays = startedOn ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startedOn}T00:00:00Z`)) / 86_400_000) + 1 : null;
  const rawRelease = registry?.release;
  const release = rawRelease && typeof rawRelease.id === "string" && ["release_key", "code_version", "model_identity", "evaluation_version"].every((key) => typeof rawRelease[key] === "string")
    ? { id: rawRelease.id, key: rawRelease.release_key, codeVersion: rawRelease.code_version, modelIdentity: rawRelease.model_identity, evaluationVersion: rawRelease.evaluation_version } : null;
  const policy = boardValidationPolicySchema.safeParse(rawRelease?.policy);
  const reviews = (Array.isArray(registry?.reviews) && release && policy.success ? registry.reviews : []).flatMap((row: any) => {
    const parsed = boardReviewSchema.safeParse(row.report);
    if (!parsed.success || parsed.data.evaluationVersion !== release!.evaluationVersion || parsed.data.policyHash !== rawRelease.policy_hash
      || typeof row.id !== "string" || typeof row.report_hash !== "string") return [];
    return [{ id: row.id as string, kind: row.kind as string, hash: row.report_hash as string, report: parsed.data }];
  }).sort((a: any, b: any) => Date.parse(b.report.asOf) - Date.parse(a.report.asOf));
  const latest = reviews[0] as { id: string; kind: string; hash: string; report: BoardValidationReview } | undefined;
  const prospective = latest?.report.evidenceClass === "captured_live" && latest?.report.gameType === "regular_season";
  return {
    status: unavailable ? "unavailable" : latest ? "review_available" : startedOn ? "collecting_evidence" : "awaiting_prospective_evidence",
    servingDecision: "forge_retained_pending_review", distributionStatus: "means_only_unvalidated", release, startedOn, elapsedDays,
    liveRegularSlates: count.safeParse(registry?.liveRegularSlates).success ? registry.liveRegularSlates : null,
    evaluatedGames: prospective ? latest!.report.settledGames : null, evaluatedSlates: prospective ? latest!.report.settledSlates : null,
    evaluatedForecasts: prospective ? latest!.report.settledForecasts : null, reviewDays: [14, 30],
    milestones: ([14, 30] as const).map((day) => ({ day,
      dueOn: startedOn ? new Date(Date.parse(`${startedOn}T00:00:00Z`) + (day - 1) * 86_400_000).toISOString().slice(0, 10) : null,
      status: reviews.some((row: any) => row.kind === `day${day}`) ? "published" : elapsedDays == null ? "awaiting_launch" : elapsedDays >= day ? "due" : "scheduled",
    })),
    latestReview: latest && policy.success ? { id: latest.id, kind: latest.kind, asOf: latest.report.asOf, reportHash: latest.hash,
      metrics: latest.report.metrics, decisions: boardComponentDecisions(latest.report, policy.data),
      evidenceClass: latest.report.evidenceClass, gameType: latest.report.gameType } : null,
  };
}

/** Whitelist the public contract again in the browser; never carry registry rows. */
export function normalizeBoardValidationDisclosure(value: unknown): BoardValidationDisclosure | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = z.object({
    status: z.enum(["awaiting_prospective_evidence", "collecting_evidence", "review_available", "unavailable"]),
    servingDecision: z.literal("forge_retained_pending_review"), distributionStatus: z.literal("means_only_unvalidated"),
    release: z.object({ id: z.string(), key: name, codeVersion: z.string(), modelIdentity: name, evaluationVersion: name }).nullable(),
    startedOn: date.nullable(), elapsedDays: count.nullable(), liveRegularSlates: count.nullable(),
    evaluatedGames: count.nullable(), evaluatedSlates: count.nullable(), evaluatedForecasts: count.nullable(),
    reviewDays: z.tuple([z.literal(14), z.literal(30)]),
    milestones: z.array(z.object({ day: z.union([z.literal(14), z.literal(30)]), dueOn: date.nullable(),
      status: z.enum(["awaiting_launch", "scheduled", "due", "published"]) })).max(2),
    latestReview: z.object({ id: z.string(), kind: z.enum(["weekly", "day14", "day30"]), asOf: z.string(), reportHash: hash,
      metrics: boardReviewSchema.innerType().shape.metrics,
      decisions: z.array(z.object({ component: name, candidateId: name.nullable(), decision: z.enum(["retain_serving_component", "eligible_for_promotion_review"]), reasons: z.array(z.string()).max(20) })).max(20),
      evidenceClass: z.enum(["captured_live", "historical_reconstruction"]), gameType: z.enum(["regular_season", "preseason"]),
    }).nullable(),
  }).safeParse(value);
  if (parsed.success) return parsed.data;
  // Earlier v2 consumers only sent the pending status. Never turn a malformed
  // measured claim into a successful review.
  return buildBoardValidationDisclosure(null, new Date().toISOString().slice(0, 10), (value as any).status !== "awaiting_prospective_evidence");
}

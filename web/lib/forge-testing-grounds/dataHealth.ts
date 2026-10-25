import { z } from "zod";
import { timestampMicros } from "../projections/evidenceTime";

export const healthIssueCodes = [
  "missing", "null", "malformed", "duplicate", "stale", "identity",
  "units", "strength", "source_mismatch", "invalid_clock", "missing_revision",
  "historically_unavailable", "availability_unknown", "later_capture",
] as const;
export type HealthIssueCode = typeof healthIssueCodes[number];

const stamp = z.string().datetime({ offset: true }).refine(value => timestampMicros(value) !== null);
const identifier = z.number().int().positive().safe();
const safeLocation = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/);
const rowIdentity = z.object({ playerId: identifier, gameId: identifier }).strict();
const fieldContract = z.object({
  source: safeLocation,
  table: safeLocation,
  field: safeLocation,
  unit: z.enum(["count", "seconds", "minutes", "probability", "ratio"]),
  strength: z.enum(["all", "es", "pp", "pk", "5v5"]),
  minimum: z.number().finite(),
  maximum: z.number().finite().nullable(),
  allowFractional: z.boolean(),
}).strict().superRefine((field, context) => {
  if (field.maximum !== null && field.maximum < field.minimum) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Field bounds are inverted." });
  }
});

/** Caller supplies a reviewed, immutable field/policy definition; no guessed defaults. */
export const healthCheckSpecification = z.object({
  reportId: z.string().uuid(),
  inputManifestId: z.string().uuid(),
  policyHash: z.string().regex(/^[a-f0-9]{64}$/),
  cohortId: z.string().uuid(),
  checkedAt: stamp,
  predictionCutoff: stamp,
  maxAgeMs: z.number().int().nonnegative().safe(),
  requireAuthenticHistory: z.boolean(),
  blockingCodes: z.array(z.enum(healthIssueCodes)),
  field: fieldContract,
  supersedes: z.object({ reportId: z.string().uuid(), inputManifestId: z.string().uuid() }).strict().nullable(),
}).strict().superRefine((spec, context) => {
  if (timestampMicros(spec.checkedAt)! < timestampMicros(spec.predictionCutoff)!) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Health inspection cannot precede the prediction cutoff." });
  }
  if (spec.supersedes && (spec.supersedes.reportId === spec.reportId || spec.supersedes.inputManifestId === spec.inputManifestId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A recheck needs a distinct report and input manifest identity." });
  }
});

export type HealthCheckSpecification = z.infer<typeof healthCheckSpecification>;

// Deliberately accept unknown source values. Never include them in a result or
// validation error. Only a trusted adapter may select input (never outcome) rows.
export type InputHealthRow = {
  identity?: unknown;
  source?: unknown;
  table?: unknown;
  field?: unknown;
  unit?: unknown;
  strength?: unknown;
  value?: unknown;
  observedAt?: unknown;
  availableAt?: unknown;
  capturedAt?: unknown;
  revisionId?: unknown;
};

export type InputHealthIssue = {
  code: HealthIssueCode;
  severity: "blocker" | "warning";
  affectedRows: number;
  samples: Array<{
    rowIndex: number;
    identity: z.infer<typeof rowIdentity> | null;
    observedShape: string;
  }>;
  omittedSamples: number;
  expected: string;
  guidance: string;
};

const descriptions: Record<HealthIssueCode, [string, string]> = {
  missing: ["The declared field is present.", "Inspect the source field; absence is not an observed zero."],
  null: ["An observed numeric value is available.", "Resolve the unknown value deliberately; do not fill it with zero."],
  malformed: ["A finite numeric value matches the declared range and fraction policy.", "Check source parsing and the declared field contract."],
  duplicate: ["One row per player-game for this field and strength.", "Inspect all duplicate identities; do not silently keep one."],
  stale: ["Observation age is within the declared maximum at prediction cutoff.", "Inspect freshness against this run's cutoff; later data is not an automatic replacement."],
  identity: ["Positive integer player and game IDs.", "Verify identity joins manually; malformed IDs are withheld from this report."],
  units: ["The declared field unit.", "Check units and any versioned transformation; do not guess a conversion."],
  strength: ["The declared strength state.", "Check the source strength-state selection and join."],
  source_mismatch: ["The declared source, table and field.", "Verify the adapter's source/table/field mapping."],
  invalid_clock: ["Valid ordered observation, availability and capture timestamps.", "Inspect original clock evidence. Do not backdate knowledge."],
  missing_revision: ["An explicit source revision identity.", "Retain the original source revision before claiming reproducibility."],
  historically_unavailable: ["Observation and known availability do not follow prediction cutoff.", "This input cannot enter this prediction. Select permitted evidence in a new manifest."],
  availability_unknown: ["Evidence of when the source became available.", "Label reconstructed-history diagnostics; do not claim authentic historical knowledge."],
  later_capture: ["Capture at or before prediction cutoff for an original historical snapshot.", "Keep the later capture labeled reconstructed history; never backdate it."],
};

function safeShape(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? "finite number" : "non-finite number";
  return Array.isArray(value) ? "array" : typeof value;
}

function readTime(value: unknown): bigint | null {
  return typeof value === "string" && stamp.safeParse(value).success ? timestampMicros(value) : null;
}

/**
 * Numeric input-field diagnostics only. No fetch, repair, row exclusion or outcome
 * inspection. The caller must keep outcome-bearing rows sealed and must authorize
 * access to this report; safe shapes cannot make outcome-derived counts safe.
 */
export function checkInputFieldHealth(specification: unknown, rows: readonly InputHealthRow[]) {
  const spec = healthCheckSpecification.parse(specification);
  if (!Array.isArray(rows)) throw new Error("Input rows must be an array.");
  const cutoff = timestampMicros(spec.predictionCutoff)!;
  const checkedAt = timestampMicros(spec.checkedAt)!;
  const issues = new Map<HealthIssueCode, InputHealthIssue>();
  const affected = new Set<number>();
  const identities = rows.map(row => rowIdentity.safeParse(row?.identity));
  const occurrences = new Map<string, number>();
  for (const parsed of identities) if (parsed.success) {
    const key = `${parsed.data.playerId}:${parsed.data.gameId}`;
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  let validNumericRows = 0, validZeroRows = 0, missingRows = 0, nullRows = 0;
  let reconstructed = false;
  const add = (code: HealthIssueCode, index: number, shape: string) => {
    affected.add(index);
    const authenticityIssue = ["availability_unknown", "later_capture", "missing_revision", "invalid_clock"].includes(code);
    if (authenticityIssue) reconstructed = true;
    const blocker = code === "historically_unavailable" || code === "invalid_clock"
      || spec.requireAuthenticHistory && authenticityIssue || spec.blockingCodes.includes(code);
    const issue = issues.get(code) ?? {
      code, severity: blocker ? "blocker" : "warning", affectedRows: 0, samples: [], omittedSamples: 0,
      expected: descriptions[code][0], guidance: descriptions[code][1],
    } satisfies InputHealthIssue;
    issue.affectedRows++;
    const identity = identities[index];
    if (issue.samples.length < 10) issue.samples.push({ rowIndex: index, identity: identity.success ? identity.data : null, observedShape: shape });
    else issue.omittedSamples++;
    issues.set(code, issue);
  };
  rows.forEach((input, index) => {
    const row = input ?? {};
    const identity = identities[index];
    if (!identity.success) add("identity", index, "invalid identity (withheld)");
    else if (occurrences.get(`${identity.data.playerId}:${identity.data.gameId}`)! > 1) add("duplicate", index, "duplicate player-game identity");
    if (row.source !== spec.field.source || row.table !== spec.field.table || row.field !== spec.field.field) add("source_mismatch", index, "source location differs (withheld)");
    if (row.unit !== spec.field.unit) add("units", index, "unit differs (withheld)");
    if (row.strength !== spec.field.strength) add("strength", index, "strength differs (withheld)");
    if (row.value === undefined) { missingRows++; add("missing", index, "missing"); }
    else if (row.value === null) { nullRows++; add("null", index, "null"); }
    else if (typeof row.value !== "number" || !Number.isFinite(row.value)
      || row.value < spec.field.minimum || spec.field.maximum !== null && row.value > spec.field.maximum
      || !spec.field.allowFractional && !Number.isSafeInteger(row.value)) add("malformed", index, safeShape(row.value));
    else { validNumericRows++; if (row.value === 0) validZeroRows++; }
    const observed = readTime(row.observedAt), available = readTime(row.availableAt), captured = readTime(row.capturedAt);
    const availabilityUnknown = row.availableAt === null || row.availableAt === undefined;
    if (observed === null || captured === null || !availabilityUnknown && available === null
      || captured !== null && captured > checkedAt
      || observed !== null && captured !== null && observed > captured
      || available !== null && captured !== null && available > captured
      || observed !== null && available !== null && observed > available) add("invalid_clock", index, "invalid or inconsistent source timestamps");
    if (availabilityUnknown) add("availability_unknown", index, "availability unknown");
    if (observed !== null && observed > cutoff || available !== null && available > cutoff) add("historically_unavailable", index, "source knowledge follows cutoff");
    if (captured !== null && captured > cutoff) add("later_capture", index, "capture follows cutoff");
    if (observed !== null && cutoff - observed > BigInt(spec.maxAgeMs) * BigInt(1000)) add("stale", index, "observation exceeds declared age");
    if (typeof row.revisionId !== "string" || !row.revisionId.trim() || row.revisionId.length > 256) add("missing_revision", index, "revision unavailable");
  });
  const orderedIssues = healthIssueCodes.flatMap(code => issues.has(code) ? [issues.get(code)!] : []);
  return {
    version: "forge-testing-grounds-input-health-v1" as const,
    specification: spec,
    status: orderedIssues.some(issue => issue.severity === "blocker") ? "blocked" as const : "checked" as const,
    historyClassification: reconstructed ? "reconstructed_history_diagnostic" as const : "original_snapshot_clocks_present" as const,
    authenticityLimitation: "Clock presence is not independent proof of source authenticity, completeness or revision lineage.",
    counts: { inputRows: rows.length, validNumericRows, validZeroRows, missingRows, nullRows,
      affectedRows: affected.size, unaffectedRows: rows.length - affected.size, automaticallyExcludedRows: 0 },
    issues: orderedIssues,
    investigation: { href: "/db/runner" as const, action: "navigate_only" as const,
      guidance: "Inspect these safe IDs and the declared source manually. Opening the runner does not authorize a repair. Recheck repaired inputs using a new manifest and report." },
  };
}

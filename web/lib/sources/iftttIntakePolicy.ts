import { timestampMicros } from "lib/projections/evidenceTime";

export type IftttIntakeScope = {
  table: "line_source_ifttt_events" | "lines_ccc_ifttt_events";
  sourceGroup: string;
  sourceKey: string;
  sourceAccount: string;
};
export type IftttIntakePolicy = {
  version: "ifttt-intake-v1";
  id: string;
  startsAt: string;
  endsAt: string;
  maxAttempts: number;
  maxReceipts: number;
  scopes: IftttIntakeScope[];
};

const keysMatch = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join(",") === keys.sort().join(",");
const token = (value: unknown) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);

/** Exact discovery-route scope; this does not verify the post's original author. */
export function normalizeIftttIntakeScope(scope: IftttIntakeScope): IftttIntakeScope {
  return { table: scope.table, sourceGroup: scope.sourceGroup, sourceKey: scope.sourceKey,
    sourceAccount: scope.sourceAccount.replace(/^@/, "").toLowerCase() };
}

export function parseIftttIntakePolicy(input: unknown): IftttIntakePolicy {
  const p = input as IftttIntakePolicy;
  if (!p || typeof p !== "object" || Array.isArray(p)
    || !keysMatch(p, ["version", "id", "startsAt", "endsAt", "maxAttempts", "maxReceipts", "scopes"])
    || p.version !== "ifttt-intake-v1" || !token(p.id)
    || typeof p.startsAt !== "string" || typeof p.endsAt !== "string"
    || timestampMicros(p.startsAt) === null || timestampMicros(p.endsAt) === null
    || timestampMicros(p.startsAt)! >= timestampMicros(p.endsAt)!
    || !Number.isSafeInteger(p.maxAttempts) || p.maxAttempts < 1
    || !Number.isSafeInteger(p.maxReceipts) || p.maxReceipts < 1
    || !Array.isArray(p.scopes) || p.scopes.length === 0) {
    throw new Error("An explicit bounded IFTTT intake policy is required");
  }
  const scopes = p.scopes.map((scope) => {
    if (!scope || typeof scope !== "object" || Array.isArray(scope)
      || !keysMatch(scope, ["table", "sourceGroup", "sourceKey", "sourceAccount"])
      || !["line_source_ifttt_events", "lines_ccc_ifttt_events"].includes(scope.table)
      || !token(scope.sourceGroup) || !token(scope.sourceKey)
      || typeof scope.sourceAccount !== "string" || !/^@?[a-zA-Z0-9_]{1,15}$/.test(scope.sourceAccount)) {
      throw new Error("IFTTT intake scopes must name exact receiver routes");
    }
    return normalizeIftttIntakeScope(scope);
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (new Set(scopes.map((s) => JSON.stringify(s))).size !== scopes.length) throw new Error("Duplicate IFTTT intake scope");
  const result = { ...p, scopes };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 8192) throw new Error("IFTTT intake policy exceeds configuration bound");
  return result;
}

/** Any pilot flag, policy or stop is present; only a fully absent/off pilot keeps legacy behavior. */
export function iftttIntakePilotConfigured() {
  const flag = process.env.IFTTT_RECEIPT_VARIANTS_ENABLED;
  const stop = process.env.IFTTT_INTAKE_STOP;
  return !((flag === undefined || flag === "false") && process.env.IFTTT_INTAKE_POLICY === undefined
    && (stop === undefined || stop === "false"));
}

/** Presence of pilot configuration keeps a disabled/misconfigured pilot closed. */
export function iftttIntakeConfiguration(scope: IftttIntakeScope):
  { controlled: false } | { controlled: true; policy: IftttIntakePolicy; scope: IftttIntakeScope } {
  const flag = process.env.IFTTT_RECEIPT_VARIANTS_ENABLED;
  const raw = process.env.IFTTT_INTAKE_POLICY;
  const stop = process.env.IFTTT_INTAKE_STOP;
  if (!iftttIntakePilotConfigured()) return { controlled: false };
  if (flag !== "true" || stop !== undefined && stop !== "false"
    || raw === undefined || process.env.TWEET_CLAIMS_MODE !== "shadow"
    || process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED !== "true") {
    throw new Error("IFTTT controlled intake is stopped or incompletely configured");
  }
  const policy = parseIftttIntakePolicy(JSON.parse(raw));
  const normalized = normalizeIftttIntakeScope(scope);
  if (!policy.scopes.some((s) => s.table === normalized.table && s.sourceGroup === normalized.sourceGroup
    && s.sourceKey === normalized.sourceKey && s.sourceAccount === normalized.sourceAccount)) {
    throw new Error("Receiver is outside the IFTTT intake policy");
  }
  return { controlled: true, policy, scope: normalized };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContributionAllowedUses, ContributionSource } from "./contributions";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

const PROVIDER = "fhfh";
const DATASET = "contribution-bundle-v1";
const POLICY_DATASET = "baseline-evaluation-policy-v1";
const REVIEW_DATASET = "baseline-validation-review-v1";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export type ContributionEvaluationPolicy = {
  version: "baseline-evaluation-policy-v1";
  seasonId: number;
  policyVersion: string;
  candidateInputHash: string;
  status: "owner_approved";
  allowedPublicUses: Array<keyof ContributionAllowedUses>;
  prospectiveEvidenceRef: string;
  ownerApprovalRef: string;
  approvedAt: string;
};

export type ContributionValidationReview = {
  version: "baseline-validation-review-v1";
  seasonId: number;
  policyVersion: string;
  candidateInputHash: string;
  policyHash: string;
  bundleChecksum: string;
  status: "owner_approved";
  eligible: true;
  prospectiveEvidenceRef: string;
  ownerApprovalRef: string;
  reviewedAt: string;
};

export type ContributionBundleManifest = {
  seasonId: number;
  policyVersion: string;
  inputCutoff: string;
  issuedAt: string;
  expiresAt: string;
  sourceCount: number;
  sourceWatermarks: string[];
  rosterRevisions: string[];
  evaluationPolicyId: string | null;
  reviewId: string | null;
  released: boolean;
  checksum: string;
};

type BundlePayload = { manifest: ContributionBundleManifest; sources: ContributionSource[] };
type ManifestWithoutChecksum = Omit<ContributionBundleManifest, "checksum">;

export function contributionBundleChecksum(args: {
  manifest: ManifestWithoutChecksum;
  sources: ContributionSource[];
}): string {
  return playerForecastSourcePayloadHash(args);
}

/** Stable candidate identity excludes release-state and receipt IDs. */
export function contributionBundleCandidateInputHash(args: {
  manifest: ContributionBundleManifest;
  sources: ContributionSource[];
}): string {
  return playerForecastSourcePayloadHash({
    seasonId: args.manifest.seasonId,
    policyVersion: args.manifest.policyVersion,
    inputCutoff: args.manifest.inputCutoff,
    sourceWatermarks: args.manifest.sourceWatermarks,
    rosterRevisions: args.manifest.rosterRevisions,
    rates: args.sources.map((source) => ({
      sourceId: source.sourceId, playerId: source.playerId, nhlPlayerId: source.nhlPlayerId,
      teamId: source.teamId, targetKey: source.targetKey, unit: source.unit, basis: source.basis,
      mean: source.mean, cutoffAt: source.cutoffAt, sourceWatermark: source.sourceWatermark,
      scheduleRevision: source.scheduleRevision, rosterRevision: source.rosterRevision,
    })).sort((a, b) => a.playerId - b.playerId || a.targetKey.localeCompare(b.targetKey)),
  });
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function equalStrings(left: unknown, right: string[]): boolean {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function validBundle(payload: unknown): payload is BundlePayload {
  if (!payload || typeof payload !== "object") return false;
  if (Object.keys(payload).some((key) => key !== "manifest" && key !== "sources")) return false;
  const { manifest, sources } = payload as BundlePayload;
  const manifestKeys = new Set(["seasonId", "policyVersion", "inputCutoff", "issuedAt", "expiresAt",
    "sourceCount", "sourceWatermarks", "rosterRevisions", "evaluationPolicyId", "reviewId", "released", "checksum"]);
  const sourceKeys = new Set(["kind", "sourceId", "policyVersion", "released", "playerId", "nhlPlayerId",
    "seasonId", "teamId", "targetKey", "unit", "basis", "mean", "participationIntegrated", "cutoffAt",
    "issuedAt", "expiresAt", "sourceWatermark", "scheduleRevision", "rosterRevision", "limitations"]);
  if (!manifest || !Array.isArray(sources) || sources.length === 0 ||
      Object.keys(manifest).some((key) => !manifestKeys.has(key)) ||
      !Number.isSafeInteger(manifest.seasonId) || manifest.seasonId <= 0 ||
      !nonempty(manifest.policyVersion) || !validTimestamp(manifest.inputCutoff) ||
      !validTimestamp(manifest.issuedAt) || !validTimestamp(manifest.expiresAt) ||
      Date.parse(manifest.inputCutoff) > Date.parse(manifest.issuedAt) ||
      Date.parse(manifest.issuedAt) >= Date.parse(manifest.expiresAt) ||
      !Number.isSafeInteger(manifest.sourceCount) || manifest.sourceCount !== sources.length ||
      typeof manifest.released !== "boolean" ||
      !(manifest.evaluationPolicyId === null || nonempty(manifest.evaluationPolicyId)) ||
      !(manifest.reviewId === null || nonempty(manifest.reviewId)) ||
      (manifest.released && (!UUID.test(manifest.evaluationPolicyId ?? "") ||
        !UUID.test(manifest.reviewId ?? "")))) return false;
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source || Object.keys(source).some((key) => !sourceKeys.has(key)) ||
        source.kind !== "baseline" || source.gameId != null ||
        !nonempty(source.sourceId) || !nonempty(source.policyVersion) ||
        source.policyVersion !== manifest.policyVersion ||
        source.released !== manifest.released ||
        !Number.isSafeInteger(source.playerId) || source.playerId <= 0 ||
        !Number.isSafeInteger(source.nhlPlayerId) || source.nhlPlayerId <= 0 ||
        !Number.isSafeInteger(source.teamId) || source.teamId <= 0 ||
        source.seasonId !== manifest.seasonId || !nonempty(source.targetKey) ||
        !["count", "minutes"].includes(source.unit) ||
        !["per_appearance", "per_start"].includes(source.basis) ||
        !Number.isFinite(source.mean) || (source.mean < 0 && source.targetKey !== "PLUS_MINUS") ||
        source.participationIntegrated !== false || source.legacyAvailabilityAdjustment === true ||
        !validTimestamp(source.cutoffAt) || !validTimestamp(source.issuedAt) ||
        !validTimestamp(source.expiresAt) ||
        Date.parse(source.cutoffAt) > Date.parse(manifest.inputCutoff) ||
        Date.parse(source.issuedAt) !== Date.parse(manifest.issuedAt) ||
        Date.parse(source.expiresAt) !== Date.parse(manifest.expiresAt) ||
        !nonempty(source.sourceWatermark) || !nonempty(source.scheduleRevision) ||
        !nonempty(source.rosterRevision) ||
        (source.limitations != null && (!Array.isArray(source.limitations) ||
          !source.limitations.every(nonempty)))) return false;
    const key = `${source.playerId}:${source.targetKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  if (!equalStrings(manifest.sourceWatermarks, sortedUnique(sources.map((source) => source.sourceWatermark))) ||
      !equalStrings(manifest.rosterRevisions, sortedUnique(sources.map((source) => source.rosterRevision)))) return false;
  const { checksum, ...withoutChecksum } = manifest;
  return typeof checksum === "string" && /^[a-f0-9]{64}$/.test(checksum) &&
    checksum === contributionBundleChecksum({ manifest: withoutChecksum, sources });
}

type ReceiptRow = {
  id: string;
  provider: string;
  dataset_key: string;
  entity_kind: string;
  entity_key: string;
  available_at: string;
  payload_hash: string;
  payload: unknown;
};

function validReceiptRow(row: ReceiptRow | undefined, id: string, dataset: string,
  kind: string, seasonId: number, now: Date): row is ReceiptRow {
  return !!row && row.id === id && row.provider === PROVIDER && row.dataset_key === dataset &&
    row.entity_kind === kind && row.entity_key === String(seasonId) &&
    /^[a-f0-9]{64}$/.test(row.payload_hash) &&
    row.payload_hash === playerForecastSourcePayloadHash(row.payload) &&
    validTimestamp(row.available_at) && Date.parse(row.available_at) <= now.getTime();
}

function validPolicy(value: unknown, row: ReceiptRow, bundle: BundlePayload, candidateInputHash: string): value is ContributionEvaluationPolicy {
  if (!value || typeof value !== "object") return false;
  const policy = value as ContributionEvaluationPolicy;
  const keys = new Set(["version", "seasonId", "policyVersion", "candidateInputHash", "status",
    "allowedPublicUses", "prospectiveEvidenceRef", "ownerApprovalRef", "approvedAt"]);
  const validUses: ContributionEvaluationPolicy["allowedPublicUses"] = ["assignment", "totals", "comparison", "conditionalTieBreak"];
  return Object.keys(policy).every((key) => keys.has(key)) &&
    policy.version === POLICY_DATASET && policy.seasonId === bundle.manifest.seasonId &&
    policy.policyVersion === bundle.manifest.policyVersion &&
    policy.candidateInputHash === candidateInputHash && policy.status === "owner_approved" &&
    Array.isArray(policy.allowedPublicUses) &&
    policy.allowedPublicUses.length > 0 &&
    new Set(policy.allowedPublicUses).size === policy.allowedPublicUses.length &&
    policy.allowedPublicUses.every((use) => validUses.includes(use)) &&
    nonempty(policy.prospectiveEvidenceRef) && nonempty(policy.ownerApprovalRef) &&
    validTimestamp(policy.approvedAt) && Date.parse(policy.approvedAt) === Date.parse(row.available_at) &&
    Date.parse(policy.approvedAt) <= Date.parse(bundle.manifest.issuedAt);
}

function validReview(value: unknown, row: ReceiptRow, bundle: BundlePayload,
  candidateInputHash: string, policyHash: string): value is ContributionValidationReview {
  if (!value || typeof value !== "object") return false;
  const review = value as ContributionValidationReview;
  const keys = new Set(["version", "seasonId", "policyVersion", "candidateInputHash", "policyHash",
    "bundleChecksum", "status", "eligible", "prospectiveEvidenceRef", "ownerApprovalRef", "reviewedAt"]);
  return Object.keys(review).every((key) => keys.has(key)) &&
    review.version === REVIEW_DATASET && review.seasonId === bundle.manifest.seasonId &&
    review.policyVersion === bundle.manifest.policyVersion && review.candidateInputHash === candidateInputHash &&
    review.policyHash === policyHash && review.bundleChecksum === bundle.manifest.checksum &&
    review.status === "owner_approved" && review.eligible === true &&
    nonempty(review.prospectiveEvidenceRef) && nonempty(review.ownerApprovalRef) &&
    validTimestamp(review.reviewedAt) && Date.parse(review.reviewedAt) === Date.parse(row.available_at) &&
    Date.parse(review.reviewedAt) >= Date.parse(bundle.manifest.issuedAt);
}

function publicSource(source: ContributionSource, approved: ReadonlySet<keyof ContributionAllowedUses>): ContributionSource {
  return {
    kind: source.kind, sourceId: source.sourceId, policyVersion: source.policyVersion,
    released: source.released, playerId: source.playerId, nhlPlayerId: source.nhlPlayerId,
    allowedUses: { assignment: approved.has("assignment"), totals: approved.has("totals"),
      comparison: approved.has("comparison"), conditionalTieBreak: approved.has("conditionalTieBreak") },
    seasonId: source.seasonId, teamId: source.teamId, targetKey: source.targetKey,
    unit: source.unit, basis: source.basis, mean: source.mean,
    participationIntegrated: source.participationIntegrated, cutoffAt: source.cutoffAt,
    issuedAt: source.issuedAt, expiresAt: source.expiresAt,
    sourceWatermark: source.sourceWatermark, scheduleRevision: source.scheduleRevision,
    rosterRevision: source.rosterRevision,
    limitations: [...(source.limitations ?? [])],
  };
}

/** Persist an immutable global rate snapshot; dry-run is the default. */
export async function persistContributionBundle(db: SupabaseClient<any>, args: {
  manifest: ContributionBundleManifest;
  sources: ContributionSource[];
  dryRun?: boolean;
}): Promise<{ dryRun: boolean; payloadHash: string; snapshotId: string | null }> {
  const payload = { manifest: args.manifest, sources: args.sources };
  if (!validBundle(payload)) throw new Error("Invalid or incomplete contribution bundle.");
  const payloadHash = playerForecastSourcePayloadHash(payload);
  if (args.dryRun ?? true) return { dryRun: true, payloadHash, snapshotId: null };
  const { data, error } = await db.from("player_forecast_source_observations").insert({
    provider: PROVIDER,
    dataset_key: DATASET,
    entity_kind: "seasonal_rate_bundle",
    entity_key: String(args.manifest.seasonId),
    source_revision_key: args.manifest.checksum,
    observed_at: args.manifest.inputCutoff,
    available_at: args.manifest.issuedAt,
    payload_hash: payloadHash,
    payload,
    metadata: { policyVersion: args.manifest.policyVersion, released: args.manifest.released },
  }).select("id").single();
  if (error?.code === "23505") {
    const existing = await db.from("player_forecast_source_observations").select("id")
      .eq("provider", PROVIDER).eq("dataset_key", DATASET)
      .eq("entity_kind", "seasonal_rate_bundle").eq("entity_key", String(args.manifest.seasonId))
      .eq("payload_hash", payloadHash).maybeSingle();
    if (existing.error || !existing.data) throw existing.error ?? error;
    return { dryRun: false, payloadHash, snapshotId: existing.data.id };
  }
  if (error) throw error;
  return { dryRun: false, payloadHash, snapshotId: data.id };
}

/** Only explicitly allowlisted, approved snapshots can supply public baseline rates. */
export async function loadApprovedContributionBundle(
  db: SupabaseClient<any>,
  seasonId: number,
  now: Date,
  options?: { environment?: Record<string, string | undefined>; signal?: AbortSignal },
): Promise<{ sources: ContributionSource[]; manifests: ContributionBundleManifest[]; checksum: string | null; limitations: string[] }> {
  const empty = (reason: string) => ({ sources: [] as ContributionSource[], manifests: [], checksum: null, limitations: [reason] });
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0 || !Number.isFinite(now.getTime())) return empty("invalid_request");
  const ids = sortedUnique((options?.environment ?? process.env).PLAYER_FORECAST_BASELINE_RELEASE_IDS
    ?.split(",").map((id) => id.trim()).filter(Boolean) ?? []);
  if (ids.length === 0) return empty("baseline_serving_disabled");
  if (ids.some((id) => !UUID.test(id))) return empty("invalid_release_allowlist");
  let bundleQuery = db.from("player_forecast_source_observations")
    .select("id,provider,dataset_key,entity_kind,entity_key,available_at,payload_hash,payload")
    .in("id", ids).eq("provider", PROVIDER).eq("dataset_key", DATASET)
    .eq("entity_kind", "seasonal_rate_bundle").eq("entity_key", String(seasonId));
  if (options?.signal) bundleQuery = bundleQuery.abortSignal(options.signal);
  const { data, error } = await bundleQuery;
  if (error) return empty("bundle_query_failed");
  if ((data ?? []).length !== ids.length) return empty("release_snapshot_missing");
  const accepted: BundlePayload[] = [];
  for (const row of data ?? []) {
    const payload = row.payload;
    if (!ids.includes(row.id) || row.provider !== PROVIDER || row.dataset_key !== DATASET ||
        row.entity_kind !== "seasonal_rate_bundle" || row.entity_key !== String(seasonId) ||
        !validBundle(payload) || !payload.manifest.released ||
        row.payload_hash !== playerForecastSourcePayloadHash(payload) ||
        Date.parse(row.available_at) !== Date.parse(payload.manifest.issuedAt) ||
        Date.parse(payload.manifest.issuedAt) > now.getTime() ||
        Date.parse(payload.manifest.expiresAt) <= now.getTime()) return empty("release_snapshot_invalid_or_stale");
    accepted.push(payload);
  }
  const receiptIds = sortedUnique(accepted.flatMap((bundle) => [
    bundle.manifest.evaluationPolicyId!, bundle.manifest.reviewId!,
  ]));
  let receiptQuery = db.from("player_forecast_source_observations")
    .select("id,provider,dataset_key,entity_kind,entity_key,available_at,payload_hash,payload")
    .in("id", receiptIds).eq("provider", PROVIDER);
  if (options?.signal) receiptQuery = receiptQuery.abortSignal(options.signal);
  const { data: receiptData, error: receiptError } = await receiptQuery;
  if (receiptError || (receiptData ?? []).length !== receiptIds.length) return empty("baseline_review_unverified");
  const receipts = new Map<string, ReceiptRow>((receiptData ?? []).map((row: ReceiptRow) => [row.id, row]));
  const approvedUses = new Map<string, ReadonlySet<keyof ContributionAllowedUses>>();
  for (const bundle of accepted) {
    const policyId = bundle.manifest.evaluationPolicyId!;
    const reviewId = bundle.manifest.reviewId!;
    const policyRow = receipts.get(policyId);
    const reviewRow = receipts.get(reviewId);
    const candidateInputHash = contributionBundleCandidateInputHash(bundle);
    if (!validReceiptRow(policyRow, policyId, POLICY_DATASET, "baseline_evaluation_policy", seasonId, now) ||
        !validPolicy(policyRow.payload, policyRow, bundle, candidateInputHash) ||
        !validReceiptRow(reviewRow, reviewId, REVIEW_DATASET, "baseline_validation_review", seasonId, now) ||
        !validReview(reviewRow.payload, reviewRow, bundle, candidateInputHash, policyRow.payload_hash) ||
        Date.parse(reviewRow.available_at) < Date.parse(policyRow.available_at)) return empty("baseline_review_unverified");
    approvedUses.set(bundle.manifest.checksum, new Set(policyRow.payload.allowedPublicUses));
  }
  accepted.sort((a, b) => b.manifest.issuedAt.localeCompare(a.manifest.issuedAt)
    || a.manifest.checksum.localeCompare(b.manifest.checksum));
  // Each policy publishes a complete bundle. Never fill holes from an older revision.
  const selected = new Map<string, BundlePayload>();
  for (const bundle of accepted) {
    if (!selected.has(bundle.manifest.policyVersion)) selected.set(bundle.manifest.policyVersion, bundle);
  }
  if (!selected.size) return empty("release_snapshot_missing");
  const bundles = [...selected.values()].sort((a, b) => a.manifest.policyVersion.localeCompare(b.manifest.policyVersion));
  const sources = bundles.flatMap((bundle) => bundle.sources.map((source) =>
    publicSource(source, approvedUses.get(bundle.manifest.checksum)!))).sort((a, b) =>
    a.playerId - b.playerId || a.targetKey.localeCompare(b.targetKey));
  const keys = sources.map((source) => `${source.playerId}:${source.targetKey}`);
  if (new Set(keys).size !== keys.length) return empty("conflicting_release_policies");
  const manifests = bundles.map(({ manifest }) => ({ ...manifest,
    sourceWatermarks: [...manifest.sourceWatermarks], rosterRevisions: [...manifest.rosterRevisions] }));
  return {
    sources,
    manifests,
    checksum: manifests.length === 1 ? manifests[0].checksum
      : playerForecastSourcePayloadHash(manifests.map((manifest) => manifest.checksum)),
    limitations: ["baseline_rate_candidate_unvalidated_for_public_quality_claims"],
  };
}

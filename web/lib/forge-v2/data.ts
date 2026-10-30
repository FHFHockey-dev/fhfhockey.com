import type { SourceReference } from "./contracts";
import { contentHash } from "./hash.server";

export interface SourceRecord<T> {
  identity: { playerId: number; gameId: number; seasonId: number; teamId: number; mappingRevision: string; verified: boolean };
  source: SourceReference;
  /** The source hash binds this canonical payload, not differently serialized original bytes. */
  payload: T;
}
export interface SourceBatch<T> {
  complete: boolean;
  expectedCount: number;
  pages: Array<{ index: number; records: SourceRecord<T>[] }>;
}
export interface SourcePolicy {
  cutoffAt: string;
  maximumAgeMs: number;
  maximumRecords: number;
  maximumPages: number;
  approvals: Array<{ source: string; evidenceId: string; approvedAt: string; intendedUse: string }>;
  intendedUse: string;
}
export type SourceBatchResult<T> =
  | { state: "available"; records: SourceRecord<T>[]; manifestHash: string; approvalEvidenceIds: string[] }
  | { state: "unavailable"; reasons: string[] };

/** Require an explicit UTC instant; local wall-clock strings are not provenance. */
export function sourceInstant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value.slice(0, 10) ? parsed : NaN;
}
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const positiveId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;

/** Supplied evidence only. Approval authenticity remains the owner's responsibility. */
export function normalizeSourceBatch<T>(batch: SourceBatch<T>, policy: SourcePolicy,
  validatePayload: (payload: T) => boolean): SourceBatchResult<T> {
  const reject = (...reasons: string[]): SourceBatchResult<T> => ({ state: "unavailable", reasons });
  const cutoff = sourceInstant(policy?.cutoffAt);
  if (!Number.isFinite(cutoff) || !Number.isFinite(policy.maximumAgeMs) || policy.maximumAgeMs < 0
    || !Number.isSafeInteger(policy.maximumRecords) || policy.maximumRecords < 1 || policy.maximumRecords > 100000
    || !Number.isSafeInteger(policy.maximumPages) || policy.maximumPages < 1 || policy.maximumPages > 1000
    || !text(policy.intendedUse) || !Array.isArray(policy.approvals) || policy.approvals.length > 1000) return reject("invalid_source_policy");
  if (!batch || batch.complete !== true || !Number.isSafeInteger(batch.expectedCount) || batch.expectedCount < 0
    || batch.expectedCount > policy.maximumRecords || !Array.isArray(batch.pages) || !batch.pages.length
    || batch.pages.length > policy.maximumPages) return reject("incomplete_or_unbounded_batch");
  const records: SourceRecord<T>[] = [];
  for (const [index, page] of batch.pages.entries()) {
    if (page.index !== index || !Array.isArray(page.records) || records.length + page.records.length > policy.maximumRecords
      || page.records.length === 0 && (batch.expectedCount !== 0 || batch.pages.length !== 1)) return reject("incomplete_pagination");
    records.push(...page.records);
  }
  if (records.length !== batch.expectedCount) return reject("incomplete_pagination");
  const revisions = new Set<string>(), selected = new Map<string, SourceRecord<T>>(), approvalIds = new Set<string>();
  for (const record of records) {
    const identity = record?.identity, source = record?.source;
    if (!identity || ![identity.playerId, identity.gameId, identity.seasonId, identity.teamId].every(positiveId)
      || identity.verified !== true || !text(identity.mappingRevision)) return reject("unverified_canonical_identity");
    if (!source || ![source.id, source.revision, source.source].every(text) || !/^[a-f0-9]{64}$/.test(source.sha256)) return reject("missing_source_lineage");
    const observed = sourceInstant(source.observedAt), received = sourceInstant(source.firstReceivedAt);
    const published = source.publishedAt === null ? null : sourceInstant(source.publishedAt);
    if (![observed, received].every(Number.isFinite) || published !== null && !Number.isFinite(published)
      || observed > received || published !== null && published > received || received > cutoff) return reject("invalid_or_future_source_clock");
    if (cutoff - received > policy.maximumAgeMs || cutoff - observed > policy.maximumAgeMs) return reject("stale_source");
    const approval = policy.approvals.find(row => row.source === source.source && row.intendedUse === policy.intendedUse
      && text(row.evidenceId) && Number.isFinite(sourceInstant(row.approvedAt)) && sourceInstant(row.approvedAt) <= cutoff);
    if (source.use !== "approved" || !approval) return reject("intended_use_not_approved");
    approvalIds.add(approval.evidenceId);
    try {
      if (contentHash(record.payload) !== source.sha256) return reject("source_content_hash_mismatch");
      if (!validatePayload(record.payload)) return reject("invalid_or_missing_payload_fields");
    } catch { return reject("invalid_or_missing_payload_fields"); }
    const key = `${identity.playerId}:${identity.gameId}:${identity.seasonId}:${identity.teamId}:${source.source}:${source.id}`;
    const revision = `${key}:${source.revision}`;
    if (revisions.has(revision)) return reject("duplicate_or_conflicting_revision");
    revisions.add(revision);
    const previous = selected.get(key);
    if (previous && sourceInstant(previous.source.firstReceivedAt) === received) return reject("conflicting_revision_clock");
    if (!previous || sourceInstant(previous.source.firstReceivedAt) < received) selected.set(key, record);
  }
  const normalized = [...selected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, record]) => structuredClone(record));
  return { state: "available", records: normalized, manifestHash: contentHash(normalized), approvalEvidenceIds: [...approvalIds].sort() };
}

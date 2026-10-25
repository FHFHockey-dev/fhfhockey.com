import { z } from "zod";
import { timestampMicros } from "lib/projections/evidenceTime";
import { buildPlayerIdentitySnapshot, freezeIdentityValue, identityDigest, identityTimestamp,
  type IdentitySnapshotRecord } from "./playerIdentitySnapshot";

const id = z.number().int().positive().safe();
const label = z.string().trim().min(1).max(200);
const provenance = z.string().trim().min(1).max(4000);
const effectiveInterval = z.object({ startsAt: identityTimestamp, endsAt: identityTimestamp.nullable(),
  basis: z.literal("independently_evidenced_effective_interval"), provenance }).strict()
  .refine(v => v.endsAt === null || timestampMicros(v.startsAt)! < timestampMicros(v.endsAt)!, "invalid_effective_interval");
const scope = z.discriminatedUnion("kind", [z.object({ kind: z.literal("global") }).strict(),
  z.object({ kind: z.literal("team"), teamId: id }).strict()]);
const evidenceSchema = z.object({
  version: z.literal("saved-public-player-evidence-v1"), cohort: label,
  players: z.array(z.object({ nhlId: id, registryId: id, fullName: label, lastName: label,
    position: label, provenance, knownAt: identityTimestamp.nullable() }).strict()).min(1).max(20),
  aliases: z.array(z.object({ registryId: id.nullable(), nhlId: id.nullable(), text: label, verified: z.boolean(),
    scope: scope.nullable(), knownAt: identityTimestamp.nullable(), recordCreatedAt: identityTimestamp.optional(),
    effective: effectiveInterval.nullable(), provenance }).strict()).max(100),
  memberships: z.array(z.object({ nhlId: id, teamId: id, knownAt: identityTimestamp.nullable(),
    effective: effectiveInterval.nullable(), provenance,
    recordInterval: z.object({ createdAt: identityTimestamp, endedAt: identityTimestamp.nullable(),
      isCurrent: z.boolean(), seasonId: id }).strict().optional(),
  }).strict()).max(100),
  completeness: z.object({ status: z.enum(["partial", "complete", "unknown"]), scope: label,
    omittedRecords: z.number().int().nonnegative().safe().nullable() }).strict(),
  truncated: z.boolean(),
}).strict().refine(e => e.aliases.length + e.memberships.length <= 100, "related_evidence_limit_exceeded");

const evaluationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("causal_as_of"), sourcePublishedAt: identityTimestamp }).strict(),
  z.object({ mode: z.literal("retrospective"), sourcePublishedAt: identityTimestamp, reviewedAt: identityTimestamp }).strict(),
]);
const optionsSchema = z.object({ asOf: identityTimestamp, evaluation: evaluationSchema }).strict();
export type SavedPlayerIdentityEvidence = z.infer<typeof evidenceSchema>;
export type IdentityEvidenceEvaluation = z.infer<typeof evaluationSchema>;
export type SavedIdentityProjectionOptions = z.infer<typeof optionsSchema>;

/** Pure bounded import. Provenance is supplied evidence, not authenticated or fetched here. */
export function projectSavedPlayerIdentityEvidence(input: unknown, options: SavedIdentityProjectionOptions) {
  const serialized = JSON.stringify(input);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 256_000) throw new Error("saved_identity_evidence_too_large");
  const evidence = evidenceSchema.parse(input), parsed = optionsSchema.parse(options);
  const { asOf, evaluation } = parsed;
  const knowledgeCutoff = evaluation.mode === "causal_as_of" ? evaluation.sourcePublishedAt : evaluation.reviewedAt;
  if (timestampMicros(knowledgeCutoff)! > timestampMicros(asOf)!
    || timestampMicros(knowledgeCutoff)! < timestampMicros(evaluation.sourcePublishedAt)!) throw new Error("invalid_evaluation_clock_order");
  if (new Set(evidence.players.map(p => p.nhlId)).size !== evidence.players.length
    || new Set(evidence.players.map(p => p.registryId)).size !== evidence.players.length) throw new Error("conflicting_canonical_links");
  const records: IdentitySnapshotRecord[] = evidence.players.map(p => ({
    identity: { playerId: p.nhlId, registryId: p.registryId, fullName: p.fullName, lastName: p.lastName, position: p.position },
    verifiedAliases: [], memberships: [],
  }));
  const audit: Array<{ kind: "player" | "alias" | "membership"; index: number; state: "included" | "withheld"; reasons: string[] }> = [];
  const eligibleIds = new Set<number>();
  evidence.players.forEach((player, index) => {
    const reasons = player.knownAt === null ? ["knowledge_time_unavailable"]
      : timestampMicros(player.knownAt)! > timestampMicros(knowledgeCutoff)! ? ["known_after_cutoff"] : [];
    if (!reasons.length) eligibleIds.add(player.nhlId);
    audit.push({ kind: "player", index, state: reasons.length ? "withheld" : "included", reasons });
  });
  const reasonsFor = (knownAt: string | null, effective: z.infer<typeof effectiveInterval> | null) => {
    const reasons: string[] = [];
    if (knownAt === null) reasons.push("knowledge_time_unavailable");
    else if (timestampMicros(knownAt)! > timestampMicros(knowledgeCutoff)!) reasons.push("known_after_cutoff");
    if (effective === null) reasons.push("historical_effective_interval_unavailable");
    return reasons;
  };
  evidence.aliases.forEach((alias, index) => {
    const byRegistry = alias.registryId === null ? undefined : records.find(r => r.identity.registryId === alias.registryId);
    const byNhl = alias.nhlId === null ? undefined : records.find(r => r.identity.playerId === alias.nhlId);
    if ((alias.registryId !== null && !byRegistry) || (alias.nhlId !== null && !byNhl)
      || (byRegistry && byNhl && byRegistry !== byNhl)) throw new Error("alias_canonical_link_conflict");
    const record = byRegistry ?? byNhl;
    if (!record) throw new Error("alias_canonical_link_unavailable");
    const reasons = reasonsFor(alias.knownAt, alias.effective);
    if (!eligibleIds.has(record.identity.playerId)) reasons.push("canonical_identity_not_available_at_cutoff");
    if (!alias.verified) reasons.push("verification_unavailable");
    if (alias.scope === null) reasons.push("scope_unavailable");
    if (!reasons.length && alias.effective && alias.scope) record.verifiedAliases.push({
      text: alias.text, verification: "verified", scope: alias.scope,
      startsAt: alias.effective.startsAt, endsAt: alias.effective.endsAt,
      provenance: `saved-alias-evidence:${identityDigest(alias)}`,
    });
    audit.push({ kind: "alias", index, state: reasons.length ? "withheld" : "included", reasons });
  });
  evidence.memberships.forEach((membership, index) => {
    const record = records.find(r => r.identity.playerId === membership.nhlId);
    if (!record) throw new Error("membership_canonical_link_unavailable");
    const reasons = reasonsFor(membership.knownAt, membership.effective);
    if (!eligibleIds.has(record.identity.playerId)) reasons.push("canonical_identity_not_available_at_cutoff");
    if (!reasons.length && membership.effective) record.memberships.push({
      teamId: membership.teamId, startsAt: membership.effective.startsAt, endsAt: membership.effective.endsAt,
      provenance: `saved-membership-evidence:${identityDigest(membership)}`,
    });
    audit.push({ kind: "membership", index, state: reasons.length ? "withheld" : "included", reasons });
  });
  const completeness = evidence.truncated || eligibleIds.size !== records.length
    ? { ...evidence.completeness, status: "partial" as const, omittedRecords: null } : evidence.completeness;
  const snapshot = buildPlayerIdentitySnapshot({ asOf, records: records.filter(r => eligibleIds.has(r.identity.playerId)),
    provenance: `saved-evidence:${identityDigest(evidence)};evaluation:${identityDigest(evaluation)}`,
    completeness,
  });
  const content = { version: "saved-player-identity-projection-v1", snapshot, evaluation, knowledgeCutoff, audit, evidence,
    canPublish: false, canWriteAliases: false, canExecute: false } as const;
  return freezeIdentityValue({ ...content, hash: identityDigest(content) });
}

import { buildPlayerIdentitySnapshot, identityDigest, type IdentitySnapshotRecord } from '../../../web/lib/sources/playerIdentitySnapshot';
import { timestampMicros } from '../../../web/lib/projections/evidenceTime';

type EffectiveInterval = {
  startsAt: string; endsAt: string | null;
  basis: 'independently_evidenced_effective_interval'; provenance: string;
};
type Scope = { kind: 'global' } | { kind: 'team'; teamId: number };
export type SavedPublicEvidence = {
  version: 'saved-public-player-evidence-v1'; cohort: string;
  players: Array<{ nhlId: number; registryId: number; fullName: string; lastName: string; position: string; provenance: string }>;
  aliases: Array<{ registryId: number | null; nhlId: number | null; text: string; verified: boolean;
    scope: Scope | null; knownAt: string | null; recordCreatedAt?: string; effective: EffectiveInterval | null; provenance: string }>;
  memberships: Array<{ nhlId: number; teamId: number; knownAt: string | null; effective: EffectiveInterval | null;
    recordInterval?: { createdAt: string; endedAt: string | null; isCurrent: boolean; seasonId: number }; provenance: string }>;
  completeness: { status: 'partial' | 'complete' | 'unknown'; scope: string; omittedRecords: number | null };
  truncated: boolean;
};

function clock(value: string) {
  const parsed = timestampMicros(value);
  if (parsed === null) throw new Error('invalid_evidence_clock');
  return parsed;
}

// A task-only projection of typed, pinned fixture input; not a database loader or ingestion API.
export function mapSavedProvenance(evidence: SavedPublicEvidence, asOf: string, knowledgeCutoff: string) {
  if (evidence.version !== 'saved-public-player-evidence-v1' || clock(knowledgeCutoff) > clock(asOf)) {
    throw new Error('invalid_snapshot_contract');
  }
  if (new Set(evidence.players.map(p => p.nhlId)).size !== evidence.players.length
    || new Set(evidence.players.map(p => p.registryId)).size !== evidence.players.length) throw new Error('conflicting_canonical_links');
  const records: IdentitySnapshotRecord[] = evidence.players.map(p => ({
    identity: { playerId: p.nhlId, registryId: p.registryId, fullName: p.fullName, lastName: p.lastName, position: p.position },
    verifiedAliases: [], memberships: [],
  }));
  const audit: Array<{ kind: 'alias' | 'membership'; index: number; state: 'included' | 'withheld'; reasons: string[] }> = [];
  function reasonsFor(knownAt: string | null, interval: EffectiveInterval | null, provenance: string) {
    const reasons: string[] = [];
    if (!provenance.trim()) reasons.push('missing_provenance');
    if (knownAt === null) reasons.push('knowledge_time_unavailable');
    else if (clock(knownAt) > clock(knowledgeCutoff)) reasons.push('known_after_cutoff');
    if (interval === null) reasons.push('historical_effective_interval_unavailable');
    else {
      if (interval.basis !== 'independently_evidenced_effective_interval' || !interval.provenance.trim()) {
        reasons.push('effective_interval_proof_unavailable');
      }
      const start = clock(interval.startsAt), end = interval.endsAt === null ? null : clock(interval.endsAt);
      if (end !== null && end <= start) throw new Error('invalid_effective_interval');
    }
    return reasons;
  }
  evidence.aliases.forEach((alias, index) => {
    const byRegistry = alias.registryId === null ? undefined : records.find(r => r.identity.registryId === alias.registryId);
    const byNhl = alias.nhlId === null ? undefined : records.find(r => r.identity.playerId === alias.nhlId);
    if ((alias.registryId !== null && !byRegistry) || (alias.nhlId !== null && !byNhl)
      || (byRegistry && byNhl && byRegistry !== byNhl)) throw new Error('alias_canonical_link_conflict');
    const record = byRegistry ?? byNhl;
    if (!record) throw new Error('alias_canonical_link_unavailable');
    const reasons = reasonsFor(alias.knownAt, alias.effective, alias.provenance);
    if (alias.verified !== true) reasons.push('verification_unavailable');
    if (alias.scope === null) reasons.push('scope_unavailable');
    if (!reasons.length && alias.effective && alias.scope) record.verifiedAliases.push({
      text: alias.text, verification: 'verified', scope: alias.scope,
      startsAt: alias.effective.startsAt, endsAt: alias.effective.endsAt,
      // v1 limits this string to 200 characters; bind the complete retained sidecar without truncating it.
      provenance: `saved-alias-evidence:${identityDigest(alias)}`,
    });
    audit.push({ kind: 'alias', index, state: reasons.length ? 'withheld' : 'included', reasons });
  });
  evidence.memberships.forEach((membership, index) => {
    const record = records.find(r => r.identity.playerId === membership.nhlId);
    if (!record) throw new Error('membership_canonical_link_unavailable');
    const reasons = reasonsFor(membership.knownAt, membership.effective, membership.provenance);
    if (!reasons.length && membership.effective) record.memberships.push({
      teamId: membership.teamId, startsAt: membership.effective.startsAt, endsAt: membership.effective.endsAt,
      provenance: `saved-membership-evidence:${identityDigest(membership)}`,
    });
    audit.push({ kind: 'membership', index, state: reasons.length ? 'withheld' : 'included', reasons });
  });
  const snapshot = buildPlayerIdentitySnapshot({ asOf, records,
    provenance: `task-only strict dated evidence ${identityDigest(evidence)}; knowledge_cutoff=${knowledgeCutoff}`,
    completeness: evidence.truncated ? { ...evidence.completeness, status: 'partial', omittedRecords: null } : evidence.completeness,
  });
  return { version: 'strict-saved-provenance-projection-v1', snapshot, knowledgeCutoff, audit,
    // Keep observation time, raw record intervals and missing fields visible outside v1's narrower snapshot shape.
    evidence: structuredClone(evidence), canPublish: false, canWriteAliases: false, canExecute: false } as const;
}

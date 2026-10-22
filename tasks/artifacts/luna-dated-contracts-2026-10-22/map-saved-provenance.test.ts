// @vitest-environment node
import { describe, expect, it } from 'vitest';
import publicEvidence from './PUBLIC-EVIDENCE.json';
import { mapSavedProvenance, type SavedPublicEvidence } from './map-saved-provenance';
import { indexPlayerIdentitySnapshot, snapshotRowAtSource } from '../../../web/lib/sources/playerIdentitySnapshot';

const asOf = '2026-10-22T00:00:00Z', sourceTime = '2026-09-29T16:28:31Z';
const saved = () => structuredClone(publicEvidence) as SavedPublicEvidence;
const interval = () => ({ startsAt: '2026-09-01T00:00:00Z', endsAt: null,
  basis: 'independently_evidenced_effective_interval' as const, provenance: 'SYNTHETIC test interval, not player history' });
function synthetic() {
  const evidence = saved();
  evidence.cohort = 'synthetic_contract_controls_not_player_history';
  evidence.aliases = [{ ...evidence.aliases[3]!, knownAt: '2026-09-01T00:00:00Z', effective: interval() }];
  evidence.memberships = [{ ...evidence.memberships[0]!, knownAt: '2026-09-01T00:00:00Z', effective: interval() }];
  return evidence;
}

describe('strict saved public-player provenance projection', () => {
  it('maps both canonical namespaces and preserves observations without inventing dated validity', () => {
    const evidence = saved(), before = structuredClone(evidence);
    const result = mapSavedProvenance(evidence, asOf, sourceTime);
    expect(result.snapshot.content.rows.map(p => [p.canonicalId, p.registryId])).toEqual([
      ['nhl:8476454', 9521], ['nhl:8481617', 10190],
    ]);
    expect(result.snapshot.content.rows.every(p => !p.aliases.length && !p.memberships.length)).toBe(true);
    expect(result.audit).toHaveLength(6);
    expect(result.audit.every(x => x.reasons.includes('historical_effective_interval_unavailable'))).toBe(true);
    expect(result.evidence.aliases[3]).toMatchObject({ text: 'RNH', verified: true, scope: { kind: 'global' },
      knownAt: '2026-10-20T23:03:35Z', effective: null });
    expect(result.evidence.memberships[0]!.recordInterval?.createdAt).toBe('2026-09-19T00:57:26.215689+00:00');
    expect(result.snapshot.content.completeness.status).toBe('partial');
    expect(evidence).toEqual(before);
  });
  it('does not convert post-confirmation knowledge into an alias valid interval or current membership', () => {
    const result = mapSavedProvenance(saved(), asOf, asOf);
    expect(result.audit[3]!.reasons).toEqual(['historical_effective_interval_unavailable']);
    expect(result.snapshot.content.rows[0]!.aliases).toEqual([]);
    expect(result.snapshot.content.rows[0]!.memberships).toEqual([]);
  });
  it('projects explicitly evidenced synthetic intervals with microsecond and exclusive-end boundaries', () => {
    const e = synthetic();
    e.aliases[0]!.effective = { ...interval(), startsAt: '2026-09-29T16:28:31.000001Z', endsAt: '2026-09-29T16:28:31.000003Z' };
    const result = mapSavedProvenance(e, asOf, sourceTime), index = indexPlayerIdentitySnapshot(result.snapshot);
    const row = index.snapshot.content.rows[0]!;
    expect(snapshotRowAtSource(row, index, '2026-09-29T16:28:31.000000Z').aliases).toHaveLength(0);
    expect(snapshotRowAtSource(row, index, '2026-09-29T16:28:31.000001Z').aliases).toHaveLength(1);
    expect(snapshotRowAtSource(row, index, '2026-09-29T16:28:31.000003Z').aliases).toHaveLength(0);
  });
  it('keeps future knowledge out even when a synthetic effective interval covers the source', () => {
    const e = synthetic(); e.aliases[0]!.knownAt = '2026-09-29T16:28:31.000001Z';
    expect(mapSavedProvenance(e, asOf, sourceTime).audit[0]!.reasons).toEqual(['known_after_cutoff']);
  });
  it('does not leak scoped aliases outside independently dated membership', () => {
    const e = synthetic(); e.aliases[0]!.scope = { kind: 'team', teamId: 22 };
    e.memberships[0]!.effective = { ...interval(), endsAt: '2026-09-20T00:00:00Z' };
    const index = indexPlayerIdentitySnapshot(mapSavedProvenance(e, asOf, sourceTime).snapshot);
    expect(snapshotRowAtSource(index.snapshot.content.rows[0]!, index, sourceTime).aliases).toEqual([]);
  });
  it('retains conflicting membership instead of inventing one team', () => {
    const e = synthetic(); e.memberships.push({ ...e.memberships[0]!, teamId: 99 });
    const index = indexPlayerIdentitySnapshot(mapSavedProvenance(e, asOf, sourceTime).snapshot);
    const view = snapshotRowAtSource(index.snapshot.content.rows[0]!, index, sourceTime);
    expect(view.teamIds).toEqual([22, 99]); expect(view.identity.teamId).toBeNull();
  });
  it.each(['unknown-link', 'swapped-namespaces', 'conflicting-link', 'duplicate-player'] as const)('fails closed on %s', kind => {
    const e = synthetic();
    if (kind === 'unknown-link') e.aliases[0]!.registryId = 999;
    if (kind === 'swapped-namespaces') e.aliases[0]!.nhlId = 9521;
    if (kind === 'conflicting-link') e.aliases[0]!.nhlId = 8481617;
    if (kind === 'duplicate-player') e.players.push(e.players[0]!);
    expect(() => mapSavedProvenance(e, asOf, sourceTime)).toThrow(/link/);
  });
  it.each(['missing-time', 'unverified', 'missing-scope', 'missing-proof'] as const)('withholds %s evidence', kind => {
    const e = synthetic();
    if (kind === 'missing-time') e.aliases[0]!.knownAt = null;
    if (kind === 'unverified') e.aliases[0]!.verified = false;
    if (kind === 'missing-scope') e.aliases[0]!.scope = null;
    if (kind === 'missing-proof') e.aliases[0]!.effective!.provenance = '';
    expect(mapSavedProvenance(e, asOf, sourceTime).snapshot.content.rows[0]!.aliases).toEqual([]);
  });
  it('shows export truncation even when the supplied completeness incorrectly says complete', () => {
    const e = saved(); e.truncated = true; e.completeness.status = 'complete'; e.completeness.omittedRecords = 0;
    expect(mapSavedProvenance(e, asOf, sourceTime).snapshot.content.completeness).toMatchObject({ status: 'partial', omittedRecords: null });
  });
  it('rejects malformed clocks, reversed intervals and a future knowledge cutoff', () => {
    const e = synthetic(); e.aliases[0]!.knownAt = '2026-02-30T00:00:00Z';
    expect(() => mapSavedProvenance(e, asOf, sourceTime)).toThrow('invalid_evidence_clock');
    e.aliases[0]!.knownAt = sourceTime; e.aliases[0]!.effective!.endsAt = '2026-08-01T00:00:00Z';
    expect(() => mapSavedProvenance(e, asOf, sourceTime)).toThrow('invalid_effective_interval');
    expect(() => mapSavedProvenance(saved(), sourceTime, asOf)).toThrow('invalid_snapshot_contract');
  });
});

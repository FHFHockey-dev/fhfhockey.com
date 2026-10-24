// Independent synthetic controls. Copy into the pinned scratch web/lib/sources directory.
import { describe, expect, it } from 'vitest';
import { projectSavedPlayerIdentityEvidence, type SavedPlayerIdentityEvidence } from './playerIdentitySnapshotEvidence';
import { prepareTweetIdentityReplacementReview } from './tweetIdentityReplacementReview';
import { indexPlayerIdentitySnapshot, snapshotRowAtSource } from './playerIdentitySnapshot';
import { prepareFixtureIdentityRequest } from './tweetIdentityProposal';
import { offlineIdentityMention, offlineIdentityReply, offlineIdentitySource } from './fixtures/tweetIdentityOfflineFixture';

const at = '2026-09-29T16:28:31.000001Z';
const asOf = '2026-10-22T00:00:00Z';
const prior = '2026-09-01T00:00:00Z';
const causal = { asOf, evaluation: { mode: 'causal_as_of' as const, sourcePublishedAt: at } };
const retro = { asOf, evaluation: { mode: 'retrospective' as const, sourcePublishedAt: at, reviewedAt: asOf } };
const interval = () => ({ startsAt: prior, endsAt: null, basis: 'independently_evidenced_effective_interval' as const, provenance: 'synthetic only' });
function evidence(): SavedPlayerIdentityEvidence {
  return { version: 'saved-public-player-evidence-v1', cohort: 'independent synthetic review',
    players: [
      { nhlId: 1001, registryId: 1, fullName: 'Milo North', lastName: 'North', position: 'C', provenance: 'synthetic', knownAt: prior },
      { nhlId: 1002, registryId: 2, fullName: 'Riley Spot', lastName: 'Spot', position: 'D', provenance: 'synthetic', knownAt: prior },
    ], aliases: [], memberships: [], truncated: false,
    completeness: { status: 'partial', scope: 'two synthetic people', omittedRecords: null } };
}
function fixture(text = "Milo North will take spot's spot", outgoingStart = text.indexOf('spot'), e = evidence(), prefix = '') {
  const source = offlineIdentitySource(prefix + text, at);
  const outName = e.players[1]!.lastName.toLowerCase();
  const mentions = [offlineIdentityMention(source.text, 'Milo North'), offlineIdentityMention(source.text, outName, 'name', prefix.length + outgoingStart)];
  const projection = projectSavedPlayerIdentityEvidence(e, causal);
  const prepared = prepareFixtureIdentityRequest({ enabled: true, source, index: indexPlayerIdentitySnapshot(projection.snapshot), mentions });
  if (prepared.status !== 'prepared') throw Error(prepared.reason);
  const proposal = offlineIdentityReply(prepared.request, (_, i) => ({ status: 'matched', canonicalId: `nhl:${1001+i}` }));
  return { enabled: true, request: prepared.request, proposal,
    clause: { incomingOccurrenceId: mentions[0]!.id, outgoingOccurrenceId: mentions[1]!.id,
      evidence: { start: prefix.length, end: source.text.length, text }, unitEvidence: null } };
}
describe('independent offline contract controls', () => {
  it('uses microsecond knowledge boundaries for canonical identity', () => {
    const e = evidence(); e.players[0]!.knownAt = at; e.players[1]!.knownAt = '2026-09-29T16:28:31.000002Z';
    expect(projectSavedPlayerIdentityEvidence(e, causal).snapshot.content.rows.map(r => r.nhlPlayerId)).toEqual([1001]);
    expect(projectSavedPlayerIdentityEvidence(e, retro).snapshot.content.rows.map(r => r.nhlPlayerId)).toEqual([1001,1002]);
  });
  it('does not let backdated validity override late alias or membership knowledge', () => {
    const e = evidence();
    e.aliases = [{ nhlId: 1001, registryId: 1, text: 'Sparky', verified: true, scope: { kind: 'global' }, knownAt: '2026-09-29T16:28:31.000002Z', effective: interval(), provenance: 'synthetic' }];
    e.memberships = [{ nhlId: 1001, teamId: 22, knownAt: '2026-09-29T16:28:31.000002Z', effective: interval(), provenance: 'synthetic' }];
    const before = projectSavedPlayerIdentityEvidence(e, causal).snapshot.content.rows[0]!;
    expect([before.aliases.length, before.memberships.length]).toEqual([0,0]);
    const after = projectSavedPlayerIdentityEvidence(e, retro).snapshot.content.rows[0]!;
    expect([after.aliases.length, after.memberships.length]).toEqual([1,1]);
  });
  it('keeps effective membership half-open independently of knowledge time', () => {
    const e = evidence(); e.memberships = [{ nhlId: 1001, teamId: 22, knownAt: prior,
      effective: { ...interval(), startsAt: at, endsAt: '2026-09-29T16:28:31.000002Z' }, provenance: 'synthetic' }];
    const index = indexPlayerIdentitySnapshot(projectSavedPlayerIdentityEvidence(e, causal).snapshot), row = index.snapshot.content.rows[0]!;
    expect(snapshotRowAtSource(row,index,'2026-09-29T16:28:31Z').identity.teamId).toBeNull();
    expect(snapshotRowAtSource(row,index,at).identity.teamId).toBe(22);
    expect(snapshotRowAtSource(row,index,'2026-09-29T16:28:31.000002Z').identity.teamId).toBeNull();
  });
  it('does not use a current DB record interval as historical membership', () => {
    const e = evidence(); e.memberships = [{ nhlId: 1001, teamId: 22, knownAt: prior, effective: null, provenance: 'synthetic',
      recordInterval: { createdAt: prior, endedAt: null, isCurrent: true, seasonId: 20262027 } }];
    const result = projectSavedPlayerIdentityEvidence(e, causal);
    expect(result.snapshot.content.rows[0]!.memberships).toEqual([]);
    expect(result.audit.find(a => a.kind === 'membership')!.reasons).toContain('historical_effective_interval_unavailable');
    const args = fixture(undefined,undefined,e);
    expect(args.request.content.occurrences[0]!.candidateSet.candidates[0]!.teamEvidence).toBe('unknown');
    expect(prepareTweetIdentityReplacementReview(args).packet?.sourceTimeMembership).toBeNull();
  });
  it('requires literal true before reading any review payload', () => {
    for (const enabled of [undefined,false,0,1,'true',new Boolean(true)]) {
      const args = { enabled };
      for (const key of ['request','proposal','clause']) Object.defineProperty(args,key,{get(){ throw Error('disabled input inspected'); }});
      expect(prepareTweetIdentityReplacementReview(args as never)).toMatchObject({status:'disabled',canPublish:false,canWriteAliases:false,canChangeStatus:false,canExecuteReplacement:false,providerDispatchEnabled:false});
    }
  });
  it('retains preceding conditional context without upgrading the literal statement or allowing effects', () => {
    const args=fixture(undefined,undefined,evidence(),'If cleared after practice, ');
    const result=prepareTweetIdentityReplacementReview(args);
    expect(result).toMatchObject({status:'reviewable_held',canExecuteReplacement:false,canPublish:false,providerDispatchEnabled:false});
    expect(result.packet).toMatchObject({claimCertainty:'unassessed',governingContext:'unassessed',source:{text:args.request.content.source.text}});
    expect(result.packet?.holds).toContain('governing_context_unassessed');
    expect(Object.isFrozen(result.packet?.source)).toBe(true);
  });
  it('rejects a heading as a matched outgoing player through the existing proposal gate', () => {
    const args = fixture(), request = structuredClone(args.request);
    // Rebuild a valid request with the annotation classified as a heading.
    const mentions = request.content.occurrences.map(({candidateSet: _ignored,...mention},i) => ({...mention,kind:i ? 'heading' as const:'name' as const}));
    const prepared = prepareFixtureIdentityRequest({enabled:true,index:indexPlayerIdentitySnapshot(projectSavedPlayerIdentityEvidence(evidence(),causal).snapshot),source:request.content.source,mentions});
    if(prepared.status !== 'prepared') throw Error(prepared.reason);
    const proposal=offlineIdentityReply(prepared.request,(_,i)=>({status:'matched',canonicalId:`nhl:${1001+i}`}));
    expect(prepareTweetIdentityReplacementReview({...args,request:prepared.request,proposal})).toMatchObject({status:'held',reason:'identity_heading_or_chunk_is_not_a_person'});
  });
  it('rejects conflicting dated membership through the existing proposal gate', () => {
    const e = evidence(); e.memberships=[22,99].map(teamId=>({nhlId:1002,teamId,knownAt:prior,effective:interval(),provenance:'synthetic'}));
    expect(prepareTweetIdentityReplacementReview(fixture(undefined,undefined,e))).toMatchObject({status:'held',reason:'identity_membership_conflict'});
  });
  it('documents an integration constraint: a bare projected snapshot does not bind later request publication time', () => {
    const e=evidence(); e.players.forEach(p=>{p.knownAt='2026-09-20T00:00:00Z';});
    const projection=projectSavedPlayerIdentityEvidence(e,causal);
    const source=offlineIdentitySource('Milo North',prior);
    const prepared=prepareFixtureIdentityRequest({enabled:true,index:indexPlayerIdentitySnapshot(projection.snapshot),source,mentions:[offlineIdentityMention(source.text,'Milo North')]});
    expect(prepared.status).toBe('prepared');
    if(prepared.status==='prepared') expect(prepared.request.content.occurrences[0]!.candidateSet.candidates.map(c=>c.row.canonicalId)).toEqual(['nhl:1001']);
    // This is a characterization, not proof of causal safety for cross-source reuse.
    expect(projectSavedPlayerIdentityEvidence(e,{asOf,evaluation:{mode:'causal_as_of',sourcePublishedAt:prior}}).snapshot.content.rows).toEqual([]);
  });
  it.each(['noun','predicate'] as const)('requires the outgoing occurrence to occupy the grammatical slot, not the repeated %s', kind => {
    const e=evidence();
    const text=kind==='noun' ? "Milo North will take spot's spot" : "Milo North will take will's spot";
    if(kind==='predicate'){e.players[1]!.fullName='Riley Will';e.players[1]!.lastName='Will';}
    const wrong=kind==='noun' ? text.lastIndexOf('spot') : text.indexOf('will');
    const result=prepareTweetIdentityReplacementReview(fixture(text,wrong,e));
    expect(result.status).toBe('held');
  });
});

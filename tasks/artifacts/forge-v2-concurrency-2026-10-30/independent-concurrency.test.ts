// @vitest-environment node
import {it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {issuedLifecycleFixture} from './fixtureHarness.server';
import {preparePlayerReadContext} from './preparation.server';
import {FIXTURE_TARGET} from './fixtures';
import {DEFAULT_SCORING,targetKey} from './identity';
import {available} from './contracts';
import {PreparedForgeReadRepository,type PreparedPlayerContext} from './api.server';
it('concurrent older preparation must not replace a newer corrected read head', async()=>{
 const root=await mkdtemp(join(tmpdir(),'forge-independent-race-'));
 try {
  const env=await issuedLifecycleFixture(root), early='2026-01-13T04:00:00.000Z', late='2026-01-14T04:00:00.000Z';
  const input={store:env.store,artifacts:env.artifacts,player:env.context.player,targets:[FIXTURE_TARGET],evidenceClass:'fixture' as const,profiles:[DEFAULT_SCORING],qualifications:[],excluded:[],previous:env.context,maximumRecordsPerKind:5000,maximumPublicationsPerGame:200,visibility:'local_fixture' as const};
  let paused!:()=>void,release!:()=>void;
  const atAppend=new Promise<void>(r=>paused=r), resume=new Promise<void>(r=>release=r);
  const append=env.store.appendRecord.bind(env.store);
  env.store.appendRecord=async(...args:Parameters<typeof append>)=>{
   if(args[1]==='read_context' && (args[3] as PreparedPlayerContext).asOf===early){paused();await resume;}
   return append(...args);
  };
  const older=preparePlayerReadContext({...input,asOf:early}).then(()=>null,error=>error);
  await atAppend;
  const oldOutcome=env.context.games[0].outcome!;
  const corrected={...oldOutcome,id:'independent-new-correction',predecessorId:oldOutcome.id,recordedAt:'2026-01-14T03:00:00.000Z',values:{...oldOutcome.values,G:available(5)},reason:'synthetic_later_official_correction'};
  await append(corrected.id,'outcome',targetKey(corrected),corrected,oldOutcome.id);
  const newer=await preparePlayerReadContext({...input,asOf:late});
  release(); const olderResult=await older;
  expect(olderResult?.message).toBe("prepared_context_predecessor_or_time_conflict");
  const read=async()=>[...env.store.ledger.values()].filter(r=>r.kind==='read_context').at(-1)!.payload as PreparedPlayerContext;
  const repo=new PreparedForgeReadRepository({players:async()=>[env.context.player],read,readGame:read},env.store.asPostgresStore(),env.artifacts);
  const served=await repo.player(FIXTURE_TARGET.playerId,DEFAULT_SCORING);
  console.info('Independent race evidence',JSON.stringify({olderRejected:olderResult.message,newer:newer.asOf,lastInserted:(await read()).asOf,expectedOutcome:corrected.id,servedOutcome:served?.games[0].actual.revisionId}));
  expect((await read()).asOf).toBe(late);
  expect(served?.games[0].actual.revisionId).toBe(corrected.id);
 } finally {await rm(root,{recursive:true,force:true});}
},20000);

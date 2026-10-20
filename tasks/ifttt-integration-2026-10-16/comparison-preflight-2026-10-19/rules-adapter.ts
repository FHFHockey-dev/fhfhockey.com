import { extractTweetPlayerEvents } from '../../../web/lib/sources/tweetPlayerEvents';
import { interpretTweetUnits } from '../../../web/lib/sources/tweetInterpretation';
import { buildRequest } from '../../../web/lib/sources/decisionsReference/adapter.mjs';
import type { PlayerIdentity } from '../../../web/lib/sources/playerIdentity';

export type Source = { source_id: string; text: string; author: string; url: string; published_at: string | null;
  received_at: string; players: PlayerIdentity[]; attribution_status: string };
export type Proposal = { id: string; player: string; player_id: string | null; team: string | null;
  role: string | null; event: string; value: string; polarity: string; certainty: string;
  time: string | null; condition: string | null; source_id: string; source_author: string;
  evidence: { start: number; end: number; text: string } };

/** Local source proposal projection. Native observations/statuses are untouched.
 * Relative time remains literal. Test roster IDs are never promoted to real IDs.
 * A missing extraction is retained as a miss by the separate grading oracle.
 */
export function rules(source: Source) {
  const events = extractTweetPlayerEvents({text:source.text,players:source.players,publishedAt:source.published_at,includeClaimAnchors:true});
  const units = interpretTweetUnits(source.text,source.players);
  const claims: Proposal[] = [];
  const add = (input: Omit<Proposal,'id'|'player_id'|'team'|'source_id'|'source_author'>) => claims.push({
    id:`rules-${source.source_id}-${claims.length}`,player_id:null,team:null,
    source_id:source.source_id,source_author:source.author,...input });
  const timing = (text: string) => text.match(/\b(tonight|today|tomorrow|Friday|Saturday)\b/i)?.[0] ?? null;
  for (const e of events) {
    add({player:e.playerName,event:e.kind==='goalie'?'starter':e.kind==='participation'?'attendance':'availability',
      value:e.kind==='goalie'?e.goalieRole??e.state:e.kind==='participation'?e.observation??'unknown':e.availability,
      role:e.kind==='goalie'?e.goalieRole==='backup'?'backup':'goalie':null,
      polarity:e.modality==='negated'||e.availability==='out'?'negative':'positive',
      certainty:e.modality==='observation'?'observation':e.modality==='tentative'||e.availability==='uncertain'?'tentative':'asserted',
      time:timing(e.evidence.text),condition:null,
      evidence:{start:e.evidence.start,end:e.evidence.end,text:e.evidence.text}});
  }
  for (const unit of units.units) {
    if (!['es_forward','es_defense','pp'].includes(unit.situation)) continue;
    for (const player of unit.players) {
      const spans=unit.evidence;
      if (!spans.length) continue;
      const start=Math.min(...spans.map(s=>s.start)),end=Math.max(...spans.map(s=>s.end));
      add({player:player.name,event:unit.situation==='pp'?'pp':'line',value:'member',
        role:unit.situation==='pp'?`pp${unit.number??'unknown'}`:unit.situation,
        polarity:'positive',certainty:units.certainty==='projected'?'tentative':'asserted',
        time:units.context==='practice'?'practice':timing(source.text),condition:null,
        evidence:{start,end,text:source.text.slice(start,end)}});
    }
  }
  return {material:claims.length>0,claims,overflow:claims.length>32};
}

export function statement(claim: Proposal) {
  const {id:_id,evidence:_evidence,...fields}=claim;
  return 'Evaluate every field of this source proposition: '+JSON.stringify(fields,Object.keys(fields).sort());
}

/** Only builds retained reference requests. Never creates its demo executor.
 * Explicitly does not claim live Decisions-schema or native-fact compatibility.
 */
export function decisionsRequest(source: Source, claims: Proposal[]) {
  if (!source.published_at||source.attribution_status!=='original') return {status:'held',reason:'original_metadata_unresolved'} as const;
  const eligible=claims.filter(c=>c.player_id!==null && c.event!=='line' && c.event!=='pp');
  const plan=buildRequest({source:{id:source.source_id,text:source.text,authorId:source.author,url:source.url,
    publishedAt:source.published_at,ingestedAt:source.received_at},extractionVersion:'comparison-source-proposition-v1',
    claims:eligible.map(c=>({id:c.id,sourceId:c.source_id,playerId:c.player_id!,statement:statement(c),
      sourceSpan:{start:c.evidence.start,end:c.evidence.end,quote:c.evidence.text}}))});
  return {status:'prepared',request:plan.request,heldClaimIds:claims.filter(c=>!eligible.includes(c)).map(c=>c.id)} as const;
}

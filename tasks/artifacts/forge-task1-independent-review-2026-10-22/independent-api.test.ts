import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({rows:[] as any[],reads:[] as string[],columns:[] as string[],count:null as number|null}));
vi.mock('lib/supabase/server',()=>({default:{from:(table:string)=>{
  fixture.reads.push(table);
  const filters:Array<(row:any)=>boolean>=[];
  let from=0,to=999;
  const query:any={select:(columns:string)=>{fixture.columns.push(columns);return query;},order:()=>query,
    range:(a:number,b:number)=>{from=a;to=b;return query;},
    eq:(column:string,value:any)=>{filters.push(r=>r[column]===value);return query;},
    not:(column:string)=>{filters.push(r=>r[column]!=null);return query;},
    gte:(column:string,value:any)=>{filters.push(r=>r[column]>=value);return query;},
    lte:(column:string,value:any)=>{filters.push(r=>r[column]<=value);return query;},
    abortSignal:async()=>{const rows=fixture.rows.filter(r=>filters.every(filter=>filter(r)));return {data:rows.slice(from,to+1),count:fixture.count??rows.length,error:null};}};
  return query;
}}}));
import handler from 'pages/api/v1/forge/scoreboard';
function row(source:string,id:number,extra:Record<string,unknown>={}) {
  return {source,served_date:'2026-10-20',season_id:'20262027',player_id:String(id),game_id:'100',player_class:'skater',
    settled_at:'2026-10-22T01:00:00Z',dressed:true,started:null,
    exp_goals:'1',act_goals:'0',exp_fantasy_points:'1',act_fantasy_points:'0',...extra};
}
const response=()=>({statusCode:0,body:null as any,setHeader:vi.fn(),status(code:number){this.statusCode=code;return this;},json(body:any){this.body=body;return this;}});
const comparison=(body:any)=>body.pooledPaired.comparisons.find((r:any)=>r.source==='bridge_exact'&&r.reference==='naive_last5');
describe('independent offline API boundary checks',()=>{
  beforeEach(()=>{fixture.rows=[];fixture.reads=[];fixture.columns=[];fixture.count=null;vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));});

  it('pools player-game/as-of observations rather than equally weighting days or separate source means',async()=>{
    fixture.rows=[['2026-10-20',1,10],['2026-10-21',1,0],['2026-10-21',2,0],['2026-10-21',3,0]].flatMap(([day,id,p])=>[
      row('bridge_exact',Number(id),{served_date:day,exp_goals:String(p),exp_fantasy_points:String(p)}),
      row('naive_last5',Number(id),{served_date:day})]);
    fixture.rows.push(row('bridge_exact',99,{exp_goals:'1000000'}));
    const out=response();await handler({method:'GET',query:{scope:'skater'}} as any,out as any);
    expect(out.statusCode).toBe(200);
    expect(comparison(out.body)).toMatchObject({pairing:{matched:4,sourceOnly:1},heads:{goals:{source:{n:4,bias:2.5,rmse:5},reference:{n:4,rmse:1},rmseSkill:-4}}});
    expect(out.body.data.map((day:any)=>day.paired.comparisons.find((r:any)=>r.source==='bridge_exact'&&r.reference==='naive_last5').heads.goals.source.n)).toEqual([1,3]);
    expect(fixture.reads).toEqual(['forge_served_forecast_ledger']);
    expect(fixture.columns[0].split(',')).toContain('season_id');
    expect(out.body).toMatchObject({comparison:'paired_player_game',sourceSamples:'unpaired_descriptive_only',coverageStatus:'unavailable_independent_universe_not_persisted'});
  });

  it('preserves goalie non-starts through numeric parsing and rejects missing/malformed evidence without zero filling',async()=>{
    fixture.rows=[true,false].flatMap((started,i)=>[
      row('bridge_exact',i+1,{player_class:'goalie',dressed:started,started,start_probability:i===0?'0.9':'0.6',exp_saves:'',act_saves:'0'}),
      row('naive_last5',i+1,{player_class:'goalie',dressed:started,started,start_probability:'0.5',exp_saves:'20',act_saves:'0'})]);
    fixture.rows.push(row('native',99,{season_id:true}),row('native',98,{player_id:false}));
    const out=response();await handler({method:'GET',query:{}} as any,out as any);
    expect(out.statusCode).toBe(200);
    expect(comparison(out.body)).toMatchObject({pairing:{matched:2,dressed:1},binary:{start:{source:{n:2,brier:.185},reference:{n:2,brier:.25}}},
      heads:{saves:{source:{n:0},exclusions:{missingPrediction:1}}}});
    expect(out.body.pooledPaired.invalidIdentityRows).toBe(2);
    expect(out.body.pooled.find((r:any)=>r.source==='bridge_exact').binary.start.n).toBe(2);
    expect(fixture.reads).toEqual(['forge_served_forecast_ledger']);
  });

  it('refuses an oversized/incomplete bounded read instead of presenting a partial successful scoreboard',async()=>{
    fixture.rows=[row('bridge_exact',1)];fixture.count=120001;
    const out=response();await handler({method:'GET',query:{}} as any,out as any);
    expect(out.statusCode).toBe(500);
    expect(out.body.pooledPaired).toBeUndefined();
    expect(fixture.reads).toEqual(['forge_served_forecast_ledger']);
  });
});

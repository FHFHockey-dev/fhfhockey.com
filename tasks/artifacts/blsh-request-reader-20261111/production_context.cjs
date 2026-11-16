/* Descriptive current-window context only. No reference fit or BLSH score. */
function buildProductionContexts(records, {outcomes, eventThroughDate, capturedAtUTC, discrepancies=[]}) {
  const groups=new Map();
  for(const r of records){if(!groups.has(r.record.player_id))groups.set(r.record.player_id,[]);groups.get(r.record.player_id).push(r);}
  const flagged=new Map();for(const d of discrepancies){if(!flagged.has(d.source_id))flagged.set(d.source_id,[]);flagged.get(d.source_id).push(d);}
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const total=values=>values.length&&values.every(finite)?values.reduce((a,b)=>a+b,0):null;
  return [...groups].sort(([a],[b])=>a-b).map(([id,all])=>{
    const rows=[...all].sort((a,b)=>a.record.date.localeCompare(b.record.date)||a.record.id-b.record.id).slice(-5);
    const identity=rows.every(r=>r.identityAndExposure.qualified);
    const appearances=rows.every(r=>r.record.games_played===1)?rows.length:null;
    const seconds=identity&&appearances!==null?total(rows.map(r=>r.record.toi_per_game)):null;
    const metrics=['fantasyPoints','rawPoints','wigoGameScore'].map((key,j)=>{
      const values=rows.map(r=>r.tracks[key].qualified?outcomes(r.record.counts)[j].value:null),sum=total(values);
      return {key,total:sum,perAppearance:sum!==null&&appearances!==null&&appearances>0?sum/appearances:null,
        per60:sum!==null&&seconds!==null&&seconds>0?sum*3600/seconds:null,
        coveredRecords:values.filter(finite).length,selectedRecords:rows.length,
        missingReasons:[...new Set(rows.flatMap(r=>r.tracks[key].reasons))].sort()};
    });
    const latest=rows[rows.length-1].record;
    const retainedDiscrepancies=rows.flatMap(r=>(flagged.get(r.record.id)||[]).map(d=>{
      const allowed=['goals','assists','shots','hits','blocked_shots','toi_per_game'];
      const capturedValue=d.field==='toi_per_game'?r.record.toi_per_game:r.record.counts[d.field];
      if(!allowed.includes(d.field)||d.player_id!==r.record.player_id||d.game_id!==r.record.game_id||d.date!==r.record.date||d.wgo_value!==capturedValue)throw Error('Discrepancy evidence does not match current captured row');
      return {...d,currentWgoCapturedAtUTC:capturedAtUTC,priorEvidenceOnly:true};
    }));
    return {playerId:id,name:latest.player_name||null,team:latest.team_abbrev||null,position:latest.position_code||null,
      eventThroughDate,capturedAtUTC,sourceIds:rows.map(r=>r.record.id),dates:rows.map(r=>r.record.date),
      selectedRecords:rows.length,appearances,seconds,minutes:seconds===null?null:seconds/60,
      lastRecordAgeDays:(Date.parse(eventThroughDate)-Date.parse(latest.date))/86400000,
      metricBasis:'WGO observed selected-record totals, separately divided by appearances or total ice time; source discrepancies retained',
      metrics,shots:total(rows.map(r=>r.record.counts.shots)),identityAndExposureQualified:identity,
      sourceDiscrepancies:retainedDiscrepancies,officialFieldVerification:'not_inferred_from_input_completeness',
      supportStatus:'unavailable_source_definition_gate',supportScore:null,buySellLabel:null,baselineComparison:null,
      trusted:false,productionAdopted:false};
  });
}
module.exports={buildProductionContexts};

// Executed in functions.exec; tools are supplied by that runtime.
async function runBatch(){
 const base="tasks/artifacts/drm-ddatv-2026-11-12",dir=base+"/production/step5";
 const quote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
 async function command(cmd){let r=await tools.exec_command({cmd,yield_time_ms:1000,max_output_tokens:5000});let out=r.output;while(r.session_id){r=await tools.write_stdin({session_id:r.session_id,chars:"",yield_time_ms:1000,max_output_tokens:5000});out+=r.output;}if(r.exit_code!==0)throw Error(out.trim()||"Command failed");return out.trim();}
 async function writeJson(file,value){await command("python3 -c "+quote("import pathlib,json,sys\np=pathlib.Path(sys.argv[1]);p.write_text(json.dumps(json.loads(sys.argv[2]),indent=2)+'\\n')")+" "+quote(file)+" "+quote(JSON.stringify(value)));}
 const state=JSON.parse(await command("cat "+dir+"/PROGRESS.json"));
 const scope=JSON.parse(await command("python3 -c "+quote("import json,sys\ns=json.load(open(sys.argv[1]));print(json.dumps({k:s[k] for k in ['maximumHealthSqlRequests','maximumDatabaseRestRequests','maximumWriteRpcs','maximumProbeDurationMs','healthLatencyOverride','minimumGameSpacingSeconds','gameSpacingOverride']}))")+" "+quote(dir+"/APPROVED-SCOPE.json")));
 const persist=async()=>{state.updatedAt=new Date().toISOString();await writeJson(dir+"/PROGRESS.json",state);};
 const deadline=Date.parse(state.deadlineAt);
 const checkTime=()=>{if(Date.now()>=deadline)throw Error("Original six-hour execution window expired");};
 const waitUntil=async(time)=>{while(Date.now()<time){checkTime();await new Promise(r=>setTimeout(r,Math.min(60000,time-Date.now())));}checkTime();};
 const healthQuery="begin; set transaction read only; set local statement_timeout='0'; select clock_timestamp() as checked_at, count(*) filter(where state='active') as active_other, coalesce(max(extract(epoch from clock_timestamp()-query_start)) filter(where state='active'),0) as longest_active_seconds, count(*) filter(where state='active' and wait_event_type in('IO','Lock','LWLock')) as io_lock_waits, (select checkpoints_req from pg_stat_bgwriter) as checkpoints_requested, (select stats_reset from pg_stat_bgwriter) as stats_reset from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend'; commit;";
 async function guard(gameId,phase){
  while(true){
   if(state.healthRetryNotBefore)await waitUntil(Date.parse(state.healthRetryNotBefore));
   checkTime();if(state.healthSqlRequests>=scope.maximumHealthSqlRequests)throw Error("Health SQL budget exhausted");
   state.healthSqlRequests++;state.phase=phase+"_health";await persist();
   const started=Date.now();
   const result=await tools.mcp__codex_apps__supabase_execute_sql({project_id:"fyhftlxokyjtpndbkfse",query:healthQuery});
   const duration=Date.now()-started;
   if(result.isError)throw Error("Health tool failed");
   const match=JSON.parse(result.content[0].text).result.match(/>\n(\[.*\])\n<\/untrusted/);
   if(!match)throw Error("Health response shape changed");
   const row=JSON.parse(match[1])[0],previous=state.checkpointBaseline;
   const h={projectId:"fyhftlxokyjtpndbkfse",healthy:true,checkedAt:new Date(row.checked_at).toISOString(),ioLockWaits:Number(row.io_lock_waits),longestActiveSeconds:Number(row.longest_active_seconds),probeDurationMs:duration,checkpointsRequested:Number(row.checkpoints_requested),previousCheckpointsRequested:previous.checkpointsRequested,statsReset:new Date(row.stats_reset).toISOString(),previousStatsReset:previous.statsReset,checkpointPauseUntil:state.checkpointPauseUntil};
   state.lastHealth=h;await writeJson(`${dir}/${gameId}-${phase}-${state.healthSqlRequests}-health.json`,h);await persist();
   if(!Number.isFinite(h.longestActiveSeconds)||!Number.isSafeInteger(h.ioLockWaits)||h.ioLockWaits<0)throw Error("Invalid health evidence");
   if(h.statsReset!==previous.statsReset||!Number.isSafeInteger(h.checkpointsRequested)||h.checkpointsRequested<previous.checkpointsRequested)throw Error("Checkpoint baseline invalid/reset");
   if(h.checkpointsRequested>previous.checkpointsRequested){
     state.checkpointBaseline={checkpointsRequested:h.checkpointsRequested,statsReset:h.statsReset};
     state.checkpointPauseUntil=new Date(Date.now()+180000).toISOString();state.phase="forced_checkpoint_cooldown";await persist();
     notify({status:"checkpoint_cooldown",gameId,until:state.checkpointPauseUntil});await waitUntil(Date.parse(state.checkpointPauseUntil));continue;
   }
   if(h.ioLockWaits!==0||h.longestActiveSeconds>5){
     state.healthRetryNotBefore=new Date(Date.now()+15000).toISOString();state.phase="waiting_for_contention_to_clear";await persist();
     notify({status:"contention_cooldown",gameId,waits:h.ioLockWaits,longestActiveSeconds:h.longestActiveSeconds,until:state.healthRetryNotBefore});continue;
   }
   if(scope.maximumProbeDurationMs!==null&&duration>scope.maximumProbeDurationMs)throw Error("Health latency limit exceeded");
   if(state.checkpointPauseUntil&&Date.now()<Date.parse(state.checkpointPauseUntil)){await waitUntil(Date.parse(state.checkpointPauseUntil));continue;}
   delete state.healthRetryNotBefore;return h;
  }
 }
 try{
  if(state.status!=="active"||scope.maximumProbeDurationMs!==null||scope.healthLatencyOverride?.status!=="approved_by_TJ"||scope.minimumGameSpacingSeconds!==0||scope.gameSpacingOverride?.status!=="approved_by_TJ")throw Error("Unexpected restart/override approval");
  for(const gameId of [...state.remaining].filter(id=>!(state.sourceBlocked??[]).some(game=>game.gameId===id))){
    await command("test ! -e "+dir+"/STOP-REQUESTED");
    checkTime();state.currentGame=gameId;state.phase="waiting_game_spacing";await persist();
    await waitUntil(Date.parse(state.lastWriteStartedAt)+scope.minimumGameSpacingSeconds*1000);
    if(state.databaseRestRequests+55>scope.maximumDatabaseRestRequests||state.writeRpcRequests+3>scope.maximumWriteRpcs)throw Error("Approved request budget exhausted");
    const captureHealth = await guard(gameId,"capture");
    // Game 100 stopped before writes; its preserved capture now has verified boxscore evidence.
    const beforePath = `${dir}/${gameId}${gameId===2026020100 ? "-qualified" : gameId===2026020057 ? "-source-repaired" : ""}-before.json`;
    if(gameId!==2026020100){
      state.phase="capturing";state.databaseRestRequests+=20;await persist();
      const captured=JSON.parse(await command(`node ${base}/capture-stored-repair.cjs ${gameId} ${beforePath}`));
      state.databaseRestRequests+=captured.requests-20;state.phase="preparing";await persist();
      await command(`node ${base}/prepare-stored-repair.cjs ${beforePath} ${dir}/${gameId}-prepared.json`);
      await command(`node ${base}/check-stored-current.cjs ${beforePath} ${dir}/${gameId}-prepared.json ${dir}/${gameId}-classification.json`);
    }
    const classified=JSON.parse(await command(`cat ${dir}/${gameId}-classification.json`));
    if(classified.status==="already_current_no_write"){
      state.verifiedAlreadyCurrent.push(gameId);state.remaining=state.remaining.filter(x=>x!==gameId);state.phase="already_current";await persist();
      notify({gameId,status:"already_current",repaired:state.verifiedRepaired.length,current:state.verifiedAlreadyCurrent.length,remaining:state.remaining.length});continue;
    }
    if(classified.status!=="qualified_candidate_needs_repair")throw Error("Unexpected qualification state");
    const health=Date.now()-Date.parse(captureHealth.checkedAt)<30000
      ? captureHealth : await guard(gameId,"write");
    await writeJson(`${dir}/${gameId}-health.json`,health);
    await command("test ! -e "+dir+"/STOP-REQUESTED");
    checkTime();state.phase="writing_and_verifying";state.databaseRestRequests+=35;state.writeRpcRequests+=3;await persist();
    let verified;
    try{
      verified=JSON.parse(await command(`node ${base}/apply-stored-repair.cjs ${beforePath} ${dir}/${gameId}-prepared.json ${dir}/${gameId}-journal.jsonl ${dir}/APPROVED-SCOPE.json ${dir}/${gameId}-health.json --write`));
    }catch(error){
      const py="import json,pathlib,sys\np=pathlib.Path(sys.argv[1]);j=[json.loads(x) for x in p.read_text().splitlines()] if p.exists() else [];last=j[-1] if j else {};print(json.dumps({'requests':last.get('requests',0) if not j else last.get('requests'),'writes':last.get('requestedWrites',0) if not j else last.get('requestedWrites'),'successful':sum(x['event']=='rpc_response' for x in j),'started':next((x['at'] for x in j if x['event']=='inputs_requested'),None)}))";
      const actual=JSON.parse(await command("python3 -c "+quote(py)+" "+quote(`${dir}/${gameId}-journal.jsonl`)));
      if(actual.requests!=null)state.databaseRestRequests+=actual.requests-35;
      if(actual.writes!=null)state.writeRpcRequests+=actual.writes-3;
      state.successfulWriteReceipts+=actual.successful;
      if(actual.started)state.lastWriteStartedAt=actual.started;
      throw error;
    }
    if(verified.status!=="verified"||verified.writes!==3)throw Error("Unexpected apply result");
    state.databaseRestRequests+=verified.requests-35;state.successfulWriteReceipts+=verified.writes;
    const py="import json,sys\nj=[json.loads(x) for x in open(sys.argv[1])];print(next(x['at'] for x in j if x['event']=='inputs_requested'))";
    state.lastWriteStartedAt=await command("python3 -c "+quote(py)+" "+quote(`${dir}/${gameId}-journal.jsonl`));
    state.verifiedRepaired.push(gameId);state.remaining=state.remaining.filter(x=>x!==gameId);state.phase="game_verified";await persist();
    if(state.verifiedRepaired.length%10===0){
      const note=`\n- ${state.updatedAt} step5 running: ${state.verifiedRepaired.length} repaired, ${state.verifiedAlreadyCurrent.length} already current, ${state.remaining.length} remaining; ${state.databaseRestRequests} REST/${state.writeRpcRequests} RPC attempts. Latest game ${gameId} fully readback verified. TJ approved unlimited health latency and sequential back-to-back games; contention/checkpoint gates retained.\n`;
      await command("python3 -c "+quote("import pathlib,sys\nwith pathlib.Path('tasks/diaries/2026-11-12-codex-drm-ddatv.md').open('a') as f:f.write(sys.argv[1])")+" "+quote(note));
    }
    notify({gameId,status:"verified",repaired:state.verifiedRepaired.length,current:state.verifiedAlreadyCurrent.length,remaining:state.remaining.length,writeAttempts:state.writeRpcRequests});
  }
  state.status=state.remaining.length ? "source_repairs_pending" : "all_game_checks_complete";
  state.phase=state.remaining.length ? "source-fallback-pending" : "final-inventory-pending";
  await persist();text({status:state.status,repaired:state.verifiedRepaired.length,current:state.verifiedAlreadyCurrent.length,remaining:state.remaining,requests:state.databaseRestRequests,writes:state.writeRpcRequests});
 }catch(error){
  state.status="stopped";state.error=error.message;state.stoppedAt=new Date().toISOString();await persist();text({status:"stopped",gameId:state.currentGame,phase:state.phase,error:state.error,repaired:state.verifiedRepaired.length,remaining:state.remaining.length,requests:state.databaseRestRequests,writes:state.writeRpcRequests});
 }
}
runBatch();

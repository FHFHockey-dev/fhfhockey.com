from pathlib import Path
import json,subprocess,os,uuid,datetime
F=Path(__file__).resolve().parent;P=json.loads((F/'PROPOSAL.json').read_text());S=Path(P['snapshot']);W=S/'web';E=json.loads((F/'ENVIRONMENT.json').read_text());L=Path('/private/tmp/fhfh-heavy.lock')
commands=[('iteration2-types',['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false']),('iteration2-tests',['npm','test','--','--run','--config','audit.vitest.config.mts','lib/projections/runProjectionV2.test.ts','lib/projections/runProjectionV2.alignedConversion.test.ts','lib/player-forecasts/nativeContributionAdmission.test.ts','lib/rosterScheduleData/forgeDailyBridge.test.ts','lib/rosterScheduleData/planning.test.ts','--reporter=json','--outputFile='+str(F/'iteration2-tests.json')])]
(F/'ITERATION2-COMMANDS.json').write_text(json.dumps(dict(cwd=str(W),commands=dict(commands)),indent=2)+'\n')
owner=dict(pid=os.getpid(),token=str(uuid.uuid4()),scope='unapproved composition probe with release C model preserved',thread='01a1637a-4222-70c0-8439-cb3cc46b20c4');L.mkdir();(L/'owner.json').write_text(json.dumps(owner));inode=L.stat().st_ino;results=[]
try:
 for name,cmd in commands:
  print('START '+name,flush=True)
  with (F/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=W,env=E,stdout=f,stderr=subprocess.STDOUT)
  results.append(dict(name=name,exit_code=r.returncode,ended_at=datetime.datetime.now(datetime.timezone.utc).isoformat()));(F/'ITERATION2-RESULTS.json').write_text(json.dumps(results,indent=2)+'\n');print('END '+name+' '+str(r.returncode),flush=True)
finally:
 if L.stat().st_ino==inode and json.loads((L/'owner.json').read_text())['token']==owner['token']:(L/'owner.json').unlink();L.rmdir()

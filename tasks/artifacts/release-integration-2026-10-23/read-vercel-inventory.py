from pathlib import Path
import subprocess,os,json,datetime
O=Path(__file__).resolve().parent
cli='/Users/tim/.npm/_npx/b3e0457adddfeeef/node_modules/vercel/dist/index.js'
team='team_KVFicHhQJARTbO6wRD2x6jpq'
projects=['prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw','prj_q9tnoe1pF6WAe9zPcBzBLBPZx5mQ','prj_gG8SHX7C5GbCDJoind7trh9bj6dK','prj_3X6goi9DxqUnD0sHChwEwaRakquG']
env=dict(os.environ,NO_UPDATE_NOTIFIER='1',VERCEL_TELEMETRY_DISABLED='1',CI='1')
rows=[]
for project in projects:
 cmd=['node',cli,'api','/v9/projects/'+project+'?teamId='+team,'--method','GET','--raw','--non-interactive','--scope',team]
 p=subprocess.run(cmd,cwd='/Users/tim/Code/fhfhockey.com/web',env=env,capture_output=True,text=True,timeout=45)
 if p.returncode:
  rows.append(dict(id=project,exit_code=p.returncode,status='metadata read failed; raw response withheld'));break
 try:j=json.loads(p.stdout)
 except ValueError:rows.append(dict(id=project,exit_code=p.returncode,status='non-JSON response withheld'));break
 allowed=['id','name','accountId','rootDirectory','framework','commandForIgnoringBuildStep','buildCommand','installCommand','nodeVersion','previewDeploymentsDisabled','gitProviderOptions','gitDeploymentEnabled','updatedAt']
 row={k:j[k] for k in allowed if k in j}
 link=j.get('link',{});row['link']={k:link[k] for k in ['type','repo','org','productionBranch','sourceless','createdAt','updatedAt'] if k in link}
 row['deployHookCount']=len(link.get('deployHooks',[]));row['deployHookRefs']=[r.get('ref') for r in link.get('deployHooks',[])];rows.append(row)
 print(json.dumps(row),flush=True)
(O/'VERCEL-CURRENT-INVENTORY.json').write_text(json.dumps(dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation='4 bounded GET project metadata reads; whitelisted non-secret fields only',projects=rows),indent=2)+'\n')

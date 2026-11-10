import json, os, subprocess, time
from pathlib import Path
repo=Path('/Users/tim/Code/fhfhockey.com')
out=repo/'tasks/artifacts/rso-local-loading-2026-11-10'
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']}
env.update({'TZ':'UTC','NEXT_TELEMETRY_DISABLED':'1','CI':'1',
 'NEXT_PUBLIC_SUPABASE_URL':'https://rso-fixtures.supabase.invalid','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key',
 'SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','CMS_URL':'http://127.0.0.1:3186',
 'NODE_OPTIONS':'--require='+str(repo/'tasks/artifacts/rso-daily-beta-2026-11-08/verification-harness/guard.cjs'),
 'RSO_NETWORK_LOG':str(out/'confirmation-blocked-network.log'),'PLAYWRIGHT_JSON_OUTPUT_NAME':str(out/'confirmation-browser-results.json')})
cmd=['node','node_modules/@playwright/test/cli.js','test','--config',str(out/'playwright.config.ts'),
 'e2e/rso-acceptance.spec.ts','e2e/roster-schedule-optimizer.spec.ts','e2e/rso-continuity.spec.ts','--grep','RSO inputs|provider refresh proposes',
 '--max-failures=3','--reporter=line,json','--output',str(out/'confirmation-browser-output')]
start=time.monotonic()
with (out/'confirmation-browser.log').open('w') as log: result=subprocess.run(cmd,cwd=repo/'web',env=env,stdout=log,stderr=subprocess.STDOUT)
record={'command':cmd,'exitCode':result.returncode,'seconds':round(time.monotonic()-start,2),
 'network':'Synthetic env; Node loopback-only guard; browser external abort and unmocked API denial; fresh isolated context.'}
(out/'confirmation-browser-run.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record));print('\n'.join((out/'confirmation-browser.log').read_text().splitlines()[-24:]))
raise SystemExit(result.returncode)

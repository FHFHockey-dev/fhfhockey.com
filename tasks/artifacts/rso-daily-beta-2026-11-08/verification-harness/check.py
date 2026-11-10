import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

repo = Path('/Users/tim/Code/fhfhockey.com')
artifacts = repo / 'tasks/artifacts/rso-daily-beta-2026-11-08'
candidate = json.loads((artifacts / 'CANDIDATE.json').read_text())
web = Path(candidate['exportRoot']) / 'web'
name = sys.argv[1]
env = {k: v for k, v in os.environ.items() if k in ['PATH', 'HOME', 'TMPDIR', 'LANG']}
env.update({
    'TZ': 'UTC', 'NEXT_TELEMETRY_DISABLED': '1', 'CI': '1',
    'NEXT_PUBLIC_SUPABASE_URL': 'https://rso-fixtures.supabase.invalid',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY': 'synthetic-public-key',
    'SUPABASE_SERVICE_ROLE_KEY': 'synthetic-service-role-key',
    'CMS_URL': 'http://127.0.0.1:3174',
    'NODE_OPTIONS': '--require=/tmp/rso-daily-beta-20261108-guard.cjs',
    'RSO_NETWORK_LOG': str(artifacts / (name + '-blocked-network.log')),
})
commands = {
    'regressions': ['node', 'node_modules/vitest/vitest.mjs', 'run',
        'lib/rosterScheduleOptimizer', 'lib/rosterScheduleData', 'components/RosterScheduleOptimizer',
        'hooks/useRosterPlanning.test.tsx', 'hooks/useRosterScheduleOptimizer.test.tsx',
        '__tests__/pages/roster-schedule-optimizer.test.tsx', '__tests__/pages/api/v1/roster-schedule-optimizer',
        'yahoo', 'Yahoo', 'lib/player-forecasts/contributions.test.ts',
        'lib/player-forecasts/planningContributions.test.ts', 'lib/player-forecasts/rsoUsePolicy.test.ts',
        '--maxWorkers=2', '--reporter=dot', '--reporter=json',
        '--outputFile.json=' + str(artifacts / 'regressions-results.json')],
    'types': ['node', '--max-old-space-size=8192', 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
    'lint': ['node', 'node_modules/eslint/bin/eslint.js'] + [row['path'][4:] for row in candidate['sourceFiles']],
    'browser': ['node', 'node_modules/@playwright/test/cli.js', 'test', '--config', str(web / '.rso-beta-playwright.config.ts'),
        'e2e/roster-schedule-optimizer.spec.ts', 'e2e/rso-acceptance.spec.ts', 'e2e/rso-continuity.spec.ts',
        '--workers=1', '--retries=0', '--max-failures=1', '--reporter=line,json',
        '--output', str(artifacts / 'browser-output')],
}
if name == 'browser':
    env.update({'PLAYWRIGHT_PORT':'3174', 'PLAYWRIGHT_BASE_URL':'http://127.0.0.1:3174',
                'PLAYWRIGHT_JSON_OUTPUT_NAME': str(artifacts / 'browser-results.json')})
    (web / '.rso-beta-playwright.config.ts').write_text('''import base from "./playwright.config";
export default { ...base, webServer: {
 command: "npm run dev:stable -- -H 127.0.0.1 -p 3174",
 env: { PLAYWRIGHT_ISOLATED_NEXT: "1" },
 url: "http://127.0.0.1:3174/roster-schedule-optimizer",
 reuseExistingServer: false, timeout: 120000,
} };
''')
started = datetime.now(timezone.utc).isoformat()
clock = time.monotonic()
with (artifacts / (name + '.log')).open('w') as log:
    result = subprocess.run(commands[name], cwd=web, env=env, stdout=log, stderr=subprocess.STDOUT)
record = {'name': name, 'command': commands[name], 'cwd': str(web), 'candidateTree': candidate['candidateTree'],
    'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(), 'exitCode': result.returncode,
    'durationSeconds': round(time.monotonic() - clock, 2), 'node': subprocess.check_output(['node','--version'],text=True).strip(),
    'network': 'Inert environment, no .env files, Node loopback guard; browser uses existing synthetic fixture interception.'}
(artifacts / (name + '.json')).write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
print('\n'.join((artifacts / (name + '.log')).read_text().splitlines()[-25:]))
raise SystemExit(result.returncode)

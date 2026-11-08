"""Supervised one-report invocation; no loop, retry or API implementation."""
import json, os, pathlib, subprocess, sys, time
root = pathlib.Path.cwd()
assert root.name == 'fhfhockey.com' and len(sys.argv) == 3
case, anchors = sys.argv[1:]
base = root / 'tasks/artifacts/luna-reference-package-2026-10-31'
d, frozen = base / 'diagnostic-e07-execution', base / 'diagnostic-e07-e16-r2'
assert case in json.loads((frozen / 'PLAN.json').read_text())['selectedCaseIds']
json.loads(anchors)  # Supplied by supervisor from prior tool results, never reconstructed from disk.
env = {'PATH': os.environ['PATH'], 'TMPDIR': '/tmp', 'NODE_PATH': '.:./node_modules', 'TS_NODE_COMPILER_OPTIONS': '{"module":"CommonJS","moduleResolution":"node","allowJs":false}'}
offline = dict(env, NODE_OPTIONS='--require=' + str(base / 'deny-network.cjs'))
control = ['node', '--experimental-require-module', '-r', 'ts-node/register/transpile-only', str(d / 'control.ts')]
with (d / (case + '.operator.log')).open('x') as log:
    pre = subprocess.run(control + ['preflight', case, anchors], cwd=root / 'web', env=offline, capture_output=True, text=True)
    log.write(pre.stdout + pre.stderr); log.flush()
    if pre.returncode:
        print('Preflight held; no CLI invocation.'); sys.exit(2)
    prehash = json.loads(pre.stdout)['preflightHash']
    code = -1
    start = time.monotonic()
    try:
        with (d / (case + '.cli.log')).open('x') as cli_log:
            paid_env = dict(env, NODE_OPTIONS='', IFTTT_LUNA_REVIEW_ENABLED='true', IFTTT_LUNA_REVIEW_STOP='false')
            command = ['node', '--env-file=.env.local', '--experimental-require-module', '-r', 'ts-node/register/transpile-only', 'scripts/review-ifttt-luna.ts', '--input', str(frozen / 'inputs' / (case + '.json')), '--output', str(d / (case + '.original.json')), '--binding-candidate-output', str(d / (case + '.candidate.json')), '--ledger', str(base / 'paid-evaluation/ledger.json'), '--dispatch']
            code = subprocess.run(command, cwd=root / 'web', env=paid_env, stdout=cli_log, stderr=subprocess.STDOUT).returncode
    finally:
        grade = subprocess.run(control + ['grade', case, anchors, str(code), prehash], cwd=root / 'web', env=offline, capture_output=True, text=True)
        log.write(grade.stdout + grade.stderr); log.flush()
        if grade.returncode:
            subprocess.run(control + ['stop'], cwd=root / 'web', env=offline, stdout=log, stderr=subprocess.STDOUT, check=True)
        with (d / (case + '.time.json')).open('x') as out:
            json.dump({'caseId': case, 'cliExitCode': code, 'gradingExitCode': grade.returncode, 'wallSeconds': round(time.monotonic() - start, 3), 'automaticRetry': False}, out, indent=2)
            out.write('\n')
    print(grade.stdout.strip() or 'Diagnostic stopped; inspect retained evidence.'); sys.exit(grade.returncode)

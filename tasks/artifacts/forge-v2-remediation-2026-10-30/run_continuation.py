"""Run bounded, local-only preparation checks with retained exit receipts."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from uuid import uuid4

directory = Path(__file__).resolve().parent
root = directory.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('check', choices=['intake', 'chronology', 'capacity', 'types'])
args = parser.parse_args()
lock = Path('/private/tmp/fhfh-heavy.lock')
lock.mkdir()  # Refuse occupied shared resources; never remove another owner's lock.
owner = lock / 'forge-continuation-owner.json'
owner.write_text(json.dumps({'pid': os.getpid(), 'check': args.check, 'scope': 'synthetic only'}))
env = os.environ.copy()
env['PYTHONDONTWRITEBYTECODE'] = '1'
log = directory / ('continuation-' + args.check + '.txt')
commands = []
result_code = 1
run_id = str(uuid4())
receipt_path = directory / ('continuation-' + args.check + '-receipt.json')
receipt_path.write_text(json.dumps({'check': args.check, 'runId': run_id, 'startedAt': datetime.now(timezone.utc).isoformat(), 'status': 'running', 'exit': None}, indent=2) + '\n')
error_kind = None
try:
    with log.open('w') as output:
        if args.check == 'intake':
            commands = [['python3', '-m', 'unittest', '-v', 'test_intake_check.py']]
            result_code = subprocess.run(commands[0], cwd=directory, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=30).returncode
        elif args.check == 'types':
            with tempfile.TemporaryDirectory(prefix='forge-continuation-types-') as scratch:
                config = Path(scratch) / 'tsconfig.json'
                config.write_text(json.dumps({'extends': str(root / 'web/tsconfig.json'), 'compilerOptions': {'incremental': False, 'paths': {'pg': [str(root / 'web/node_modules/@types/pg/index.d.ts')]}}, 'include': [str(root / 'web/next-bootstrap.d.ts'), str(directory / 'chronology-check.ts'), str(directory / 'capacity-check.ts')], 'exclude': [str(root / 'web/node_modules')]}))
                commands = [[str(root / 'web/node_modules/.bin/tsc'), '--noEmit', '--project', str(config)]]
                result_code = subprocess.run(commands[0], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=60).returncode
        else:
            assert subprocess.check_output(['node', '--version'], text=True).strip() == 'v22.11.0'
            with tempfile.TemporaryDirectory(prefix='forge-continuation-') as scratch:
                bundle = str(Path(scratch) / 'check.cjs')
                commands = [[str(root / 'web/node_modules/.bin/esbuild'), str(directory / (args.check + '-check.ts')), '--bundle', '--platform=node', '--format=cjs', '--external:pg', '--outfile=' + bundle], ['node', bundle]]
                subprocess.run(commands[0], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=30, check=True)
                env['NODE_PATH'] = str(root / 'web/node_modules')
                env['FORGE_FIXTURE_ROOT'] = str(root)
                result_code = subprocess.run(commands[1], cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=120).returncode
except Exception as error:
    error_kind = type(error).__name__
    with log.open('a') as output:
        output.write('\nRunner failed: ' + error_kind + '\n')
finally:
    receipt = {'check': args.check, 'runId': run_id, 'exit': result_code, 'status': 'passed' if result_code == 0 else 'failed', 'errorKind': error_kind, 'commands': commands, 'log': log.name, 'logSha256': hashlib.sha256(log.read_bytes()).hexdigest(), 'scientificallyQualified': False, 'remoteActions': 0}
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    owner.unlink()
    lock.rmdir()
print(log.read_text()[-15000:])
print(json.dumps(receipt))
raise SystemExit(result_code)

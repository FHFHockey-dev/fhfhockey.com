"""Bounded Unity run for Q2 v22 that also honours the shared heavy-work lock used by the Codex lanes."""
from pathlib import Path
import argparse, datetime, json, os, signal, subprocess, time, uuid
parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True); parser.add_argument('--cwd', required=True); parser.add_argument('--timeout', type=int, default=600)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ['--'] else args.command
root = Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v23/evidence')
lock = Path('/private/tmp/fhfh-heavy.lock'); token = str(uuid.uuid4())
try: lock.mkdir()
except FileExistsError:
    print('HEAVY_RESOURCE_BUSY; existing lock preserved: ' + ((lock / 'owner.json').read_text() if (lock / 'owner.json').exists() else '?')); raise SystemExit(4)
(lock / 'owner.json').write_text(json.dumps({'owner': 'Claude Q2 v23', 'pid': os.getpid(), 'token': token, 'name': args.name, 'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat()}))
start = time.monotonic(); started = datetime.datetime.now(datetime.timezone.utc).isoformat(); timed_out = False
env = os.environ.copy(); env['DOTNET_PROCESSOR_COUNT'] = '2'; env['JAVA_TOOL_OPTIONS'] = '-XX:ActiveProcessorCount=2'
try:
    with (root / (args.name + '-launcher.log')).open('w') as stream:
        process = subprocess.Popen(command, cwd=args.cwd, env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try: code = process.wait(timeout=args.timeout)
        except subprocess.TimeoutExpired:
            timed_out = True; os.killpg(process.pid, signal.SIGTERM)
            try: code = process.wait(timeout=10)
            except subprocess.TimeoutExpired: os.killpg(process.pid, signal.SIGKILL); code = process.wait()
finally:
    o = lock / 'owner.json'
    if o.exists() and json.loads(o.read_text()).get('token') == token: o.unlink(); lock.rmdir()
receipt = {'startedUtc': started, 'finishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': command, 'cwd': args.cwd,
           'exitCode': code, 'timedOut': timed_out, 'seconds': round(time.monotonic() - start, 2), 'heavyLock': 'acquired and released (Claude Q2 v23)'}
(root / (args.name + '-execution.json')).write_text(json.dumps(receipt, indent=2)); print(json.dumps(receipt))
raise SystemExit(code if code >= 0 else 128 - code)

"""Run only this task's explicit command with a time limit and a durable receipt."""
from pathlib import Path
import argparse
import datetime
import json
import os
import signal
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
parser.add_argument('--cwd', required=True)
parser.add_argument('--timeout', type=int, default=600)
parser.add_argument('command', nargs=argparse.REMAINDER)
args = parser.parse_args()
command = args.command[1:] if args.command[:1] == ['--'] else args.command
root = Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2/v16/evidence')
start = time.monotonic()
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
timed_out = False
env = os.environ.copy()
env['DOTNET_PROCESSOR_COUNT'] = '2'
env['JAVA_TOOL_OPTIONS'] = '-XX:ActiveProcessorCount=2'
with (root / (args.name + '-launcher.log')).open('w') as stream:
    process = subprocess.Popen(command, cwd=args.cwd, env=env, stdout=stream,
                               stderr=subprocess.STDOUT, start_new_session=True)
    try:
        code = process.wait(timeout=args.timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try:
            code = process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            code = process.wait()
receipt = {'startedUtc': started,
           'finishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'command': command, 'cwd': args.cwd, 'exitCode': code,
           'timedOut': timed_out, 'seconds': round(time.monotonic() - start, 2),
           'processCountHints': {'DOTNET_PROCESSOR_COUNT': '2', 'JAVA_TOOL_OPTIONS': '-XX:ActiveProcessorCount=2'}}
receipt['tempDirectory'] = env.get('TMPDIR')
(root / (args.name + '-execution.json')).write_text(json.dumps(receipt, indent=2))
print(json.dumps(receipt))
raise SystemExit(code if code >= 0 else 128 - code)

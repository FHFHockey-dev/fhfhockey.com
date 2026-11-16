"""R4: launcher-1118 does not refuse when the 11-17 launcher's lock exists (only its own lock name is checked).
Everything is fake: env file, clock, temp dir/ledger, G3 and execve (recorded, never called). Never web/.env.local.
Run: /usr/bin/python3 -I r4-launcher1118-ignores-1117-lock.py <new scratch dir>"""
import datetime, importlib.util, os, sys
sys.dont_write_bytecode = True  # never leave __pycache__ in the operator lane folder
S = os.path.abspath(sys.argv[1]); os.makedirs(S)
L_PATH = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher-1118.py"
spec = importlib.util.spec_from_file_location("l1118", L_PATH); L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
att = os.path.join(S, "attestation"); os.makedirs(att)
open(os.path.join(att, "launcher-20261117T1405Z.lock"), "w").write('{"pid":1,"takenAtUTC":"2026-11-17T14:03:30Z"}\n')  # 11-17 attempt happened
envf = os.path.join(S, "fake.env"); fd = os.open(envf, os.O_WRONLY | os.O_CREAT, 0o600)
os.write(fd, b"NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co\nNST_KEY=fake-a\nSUPABASE_SERVICE_ROLE_KEY=fake-b\n"); os.close(fd)
rcpt = os.path.join(S, "receipt.json"); fd = os.open(rcpt, os.O_WRONLY | os.O_CREAT, 0o600); os.write(fd, b"{}"); os.close(fd)
tmp = os.path.join(S, "usertmp") + "/"; os.makedirs(os.path.join(tmp, "fhfhockey-nst-budget-%d" % os.getuid()))
t = [datetime.datetime(2026, 11, 18, 14, 4, tzinfo=datetime.timezone.utc)]
def sleep(s): t[0] += datetime.timedelta(seconds=s)
calls = []
try:
    L.launch(rcpt, own_env={}, env_file=envf, web=S, node="/nonexistent-node", now=lambda: t[0], sleep=sleep, user_temp_dir=lambda: tmp,
             g3=lambda log: None, execve=lambda path, argv, env: calls.append(path), log=lambda o: None, launcher_sha256="r4",
             lock_path=os.path.join(att, "launcher-20261118T1405Z.lock"))
except L.Refuse as r:
    print("refused:", r)
print("11-17 lock present:", os.path.exists(os.path.join(att, "launcher-20261117T1405Z.lock")), "| execve calls:", len(calls))
print("RESULT:", "GAP (launcher-1118 would exec despite an 11-17 lock)" if calls else "refused")

# RECHECK-9 seam probes for nst-pilot-launcher.py 31c370c3: env-file hygiene and the O_EXCL lock, via launch()'s own
# seams (fake clock, fake env file, scratch lock path, recording execve, fake G3). Offline; never web/.env.local or node.
# Usage: /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I seam-probes.py <scratch>
import datetime, importlib.util, json, os, sys
S = os.path.abspath(sys.argv[1]); os.makedirs(S, exist_ok=True)
spec = importlib.util.spec_from_file_location("L", "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py")
L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
UTC = datetime.timezone.utc
tmp = os.path.join(S, "usertmp") + "/"; os.makedirs(tmp + "fhfhockey-nst-budget-%d" % os.getuid(), exist_ok=True)
rec = os.path.join(S, "receipt.json"); open(rec, "w").write("{}\n"); os.chmod(rec, 0o600)
GOOD = "NEXT_PUBLIC_SUPABASE_URL=%s\nNST_KEY=fakeNSTvalue123\nSUPABASE_SERVICE_ROLE_KEY=fakeSRKvalue456\n" % L.ORIGIN
def envfile(name, mode=0o600, text=GOOD):
    p = os.path.join(S, name); open(p, "w").write(text); os.chmod(p, mode); return p
def run(name, env_path, lock_path, start=(14, 4, 0), opened=None):
    clock = {"t": datetime.datetime(2026, 11, 17, *start, tzinfo=UTC)}
    calls, logs = [], []
    real_read = L.read_private_env_file
    def spy(p):
        if opened is not None: opened.append((p, os.path.exists(lock_path)))
        return real_read(p)
    L.read_private_env_file = spy
    try:
        L.launch(rec, own_env={}, env_file=env_path, web=S, node="/nonexistent-node", now=lambda: clock["t"],
                 sleep=lambda s: clock.__setitem__("t", clock["t"] + datetime.timedelta(seconds=s)), user_temp_dir=lambda: tmp,
                 g3=lambda log: clock.__setitem__("t", clock["t"] + datetime.timedelta(seconds=1)),
                 execve=lambda path, argv, env: calls.append(1) or (_ for _ in ()).throw(SystemExit()), log=logs.append,
                 launcher_sha256="probe", lock_path=lock_path)
    except L.Refuse as r: out = "refuse:" + str(r)
    except SystemExit: out = "exec"
    finally: L.read_private_env_file = real_read
    leaked = any(v in json.dumps(logs) + out for v in ("fakeNSTvalue123", "fakeSRKvalue456"))
    print(json.dumps({"case": name, "result": out, "execveCalls": len(calls), "lockExistsAfter": os.path.lexists(lock_path), "valueInLogs": leaked,
                      **({"envReadSawLock": [x[1] for x in opened]} if opened is not None else {})}))
lockdir = os.path.join(S, "attestation"); os.makedirs(lockdir, exist_ok=True)
n = [0]
def fresh(): n[0] += 1; return os.path.join(lockdir, "lock-%d" % n[0])
good = envfile("good.env")
seen = []; run("happy_lock_before_env_read", good, fresh(), opened=seen)
run("env_0644", envfile("m644.env", 0o644), fresh())
run("env_0640", envfile("m640.env", 0o640), fresh())
link = os.path.join(S, "link.env"); os.path.lexists(link) or os.symlink(good, link); run("env_symlink", link, fresh())
fifo = os.path.join(S, "fifo.env"); os.path.exists(fifo) or os.mkfifo(fifo, 0o600); run("env_fifo_no_hang", fifo, fresh())
d = os.path.join(S, "dir.env"); os.makedirs(d, exist_ok=True); os.chmod(d, 0o700); run("env_directory", d, fresh())
hl = os.path.join(S, "hardlink.env"); os.path.exists(hl) or os.link(good, hl); run("env_hardlink_private (accepted)", hl, fresh())
run("env_missing", os.path.join(S, "absent.env"), fresh())
L1 = fresh(); run("first_launcher", good, L1); run("second_launcher_same_lock", good, L1)
L2 = fresh(); run("first_refuses_on_env (lock still taken)", envfile("bad.env", 0o644), L2); run("then_good_env_same_lock", good, L2)
L3 = fresh(); os.symlink(os.path.join(S, "elsewhere"), L3); run("lock_path_is_planted_symlink", good, L3); print(json.dumps({"symlinkTargetCreated": os.path.exists(os.path.join(S, "elsewhere"))}))
run("lock_dir_missing", good, os.path.join(S, "no-attestation-dir", "lock"))
L4 = fresh(); run("outside_window_takes_no_lock", good, L4, start=(14, 5, 0))

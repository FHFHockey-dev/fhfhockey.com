# RECHECK-8 edge probes for nst-pilot-launcher.py through its own test seams (fake clock, fake env file, recording execve,
# fake G3). Offline; never web/.env.local, never node, never the bootstrap. Usage: /usr/bin/python3 -I edge-probes.py <scratch>
import datetime, importlib.util, json, os, sys
S = os.path.abspath(sys.argv[1]); os.makedirs(S, exist_ok=True)
spec = importlib.util.spec_from_file_location("L", "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py")
L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
UTC = datetime.timezone.utc
tmp = os.path.join(S, "usertmp") + "/"; os.makedirs(tmp + "fhfhockey-nst-budget-%d" % os.getuid(), exist_ok=True)
rec = os.path.join(S, "receipt.json"); open(rec, "w").write("{}\n"); os.chmod(rec, 0o600)
GOOD = "NEXT_PUBLIC_SUPABASE_URL=%s\nNST_KEY=fakeNSTvalue123\nSUPABASE_SERVICE_ROLE_KEY=fakeSRKvalue456\n" % L.ORIGIN
def run(name, text=GOOD, start=(14, 4, 0), g3_secs=1.0, after_wake=None, env_path=None, own_env=None):
    p = env_path or os.path.join(S, name + ".env")
    if env_path is None: open(p, "w", newline="").write(text)
    clock = {"t": datetime.datetime(2026, 11, 17, *start, tzinfo=UTC)}
    def sleep(s): clock["t"] += datetime.timedelta(seconds=s)
    def g3(log): clock["t"] = (after_wake or clock["t"]) + datetime.timedelta(seconds=g3_secs)
    calls, logs = [], []
    try:
        L.launch(rec, own_env=own_env or {}, env_file=p, web=S, node="/nonexistent-node", now=lambda: clock["t"], sleep=sleep,
                 user_temp_dir=lambda: tmp, g3=g3, execve=lambda path, argv, env: calls.append(sorted(env)) or (_ for _ in ()).throw(SystemExit("exec")),
                 log=logs.append, launcher_sha256="probe")
    except L.Refuse as r: out = "refuse:" + str(r)
    except SystemExit: out = "exec(envKeys=%d)" % len(calls[0])
    leaked = any(v in json.dumps(logs) + out for v in ("fakeNSTvalue123", "fakeSRKvalue456"))
    print(json.dumps({"case": name, "result": out, "execveCalls": len(calls), "valueInLogs": leaked}))
w = datetime.datetime(2026, 11, 17, 14, 5, 0, tzinfo=UTC)
run("exec_at_14:05:49.999", after_wake=w + datetime.timedelta(seconds=48.999))
run("exec_at_14:05:50.000", after_wake=w + datetime.timedelta(seconds=49))
run("start_14:04:59.999", start=(14, 4, 59, 999000))
run("start_14:05:00.000", start=(14, 5, 0))
run("export_DYLD_in_file", GOOD + "export DYLD_INSERT_LIBRARIES=/tmp/x.dylib\n")
run("spaced_DYLD_in_file", GOOD + "  DYLD_LIBRARY_PATH = /tmp \n")
run("lowercase_dyld_in_file", GOOD + "dyld_insert_libraries=/tmp/x\n")
run("NODE_OPTIONS_in_file_dropped", GOOD + "NODE_OPTIONS=--require /tmp/evil.js\n")
run("CRLF_file", GOOD.replace("\n", "\r\n"))
run("url_trailing_slash", GOOD.replace(L.ORIGIN, L.ORIGIN + "/"))
run("hash_without_space_in_value", GOOD.replace("fakeNSTvalue123", "fakeNST#value123"))
run("duplicate_NST_KEY", GOOD + "NST_KEY=other\n")
os.symlink(os.path.join(S, "CRLF_file.env"), os.path.join(S, "symlinked.env"), ) if not os.path.exists(os.path.join(S, "symlinked.env")) else None
run("env_file_is_symlink", env_path=os.path.join(S, "symlinked.env"))
os.chmod(os.path.join(S, "CRLF_file.env"), 0o644); run("env_file_mode_0644", env_path=os.path.join(S, "CRLF_file.env"))
run("own_env_DYLD", own_env={"DYLD_INSERT_LIBRARIES": "/tmp/x"})

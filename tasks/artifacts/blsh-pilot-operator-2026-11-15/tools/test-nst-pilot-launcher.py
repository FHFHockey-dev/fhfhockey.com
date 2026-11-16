"""Offline tests for nst-pilot-launcher.py. No credentials, no network, never the real bootstrap --run, never web/.env.local.
Run:  /usr/bin/python3 -I test-nst-pilot-launcher.py <scratch dir>
Each case runs a driver in its own process. The driver imports the launcher and calls launch() with a fake env file,
a fake clock, a fake user temp dir (with or without a ledger dir), a fake web dir and a STUB as the execve target. The
stub prints only argv, cwd, env key NAMES and sha256 digests of the three file values. Two cases run the driver through
real interpreters to test the DYLD rule end to end; one case runs the real pinned G3 (credential-free) on canonical web/.
Exits 1 if any case does not behave as expected, or if a fake secret appears anywhere in any output.
"""
# RECHECK-11 B1: hard date guard, checked FIRST. On a slot date (2026-11-17 or 2026-11-18 UTC) this suite could put a
# real launcher inside its window; it refuses to run at all (RUNBOOK rule: no rehearsal or suite on a slot date).
import datetime as _guard_dt, sys as _guard_sys
if _guard_dt.datetime.now(_guard_dt.timezone.utc).strftime("%Y-%m-%d") in ("2026-11-17", "2026-11-18"):
    _guard_sys.stdout.write("REFUSE: slot date (UTC 2026-11-17/18): the launcher suite never runs on a slot date\n")
    _guard_sys.exit(3)
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Optional 2nd argument "1118": test the 2026-11-18 fallback launcher (same code; date, lock name, G3 baseline pin).
VARIANT = sys.argv[2] if len(sys.argv) > 2 else "1117"
assert VARIANT in ("1117", "1118"), "variant must be 1117 or 1118"
DAYNUM = 17 if VARIANT == "1117" else 18
DAY, OTHER_DAY = "2026-11-%d" % DAYNUM, "2026-11-%d" % (35 - DAYNUM)
LAUNCHER = os.path.join(HERE, "nst-pilot-launcher.py" if VARIANT == "1117" else "nst-pilot-launcher-1118.py")
BASELINE_PIN = {"1117": "4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3",
                "1118": "e9c7ec5a8afc627c231331a7c7ace6488064ee414244947a078325b7a4ccd7e9"}[VARIANT]
LOCK_NAME = "launcher-202611%dT1405Z.lock" % DAYNUM
S = os.path.abspath(sys.argv[1])
os.makedirs(S, exist_ok=True)
# Scratch seam (RECHECK-11 B1): every case that runs the launcher as a real script runs a scratch COPY whose only two
# changed lines are ENV_FILE and LOCK_PATH, pointed into scratch. No case ever uses the real LOCK_PATH or ENV_FILE.
REAL_ENV = "/Users/tim/Code/fhfhockey.com/web/.env.local"
REAL_ATTESTATION = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation"
SEAM_ENV = os.path.join(S, "seam", ".env.local")
SEAM_LOCK = os.path.join(S, "seam", "lock", "launcher.lock")
_src = open(LAUNCHER).read()
_env_line = 'ENV_FILE = os.path.join(WEB, ".env.local")'
_lock_line = 'LOCK_PATH = os.path.join(os.path.dirname(TOOLS), "attestation", "launcher-202611%dT1405Z.lock")' % (17 if VARIANT == "1117" else 18)
assert _src.count(_env_line) == 1 and _src.count(_lock_line) == 1
_copy = _src.replace(_env_line, "ENV_FILE = %r  # TEST SEAM" % SEAM_ENV).replace(_lock_line, "LOCK_PATH = %r  # TEST SEAM" % SEAM_LOCK)
assert sum(1 for a, b in zip(_src.split("\n"), _copy.split("\n")) if a != b) == 2 and len(_src.split("\n")) == len(_copy.split("\n"))
SCRIPT_COPY = os.path.join(S, "launcher-seam-copy.py")
open(SCRIPT_COPY, "w").write(_copy)
STUB_PY = "/usr/bin/python3"
CLT_PY = "/Library/Developer/CommandLineTools/usr/bin/python3"
SECRET_NST = "fake-nst-0f9e8d7c6b5a4f3e2d1c"
SECRET_SRK = "fake-srk-a1b2c3d4e5f6a7b8c9d0"
ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co"
os.makedirs(S, exist_ok=True)
STUB = os.path.join(S, "stub-node")
with open(STUB, "w") as h:
    # A node script, not python: the /usr/bin/python3 xcrun shim injects CPATH, SDKROOT, LC_CTYPE, ... into its own env,
    # which would hide what the launcher actually passed. node adds nothing.
    h.write("""#!/usr/local/bin/node
const c = require("node:crypto"), d = v => c.createHash("sha256").update(v).digest("hex");
const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NST_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(k => k in process.env);
console.log(JSON.stringify({ stub: true, argv: [process.argv[1], ...process.argv.slice(2)], cwd: process.cwd(),
  envKeys: Object.keys(process.env).sort(), digests: Object.fromEntries(keys.map(k => [k, d(process.env[k])])), TMPDIR: process.env.TMPDIR ?? null }));
""")
os.chmod(STUB, 0o755)
FAKE_WEB = os.path.join(S, "web"); os.makedirs(FAKE_WEB, exist_ok=True)
TMP_OK = os.path.join(S, "usertmp-ok") + "/"; os.makedirs(os.path.join(TMP_OK, "fhfhockey-nst-budget-%d" % os.getuid()), exist_ok=True)
TMP_NOLEDGER = os.path.join(S, "usertmp-noledger") + "/"; os.makedirs(TMP_NOLEDGER, exist_ok=True)
RECEIPT = os.path.join(S, "receipt.json"); open(RECEIPT, "w").write("{}\n"); os.chmod(RECEIPT, 0o600)
RECEIPT_644 = os.path.join(S, "receipt-644.json"); open(RECEIPT_644, "w").write("{}\n"); os.chmod(RECEIPT_644, 0o644)
GOOD = "NEXT_PUBLIC_SUPABASE_URL=%s\nNST_KEY=%s\nexport SUPABASE_SERVICE_ROLE_KEY=\"%s\"\n" % (ORIGIN, SECRET_NST, SECRET_SRK)
EXTRAS = "# comment\nOTHER_KEY=x\nNODE_OPTIONS=--inspect\nHTTPS_PROXY=http://p\nNODE_USE_SYSTEM_CA=1\nOPENSSL_CONF=/dev/null\nTS_NODE_PROJECT=x\n"

DRIVER = r"""
import datetime, importlib.util, json, os, sys
cfg = json.loads(sys.argv[1])
spec = importlib.util.spec_from_file_location("launcher", cfg["launcher"]); L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
UTC = datetime.timezone.utc
class Clock:
    def __init__(self, iso): self.t = datetime.datetime.fromisoformat(iso).replace(tzinfo=UTC); self.slept = 0.0
    def now(self): return self.t
    def sleep(self, s): self.t += datetime.timedelta(seconds=s); self.slept += s
clock = Clock(cfg["start"])
def log(o): print(json.dumps(o, sort_keys=True), flush=True)
def fake_g3(log_):
    clock.t += datetime.timedelta(seconds=cfg.get("g3_seconds", 1))
    log_({"launcher": "g3", "fake": True, "result": cfg.get("g3", "match")})
    if cfg.get("g3", "match") != "match": raise L.Refuse("g3_not_match")
for k, v in cfg.get("patch", {}).items(): setattr(L, k, v)
calls = []
def execve(path, argv, env):
    calls.append(path); log({"driver": "execve_called", "count": len(calls), "sleptSeconds": clock.slept, "clockAtExec": clock.t.isoformat(), "envKeysPassed": sorted(env)})
    os.execve(path, argv, env)
own_env = dict(os.environ) if cfg.get("real_env") else cfg.get("own_env", {"PATH": "/usr/bin:/bin"})
try:
    L.launch(cfg["receipt"], own_env=own_env, env_file=cfg["env_file"], web=cfg["web"], node=cfg["node"], now=clock.now,
             sleep=clock.sleep, user_temp_dir=lambda: cfg["usertmp"], g3=(L.default_g3 if cfg.get("real_g3") else fake_g3),
             execve=execve, log=log, launcher_sha256="test", lock_path=cfg["lock"])
except L.Refuse as r:
    log({"launcher": "refuse", "code": str(r), "execveCalls": len(calls)}); sys.exit(2)
except Exception as e:
    log({"launcher": "refuse", "code": "unexpected_" + type(e).__name__, "execveCalls": len(calls)}); sys.exit(2)
"""

results, fails, all_output = [], 0, []


lines_case_name = [None]


def case(name, env_text=GOOD, start=DAY + "T14:04:00", expect=None, interp=STUB_PY, proc_env=None, **cfg):
    global fails
    lines_case_name[0] = name
    env_file = os.path.join(S, name + ".env")
    open(env_file, "w").write(env_text)
    os.chmod(env_file, 0o600)  # the launcher now refuses a group/other-readable env file
    conf = {"launcher": LAUNCHER, "env_file": env_file, "web": FAKE_WEB, "node": STUB, "receipt": RECEIPT,
            "usertmp": TMP_OK, "start": start, "lock": os.path.join(S, name + ".lock")}
    conf.update(cfg)
    assert os.path.abspath(conf["env_file"]) != REAL_ENV and not os.path.abspath(conf["lock"]).startswith(REAL_ATTESTATION), "real path in a test case"
    p = subprocess.run([interp, "-I", "-c", DRIVER, json.dumps(conf)], env=proc_env or {"PATH": "/usr/bin:/bin"},
                       capture_output=True, text=True, timeout=120)
    out = p.stdout + p.stderr
    all_output.append(out)
    lines = [json.loads(l) for l in p.stdout.splitlines() if l.startswith("{")]
    ok, why = expect(lines, p)
    leaked = SECRET_NST in out or SECRET_SRK in out
    if leaked:
        ok, why = False, why + " SECRET LEAKED"
    if not ok:
        fails += 1
    print(("PASS" if ok else "FAIL") + " [%s] %s" % (name, why))
    results.append({"case": name, "pass": ok, "detail": why, "exit": p.returncode})


def refused(code):
    def check(lines, p):
        r = [l for l in lines if l.get("launcher") == "refuse"]
        stub = [l for l in lines if l.get("stub")]
        ok = p.returncode == 2 and len(r) == 1 and r[0]["code"].startswith(code) and not stub and r[0].get("execveCalls", 0) == 0
        return ok, "refuse %s (exit %s, execve calls %s)" % (r[0]["code"] if r else None, p.returncode, r[0].get("execveCalls") if r else None)
    return check


ALLOW = sorted(["PATH", "TMPDIR", "NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS",
                "NEXT_PUBLIC_SUPABASE_URL", "NST_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
d = lambda v: hashlib.sha256(v.encode()).hexdigest()


def executed(extra=None):
    def check(lines, p):
        stub = [l for l in lines if l.get("stub")]
        ex = [l for l in lines if l.get("launcher") == "exec"]
        calls = [l for l in lines if l.get("driver") == "execve_called"]
        if len(stub) != 1 or len(ex) != 1 or len(calls) != 1:
            return False, "no single exec (stub %d, exec %d, calls %d, exit %s): %s" % (len(stub), len(ex), len(calls), p.returncode, p.stdout[-300:])
        s = stub[0]
        want_argv = [STUB, "--require", "./node_modules/ts-node/register/transpile-only", "scripts/blsh/nativeProcessCaptureBootstrap.ts", "--run", RECEIPT]
        checks = {
            "argv": s["argv"] == want_argv,
            "cwd": os.path.realpath(s["cwd"]) == os.path.realpath(FAKE_WEB),
            # exactly the allowlist reaches execve; inside node, CoreFoundation adds __CF_USER_TEXT_ENCODING itself
            "envKeysPassed": calls[0]["envKeysPassed"] == ALLOW,
            "envKeys": s["envKeys"] == sorted(ALLOW + ["__CF_USER_TEXT_ENCODING"]),
            "TMPDIR": s["TMPDIR"] == TMP_OK,
            "values": s["digests"] == {"NEXT_PUBLIC_SUPABASE_URL": d(ORIGIN), "NST_KEY": d(SECRET_NST), "SUPABASE_SERVICE_ROLE_KEY": d(SECRET_SRK)},
            "execLogKeys": ex[0]["envKeys"] == ALLOW and ex[0]["dyldKeysPresent"] is False,
            "execLogPython": ex[0]["pythonIsolated"] is True and ex[0]["pythonExecutable"] == CLT_PY,
            "lockTaken": json.load(open(os.path.join(S, lines_case_name[0] + ".lock"))).keys() == {"pid", "takenAtUTC"},
            "wokeAfter140505": calls[0]["clockAtExec"] >= DAY + "T14:05:05",
        }
        if extra:
            checks.update(extra(lines, s))
        bad = [k for k, v in checks.items() if not v]
        return not bad, "exec once; argv/cwd/env allowlist/values ok; slept %.0fs; exec at %s%s" % (
            calls[0]["sleptSeconds"], calls[0]["clockAtExec"], (" BAD:" + ",".join(bad)) if bad else "")
    return check


# --- happy paths ---
case("happy", expect=executed())
case("extra-keys-dropped", env_text=EXTRAS + GOOD + "ANOTHER=1\n", expect=executed())
case("window-open-edge", start=DAY + "T14:03:00", expect=executed())
if VARIANT == "1117":
    case("real-g3-canonical", real_g3=True, proc_env={"PATH": "/usr/bin:/bin", "TMPDIR": S + "/"}, expect=executed(lambda lines, s: {
        "g3match": any(l.get("launcher") == "g3" and '"dependencyTree":"match"' in l.get("stdout", "") and '"uncovered":[]' in l.get("stdout", "") for l in lines)}))
else:  # canonical web/ carries the v5 bootstrap until FALLBACK.patch is applied
    case("real-g3-canonical-refuses-v5-tree", real_g3=True, proc_env={"PATH": "/usr/bin:/bin", "TMPDIR": S + "/"}, expect=refused("g3_not_match"))
# --- refusals ---
case("lifecycle-in-file-false", env_text=GOOD + "NST_JOB_LIFECYCLE_ENABLED=false\n", expect=refused("lifecycle_key_in_env_file"))
case("lifecycle-in-file-true", env_text=GOOD + "NST_JOB_LIFECYCLE_ENABLED=true\n", expect=refused("lifecycle_key_in_env_file"))
case("lifecycle-in-own-env", own_env={"PATH": "/usr/bin:/bin", "NST_JOB_LIFECYCLE_ENABLED": "false"}, expect=refused("lifecycle_key_in_launcher_env"))
case("dyld-in-own-env", own_env={"PATH": "/usr/bin:/bin", "DYLD_INSERT_LIBRARIES": "/x.dylib"}, expect=refused("dyld_key_in_launcher_env:DYLD_INSERT_LIBRARIES"))
case("dyld-in-file", env_text=GOOD + "export DYLD_FRAMEWORK_PATH=/x\n", expect=refused("dyld_key_in_env_file:DYLD_FRAMEWORK_PATH"))
case("duplicate-key", env_text=GOOD + "NST_KEY=other-value-xyz\n", expect=refused("duplicate_key_in_env_file:NST_KEY"))
case("missing-key", env_text="NEXT_PUBLIC_SUPABASE_URL=%s\nNST_KEY=%s\n" % (ORIGIN, SECRET_NST), expect=refused("missing_or_empty_key:SUPABASE_SERVICE_ROLE_KEY"))
case("empty-key", env_text=GOOD.replace("NST_KEY=" + SECRET_NST, "NST_KEY="), expect=refused("missing_or_empty_key:NST_KEY"))
case("origin-mismatch", env_text=GOOD.replace(ORIGIN, "https://evil.supabase.co"), expect=refused("supabase_origin_not_pinned"))
case("inline-comment-value", env_text=GOOD.replace("NST_KEY=" + SECRET_NST, "NST_KEY=" + SECRET_NST + " # note"), expect=refused("value_shape_suspect:NST_KEY"))
case("before-window", start=DAY + "T14:02:59", expect=refused("outside_start_window"))
case("at-window-close", start=DAY + "T14:05:00", expect=refused("outside_start_window"))
case("wrong-day", start=OTHER_DAY + "T14:04:00", expect=refused("outside_start_window"))
case("g3-slow-misses-exec-window", g3_seconds=50, expect=refused("outside_exec_window"))
case("g3-refuses", g3="refuse", expect=refused("g3_not_match"))
case("g3-tool-pin-mismatch", real_g3=True, proc_env={"PATH": "/usr/bin:/bin", "TMPDIR": S + "/"}, patch={"G3_TOOL_SHA256": "0" * 64}, expect=refused("g3_tool_not_pinned"))
case("receipt-mode-644", receipt=RECEIPT_644, expect=refused("receipt_not_private_regular_file"))
case("receipt-relative", receipt="receipt.json", expect=refused("receipt_path_not_absolute"))
case("receipt-missing", receipt=os.path.join(S, "absent.json"), expect=refused("receipt_missing"))
case("ledger-missing", usertmp=TMP_NOLEDGER, expect=refused("nst_ledger_dir_missing"))
case("execve-fails-once", node=os.path.join(S, "no-such-node"), expect=lambda lines, p: (
    p.returncode == 2 and sum(1 for l in lines if l.get("driver") == "execve_called") == 1
    and any(l.get("launcher") == "refuse" and l["code"] == "unexpected_FileNotFoundError" for l in lines),
    "one execve attempt, then refuse (no retry)"))
# --- real interpreters: the DYLD rule end to end ---
case("real-env-clt-python-sees-dyld", interp=CLT_PY, real_env=True, proc_env={"PATH": "/usr/bin:/bin", "DYLD_PRINT_LIBRARIES": "1"},
     expect=refused("dyld_key_in_launcher_env:DYLD_PRINT_LIBRARIES"))
case("real-env-sip-stub-purges-dyld", interp=STUB_PY, real_env=True, proc_env={"PATH": "/usr/bin:/bin", "DYLD_PRINT_LIBRARIES": "1"},
     expect=executed())
# env file missing (direct)
case("env-file-missing", env_file=os.path.join(S, "absent.env"), expect=refused("env_file_unreadable"))
# outside the window the env file is never opened: an absent file still gives outside_start_window
case("outside-window-never-reads-file", start=DAY + "T14:02:00", env_file=os.path.join(S, "absent.env"), expect=refused("outside_start_window"))
# --- RECHECK-8 Lows: env-file hygiene and the cross-invocation lock ---
os.makedirs(os.path.join(S, "private"), exist_ok=True)
REAL_FAKE = os.path.join(S, "private", "target.env"); open(REAL_FAKE, "w").write(GOOD); os.chmod(REAL_FAKE, 0o600)
LINK = os.path.join(S, "link.env")
if not os.path.lexists(LINK): os.symlink(REAL_FAKE, LINK)
case("env-file-symlink", env_file=LINK, expect=refused("env_file_not_private_regular_file"))
WIDE = os.path.join(S, "wide.env"); open(WIDE, "w").write(GOOD); os.chmod(WIDE, 0o640)
case("env-file-group-readable", env_file=WIDE, expect=refused("env_file_not_private_regular_file"))
FIFO = os.path.join(S, "fifo.env")
if not os.path.exists(FIFO): os.mkfifo(FIFO, 0o600)
case("env-file-fifo-no-hang", env_file=FIFO, expect=refused("env_file_not_private_regular_file"))
case("env-file-dir", env_file=os.path.join(S, "private"), expect=refused("env_file_not_private_regular_file"))
open(os.path.join(S, "lock-second.lock"), "w").write("{}\n")
case("lock-second", lock=os.path.join(S, "lock-second.lock"), expect=refused("launcher_lock_exists"))
case("lock-dir-missing", lock=os.path.join(S, "no-such-dir", "x.lock"), expect=refused("launcher_lock_unavailable"))
case("lock-before-env-read", lock=os.path.join(S, "lock-second.lock"), env_file=os.path.join(S, "absent.env"), expect=refused("launcher_lock_exists"))
_before_lock = os.path.exists(os.path.join(S, "outside-window-lock.lock"))
case("outside-window-takes-no-lock", start=DAY + "T14:02:00", lock=os.path.join(S, "outside-window-lock.lock"), expect=refused("outside_start_window"))
ok = not os.path.exists(os.path.join(S, "outside-window-lock.lock")); fails += 0 if ok else 1
print(("PASS" if ok else "FAIL") + " [outside-window-takes-no-lock/file] no lock file created")
results.append({"case": "outside-window-no-lock-file", "pass": ok})
# --- RECHECK-8 Low: isolation and interpreter guard (real script, before any import) ---
INJ = os.path.join(S, "inj"); os.makedirs(INJ, exist_ok=True)
MARK = os.path.join(S, "MARKER-hashlib")
open(os.path.join(INJ, "hashlib.py"), "w").write("open(%r, 'w').write('ran')\nraise ImportError('probe')\n" % MARK)
open(os.path.join(INJ, "json.py"), "w").write("open(%r, 'w').write('ran')\nraise ImportError('probe')\n" % MARK)
def script(name, cmd, env, want_code, want_rc=2):
    global fails
    if os.path.exists(MARK): os.remove(MARK)
    p = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=30)
    try: got = json.loads(p.stdout)
    except ValueError: got = None
    ok = (p.returncode == want_rc and got == {"launcher": "refuse", "code": want_code} and not os.path.exists(MARK)
          and "Traceback" not in p.stderr)
    fails += 0 if ok else 1
    all_output.append(p.stdout + p.stderr)
    print(("PASS" if ok else "FAIL") + " [%s] %s (exit %s, marker %s, traceback %s)" % (name, p.stdout.strip(), p.returncode, os.path.exists(MARK), "Traceback" in p.stderr))
    results.append({"case": name, "pass": ok, "exit": p.returncode})
script("no-I-refuses", [STUB_PY, SCRIPT_COPY, "--run", RECEIPT], {"PATH": "/usr/bin:/bin"}, "not_isolated")
script("no-I-PYTHONPATH-hashlib-json", [STUB_PY, SCRIPT_COPY, "--run", RECEIPT], {"PATH": "/usr/bin:/bin", "PYTHONPATH": INJ}, "not_isolated")
script("with-I-PYTHONPATH-ignored", [STUB_PY, "-I", SCRIPT_COPY, "--run", RECEIPT], {"PATH": "/usr/bin:/bin", "PYTHONPATH": INJ}, "outside_start_window")
ALT = os.path.join(S, "alt-python3")
if not os.path.lexists(ALT): os.symlink(CLT_PY, ALT)
script("unexpected-interpreter", [ALT, "-I", SCRIPT_COPY, "--run", RECEIPT], {"PATH": "/usr/bin:/bin"}, "unexpected_interpreter")
# --- RECHECK-8 blocking: DEVELOPER_DIR redirects the shim; the documented env -i prefix defeats it ---
FAKE_DEV = os.path.join(S, "fakedev", "usr", "bin"); os.makedirs(FAKE_DEV, exist_ok=True)
DEVMARK = os.path.join(S, "MARKER-devdir")
for b in ("python3", "xcrun"):
    with open(os.path.join(FAKE_DEV, b), "w") as h: h.write("#!/bin/sh\necho ran > %s\necho FAKE\n" % DEVMARK)
    os.chmod(os.path.join(FAKE_DEV, b), 0o755)
def devdir(name, cmd, want_marker):
    global fails
    if os.path.exists(DEVMARK): os.remove(DEVMARK)
    p = subprocess.run(cmd, env={"PATH": "/usr/bin:/bin", "DEVELOPER_DIR": os.path.join(S, "fakedev")}, capture_output=True, text=True, timeout=30)
    marker = os.path.exists(DEVMARK)
    if want_marker:
        ok = marker  # demonstrates the attack the prefix closes
    else:
        try: ok = not marker and json.loads(p.stdout) == {"launcher": "refuse", "code": "outside_start_window"}
        except ValueError: ok = False
    fails += 0 if ok else 1
    print(("PASS" if ok else "FAIL") + " [%s] marker %s, stdout %s" % (name, marker, p.stdout.strip()[:80]))
    results.append({"case": name, "pass": ok})
devdir("developer-dir-bare-shim-is-redirected", [STUB_PY, "-I", SCRIPT_COPY, "--run", RECEIPT], True)
devdir("developer-dir-documented-env-i-prefix", ["/usr/bin/env", "-i", "PATH=/usr/bin:/bin", STUB_PY, "-I", SCRIPT_COPY, "--run", RECEIPT], False)
# --- production constants (what main() uses) ---
import importlib.util
_spec = importlib.util.spec_from_file_location("launcher_consts", LAUNCHER); P = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(P)
import datetime as _dt
_u = _dt.timezone.utc
consts = {
    "ENV_FILE": P.ENV_FILE == "/Users/tim/Code/fhfhockey.com/web/.env.local",
    "WEB": P.WEB == "/Users/tim/Code/fhfhockey.com/web",
    "NODE": P.NODE == "/usr/local/bin/node",
    "ORIGIN": P.ORIGIN == ORIGIN,
    "LOCK_PATH": P.LOCK_PATH == "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/attestation/" + LOCK_NAME,
    "EXPECTED_PYTHON": P.EXPECTED_PYTHON == CLT_PY,
    "G3 pins": (P.G3_TOOL_SHA256, P.G3_BASELINE_SHA256) == ("912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4", BASELINE_PIN),
    "slot": P.SLOT == {"open": _dt.datetime(2026, 11, DAYNUM, 14, 3, tzinfo=_u), "close": _dt.datetime(2026, 11, DAYNUM, 14, 5, tzinfo=_u),
                       "wake": _dt.datetime(2026, 11, DAYNUM, 14, 5, 5, tzinfo=_u), "exec_from": _dt.datetime(2026, 11, DAYNUM, 14, 5, tzinfo=_u),
                       "exec_until": _dt.datetime(2026, 11, DAYNUM, 14, 5, 50, tzinfo=_u)},
    "launch defaults": P.launch.__kwdefaults__["env_file"] == P.ENV_FILE and P.launch.__kwdefaults__["web"] == P.WEB and P.launch.__kwdefaults__["node"] == P.NODE
                       and P.launch.__kwdefaults__["execve"] is os.execve and P.launch.__kwdefaults__["g3"] is P.default_g3
                       and P.launch.__kwdefaults__["lock_path"] == P.LOCK_PATH,
}
bad = [k for k, v in consts.items() if not v]
fails += 1 if bad else 0
print(("PASS" if not bad else "FAIL") + " [production-constants] ENV_FILE, WEB, NODE, ORIGIN, G3 pins, slot, launch() defaults" + (" BAD:" + ",".join(bad) if bad else ""))
results.append({"case": "production-constants", "pass": not bad})
# --- the real main(), real clock, real getconf/ledger, scratch 0600 receipt: refuses on the window before any file read ---
p = subprocess.run([STUB_PY, "-I", SCRIPT_COPY, "--run", RECEIPT], env={"PATH": "/usr/bin:/bin"}, capture_output=True, text=True, timeout=30)
ok = p.returncode == 2 and json.loads(p.stdout) == {"launcher": "refuse", "code": "outside_start_window"}
fails += 0 if ok else 1
print(("PASS" if ok else "FAIL") + " [main-real-outside-window] %s (exit %s)" % (p.stdout.strip(), p.returncode))
results.append({"case": "main-real-outside-window", "pass": ok, "exit": p.returncode})
# --- main(): argv contract (refuses before any env-file read) ---
for name, args in (("main-no-args", []), ("main-extra-arg", ["--run", RECEIPT, "--x"]), ("main-wrong-flag", ["--check", RECEIPT])):
    p = subprocess.run([STUB_PY, "-I", SCRIPT_COPY] + args, env={"PATH": "/usr/bin:/bin"}, capture_output=True, text=True, timeout=30)
    ok = p.returncode == 2 and json.loads(p.stdout) == {"launcher": "refuse", "code": "usage"}
    fails += 0 if ok else 1
    print(("PASS" if ok else "FAIL") + " [%s] refuse usage (exit %s)" % (name, p.returncode))
    results.append({"case": name, "pass": ok, "exit": p.returncode})

leak = any(SECRET_NST in o or SECRET_SRK in o for o in all_output)
print("---- cases: %d, failures: %d, fake secret seen in any output: %s" % (len(results), fails, leak))
sys.exit(1 if fails or leak else 0)

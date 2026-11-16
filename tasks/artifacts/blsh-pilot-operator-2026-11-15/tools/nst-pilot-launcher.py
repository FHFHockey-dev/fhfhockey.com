"""BLSH native-input pilot launcher (RUNTIME-RECEIPT-PLAN §1, OPERATOR-ACCEPTANCE "One start"). TJ approved the design
2026-11-15 (pop-up relayed by Chef). Value-free: it never prints a value and never puts one in argv.

The ONLY supported invocation (from any cwd; it changes to web/ itself):
    /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I <this file> --run <absolute receipt path>
/usr/bin/env -i (SIP-protected) clears DEVELOPER_DIR and every other key first: the /usr/bin/python3 xcode-select shim
honours DEVELOPER_DIR and would otherwise run another interpreter (RECHECK-8). Before any other import this file
refuses unless Python runs isolated (-I) and is the Command Line Tools interpreter, so a PYTHONPATH module cannot run
first (a sitecustomize/usercustomize on PYTHONPATH is excluded by -I itself).
/usr/bin/python3 is the SIP-protected stub: macOS purges every DYLD_* variable before this process image loads, so no
injected library can load into the launcher and no DYLD_* key can reach node (whose env is built from the allowlist
anyway). The own-environment DYLD_* refusal below is therefore defence in depth: it can only fire if the launcher is
started through an unprotected interpreter, where it does see them (tested).

Order: argv -> own env (lifecycle, DYLD_*) -> receipt -> real TMPDIR + NST ledger dir -> window 14:03:00-14:05:00Z on
2026-11-17 (before the env file is opened: outside the slot no credential file is read) -> env file web/.env.local
(parsed, never sourced) -> sleep to 14:05:05Z -> G3 (pinned tool + baseline, --loaded, credential-free env) -> clock
re-read inside 14:05:00-14:05:50Z -> exactly ONE os.execve of
    /usr/local/bin/node --require ./node_modules/ts-node/register/transpile-only scripts/blsh/nativeProcessCaptureBootstrap.ts --run <receipt>
with cwd web/ and the allowlist env. Any refusal prints one JSON line {"launcher":"refuse","code":...} and exits 2.
No retries: a failed execve is final. A lock file (O_CREAT|O_EXCL, never removed) taken after the window gate and
before the env file is read makes any second launcher refuse.
"""
import sys

EXPECTED_PYTHON = "/Library/Developer/CommandLineTools/usr/bin/python3"
if __name__ == "__main__" and (not sys.flags.isolated or sys.executable != EXPECTED_PYTHON):
    # Builtins only: nothing importable from PYTHONPATH or the cwd has run yet.
    sys.stdout.write('{"code": "%s", "launcher": "refuse"}\n' % ("not_isolated" if not sys.flags.isolated else "unexpected_interpreter"))
    sys.exit(2)

import datetime
import errno
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import time

WEB = "/Users/tim/Code/fhfhockey.com/web"
ENV_FILE = os.path.join(WEB, ".env.local")
NODE = "/usr/local/bin/node"
ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co"
TOOLS = os.path.dirname(os.path.abspath(__file__))
G3_TOOL = os.path.join(TOOLS, "dependency-tree-hash.mjs")
G3_TOOL_SHA256 = "912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4"
G3_BASELINE = os.path.join(os.path.dirname(TOOLS), "evidence", "DEPENDENCY-TREE-BASELINE.json")
G3_BASELINE_SHA256 = "4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3"
G3_TREE = "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a"
LOCK_PATH = os.path.join(os.path.dirname(TOOLS), "attestation", "launcher-20261117T1405Z.lock")
UTC = datetime.timezone.utc
SLOT = {  # 2026-11-17; a contingency date needs a new launcher hash and a new approval
    "open": datetime.datetime(2026, 11, 17, 14, 3, 0, tzinfo=UTC),
    "close": datetime.datetime(2026, 11, 17, 14, 5, 0, tzinfo=UTC),
    "wake": datetime.datetime(2026, 11, 17, 14, 5, 5, tzinfo=UTC),
    "exec_from": datetime.datetime(2026, 11, 17, 14, 5, 0, tzinfo=UTC),
    "exec_until": datetime.datetime(2026, 11, 17, 14, 5, 50, tzinfo=UTC),
}
SECRET_KEYS = ("NST_KEY", "SUPABASE_SERVICE_ROLE_KEY")
FROM_FILE = ("NEXT_PUBLIC_SUPABASE_URL",) + SECRET_KEYS
LIFECYCLE = "NST_JOB_LIFECYCLE_ENABLED"
WATCHED = FROM_FILE + (LIFECYCLE,)


class Refuse(Exception):
    pass


def sha256_file(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def read_private_env_file(path):
    """Open without following a symlink, then fstat the SAME descriptor: a regular file owned by this user with no
    group/other access, or refuse. Returns the text. Never chmods or writes the file."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)  # NONBLOCK: a FIFO cannot hang the open
    except OSError as error:
        raise Refuse("env_file_not_private_regular_file" if error.errno == errno.ELOOP else "env_file_unreadable")  # ELOOP: a symlink
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or st.st_mode & 0o077:
            raise Refuse("env_file_not_private_regular_file")
        with os.fdopen(fd, encoding="utf-8") as handle:
            fd = None
            return handle.read()
    finally:
        if fd is not None:
            os.close(fd)


def parse_env_file(text):
    """Same line rules as the TJ-approved presence probe. Returns ({key: value}, duplicate keys). Never echoes a line."""
    values, dupes = {}, set()
    for line in text.split("\n"):  # text mode already turned \r\n and \r into \n, as file iteration does
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key in values:
            dupes.add(key)
        values[key] = value
    return values, dupes


def default_user_temp_dir():
    out = subprocess.run(["/usr/bin/getconf", "DARWIN_USER_TEMP_DIR"], env={}, capture_output=True, text=True, timeout=10)
    if out.returncode != 0 or not out.stdout.strip():
        raise Refuse("tmpdir_unavailable")
    return out.stdout.strip()


def default_g3(log):
    if sha256_file(G3_TOOL) != G3_TOOL_SHA256:
        raise Refuse("g3_tool_not_pinned")
    if sha256_file(G3_BASELINE) != G3_BASELINE_SHA256:
        raise Refuse("g3_baseline_not_pinned")
    scratch = tempfile.mkdtemp(prefix="blsh-g3-")
    out = subprocess.run([NODE, G3_TOOL, "--baseline", G3_BASELINE, "--loaded"], cwd=WEB,
                         env={"PATH": "/usr/bin:/bin", "TMPDIR": scratch + "/"}, capture_output=True, text=True, timeout=60)
    log({"launcher": "g3", "exitCode": out.returncode, "stdout": out.stdout.strip()})
    try:
        result = json.loads(out.stdout)
    except ValueError:
        raise Refuse("g3_unparsed")
    ok = (out.returncode == 0 and result.get("dependencyTree") == "match" and result.get("treeSHA256") == G3_TREE
          and result.get("differences") == [] and (result.get("loaded") or {}).get("uncovered") == []
          and result.get("dyldKeysPresent") is False)
    if not ok:
        raise Refuse("g3_not_match")


def take_lock(path, t):
    """Cross-invocation lock: O_CREAT|O_EXCL, never removed, so a second launcher refuses even after this one exec'd."""
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        raise Refuse("launcher_lock_exists")
    except OSError:
        raise Refuse("launcher_lock_unavailable")
    with os.fdopen(fd, "w") as handle:
        handle.write(json.dumps({"pid": os.getpid(), "takenAtUTC": t.isoformat().replace("+00:00", "Z")}) + "\n")


def launch(receipt, *, own_env, env_file=ENV_FILE, web=WEB, node=NODE, now, sleep, user_temp_dir=default_user_temp_dir,
           g3=default_g3, execve=os.execve, log, launcher_sha256, lock_path=LOCK_PATH):
    """All gates, then one execve. The keyword seams exist only for the offline tests; main() fixes them."""
    # 1. own environment
    if LIFECYCLE in own_env:
        raise Refuse("lifecycle_key_in_launcher_env")
    dyld_env = sorted(k for k in own_env if k.startswith("DYLD_"))
    if dyld_env:
        raise Refuse("dyld_key_in_launcher_env:" + ",".join(dyld_env))
    # 2. receipt: absolute, a regular file, owned by this user, no group/other access
    if not isinstance(receipt, str) or not os.path.isabs(receipt):
        raise Refuse("receipt_path_not_absolute")
    try:
        st = os.lstat(receipt)
    except OSError:
        raise Refuse("receipt_missing")
    if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise Refuse("receipt_not_private_regular_file")
    # 3. the real same-user temp dir and its NST ledger (no substitute ledger)
    tmp = user_temp_dir()
    if not tmp.startswith("/") or not tmp.endswith("/"):
        raise Refuse("tmpdir_shape")
    ledger = os.path.join(tmp, "fhfhockey-nst-budget-%d" % os.getuid())
    if not os.path.isdir(ledger) or os.path.islink(ledger):
        raise Refuse("nst_ledger_dir_missing")
    # 4. start window: checked BEFORE the env file is opened, so a call outside the slot never reads credentials
    t = now()
    if not (SLOT["open"] <= t < SLOT["close"]):
        raise Refuse("outside_start_window")
    # 4b. one launcher only: the lock is taken before the env file is opened
    take_lock(lock_path, t)
    # 5. env file: private regular file (no symlink), parsed, never sourced; values go only into node's env
    try:
        values, dupes = parse_env_file(read_private_env_file(env_file))
    except (OSError, UnicodeDecodeError):
        raise Refuse("env_file_unreadable")
    dyld_file = sorted(k for k in values if k.startswith("DYLD_"))
    if dyld_file:
        raise Refuse("dyld_key_in_env_file:" + ",".join(dyld_file))
    if LIFECYCLE in values:
        raise Refuse("lifecycle_key_in_env_file")
    dup = sorted(k for k in dupes if k in WATCHED)
    if dup:
        raise Refuse("duplicate_key_in_env_file:" + ",".join(dup))
    for key in FROM_FILE:
        if not values.get(key):
            raise Refuse("missing_or_empty_key:" + key)
        if re.search(r"\s", values[key]) or values[key][:1] in "\"'":
            raise Refuse("value_shape_suspect:" + key)  # e.g. an inline comment or a stray quote
    if values["NEXT_PUBLIC_SUPABASE_URL"] != ORIGIN:
        raise Refuse("supabase_origin_not_pinned")
    # 6. sleep to the wake time, then G3, then the exec window
    while True:
        remaining = (SLOT["wake"] - now()).total_seconds()
        if remaining <= 0:
            break
        sleep(min(remaining, 5.0))
    g3(log)
    t = now()
    if not (SLOT["exec_from"] <= t < SLOT["exec_until"]):
        raise Refuse("outside_exec_window")
    child_env = {
        "PATH": "/usr/bin:/bin",
        "TMPDIR": tmp,
        "NODE_PATH": ".",
        "DISABLE_V8_COMPILE_CACHE": "1",
        "TS_NODE_COMPILER_OPTIONS": '{"module":"commonjs","moduleResolution":"node"}',
    }
    for key in FROM_FILE:
        child_env[key] = values[key]
    argv = [node, "--require", "./node_modules/ts-node/register/transpile-only",
            "scripts/blsh/nativeProcessCaptureBootstrap.ts", "--run", receipt]
    log({"launcher": "exec", "atUTC": t.isoformat().replace("+00:00", "Z"), "launcherSHA256": launcher_sha256,
         "cwd": web, "argv0": node, "envKeys": sorted(child_env), "dyldKeysPresent": False, "lifecycleKeyPresent": False,
         "pythonIsolated": bool(sys.flags.isolated), "pythonExecutable": sys.executable})
    os.chdir(web)
    execve(node, argv, child_env)  # exactly one; on success this never returns
    raise Refuse("execve_returned")


def main(argv):
    def log(obj):
        sys.stdout.write(json.dumps(obj, sort_keys=True) + "\n")
        sys.stdout.flush()
    try:
        if len(argv) != 2 or argv[0] != "--run":
            raise Refuse("usage")
        launch(argv[1], own_env=dict(os.environ), now=lambda: datetime.datetime.now(UTC), sleep=time.sleep, log=log,
               launcher_sha256=sha256_file(os.path.abspath(__file__)))
    except Refuse as refusal:
        log({"launcher": "refuse", "code": str(refusal)})
        return 2
    except Exception as error:  # never a traceback: it could carry a value
        log({"launcher": "refuse", "code": "unexpected_" + type(error).__name__})
        return 2
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

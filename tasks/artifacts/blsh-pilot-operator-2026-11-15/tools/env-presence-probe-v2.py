"""BLSH pilot operator: presence-only env probe, v2. Never prints, stores or exports a value.

v2 adds: a predicted RUNTIME.json (tools/runtime-snapshot.cjs) built in the launcher-shaped env,
then checked with the evidence bridge's OWN checkRuntime (tools/check-predicted-runtime.mjs), so every
checkRuntime veto fires before the slot. Lifecycle must be ABSENT (checkRuntime requires
adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED === false, i.e. key not present).
RECHECK-6 R3 (interim, operator side): any DYLD_* key (prefix match) in the env file or in this probe's own
environment makes pass false; the names (never values) are reported. G3 refuses DYLD_* in its own env too.
Optional 2nd argument: absolute path of the bootstrap whose NODE_SHA256 pin is used (default: web/ bootstrap).
Optional 3rd argument: the candidate, v5-1117 (default; successor expected-pins + DEPENDENCY-TREE-BASELINE.json) or
v5-1118 (fallback-1118/rehearsal/expected-pins.json + DEPENDENCY-TREE-BASELINE-1118.json).

Run ONLY after TJ approves the exact command in RUNTIME-RECEIPT-PLAN.md:
  cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin \
    /usr/bin/python3 -I <this file> <env file name> [<bootstrap .ts path>]

Reads one allowlisted env file in web/, classifies only the keys the capture path
reads, then runs the bootstrap --check with the two NON-SECRET values only
(project URL, lifecycle flag). NST_KEY and SUPABASE_SERVICE_ROLE_KEY never leave
this process: they are reduced to present/empty/absent and dropped.
Output: one JSON object of enums and booleans on stdout.
"""
import json
import os
import subprocess
import sys
import tempfile

WEB = "/Users/tim/Code/fhfhockey.com/web"
ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co"
ALLOWED_FILES = {".env.local", ".env.production", ".env.development.local", ".env.development"}
SECRET_KEYS = ("NST_KEY", "SUPABASE_SERVICE_ROLE_KEY")
FORBIDDEN = ("NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_USE_SYSTEM_CA",
             "NODE_USE_ENV_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "OPENSSL_CONF", "HTTPS_PROXY", "HTTP_PROXY",
             "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy", "NODE_PATH", "TS_NODE_PROJECT",
             "TS_NODE_COMPILER_OPTIONS", "TS_NODE_TRANSPILE_ONLY", "DISABLE_V8_COMPILE_CACHE")


def parse(path):
    seen, dupes = {}, set()
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if key in seen:
                dupes.add(key)
            seen[key] = value
    return seen, dupes


def main():
    candidates = {"v5-1117": ("/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-successor-candidate-2026-11-15/rehearsal/expected-pins.json", "DEPENDENCY-TREE-BASELINE.json"),
                  "v5-1118": ("/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-successor-candidate-2026-11-15/fallback-1118/rehearsal/expected-pins.json", "DEPENDENCY-TREE-BASELINE-1118.json")}
    if (len(sys.argv) not in (2, 3, 4) or sys.argv[1] not in ALLOWED_FILES or os.getcwd() != WEB
            or (len(sys.argv) == 4 and sys.argv[3] not in candidates)):
        sys.exit("usage: run from web/ with one allowlisted env file name")
    values, dupes = parse(os.path.join(WEB, sys.argv[1]))
    secrets = [values[k] for k in SECRET_KEYS if values.get(k)]

    def presence(key):
        if key not in values:
            return "absent"
        return "present_nonempty" if values[key].strip() else "present_empty"

    raw_url = values.get("NEXT_PUBLIC_SUPABASE_URL")
    project = ("unset" if raw_url is None else "pinned" if raw_url == ORIGIN
               else "pinned_after_trim" if raw_url.strip() == ORIGIN else "mismatch")
    dyld_in_file = sorted(k for k in values if k.startswith("DYLD_"))
    dyld_in_env = sorted(k for k in os.environ if k.startswith("DYLD_"))
    # Same gate as the launcher (tools/nst-pilot-launcher.py): whitespace or a stray quote in a capture-path value
    # (e.g. an inline "# comment") would refuse at the slot. Names only.
    shape_suspect = sorted(k for k in ("NEXT_PUBLIC_SUPABASE_URL",) + SECRET_KEYS
                           if values.get(k) and (any(c.isspace() for c in values[k]) or values[k][:1] in "\"'"))
    flag = values.get("NST_JOB_LIFECYCLE_ENABLED")
    lifecycle = "absent_disabled" if flag is None else "enabled" if flag == "true" else "present_disabled"

    # A fresh private temp folder per run (RECHECK-11 B3: no longer another session's scratchpad). Under env -i it is
    # made under /tmp. It holds the children's TMPDIR and predicted-runtime.json only (no values).
    SCRATCH = tempfile.mkdtemp(prefix="blsh-probe-") + "/"
    child_env = {"PATH": "/usr/bin:/bin", "TMPDIR": SCRATCH, "NODE_PATH": ".", "DISABLE_V8_COMPILE_CACHE": "1",
                 "TS_NODE_COMPILER_OPTIONS": '{"module":"commonjs","moduleResolution":"node"}'}
    if raw_url is not None:
        child_env["NEXT_PUBLIC_SUPABASE_URL"] = raw_url
    if flag is not None:
        child_env["NST_JOB_LIFECYCLE_ENABLED"] = flag
    check = subprocess.run(["/usr/local/bin/node", "--require", "./node_modules/ts-node/register/transpile-only",
                            "scripts/blsh/nativeProcessCaptureBootstrap.ts", "--check"],
                           cwd=WEB, env=child_env, capture_output=True, text=True, timeout=60)
    try:
        parsed = json.loads(check.stdout)
        check_result = {k: parsed.get(k) for k in ("state", "bootstrapSHA256", "project", "lifecycle", "proposedSlotUTC")}
    except ValueError:
        check_result = {"unparsed": True}

    tools = os.path.dirname(os.path.abspath(__file__))
    bootstrap = sys.argv[2] if len(sys.argv) >= 3 else os.path.join(WEB, "scripts/blsh/nativeProcessCaptureBootstrap.ts")
    pins, baseline_name = candidates[sys.argv[3] if len(sys.argv) == 4 else "v5-1117"]
    presence_json = json.dumps({"NST_KEY": presence("NST_KEY") == "present_nonempty",
                                "SUPABASE_SERVICE_ROLE_KEY": presence("SUPABASE_SERVICE_ROLE_KEY") == "present_nonempty"})
    snap = subprocess.run(["/usr/local/bin/node", "--require", "./node_modules/ts-node/register/transpile-only",
                           os.path.join(tools, "runtime-snapshot.cjs"), presence_json],
                          cwd=WEB, env=child_env, capture_output=True, text=True, timeout=60)
    predicted_path = os.path.join(SCRATCH, "predicted-runtime.json")
    with open(predicted_path, "w", encoding="utf-8") as handle:
        handle.write(snap.stdout)
    verdict = subprocess.run(["/usr/local/bin/node", os.path.join(tools, "check-predicted-runtime.mjs"), predicted_path, bootstrap, pins],
                             env={"PATH": "/usr/bin:/bin"}, capture_output=True, text=True, timeout=60)
    try:
        runtime_check = json.loads(verdict.stdout)
    except ValueError:
        runtime_check = {"checkRuntime": "unparsed"}

    # Packet gate G3: the runtime dependency closure must equal the saved baseline (credential-free child).
    sources = bootstrap[: -len("scripts/blsh/nativeProcessCaptureBootstrap.ts")] if bootstrap.endswith(
        "scripts/blsh/nativeProcessCaptureBootstrap.ts") else WEB
    baseline = os.path.join(os.path.dirname(tools), "evidence", baseline_name)
    tree = subprocess.run(["/usr/local/bin/node", os.path.join(tools, "dependency-tree-hash.mjs"), "--web", WEB,
                           "--sources", sources, "--baseline", baseline, "--loaded"],
                          env={"PATH": "/usr/bin:/bin", "TMPDIR": SCRATCH}, capture_output=True, text=True, timeout=120)
    try:
        tree_check = json.loads(tree.stdout)
    except ValueError:
        tree_check = {"dependencyTree": "unparsed"}

    report = {
        "probe": "fhfh.blsh.operator.env-presence.v2",
        "candidate": sys.argv[3] if len(sys.argv) == 4 else "v5-1117",
        "predictedRuntimeCheck": runtime_check,
        "dependencyTreeCheck": tree_check,
        "pass": (presence("NST_KEY") == "present_nonempty" and presence("SUPABASE_SERVICE_ROLE_KEY") == "present_nonempty"
                 and project == "pinned" and lifecycle == "absent_disabled"
                 and not [k for k in dupes if k in SECRET_KEYS + ("NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED")]
                 and not dyld_in_file and not dyld_in_env and not shape_suspect
                 and check.returncode == 0 and runtime_check.get("checkRuntime") == "pass"
                 and tree.returncode == 0 and tree_check.get("dependencyTree") == "match"),
        "envFile": sys.argv[1],
        "NST_KEY": presence("NST_KEY"),
        "SUPABASE_SERVICE_ROLE_KEY": presence("SUPABASE_SERVICE_ROLE_KEY"),
        "NEXT_PUBLIC_SUPABASE_URL": project,
        "NST_JOB_LIFECYCLE_ENABLED": lifecycle,
        "duplicateCapturePathKeys": sorted(k for k in dupes if k in SECRET_KEYS + ("NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED")),
        "dyldKeysInFile": dyld_in_file,
        "dyldKeysInProbeEnv": dyld_in_env,
        "dyldKeysPresent": bool(dyld_in_file or dyld_in_env),
        "valueShapeSuspectKeys": shape_suspect,
        "forbiddenOverrideKeysInFile": sorted(k for k in FORBIDDEN if k in values),
        "bootstrapCheckExit": check.returncode,
        "bootstrapCheck": check_result,
        "secretsPassedToChild": False,
        "valuesPrinted": False,
    }
    text = json.dumps(report, sort_keys=True)
    # Refuse to print if any secret value (or its non-trivial substring) leaked into the report.
    if any(len(s) >= 8 and s in text for s in secrets):
        sys.exit("probe_self_check_failed_no_output")
    print(text)


if __name__ == "__main__":
    main()

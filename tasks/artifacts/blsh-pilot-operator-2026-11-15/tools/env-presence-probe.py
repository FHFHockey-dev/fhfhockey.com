"""BLSH pilot operator: presence-only env probe. Never prints, stores or exports a value.

Run ONLY after TJ approves the exact command in RUNTIME-RECEIPT-PLAN.md:
  cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin \
    /usr/bin/python3 -I <this file> <env file name>

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

WEB = "/Users/tim/Code/fhfhockey.com/web"
ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co"
ALLOWED_FILES = {".env.local", ".env.production", ".env.development.local", ".env.development"}
SECRET_KEYS = ("NST_KEY", "SUPABASE_SERVICE_ROLE_KEY")
FORBIDDEN = ("NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_USE_SYSTEM_CA",
             "NODE_USE_ENV_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "OPENSSL_CONF", "HTTPS_PROXY", "HTTP_PROXY",
             "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy", "NODE_PATH", "TS_NODE_PROJECT",
             "TS_NODE_COMPILER_OPTIONS", "TS_NODE_TRANSPILE_ONLY", "DISABLE_V8_COMPILE_CACHE")
SCRATCH = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/46a3f878-497b-4ca6-873b-0eb49825f0f0/scratchpad/probe-tmp/"


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
    if len(sys.argv) != 2 or sys.argv[1] not in ALLOWED_FILES or os.getcwd() != WEB:
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
    flag = values.get("NST_JOB_LIFECYCLE_ENABLED")
    lifecycle = "absent_disabled" if flag is None else "enabled" if flag == "true" else "present_disabled"

    child_env = {"PATH": "/usr/bin:/bin", "TMPDIR": SCRATCH, "NODE_PATH": ".", "DISABLE_V8_COMPILE_CACHE": "1",
                 "TS_NODE_COMPILER_OPTIONS": '{"module":"commonjs","moduleResolution":"node"}'}
    if raw_url is not None:
        child_env["NEXT_PUBLIC_SUPABASE_URL"] = raw_url
    if flag is not None:
        child_env["NST_JOB_LIFECYCLE_ENABLED"] = flag
    os.makedirs(SCRATCH, mode=0o700, exist_ok=True)
    check = subprocess.run(["/usr/local/bin/node", "--require", "./node_modules/ts-node/register/transpile-only",
                            "scripts/blsh/nativeProcessCaptureBootstrap.ts", "--check"],
                           cwd=WEB, env=child_env, capture_output=True, text=True, timeout=60)
    try:
        parsed = json.loads(check.stdout)
        check_result = {k: parsed.get(k) for k in ("state", "bootstrapSHA256", "project", "lifecycle", "proposedSlotUTC")}
    except ValueError:
        check_result = {"unparsed": True}

    report = {
        "probe": "fhfh.blsh.operator.env-presence.v1",
        "envFile": sys.argv[1],
        "NST_KEY": presence("NST_KEY"),
        "SUPABASE_SERVICE_ROLE_KEY": presence("SUPABASE_SERVICE_ROLE_KEY"),
        "NEXT_PUBLIC_SUPABASE_URL": project,
        "NST_JOB_LIFECYCLE_ENABLED": lifecycle,
        "duplicateCapturePathKeys": sorted(k for k in dupes if k in SECRET_KEYS + ("NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED")),
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

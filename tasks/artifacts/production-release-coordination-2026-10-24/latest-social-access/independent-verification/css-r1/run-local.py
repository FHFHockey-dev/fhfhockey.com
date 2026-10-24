"""Owned, environment-free local Next/Playwright QA; never contacts a live service."""
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request

OUT = Path(__file__).resolve().parent
PACKET = OUT.parents[1]
CANDIDATE = json.loads((PACKET / "CANDIDATE.json").read_text())
SNAPSHOT = Path(CANDIDATE["snapshot"])
WEB = SNAPSHOT / "web"
ORIGIN = "http://127.0.0.1:3140"
NODE = "/usr/local/bin/node"
LOCK = Path("/private/tmp/fhfh-heavy.lock")
record = {"port": 3140, "origin": ORIGIN, "cwd": str(WEB), "cache": str(WEB / ".next-playwright"), "readiness_route": "/social-share/game-grid", "readiness_connection_attempts": 0, "readiness_successful_responses": 0, "server_started": False, "server_stopped": False, "external_service_permission": False}
server = None

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def snapshot_pins():
    test_pins = json.loads((OUT / "TEST-ONLY-PINS.json").read_text())["isolated_test_files"]
    checks = {}
    for file, pin in CANDIDATE["selected"].items():
        expected = test_pins[file] if file in test_pins else pin["sha256"]
        actual = sha(SNAPSHOT / file)
        checks[file] = {"expected": expected, "actual": actual, "matches": expected == actual, "test_only_adaptation": file in test_pins}
    for file, expected in test_pins.items():
        checks[file] = {"expected": expected, "actual": sha(SNAPSHOT / file), "matches": sha(SNAPSHOT / file) == expected, "test_only_adaptation": True}
    return checks

fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
os.write(fd, b"latest-social-access isolated Next3140 + focused browser QA\n")
os.close(fd)
try:
    release_spec = (OUT / "release-spec.ts").read_bytes()
    assert sha(WEB / "e2e/social-share.spec.ts") == hashlib.sha256(release_spec).hexdigest()
    (WEB / "e2e/social-share.spec.ts").write_bytes((OUT / "diagnostic-spec.ts").read_bytes())
    record["diagnostic_spec_installed"] = True
    record["before_pins"] = snapshot_pins()
    assert all(pin["matches"] for pin in record["before_pins"].values())
    assert not list(SNAPSHOT.glob(".env*")) and not list(WEB.glob(".env*")), "Ignored environment files forbidden"
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 3140))
    record["port_rechecked_free_immediately_before_start"] = True
    env = {name: os.environ[name] for name in ("PATH", "HOME", "TMPDIR", "USER", "LANG") if name in os.environ}
    env.update({
        "NODE_ENV": "development", "NEXT_TELEMETRY_DISABLED": "1", "NO_UPDATE_NOTIFIER": "1", "PLAYWRIGHT_ISOLATED_NEXT": "1",
        "PLAYWRIGHT_BASE_URL": ORIGIN, "PLAYWRIGHT_SKIP_WEB_SERVER": "1", "CMS_URL": ORIGIN,
        "NEXT_PUBLIC_SUPABASE_URL": "https://social-editor-fixture.supabase.invalid",
        "NEXT_PUBLIC_SUPABASE_PUBLIC_KEY": "synthetic-social-editor-public-key",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "synthetic-social-editor-public-key",
        "SUPABASE_SERVICE_ROLE_KEY": "synthetic-social-editor-service-key",
        "SOCIAL_SHARE_EVIDENCE_DIR": str(OUT / "pngs"),
        "PWTEST_CACHE_DIR": str(SNAPSHOT / ".playwright-transform-cache"),
        "SOCIAL_QA_NETWORK_LOG": str(OUT / "DENIED-NODE-NETWORK.jsonl"),
        "NODE_OPTIONS": "--max-old-space-size=4096 --require=" + str(OUT / "deny-outbound.cjs"),
    })
    command = [NODE, str(WEB / "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3140"]
    record["server_command"] = command
    record["config_before"] = {file: sha(WEB / file) for file in ("next.config.js", "tsconfig.json")}
    with (OUT / "NEXT.log").open("w") as log:
        server = subprocess.Popen(command, cwd=WEB, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        record["owned_server_pid"] = server.pid
        record["owned_process_group"] = server.pid
        record["server_started"] = True
        (OUT / "OWNED-PROCESS.json").write_text(json.dumps(record, indent=2) + "\n")
        print("Owned Next process started: " + str(server.pid), flush=True)
        deadline = time.monotonic() + 150
        while True:
            assert server.poll() is None, "Owned Next process exited before readiness"
            try:
                record["readiness_connection_attempts"] += 1
                with urllib.request.urlopen(ORIGIN + "/social-share/game-grid", timeout=130) as response:
                    html = response.read().decode()
                    record["readiness_status"] = response.status
                    record["readiness_successful_responses"] += 1
                    record["readiness_cache_control"] = response.headers.get("Cache-Control")
                    assert response.status == 200 and "Checking share studio access" in html
                    assert 'aria-label="Schedule settings"' not in html
                    assert "no-store" in record["readiness_cache_control"]
                    break
            except urllib.error.URLError as error:
                if time.monotonic() >= deadline:
                    raise
                if isinstance(error.reason, ConnectionRefusedError):
                    time.sleep(1)
                else:
                    raise
        print("Generic locked social page ready; starting only the unchanged T13 assertions/exports plus diagnostic measurements", flush=True)
        argv = [NODE, str(WEB / "node_modules/@playwright/test/cli.js"), "test", "--config", str(OUT / "playwright.local.config.ts"), "--grep", "^schedule-aware tier list shows"]
        record["playwright_command"] = argv
        with (OUT / "PLAYWRIGHT.log").open("w") as testlog:
            result = subprocess.run(argv, cwd=WEB, env=env, stdout=testlog, stderr=subprocess.STDOUT, timeout=330)
        record["playwright_exit_code"] = result.returncode
        record["status"] = "passed" if result.returncode == 0 else "test_failure"
        print("Focused Playwright exit: " + str(result.returncode), flush=True)
except Exception as error:
    record["status"] = "blocked_or_failed"
    record["error"] = {"type": type(error).__name__, "message": str(error)}
    print(json.dumps(record["error"]), flush=True)
finally:
    if server is not None:
        try:
            os.killpg(server.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            server.wait(timeout=12)
        except subprocess.TimeoutExpired:
            os.killpg(server.pid, signal.SIGKILL)
            server.wait(timeout=5)
    record["server_stopped"] = server is not None and server.poll() is not None
    record["diagnostic_after_pins"] = snapshot_pins()
    if record.get("diagnostic_spec_installed"):
        (WEB / "e2e/social-share.spec.ts").write_bytes((OUT / "release-spec.ts").read_bytes())
    record["release_spec_restored"] = sha(WEB / "e2e/social-share.spec.ts") == "a3da9fa1ef2170d11fe6a75f6bd9ec244f534b872709e86362de3d21e67955ae"
    record["after_pins"] = {file: {"expected": pin["sha256"], "actual": sha(SNAPSHOT / file), "matches": sha(SNAPSHOT / file) == pin["sha256"]} for file, pin in CANDIDATE["selected"].items()}
    record["all_selected_and_test_pins_unchanged"] = all(pin["matches"] for pin in record["after_pins"].values())
    record["config_after"] = {file: sha(WEB / file) for file in ("next.config.js", "tsconfig.json")}
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", 3140))
            record["port_free_after_owned_shutdown"] = True
        except OSError:
            record["port_free_after_owned_shutdown"] = False
    (OUT / "EXECUTION.json").write_text(json.dumps(record, indent=2) + "\n")
    LOCK.unlink()
    print(json.dumps({key: record.get(key) for key in ("status", "playwright_exit_code", "server_stopped", "port_free_after_owned_shutdown", "all_selected_and_test_pins_unchanged")}), flush=True)
if record.get("status") != "passed":
    raise SystemExit(1)

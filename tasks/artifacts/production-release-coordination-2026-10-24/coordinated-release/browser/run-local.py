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
PACKET = OUT.parent
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

    env.update({'SOCIAL_SHARE_PINNED_GRID_SHA256': '5ec123ec20c2d30a848e7ec60f1894c7f07e41f83fc7131a7138e2c8f70477f9', 'SOCIAL_SHARE_PINNED_EXTRA_SHA256': '41ce859d0b8d7581787e1462ffab7587569a7dba7beeca5ebeae5d2dbeeb83cf,f06658b8a9f545ef39a775b6d4c96f081c18817edbda92f92c22443f35fef4c3', 'SOCIAL_SHARE_PINNED_PLAYER_SHA256': 'ddd483ac05aa06abaabd5d366a1a45c61a88b9927b928491729deaddfb43f2cb,6cce7e7481ec875b63b954fd86a5c00a37d490f440553c7f2a690d11fed9040f,9a464cfd39ad6204d7f4d26cc74d6e7c8425c245353a96f6f0b88bcc768e1083,7ef95132215c9920ddb0ac86b6a3a3ad9b5ae41098c75a3d40208ffedb6a014e', 'SOCIAL_SHARE_PINNED_TIERS_SHA256': '18e6808c95a5f47f7a818b094156292e22058b1b320f97f311b320b0ed91939d,f7d382f85bf017ae61c0d8013bce304e5d3e31d32198eeabac0093fa56f37127', 'SOCIAL_SHARE_PINNED_WEDNESDAY_SHA256': '66399bddda34fd32bbd264af0888a469c8e751dfea40a18967027e2a3052a1a5,32e9df2090d31cd806d55e0a1d4a658e42be164fa242cc9b4d6d6e3c4a636a6a,16e5e072a49de42bcfb008e781c887454c671cd7b5808562faa87e3d13fa7f34,1d0ecca4d6cd9190ae73dc03b6bd120247cdb6eeb0a469f3d83861d9eadf1079,18682950fcb89cdd5a2455711fe254b118601bbec8664619088f8a995fc5170a,320f8fdf7c11f291452746bc2deb70024edc31413924a841a31b114093438df0,e18e90219b2137f033065c8bc6dd3fb67eefe76aa388f066b61614fd2c646e53,b86ab7a2a606116e81cf06ab75672a28e44e9345ab4134de32df62284697f46d,1a3e679461fac9c46e6c5e1e83679879a2703aeb2bc6435513a685e975da2a9d', 'SOCIAL_SHARE_PINNED_TUESDAY_SHA256': '8e445a4352331523b2ed3274a81f5fb2b26733ba0cc8471d753eb074b5dfcba8,69fcec8c200022ec549a12d580b1ad8b8dc3112022e9ba472abcb3c6008254f5,82db70ce2f1ea6cbf54b34e87c1c122f6a0bfa04e1b6af94cb8fbbc9a74d7449,305daf54f76ee217c1eb5bd03175aea244f79e554f6566416477113cb7ea7c07'})
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
        print("Generic locked social page ready; starting all 28 final SS1 focused tests", flush=True)
        argv = [NODE, str(WEB / "node_modules/@playwright/test/cli.js"), "test", "--config", str(OUT / "playwright.local.config.ts"), ]
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
    record["after_pins"] = snapshot_pins()
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

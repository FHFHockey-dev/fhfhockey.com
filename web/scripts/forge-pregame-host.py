#!/usr/bin/env python3
"""Run one approved game through forge-pregame-slate on a persistent Unix host.

Run from the owner's immutable, clean Git checkout, with the host's credentials in the
environment, an owner-approved load gate, and one private durable state root for
all approved wakes on that host, slate and candidate.
The queue retains custody authority. A host `terminal` result is its application
receipt; separately verify the claim in custody for the hosted proof.
"""

import argparse
from datetime import date, datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile


POLICY = "pregame-native-v1"
TERMINAL = {"never_dispatched", "source_failed", "save_unknown", "saved_without_valid_witness", "qualified"}
WEB = Path(__file__).resolve().parents[1]
ENTRY = "scripts/forge-pregame-slate.ts"
NODE = ["node", "-r", "./node_modules/ts-node/register/transpile-only"]

# Ask the existing planner for the preferred and latest dispatch instants. Epoch
# zero gives the unconstrained one-game plan without recalculating its budget here.
WAKE_PLAN = """
const { parseSlateArgs, planSlateText } = require('./scripts/forge-pregame-slate.ts');
const [game, slate] = process.argv.slice(1);
const options = parseSlateArgs(['--games', game, '--slate-date', slate, '--concurrency', '1']);
const { dispatchAt, latestDispatchAt, deadlineMs } = planSlateText(options, 0).plan.dispatches[0];
console.log(JSON.stringify({ dispatchAt, latestDispatchAt, deadlineMs, now: Date.now() }));
"""


def report(status, **details):
    print(json.dumps({"status": status, **details}), flush=True)


def verify_candidate(sha, env):
    def git(*args):
        return subprocess.run(["git", "--no-optional-locks", "-C", str(WEB), *args], env=env,
                              capture_output=True, text=True, check=True, timeout=15).stdout.strip()

    try:
        git("ls-files", "--error-unmatch", "--", "scripts/forge-pregame-host.py", ENTRY)
        if Path(git("rev-parse", "--show-toplevel")).resolve() != WEB.parent or git("rev-parse", "HEAD") != sha:
            raise ValueError("the checked out candidate does not match the approved SHA")
        if git("status", "--porcelain=v1", "--untracked-files=no", "--ignore-submodules=none"):
            raise ValueError("the candidate checkout has tracked changes")
    except subprocess.CalledProcessError as error:
        raise ValueError("the adapter and slate entry must be in the verified candidate checkout") from error


def terminal_receipt(path, pin):
    try:
        receipt = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        # The process may have died before or during the metadata receipt write.
        return None
    expected = {"codeVersion": pin["sha"], "slateDate": pin["slate"], "policyId": POLICY, "games": [pin["id"]]}
    if not isinstance(receipt, dict) or any(receipt.get(key) != value for key, value in expected.items()):
        raise ValueError("receipt identity differs from the approved game")
    result = receipt["result"]
    game, = result["results"]
    if game["gameId"] != pin["id"]:
        raise ValueError("receipt game differs from the approved game")
    if game["outcome"] is None or result["unresolved"]:
        return None
    if game["outcome"] not in TERMINAL or (game["outcome"] == "qualified" and not game["claimId"]):
        raise ValueError("invalid terminal receipt")
    return {"gameId": game["gameId"], "outcome": game["outcome"], "claimId": game["claimId"],
            "source": game["source"], "stopped": result["stopped"], "receipt": str(path)}


def bind_pin(path, pin):
    if path.exists():
        if json.loads(path.read_text()) != pin:
            raise ValueError(f"existing {path.name} differs from the approved invocation")
        return
    pending = path.with_suffix(".pending")
    pending.write_text(json.dumps(pin) + "\n")
    pending.replace(path)


def recorded_stop(path):
    try:
        lines = path.read_text().splitlines(keepends=True)
    except FileNotFoundError:
        return None
    for line in lines:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            if not line.endswith("\n"):  # A process may have died during the final append.
                break
            raise
        if event["event"] == "queue_stopped":
            return {key: event[key] for key in ("trigger", "gameId", "detail", "at")}
    return None


def game_history(game_state, pin):
    started = False
    terminal = None
    stop = None
    for attempt in sorted(game_state.glob("attempt-*")):
        started |= (attempt / "started").exists()
        out = attempt / "queue"
        receipt = terminal_receipt(out / "slate-receipt.json", pin)
        terminal = terminal or receipt
        stop = stop or (receipt and receipt["stopped"]) or recorded_stop(out / "slate-events.jsonl")
    if terminal and stop:
        terminal["stopped"] = stop
    return started, terminal, stop


def run(args):
    game_id, separator, start = args.game.partition("@")
    if not separator or not start or not re.fullmatch(r"[0-9]{10}", game_id) or args.confirm_game != game_id:
        raise ValueError("provide one game as ID@START and confirm that exact game ID")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.slate) or date.fromisoformat(args.slate).isoformat() != args.slate:
        raise ValueError("provide the approved slate date as YYYY-MM-DD")
    if "T" not in start or datetime.fromisoformat(start.replace("Z", "+00:00")).utcoffset() is None:
        raise ValueError("provide the approved start as an ISO instant with a time zone")
    if not re.fullmatch(r"[a-f0-9]{40}", args.sha):
        raise ValueError("provide the approved candidate's full commit SHA")
    if args.host != socket.gethostname():
        raise ValueError("host does not match the approved host name")
    if os.environ.get("FORGE_PREGAME_CAPTURE_ENABLED") != "true" or not args.approval or (
        args.approval != os.environ.get("FORGE_PREGAME_CAPTURE_APPROVAL")
    ):
        raise ValueError("the owner's enable and approval gates must be present")

    gate = args.gate.resolve(strict=True)
    if not gate.is_file():
        raise ValueError("provide the approved host's load gate script")
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(NODE_PATH=".", TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}')
    verify_candidate(args.sha, env)

    slate_pin = {"slate": args.slate, "sha": args.sha, "host": args.host, "policy": POLICY,
                 "gate": str(gate), "gateSha256": hashlib.sha256(gate.read_bytes()).hexdigest()}
    pin = {**slate_pin, "game": args.game, "id": int(game_id)}
    state = args.state.resolve()
    state.mkdir(mode=0o700, exist_ok=True)
    if state.stat().st_uid != os.getuid() or state.stat().st_mode & 0o077:
        raise ValueError("state directory must be private to the host user")
    with (state / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            report("in_progress")
            return 0

        bind_pin(state / "approved-slate.json", slate_pin)
        game_state = state / f"game-{game_id}"
        if (game_state / "approved-game.json").exists():
            bind_pin(game_state / "approved-game.json", pin)
        started, terminal, _ = game_history(game_state, pin)
        if terminal:
            report("terminal", **terminal)
            return 0
        for other in sorted(state.glob("game-*")):
            if other == game_state:
                continue
            other_id = int(other.name[len("game-"):])
            other_started, other_terminal, other_stop = game_history(other, {**slate_pin, "id": other_id})
            if other_stop or (other_started and not other_terminal):
                reason = "slate_stopped" if other_stop else "slate_custody_unresolved"
                report(reason, gameId=int(game_id), priorGameId=other_id,
                       trigger=other_stop["trigger"] if other_stop else None)
                return 1
        if started and not args.resume:
            report("resume_required", gameId=int(game_id))
            return 1
        if args.resume and not started:
            raise ValueError("resume requires a previous attempt for this approved game")

        plan_result = subprocess.run([*NODE, "-e", WAKE_PLAN, args.game, args.slate], cwd=WEB, env=env,
                                     capture_output=True, text=True, timeout=15)
        if plan_result.returncode != 0:
            raise ValueError("could not compute the wake window from the candidate slate planner")
        timing = json.loads(plan_result.stdout)
        if args.resume:
            # Fallible lookups in the queue may proceed as though no claim exists.
            # Once T−60 has passed, the planner cannot dispatch on that fallback.
            if timing["now"] <= timing["deadlineMs"]:
                report("resume_not_due", gameId=int(game_id), resumeAfter=timing["deadlineMs"])
                return 1
        elif timing["now"] < timing["dispatchAt"]:
            report("not_due", gameId=int(game_id), wakeAt=timing["dispatchAt"])
            return 0
        elif timing["now"] > timing["latestDispatchAt"]:
            report("missed_window", gameId=int(game_id), latestDispatchAt=timing["latestDispatchAt"])
            return 1

        game_state.mkdir(mode=0o700, exist_ok=True)
        bind_pin(game_state / "approved-game.json", pin)
        attempt = Path(tempfile.mkdtemp(prefix="attempt-", dir=game_state))
        out = attempt / "queue"
        command = [*NODE, ENTRY,
                   "--execute", "--games", args.game, "--confirm-game-ids", game_id, "--slate-date", args.slate,
                   "--approval", args.approval, "--code-version", args.sha, "--tsa-profile", "digicert-g4-v1",
                   "--out", str(out), "--gate", str(gate), "--concurrency", "1"]
        with (attempt / "launch.log").open("w") as log:
            # The child keeps the same lock even if the adapter process dies first.
            options = {"cwd": WEB, "env": env, "stdout": log, "stderr": subprocess.STDOUT, "pass_fds": (lock.fileno(),)}
            try:
                gate_status = subprocess.run(["/bin/zsh", str(gate)], timeout=60, **options).returncode
            except subprocess.TimeoutExpired:
                gate_status = None
            if gate_status != 0:
                report("load_gate_closed", gameId=int(game_id), attempt=str(attempt))
                return 1
            (attempt / "started").touch()
            child_status = subprocess.run(command, **options).returncode

        _, terminal, _ = game_history(game_state, pin)
        if terminal:
            report("terminal", **terminal)
            return 0
        report("resume_required", gameId=int(game_id), childStatus=child_status, attempt=str(attempt))
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("game", "confirm-game", "slate", "sha", "host", "approval"):
        parser.add_argument(f"--{flag}", required=True)
    parser.add_argument("--gate", required=True, type=Path)
    parser.add_argument("--state", required=True, type=Path, help="shared durable root for one host, slate and candidate")
    parser.add_argument("--resume", action="store_true", help="operator-approved reconciliation after an interrupted attempt")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        return run(args)
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        detail = "candidate verification or planning timed out" if isinstance(error, subprocess.TimeoutExpired) else str(error)
        report("refused", reason=detail)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

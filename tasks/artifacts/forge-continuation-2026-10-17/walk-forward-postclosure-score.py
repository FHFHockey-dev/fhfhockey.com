"""Post-closure descriptive scoring of the 2026-10-15 walk-forward issuance (TJ approval, chat 2026-10-17).

`capture` makes the approved reads only: 7 serial official boxscore GETs, 1 s apart, 20 s timeout,
2 MiB cap, no retries, stop on first failure. `score` is offline. Both write into a new private
directory with exclusive create and never touch the experiment folders. Scoring reuses the
evaluator's settlement normalization, metrics and pair-regret rule; it is outside the protocol's
settlement windows and is descriptive only.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))
from modeling.player_forecasts import forge_walk_forward as w  # noqa: E402

GAME_IDS = [2026020108, 2026020109, 2026020110, 2026020111, 2026020114, 2026020116, 2026020117]
PACKET = w.ROOT / "predictions/2026-10-15.json"
PACKET_SHA256 = "0fba9eb910cda1de3a03ddfe45d604d6fd6be5ad8bf79070646fbce6585ad3a0"
MAX_BYTES, TIMEOUT, SPACING = 2 * 1024 * 1024, 20, 1.0


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_new(path: Path, value) -> str:
    data = (value if isinstance(value, bytes) else json.dumps(value, indent=1, sort_keys=True).encode())
    with path.open("xb") as handle:
        handle.write(data)
    path.chmod(0o600)
    return hashlib.sha256(data).hexdigest()


def pinned_packet() -> dict:
    if w.file_hash(PACKET) != PACKET_SHA256:
        raise SystemExit("issued packet changed")
    packet = w.issued_packet(w.ROOT, PACKET)
    if packet is None or {r["gameId"] for r in packet["rows"]} != set(GAME_IDS):
        raise SystemExit("packet is not the valid Oct 15 issuance for the approved games")
    return packet


def capture(out: Path) -> None:
    pinned_packet()
    out.mkdir(mode=0o700)
    (out / "bodies").mkdir(mode=0o700)
    receipts = []
    for index, game_id in enumerate(GAME_IDS):
        if index:
            time.sleep(SPACING)
        url = f"https://api-web.nhle.com/v1/gamecenter/{game_id}/boxscore"
        started = utc()
        process = subprocess.run(["/usr/bin/curl", "--disable", "--silent", "--show-error", "--fail", "--proto", "=https",
            "--max-time", str(TIMEOUT), "--max-filesize", str(MAX_BYTES), url], capture_output=True, timeout=TIMEOUT + 5)
        received, body = utc(), process.stdout
        ok = process.returncode == 0 and 0 < len(body) <= MAX_BYTES
        receipt = {"gameId": game_id, "url": url, "startedAt": started, "receivedAt": received, "exitCode": process.returncode,
                   "bytes": len(body), "bodySha256": hashlib.sha256(body).hexdigest(), "status": "received" if ok else "failed",
                   "error": process.stderr.decode(errors="replace")[:300]}
        if ok:
            write_new(out / "bodies" / f"{game_id}.json", body)
        receipts.append(receipt)
        if not ok:
            break
    write_new(out / "receipts.json", {"version": "forge-walk-forward-postclosure-capture-v1", "attempted": len(receipts),
        "planned": len(GAME_IDS), "receipts": receipts})
    print(json.dumps({"attempted": len(receipts), "failed": [r["gameId"] for r in receipts if r["status"] != "received"],
                      "bytes": sum(r["bytes"] for r in receipts)}))


def score(out: Path) -> None:
    packet, protocol = pinned_packet(), w.load_protocol(w.ROOT)
    games = {g["id"]: g for d in protocol["days"] if d["date"] == "2026-10-15" for g in d["games"]}
    receipts = json.loads((out / "receipts.json").read_text())["receipts"]
    if [r["gameId"] for r in receipts if r["status"] == "received"] != GAME_IDS:
        raise SystemExit("capture incomplete; nothing scored")
    validated = utc()
    labels, settlements = {}, {}
    for receipt in receipts:
        path = out / "bodies" / f'{receipt["gameId"]}.json'
        if w.file_hash(path) != receipt["bodySha256"]:
            raise SystemExit("captured body changed")
        result = w.normalize_blocked_shots(json.loads(path.read_text()), games[receipt["gameId"]], receipt["receivedAt"], validated)
        settlements[receipt["gameId"]] = {"status": result["status"], "reason": result.get("reason"),
            "statuses": {str(r["playerId"]): r["status"] for r in result["rows"]}}
        for row in result["rows"]:
            labels[(row["playerId"], row["gameId"])] = row
    rows, matched, exclusions = [], [], []
    for row in packet["rows"]:
        key = (row["playerId"], row["gameId"])
        label = labels.get(key)
        observed = label["value"] if label and label["status"] == "positive_TOI" and label["teamId"] == row["teamId"] else None
        rows.append({"playerId": row["playerId"], "gameId": row["gameId"], "position": row["position"],
                     "currentHistoryBand": row["currentHistoryBand"], "observedStatus": label["status"] if label else "unlisted",
                     "observed": observed, "estimates": {m: {k: e.get(k) for k in ("mean", "p10", "p90", "basis")}
                                                         for m, e in row["estimates"].items()}})
        if observed is None:
            exclusions.append({"playerId": row["playerId"], "gameId": row["gameId"],
                               "reason": "positive_TOI_label_unavailable_or_team_conflict"})
        else:
            matched.append((row, observed))
    methods = {}
    for method in ("A", "B", "C"):
        scored = [(r["estimates"][method]["mean"], y) for r, y in matched if r["estimates"].get(method, {}).get("mean") is not None]
        bands = [(r["estimates"][method], y) for r, y in matched if r["estimates"].get(method, {}).get("p10") is not None]
        methods[method] = {**w.metrics(scored), "missing": len(matched) - len(scored),
                           "descriptiveBandCoverage": sum(e["p10"] <= y <= e["p90"] for e, y in bands) / len(bands) if bands else None}
    lookup = {(r["playerId"], r["gameId"]): r for r in packet["rows"]}
    observed_by_key = {(r["playerId"], r["gameId"]): y for r, y in matched}
    pairs = []
    for pair in packet["pairs"]:
        keys = [tuple(k) for k in pair]
        if not all(k in observed_by_key for k in keys):
            pairs.append({"keys": pair, "status": "unavailable"})
            continue
        regret = {}
        for method in ("A", "B", "C"):
            predicted = [lookup[k] for k in keys]
            if any(p["estimates"].get(method, {}).get("mean") is None for p in predicted):
                continue
            chosen = min(range(2), key=lambda i: (-predicted[i]["estimates"][method]["mean"], predicted[i]["nhlPlayerId"]))
            regret[method] = max(observed_by_key[k] for k in keys) - observed_by_key[keys[chosen]]
        pairs.append({"keys": pair, "status": "evaluated", "regret": regret})
    evaluated = [p for p in pairs if p["status"] == "evaluated"]
    report = {"version": "forge-walk-forward-postclosure-score-v1", "scoredAt": validated,
        "authority": "TJ (owner), chat 2026-10-17: approved 7 read-only boxscore GETs, score the Oct 15 issuance, record it, then release the 8 sealed games",
        "packet": {"path": "predictions/2026-10-15.json", "sha256": PACKET_SHA256, "issuedAt": packet["issuedAt"],
                   "issueDeadlineAt": packet["issueDeadlineAt"], "phase": packet["phase"], "selected": packet["selected"]},
        "experimentSha256": w.file_hash(w.ROOT / "protocol/experiment.json"),
        "scoringCode": {"script": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                        "evaluatorModule": hashlib.sha256(Path(w.__file__).read_bytes()).hexdigest()},
        "captureReceiptsSha256": w.file_hash(out / "receipts.json"),
        "target": "BLOCKED_SHOTS conditional on positive TOI", "settlements": {str(k): v for k, v in settlements.items()},
        "issuedPlayerGames": len(packet["rows"]), "pairedPositiveTOIRows": len(matched), "methods": methods,
        "pairs": pairs, "evaluatedPairs": len(evaluated),
        "pairMeanRegret": {m: sum(p["regret"][m] for p in evaluated if m in p["regret"]) / n
                           for m in ("A", "B", "C") if (n := sum(m in p["regret"] for p in evaluated))},
        "rows": rows, "exclusions": exclusions,
        "limitations": [
            "Post-closure, outside the protocol's settlement windows (2026-10-16 and 2026-10-17 10:00-10:30 ET); boxscores read 2026-10-17 or later.",
            "Adaptive-phase issuance; the protocol's final readout scored only the cancelled final days.",
            "One slate, 10 issued player-games: descriptive only, no method conclusion, promotion or calibration claim.",
            "Not FORGE-wide, production or RSO evidence."]}
    print(json.dumps({"sha256": write_new(out / "score.json", report), "matched": len(matched), "evaluatedPairs": len(evaluated),
                      "methods": {m: {k: v for k, v in s.items() if k in ("rows", "mae", "bias", "descriptiveBandCoverage")} for m, s in methods.items()},
                      "pairMeanRegret": report["pairMeanRegret"], "exclusions": len(exclusions)}, indent=1))


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("capture", "score"):
        raise SystemExit("usage: walk-forward-postclosure-score.py capture|score NEW_PRIVATE_DIR")
    (capture if sys.argv[1] == "capture" else score)(Path(sys.argv[2]))

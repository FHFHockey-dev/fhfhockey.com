"""Private, explicitly invoked FORGE evidence recorder. No acquisition or forecasting."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
from datetime import date, datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from .contract import LOCKBOX_END, LOCKBOX_START, repository_root
from .io import assert_output_outside_repository
from .pp_shot_support import BASE_SHA, PROTOCOL

CAPTURE_VERSION = "forge-pp-shot-capture-v1"
PACKET_VERSION = "forge-pp-shot-evidence-packet-v1"
REQUEST_VERSION = "forge-pp-shot-capture-request-v1"
SEAL_VERSION = "forge-pp-shot-seal-request-v1"
PRIMARY_CHECKOUT = Path("/Users/tim/Code/fhfhockey.com")
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_PACKET_BYTES = 256 * 1024 * 1024
MAX_FILES = 512
RATE_FIELDS = ("sog_per_60_last5", "sog_per_60_avg_last5", "sog_per_60_all", "sog_per_60_avg_all")
EXPOSURE_FIELDS = ("toi_seconds_total_last5", "toi_seconds_total_all")


def nullable(spec: Any) -> tuple:
    return ("nullable", spec)


def array(spec: Any) -> tuple:
    return ("array", spec)


def enum(*values: Any) -> frozenset:
    return frozenset(values)


# Mirrors the documented envelope types. Referenced producer payloads keep their own shape.
SCHEMAS: dict[str, Any] = {
    "File": {"path": "path", "sha256": "hash"},
    "Ref": {"path": "path", "sha256": "hash", "pointer": "pointer"},
    "Receipt": {"source_ref": "Ref", "source_revision": "text", "published_at": nullable("instant"),
                "received_at": nullable("instant"), "available_at": nullable("instant")},
    "Scalar": {"value": nullable("number"), "derivation_ref": nullable("Ref")},
    "Window": {"membership_rule_ref": "Ref", "weighting_recipe_ref": "Ref", "members": array({
        "game_id": "id", "team_id": "id", "source_ref": "Ref", "pp_seconds": nullable("number"),
        "pp_shots": nullable("count"), "rate_weight": nullable("number"), "receipt": "Receipt"}),
        "cumulative_pp_seconds": nullable("number"), "original_rate_denominator_seconds": nullable("number"),
        "coverage": enum("complete", "partial", "unknown"), "completeness_proof_ref": nullable("Ref")},
    "PPInput": {"original_read_index": "count", "original_row_pointer": "pointer", "supplement_ref": nullable("Ref"),
        "row": {key: nullable("number") for key in RATE_FIELDS + EXPOSURE_FIELDS},
        "windows": {"last5": nullable("Window"), "all": nullable("Window")}, "baseline_weight": "Scalar",
        "context": {key: "Scalar" for key in ("shot_quality", "on_ice", "team", "rest_schedule")}},
    "Opportunity": {"key": "text", "game_id": "id", "team_id": "id", "opponent_team_id": "id",
        "canonical_player_id": "id", "nhl_player_id": "id", "membership_revision": "text", "membership_ref": "Ref",
        "position": nullable(enum("F", "D")), "pp_input": nullable("PPInput"), "issued_projection_ref": nullable("Ref"),
        "baseline_pp_shots": "Scalar", "production_conditioning": enum("conditional_playing", "full_health_pace", "legacy_unclassified"),
        "workload": {"conditional_pp_seconds": "Scalar", "conditioning": enum("conditional_playing", "full_health_pace", "legacy_unclassified"),
                     "contract_ref": nullable("Ref")},
        "participation": {"probability": "Scalar", "status": enum("confirmed_evidence", "modelled", "missing"),
                          "evidence_refs": array("Ref"), "contract_ref": nullable("Ref")},
        "integration": {"basis": enum("existing_joint_scenarios", "existing_conditional_expectation", "unavailable"),
                        "contract_ref": nullable("Ref"), "joint_scenarios_ref": nullable("Ref"), "unconditional_pp_shots": "Scalar"},
        "segments": {"rookie": nullable("bool"), "traded": nullable("bool"), "availability_changed": nullable("bool"),
                     "evidence_refs": array("Ref")}},
    "Outcome": {"opportunity_key": "text", "game_id": "id", "team_id": "id", "canonical_player_id": "id", "nhl_player_id": "id",
        "target_key": enum("PP_SHOTS_ON_GOAL"), "target_version": enum("forge-pp-shots-outcome-v1"), "definition_ref": "Ref",
        "revision_id": "text", "supersedes_revision_id": nullable("text"), "finality": enum("pending", "final", "corrected"),
        "available_at": nullable("instant"), "receipts": array("Receipt"), "played": nullable("bool"),
        "pp_seconds": nullable("number"), "pp_shots": nullable("count"), "total_shots": nullable("count"),
        "coverage": enum("complete", "partial", "unknown"), "completeness_proof_ref": nullable("Ref"),
        "zero_basis": nullable(enum("observed_zero_shots", "observed_zero_pp_exposure", "certified_nonparticipation"))},
    "ZeroProof": {"version": enum("forge-pp-zero-proof-v1"), "opportunity_key": "text",
        "zero_basis": enum("observed_zero_shots", "observed_zero_pp_exposure", "certified_nonparticipation"),
        "fields": array({"field": enum("pp_seconds", "pp_shots", "total_shots"), "source_ref": "Ref"}), "evidence_refs": array("Ref")},
    "Coverage": {"games": array({"game_id": "id", **{key: "count" for key in (
        "cutoff_candidate_count", "opportunity_count", "issued_pp_count", "qualified_window_count", "unconditional_count", "final_label_count")}}),
        "exclusions": array({"opportunity_key": "text", "stage": enum("population", "features", "forecast", "outcome"),
                             "reason": "text", "evidence_refs": array("Ref")})},
    "DevelopmentUse": {"windows": array({"start": "date", "end": "date", "use": enum("untouched", "development_used", "protected", "unknown"),
        "purpose": "text", "recorded_at": "instant", "evidence_refs": array("Ref")}), "retrospective_or_prospective": enum("prospective")},
    "Game": {"game_id": "id", "slate_date": "date", "season_id": "id", "game_type": enum(2), "home_team_id": "id", "away_team_id": "id",
        "horizon_games": enum(1), **{key: "instant" for key in ("cutoff_at", "source_query_cutoff_at", "issued_at", "scheduled_start_at", "frozen_at")},
        "maximum_feature_available_at": nullable("instant"), **{key: "text" for key in ("run_id", "revision_id", "input_snapshot_id", "captured_code_version")},
        "input_snapshot_hash": "hash", "output_hash": "hash", "resolved_code_sha": "commit",
        **{key: "Ref" for key in ("code_bundle_ref", "nonsecret_config_ref", "frozen_board_source_ref", "issued_context_ref")},
        "schedule_receipts": array("Receipt"), "population_policy": {"id": "text", "definition": "text", "declared_at": "instant",
            "candidate_player_ids": array("id"), "roster_receipts": array("Receipt"), "completeness": enum("complete", "partial", "unknown"),
            "completeness_proof_ref": nullable("Ref")}},
}
SCHEMAS["DraftGame"] = {**SCHEMAS["Game"], "frozen_at": enum(None), "frozen_board_source_ref": enum(None), "issued_source_ref": "Ref"}
SCHEMAS["RecordRequest"] = {"version": enum(REQUEST_VERSION), "packet_id": "text", "scopes": array({"game_id": "id", "slate_date": "date"}),
    "files": array("File"), **{key: "Ref" for key in ("protocol_ref", "games_ref", "opportunities_ref", "coverage_ref", "development_use_ref")}}
SCHEMAS["SealRequest"] = {"version": enum(SEAL_VERSION), "packet_id": "text", "parent_manifest_sha256": "hash", "files": array("File"),
    "frozen_sources": array({"game_id": "id", "source_ref": "Ref"}), "outcomes_ref": "Ref", "coverage_ref": "Ref"}
SCHEMAS["Manifest"] = {"version": enum(CAPTURE_VERSION, PACKET_VERSION), "packet_id": "text", "exported_at": "instant",
    "experiment_base_sha": enum(BASE_SHA), "files": array("File"), "outcomes_ref": nullable("Ref"),
    **{key: "Ref" for key in ("protocol_ref", "games_ref", "opportunities_ref", "coverage_ref", "development_use_ref", "capture_receipt_ref")},
    "checkpoint_policy": enum("awaiting_frozen_final_pregame", "frozen_final_pregame"),
    "protected_inclusive": array("date"), "predictive_qualification": enum("pending")}
SCHEMAS["CaptureReceipt"] = {"version": enum("forge-pp-shot-capture-receipt-v1"), "phase": enum("pregame", "sealed"),
    "recorded_at": "instant", "scopes": array({"game_id": "id", "slate_date": "date"}), "request_ref": "Ref",
    "parent_manifest_ref": nullable("Ref"), "recorder_sha256": "hash", "qualification_blockers": array("text")}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _instant(value: str) -> datetime:
    if not isinstance(value, str) or not re.search(r"(?:Z|[+-]\d\d:\d\d)$", value):
        raise ValueError("timezone-qualified timestamp required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("invalid timestamp") from error
    return parsed.astimezone(timezone.utc)


def _relative(value: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError("local relative path required")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in (".", "..", "") for part in value.split("/")):
        raise ValueError("path traversal forbidden")
    return value


def _no_symlinks(path: Path) -> Path:
    path = path.expanduser().absolute()
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError("symlinks forbidden")
    return path


def _shape(value: Any, spec: Any, location: str = "envelope") -> None:
    if isinstance(spec, str) and spec in SCHEMAS:
        _shape(value, SCHEMAS[spec], location)
    elif isinstance(spec, dict):
        if not isinstance(value, dict) or set(value) != set(spec):
            raise ValueError(f"{location}: exact required fields differ")
        for key, child in spec.items():
            _shape(value[key], child, f"{location}.{key}")
    elif isinstance(spec, tuple):
        if spec[0] == "nullable" and value is None:
            return
        if spec[0] == "array":
            if not isinstance(value, list):
                raise ValueError(f"{location}: array required")
            for item in value:
                _shape(item, spec[1], location)
        else:
            _shape(value, spec[1], location)
    elif isinstance(spec, frozenset):
        if not any(type(value) is type(option) and value == option for option in spec):
            raise ValueError(f"{location}: invalid enum")
    elif spec == "instant":
        _instant(value)
    elif spec == "date":
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) or date.fromisoformat(value).isoformat() != value:
            raise ValueError(f"{location}: invalid date")
    elif spec == "path":
        _relative(value)
    elif spec == "pointer":
        if not isinstance(value, str) or value and (not value.startswith("/") or re.search(r"~(?![01])", value)):
            raise ValueError(f"{location}: invalid JSON Pointer")
    else:
        valid = {"text": lambda: isinstance(value, str) and bool(value.strip()),
                 "hash": lambda: isinstance(value, str) and bool(re.fullmatch(r"[a-f0-9]{64}", value)),
                 "commit": lambda: isinstance(value, str) and bool(re.fullmatch(r"[a-f0-9]{40}", value)),
                 "bool": lambda: type(value) is bool,
                 "id": lambda: type(value) is int and 0 < value <= 2**53 - 1,
                 "count": lambda: type(value) is int and 0 <= value <= 2**53 - 1,
                 "number": lambda: type(value) in (int, float) and math.isfinite(value) and value >= 0}[spec]()
        if not valid:
            raise ValueError(f"{location}: invalid {spec}")


def _pointer(value: Any, pointer: str) -> Any:
    _shape(pointer, "pointer")
    for token in pointer.split("/")[1:] if pointer else ():
        token = token.replace("~1", "/").replace("~0", "~")
        try:
            if isinstance(value, list):
                if not re.fullmatch(r"0|[1-9][0-9]*", token):
                    raise ValueError("invalid array pointer")
                value = value[int(token)]
            elif isinstance(value, dict):
                value = value[token]
            else:
                raise ValueError("pointer traverses scalar")
        except (KeyError, IndexError) as error:
            raise ValueError("unresolved JSON Pointer") from error
    return value


def _json(raw: bytes) -> Any:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError(f"nonfinite JSON constant: {value}")
    def finite(value):
        parsed = float(value)
        if not math.isfinite(parsed):
            raise ValueError("nonfinite JSON number")
        return parsed
    return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid, parse_float=finite)


def _bytes(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _read(path: Path) -> bytes:
    path = _no_symlinks(path)
    if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("bounded regular JSON file required")
    with path.open("rb") as handle:
        raw = handle.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError("file byte budget exceeded")
    return raw


class _Store:
    def __init__(self):
        self.raw: dict[str, bytes] = {}
        self.values: dict[str, Any] = {}
        self.hashes: dict[str, str] = {}

    def load(self, root: Path, entries: list[dict], *, recorder_files: bool = False) -> None:
        if len(entries) > MAX_FILES or len({entry["path"] for entry in entries}) != len(entries):
            raise ValueError("bounded unique file registry required")
        for entry in entries:
            _shape(entry, "File")
            name = entry["path"]
            if name.startswith("recorder/") and not recorder_files or name == "manifest.json":
                raise ValueError("reserved recorder path")
            raw = _read(root / name)
            digest = _hash(raw)
            if len(raw) > MAX_FILE_BYTES or digest != entry["sha256"]:
                raise ValueError(f"file hash mismatch: {name}")
            if name in self.raw and self.raw[name] != raw:
                raise ValueError("cannot replace retained source bytes")
            self.raw[name], self.values[name] = raw, _json(raw)
            self.hashes[name] = digest
        self.bounds()

    def bounds(self) -> None:
        if len(self.raw) > MAX_FILES or any(len(raw) > MAX_FILE_BYTES for raw in self.raw.values()) \
                or sum(map(len, self.raw.values())) > MAX_PACKET_BYTES:
            raise ValueError("retained packet file/byte budget exceeded")

    def add(self, kind: str, value: Any) -> dict:
        return self.add_raw(kind, _bytes(value))

    def add_raw(self, kind: str, raw: bytes) -> dict:
        digest = _hash(raw)
        name = f"recorder/{kind}-{digest}.json"
        self.raw[name], self.values[name], self.hashes[name] = raw, _json(raw), digest
        self.bounds()
        return {"path": name, "sha256": digest, "pointer": ""}

    def resolve(self, ref: dict) -> Any:
        _shape(ref, "Ref")
        if ref["path"] not in self.raw or self.hashes[ref["path"]] != ref["sha256"]:
            raise ValueError("reference not bound to registry bytes")
        return _pointer(self.values[ref["path"]], ref["pointer"])

    def references(self, value: Any) -> None:
        if isinstance(value, dict):
            if set(value) == {"path", "sha256", "pointer"}:
                self.resolve(value)
            else:
                for child in value.values():
                    self.references(child)
        elif isinstance(value, list):
            for child in value:
                self.references(child)


def _load_games_first(store: _Store, root: Path, files: list[dict], ref: dict, scopes: list[dict]) -> list[dict]:
    entry = next((entry for entry in files if entry["path"] == ref["path"] and entry["sha256"] == ref["sha256"]), None)
    if entry is None:
        raise ValueError("game envelope absent from registry")
    store.load(root, [entry], recorder_files=True)
    games = store.resolve(ref)
    if not isinstance(games, list):
        raise ValueError("game envelope must be an array")
    actual = [{"game_id": game["game_id"], "slate_date": game["slate_date"]} for game in games]
    _scopes(actual)
    if sorted((row["game_id"], row["slate_date"]) for row in actual) != sorted((row["game_id"], row["slate_date"]) for row in scopes):
        raise ValueError("capture header differs from game scope")
    return games


def _scopes(scopes: list[dict]) -> None:
    # Header validation must precede opening any feature or label file.
    _shape(scopes, array({"game_id": "id", "slate_date": "date"}))
    if not 1 <= len(scopes) <= 16 or len({row["game_id"] for row in scopes}) != len(scopes):
        raise ValueError("1–16 unique game scopes required")
    if any(LOCKBOX_START <= row["slate_date"] <= LOCKBOX_END for row in scopes):
        raise ValueError("protected slate cannot be read")


def _receipt_times(value: Any, cutoff: datetime, *, labels: bool = False) -> None:
    if isinstance(value, dict):
        if set(value) == set(SCHEMAS["Receipt"]):
            times = {key: _instant(value[key]) if value[key] else None for key in ("published_at", "received_at", "available_at")}
            if any(time and time > (_now() if labels else cutoff) for time in times.values()):
                raise ValueError("receipt is after allowed cutoff")
            if times["published_at"] and times["available_at"] and times["published_at"] > times["available_at"]:
                raise ValueError("source published after asserted availability")
        for child in value.values():
            _receipt_times(child, cutoff, labels=labels)
    elif isinstance(value, list):
        for child in value:
            _receipt_times(child, cutoff, labels=labels)


def _scalar(store: _Store, scalar: dict, *, probability: bool = False) -> None:
    if scalar["value"] is not None:
        if scalar["derivation_ref"] is None:
            raise ValueError("scalar must point to its original numerical value")
        original = store.resolve(scalar["derivation_ref"])
        _shape(original, "number")
        if original != scalar["value"]:
            raise ValueError("scalar must point to its original numerical value")
        if probability and scalar["value"] > 1:
            raise ValueError("probability/support weight outside [0,1]")


def _source(store: _Store, game: dict, source: dict, *, frozen: bool) -> dict:
    try:
        original_game, revision, observation = source["game"], source["revision"], source["observation"]
        snapshot = observation["payload"]
        checks = [original_game["id"] == game["game_id"], original_game["date"] == game["slate_date"],
            original_game["type"] == 2, original_game["homeTeamId"] == game["home_team_id"], original_game["awayTeamId"] == game["away_team_id"],
            revision["game_id"] == game["game_id"], revision["id"] == game["revision_id"], revision["run_id"] == game["run_id"],
            revision["input_snapshot_id"] == game["input_snapshot_id"] == observation["id"], revision["slate_date"] == game["slate_date"],
            observation["provider"] == "forge", observation["dataset_key"] == "forge-run-inputs-v1", observation["entity_key"] == game["run_id"],
            observation["payload_hash"] == game["input_snapshot_hash"], snapshot["version"] == "forge-inputs-v1",
            snapshot["runId"] == game["run_id"], snapshot["slateDate"] == game["slate_date"], snapshot["horizonGames"] == 1,
            game["game_id"] in snapshot["gameIds"], snapshot["replayClassification"] == "captured_live", not snapshot.get("controlledScenario"),
            snapshot["modelMode"] == revision["payload"]["modelMode"] == "baseline",
            snapshot["codeVersion"] == revision["payload"]["codeVersion"] == game["captured_code_version"],
            snapshot["outputHash"] == game["output_hash"], _instant(snapshot["decisionAsOf"]) == _instant(revision["decision_as_of"]) == _instant(game["cutoff_at"]),
            _instant(snapshot["inputCutoff"]) == _instant(game["source_query_cutoff_at"]), _instant(revision["published_at"]) == _instant(game["issued_at"])]
        cutoff, issued, start = (_instant(game[key]) for key in ("cutoff_at", "issued_at", "scheduled_start_at"))
        checks += [_instant(snapshot["inputCutoff"]) <= cutoff <= _instant(snapshot["capturedAt"]) <= _instant(observation["available_at"]) <= issued < start,
                   bool(snapshot["reads"]), game["home_team_id"] != game["away_team_id"]]
        for read in snapshot["reads"]:
            checks.append(_instant(read["receivedAt"]) <= cutoff)
        context = store.resolve(game["issued_context_ref"])
        cg = context["game"]
        checks += [context["version"] == "forge-issued-context-v1", cg["id"] == game["game_id"], cg["date"] == game["slate_date"],
            cg["seasonId"] == game["season_id"], cg["homeTeamId"] == game["home_team_id"], cg["awayTeamId"] == game["away_team_id"],
            _instant(cg["startTime"]) == start, _instant(context["observedAt"]) <= cutoff,
            store.resolve(game["code_bundle_ref"])["commit_sha"] == game["resolved_code_sha"]]
        config = store.resolve(game["nonsecret_config_ref"])
        for key in ("modelEnvironment", "deterministicSeed", "seasonBootstrapApplied"):
            checks.append(config.get(key) == snapshot.get(key))
        if frozen:
            checkpoint = source["frozen"]
            checks += [checkpoint["game_id"] == game["game_id"], checkpoint["revision_id"] == game["revision_id"],
                _instant(checkpoint["scheduled_start_at"]) == start, _instant(checkpoint["frozen_at"]) == _instant(game["frozen_at"]),
                start <= _instant(game["frozen_at"]) <= _now()]
        if not all(checks):
            raise ValueError("original FORGE identity/timing/baseline mismatch")
    except (KeyError, TypeError) as error:
        raise ValueError("original FORGE source is incomplete") from error
    return snapshot


def _selected_row(snapshot: dict, pp: dict, nhl_id: int, slate: str) -> dict:
    # Replay selection only, never forecasting. Group pagination/re-reads by exact query.
    batches: dict[str, list[tuple[int, dict]]] = {}
    for index, read in enumerate(snapshot["reads"]):
        operations = read["request"]
        if not operations or operations[0] != {"method": "from", "args": ["rolling_player_game_metrics"]}:
            continue
        filters = {op["args"][0]: op["args"][1] for op in operations if op["method"] == "eq"}
        ids = next((op["args"][1] for op in operations if op["method"] == "in" and op["args"][0] == "player_id"), [])
        if filters.get("strength_state") != "pp" or nhl_id not in ids:
            continue
        if not any(op["method"] == "lt" and op["args"] == ["game_date", slate] for op in operations):
            raise ValueError("PP query cutoff mismatch")
        orders = [op["args"] for op in operations if op["method"] == "order"]
        if orders != [["game_date", {"ascending": False}], ["player_id", {"ascending": True}], ["game_id", {"ascending": False}]]:
            raise ValueError("PP query must preserve original result ordering")
        lower = next((op["args"][1] for op in operations if op["method"] == "gt" and op["args"][0] == "game_date"), None)
        _shape(lower, "date")
        if lower >= slate:
            raise ValueError("invalid PP history lower bound")
        selection = next((op["args"][0] for op in operations if op["method"] == "select"), "")
        if not isinstance(selection, str) or not {"player_id", "game_id", "game_date", "strength_state"}.issubset(selection.split(",")):
            raise ValueError("PP select lacks source identity columns")
        signature = json.dumps([op for op in operations if op["method"] != "range"], sort_keys=True)
        page = next((op["args"] for op in operations if op["method"] == "range"), [])
        offset = page[0] if len(page) == 2 else None
        if type(offset) is not int or offset < 0 or page[1] != offset + 499:
            raise ValueError("original paginated PP query required")
        if offset == 0:
            batches[signature] = []
        if signature not in batches:
            raise ValueError("PP pagination lacks initial page")
        batches[signature].append((index, read))
    if not batches:
        raise ValueError("no original PP query for player")
    batch = max(batches.values(), key=lambda rows: rows[-1][0])
    candidates, seen, count, previous_order = [], 0, None, None
    identities = set()
    for index, read in batch:
        result = read["result"]
        offset = next(op["args"][0] for op in read["request"] if op["method"] == "range")
        if read.get("failure") or result.get("error") or offset != seen:
            raise ValueError("incomplete final PP query")
        _shape(result.get("count"), "count")
        if count is not None and result["count"] != count:
            raise ValueError("PP query changed during pagination")
        count = result["count"]
        if not isinstance(result["data"], list) or len(result["data"]) > 500:
            raise ValueError("PP page exceeds captured range")
        for position, row in enumerate(result["data"]):
            _shape(row["game_date"], "date")
            _shape(row["player_id"], "id")
            _shape(row["game_id"], "id")
            lower = next(op["args"][1] for op in read["request"] if op["method"] == "gt" and op["args"][0] == "game_date")
            if not lower < row["game_date"] < slate or row["strength_state"] != "pp":
                raise ValueError("PP row outside captured query bounds")
            ids = next(op["args"][1] for op in read["request"] if op["method"] == "in" and op["args"][0] == "player_id")
            order = (-date.fromisoformat(row["game_date"]).toordinal(), row["player_id"], -row["game_id"])
            identity = (row["player_id"], row["game_id"])
            if row["player_id"] not in ids or identity in identities or previous_order is not None and order < previous_order:
                raise ValueError("PP returned rows violate identity/result order")
            identities.add(identity)
            previous_order = order
            if row["player_id"] == nhl_id:
                candidates.append((index, f"/data/{position}", row))
        seen += len(result["data"])
    if seen != count or not candidates:
        raise ValueError("missing/truncated selected PP row")
    selected = candidates[0]
    for candidate in candidates[1:]:
        if candidate[2]["game_date"] > selected[2]["game_date"]:
            selected = candidate
    if (pp["original_read_index"], pp["original_row_pointer"]) != selected[:2] or selected[2]["strength_state"] != "pp":
        raise ValueError("PP input is not the final selected row")
    return selected[2]


def _window(store: _Store, window: dict, seconds: float | None, cutoff: datetime) -> None:
    _receipt_times(window, cutoff)
    identities = [(row["game_id"], row["team_id"]) for row in window["members"]]
    if len(set(identities)) != len(identities):
        raise ValueError("duplicate PP window member")
    if window["coverage"] == "complete":
        if window["completeness_proof_ref"] is None or any(row["pp_seconds"] is None or row["pp_shots"] is None
                or row["rate_weight"] is None or row["receipt"]["received_at"] is None for row in window["members"]):
            raise ValueError("complete PP window lacks proof/members")
        total = sum(row["pp_seconds"] for row in window["members"])
        if seconds is None or not math.isclose(total, seconds, abs_tol=1e-6, rel_tol=0) or window["cumulative_pp_seconds"] != seconds:
            raise ValueError("PP window exposure mismatch")
        if window["original_rate_denominator_seconds"] is None:
            raise ValueError("complete PP window lacks original denominator")


def _features(store: _Store, games: list[dict], opportunities: list[dict], *, draft: bool) -> None:
    _shape(games, array("DraftGame" if draft else "Game"))
    _shape(opportunities, array("Opportunity"))
    store.references(games)
    store.references(opportunities)
    seen_keys, mappings = set(), set()
    for game in games:
        cutoff = _instant(game["cutoff_at"])
        policy = game["population_policy"]
        if _instant(policy["declared_at"]) > cutoff or not game["schedule_receipts"] or not policy["roster_receipts"]:
            raise ValueError("cutoff-known schedule/population policy and receipts required")
        if policy["completeness"] == "complete" and policy["completeness_proof_ref"] is None:
            raise ValueError("complete population requires proof")
        ids = policy["candidate_player_ids"]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate population candidate")
        rows = [row for row in opportunities if row["game_id"] == game["game_id"]]
        if sorted(row["canonical_player_id"] for row in rows) != sorted(ids):
            raise ValueError("opportunity population differs from cutoff candidates")
        _receipt_times(game, cutoff)
        if game["maximum_feature_available_at"] is not None:
            raise ValueError("recorder cannot certify availability of all consumed sources; retain null")
        source = store.resolve(game["issued_source_ref"] if draft else game["frozen_board_source_ref"])
        snapshot = _source(store, game, source, frozen=not draft)
        context = store.resolve(game["issued_context_ref"])
        for row in rows:
            key = f'{row["game_id"]}:{row["team_id"]}:{row["canonical_player_id"]}'
            mapping = (row["game_id"], row["nhl_player_id"])
            if row["key"] != key or key in seen_keys or mapping in mappings:
                raise ValueError("duplicate/conflicting opportunity identity")
            seen_keys.add(key)
            mappings.add(mapping)
            if {row["team_id"], row["opponent_team_id"]} != {game["home_team_id"], game["away_team_id"]}:
                raise ValueError("opportunity team-stint mismatch")
            membership = store.resolve(row["membership_ref"])
            if membership not in context["roster"] or any(membership.get(field) != row[target] for field, target in (
                    ("canonicalId", "canonical_player_id"), ("nhlId", "nhl_player_id"), ("teamId", "team_id"), ("revision", "membership_revision"))) \
                    or membership.get("seasonId") != game["season_id"]:
                raise ValueError("original roster identity/revision mismatch")
            _receipt_times(row, cutoff)
            _scalar(store, row["baseline_pp_shots"])
            _scalar(store, row["workload"]["conditional_pp_seconds"])
            _scalar(store, row["participation"]["probability"], probability=True)
            _scalar(store, row["integration"]["unconditional_pp_shots"])
            issued_ref = row["issued_projection_ref"]
            if issued_ref is not None:
                issued = store.resolve(issued_ref)
                if issued not in source["revision"]["payload"]["players"] or any(issued.get(field) != row[target] for field, target in (
                    ("player_id", "canonical_player_id"), ("game_id", "game_id"), ("team_id", "team_id"))) \
                        or issued.get("run_id") != game["run_id"] or issued.get("horizon_games") != 1 \
                        or issued.get("proj_shots_pp") != row["baseline_pp_shots"]["value"] \
                        or issued.get("proj_toi_pp_seconds") != row["workload"]["conditional_pp_seconds"]["value"]:
                    raise ValueError("issued PP forecast/workload mismatch")
            elif row["baseline_pp_shots"]["value"] is not None:
                raise ValueError("missing issued row cannot have a baseline count")
            probability = row["participation"]["probability"]["value"]
            if row["participation"]["status"] == "missing" and probability is not None:
                raise ValueError("missing participation cannot have probability")
            integration = row["integration"]
            if integration["unconditional_pp_shots"]["value"] is not None and (probability is None or integration["contract_ref"] is None
                or integration["basis"] == "unavailable" or row["production_conditioning"] != "conditional_playing"
                or row["workload"]["conditioning"] != "conditional_playing" or row["participation"]["contract_ref"] is None
                or integration["basis"] == "existing_joint_scenarios" and integration["joint_scenarios_ref"] is None):
                raise ValueError("unconditional PP count lacks compatible dependence/conditioning")
            pp = row["pp_input"]
            if pp is None:
                continue
            original = _selected_row(snapshot, pp, row["nhl_player_id"], game["slate_date"])
            supplement = store.resolve(pp["supplement_ref"]) if pp["supplement_ref"] else None
            for field in RATE_FIELDS + EXPOSURE_FIELDS:
                actual = original.get(field)
                if field in EXPOSURE_FIELDS and actual is None and supplement is not None:
                    # An acquisition-owned same-revision sidecar, never a present-day repair.
                    _shape(supplement, {"input_snapshot_hash": "hash", "original_read_index": "count", "original_row_pointer": "pointer",
                        "source_revision": "text", "revision_proof_ref": "Ref", "receipt": "Receipt", "row": {key: nullable("number") for key in EXPOSURE_FIELDS}})
                    store.references(supplement)
                    _receipt_times(supplement, cutoff)
                    if (supplement["input_snapshot_hash"], supplement["original_read_index"], supplement["original_row_pointer"]) != (
                            game["input_snapshot_hash"], pp["original_read_index"], pp["original_row_pointer"]):
                        raise ValueError("PP supplement original row binding mismatch")
                    actual = supplement["row"][field]
                if pp["row"][field] != actual:
                    raise ValueError("PP rate/exposure differs from original source")
            _scalar(store, pp["baseline_weight"], probability=True)
            for scalar in pp["context"].values():
                _scalar(store, scalar)
            for window_name, window in pp["windows"].items():
                if window is not None:
                    _window(store, window, pp["row"][f"toi_seconds_total_{window_name}"], cutoff)
    if any(row["game_id"] not in {game["game_id"] for game in games} for row in opportunities):
        raise ValueError("opportunity outside packet game scope")


def _outcomes(store: _Store, outcomes: list[dict], opportunities: list[dict], previous: list[dict], games: list[dict]) -> None:
    _shape(outcomes, array("Outcome"))
    store.references(outcomes)
    by_key = {row["key"]: row for row in opportunities}
    before = {row["opportunity_key"]: row for row in previous}
    if len({row["opportunity_key"] for row in outcomes}) != len(outcomes):
        raise ValueError("one selected label revision per opportunity required")
    if not set(before).issubset({row["opportunity_key"] for row in outcomes}):
        raise ValueError("cannot drop a retained label")
    for label in outcomes:
        row = by_key.get(label["opportunity_key"])
        if row is None or any(label[key] != row[key] for key in ("game_id", "team_id", "canonical_player_id", "nhl_player_id")):
            raise ValueError("outcome identity outside frozen population")
        _receipt_times(label, _now(), labels=True)
        if label["available_at"] and _instant(label["available_at"]) > _now():
            raise ValueError("future outcome availability")
        start = _instant(next(game["scheduled_start_at"] for game in games if game["game_id"] == row["game_id"]))
        if label["finality"] != "pending" and (label["available_at"] is None or _instant(label["available_at"]) < start):
            raise ValueError("settled label cannot precede scheduled start")
        old = before.get(label["opportunity_key"])
        if old and label != old and (label["revision_id"] == old["revision_id"] or label["supersedes_revision_id"] != old["revision_id"]
                                   or label["finality"] != "corrected"):
            raise ValueError("label correction must supersede immutable selected revision")
        if label["coverage"] == "complete" and (label["completeness_proof_ref"] is None or not label["receipts"]
                or label["available_at"] is None or any(label[key] is None for key in ("played", "pp_seconds", "pp_shots"))):
            raise ValueError("complete PP label requires proof and observations")
        seconds, shots, total = (label[key] for key in ("pp_seconds", "pp_shots", "total_shots"))
        if shots is not None and total is not None and shots > total or shots and seconds == 0:
            raise ValueError("inconsistent PP shots/exposure/totals")
        if label["played"] is False and any(value not in (None, 0) for value in (seconds, shots, total)):
            raise ValueError("nonparticipant has positive outcome")
        if label["played"] is False and (label["coverage"] != "complete" or label["zero_basis"] != "certified_nonparticipation"):
            raise ValueError("nonparticipation requires a complete-source certificate")
        if any(value == 0 for value in (seconds, shots, total) if value is not None):
            basis = label["zero_basis"]
            if label["coverage"] != "complete" or basis is None or basis == "certified_nonparticipation" and label["played"] is not False \
                    or basis == "observed_zero_pp_exposure" and seconds != 0 or basis == "observed_zero_shots" and shots != 0:
                raise ValueError("zero outcome lacks matching complete-source basis")
            proof = store.resolve(label["completeness_proof_ref"])
            _shape(proof, "ZeroProof")
            store.references(proof)
            zeros = {key for key in ("pp_seconds", "pp_shots", "total_shots") if label[key] == 0 and label[key] is not None}
            if proof["opportunity_key"] != label["opportunity_key"] or proof["zero_basis"] != basis or not proof["evidence_refs"] \
                    or len(proof["fields"]) != len(zeros) or {item["field"] for item in proof["fields"]} != zeros:
                raise ValueError("zero proof must cover every numerical zero")
            for item in proof["fields"]:
                original = store.resolve(item["source_ref"])
                _shape(original, "number")
                if original != 0:
                    raise ValueError("zero proof must reference an explicit source zero")
        if label["finality"] != "pending" and (label["coverage"] != "complete" or label["pp_shots"] is None):
            raise ValueError("final PP label lacks complete evidence")


def _coverage(store: _Store, coverage: dict, games: list[dict], rows: list[dict], outcomes: list[dict]) -> None:
    _shape(coverage, "Coverage")
    store.references(coverage)
    if sorted(row["game_id"] for row in coverage["games"]) != sorted(game["game_id"] for game in games):
        raise ValueError("coverage game scope mismatch")
    keys = {row["key"] for row in rows}
    for exclusion in coverage["exclusions"]:
        if exclusion["opportunity_key"] not in keys:
            raise ValueError("exclusion outside frozen population")
    for game in games:
        game_rows = [row for row in rows if row["game_id"] == game["game_id"]]
        expected = {"game_id": game["game_id"], "cutoff_candidate_count": len(game["population_policy"]["candidate_player_ids"]),
            "opportunity_count": len(game_rows), "issued_pp_count": sum(row["baseline_pp_shots"]["value"] is not None for row in game_rows),
            "qualified_window_count": 0, "unconditional_count": sum(row["integration"]["unconditional_pp_shots"]["value"] is not None for row in game_rows),
            "final_label_count": sum(label["game_id"] == game["game_id"] and label["finality"] != "pending" for label in outcomes)}
        if next(row for row in coverage["games"] if row["game_id"] == game["game_id"]) != expected:
            raise ValueError("coverage counts differ from retained rows; windows remain unqualified")
        for row in game_rows:
            missing = [("features", row["pp_input"] is None), ("forecast", row["baseline_pp_shots"]["value"] is None),
                       ("outcome", not any(label["opportunity_key"] == row["key"] and label["finality"] != "pending" for label in outcomes))]
            if any(absent and not any(item["opportunity_key"] == row["key"] and item["stage"] == stage for item in coverage["exclusions"])
                   for stage, absent in missing):
                raise ValueError("missing evidence requires disclosed exclusion")


def _development(store: _Store, ref: dict, games: list[dict]) -> None:
    record = store.resolve(ref)
    _shape(record, "DevelopmentUse")
    store.references(record)
    for window in record["windows"]:
        if window["start"] > window["end"] or _instant(window["recorded_at"]) > _now():
            raise ValueError("invalid development-use window")
    if any(not any(window["start"] <= game["slate_date"] <= window["end"] for window in record["windows"]) for game in games):
        raise ValueError("every slate needs a prior-development-use disclosure")


def _publish(output: Path, store: _Store, manifest: dict) -> dict:
    output = _no_symlinks(output)
    assert_output_outside_repository(output, repository_root())
    assert_output_outside_repository(output, PRIMARY_CHECKOUT)
    manifest["files"] = [{"path": name, "sha256": store.hashes[name]} for name in sorted(store.raw)]
    _shape(manifest, "Manifest")
    store.references(manifest)
    store.bounds()
    manifest_raw = _bytes(manifest)
    if len(store.raw) + 1 > MAX_FILES or len(manifest_raw) > MAX_FILE_BYTES \
            or sum(map(len, store.raw.values())) + len(manifest_raw) > MAX_PACKET_BYTES:
        raise ValueError("complete packet file/byte budget exceeded")
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    try:
        for name, raw in {**store.raw, "manifest.json": manifest_raw}.items():
            destination = output / name
            directory = output
            for part in PurePosixPath(name).parts[:-1]:
                directory = directory / part
                directory.mkdir(exist_ok=True, mode=0o700)
            with os.fdopen(os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
        for directory in {output.parent, output, *(path for path in output.rglob("*") if path.is_dir())}:
            descriptor = os.open(directory, os.O_RDONLY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
    except Exception:
        shutil.rmtree(output)
        raise
    return {"packet_id": manifest["packet_id"], "manifest_sha256": _hash(_bytes(manifest)), "version": manifest["version"],
            "predictive_qualification": "pending", "decision": "retain_baseline", "training_run": False, "serving_enabled": False}


def record_pregame(request_path: Path, output: Path) -> dict:
    """Persist supplied original receipts before start. Unknown evidence stays unqualified."""
    request_path = _no_symlinks(request_path)
    request_raw = _read(request_path)
    request = _json(request_raw)
    _shape(request, "RecordRequest")
    _scopes(request["scopes"])
    store = _Store()
    games = _load_games_first(store, request_path.parent, request["files"], request["games_ref"], request["scopes"])
    store.load(request_path.parent, request["files"])
    store.references(request)
    if store.resolve(request["protocol_ref"]) != PROTOCOL:
        raise ValueError("unchanged predeclared PP protocol required")
    rows, coverage = (store.resolve(request[key]) for key in ("opportunities_ref", "coverage_ref"))
    _shape(games, array("DraftGame"))
    now = _now()
    if any(not _instant(game["issued_at"]) <= now < _instant(game["scheduled_start_at"]) for game in games):
        raise ValueError("prospective capture must occur after issue and before scheduled start")
    _features(store, games, rows, draft=True)
    _coverage(store, coverage, games, rows, [])
    _development(store, request["development_use_ref"], games)
    receipt_ref = store.add("receipt", {"version": "forge-pp-shot-capture-receipt-v1", "phase": "pregame",
        "recorded_at": now.isoformat(), "scopes": request["scopes"], "request_ref": store.add_raw("request", request_raw),
        "parent_manifest_ref": None, "recorder_sha256": _hash(Path(__file__).read_bytes()),
        "qualification_blockers": ["semantic_hash_and_exact_code_replay_unverified", "original_feature_availability_requires_qualification",
            "captured_query_selection_not_verified_against_issued_code", "PP_window_weighting_requires_qualification", "frozen_checkpoint_pending", "outcome_evidence_pending"]})
    manifest = {"version": CAPTURE_VERSION, "packet_id": request["packet_id"], "exported_at": now.isoformat(), "experiment_base_sha": BASE_SHA,
        **{key: request[key] for key in ("protocol_ref", "games_ref", "opportunities_ref", "coverage_ref", "development_use_ref")},
        "outcomes_ref": None, "capture_receipt_ref": receipt_ref, "checkpoint_policy": "awaiting_frozen_final_pregame",
        "protected_inclusive": [LOCKBOX_START, LOCKBOX_END], "predictive_qualification": "pending"}
    return _publish(output, store, manifest)


def seal_packet(parent_path: Path, request_path: Path, output: Path) -> dict:
    """Create a new immutable packet with supplied freeze/label revisions; never revise features."""
    parent_path, request_path = _no_symlinks(parent_path), _no_symlinks(request_path)
    parent_raw, request_raw = _read(parent_path), _read(request_path)
    parent, request = _json(parent_raw), _json(request_raw)
    _shape(parent, "Manifest")
    _shape(request, "SealRequest")
    draft = parent["version"] == CAPTURE_VERSION
    if parent["protected_inclusive"] != [LOCKBOX_START, LOCKBOX_END] or parent["checkpoint_policy"] != (
            "awaiting_frozen_final_pregame" if draft else "frozen_final_pregame") or (parent["outcomes_ref"] is None) != draft:
        raise ValueError("parent lifecycle/lockbox contract mismatch")
    if _hash(parent_raw) != request["parent_manifest_sha256"] or parent["packet_id"] == request["packet_id"]:
        raise ValueError("distinct packet revision and exact parent manifest hash required")
    # Read only the tiny lifecycle receipt first, to enforce the lockbox before source files.
    receipt_ref = parent["capture_receipt_ref"]
    receipt_file = _no_symlinks(parent_path.parent / receipt_ref["path"])
    receipt_raw = _read(receipt_file)
    if _hash(receipt_raw) != receipt_ref["sha256"]:
        raise ValueError("capture receipt hash mismatch")
    receipt = _pointer(_json(receipt_raw), receipt_ref["pointer"])
    _shape(receipt, "CaptureReceipt")
    if receipt["phase"] != ("pregame" if draft else "sealed") or _instant(receipt["recorded_at"]) > _now():
        raise ValueError("parent capture receipt phase/time mismatch")
    _scopes(receipt["scopes"])
    store = _Store()
    games = _load_games_first(store, parent_path.parent, parent["files"], parent["games_ref"], receipt["scopes"])
    store.load(parent_path.parent, parent["files"], recorder_files=True)
    store.references(parent)
    store.load(request_path.parent, request["files"])
    store.references(request)
    rows = store.resolve(parent["opportunities_ref"])
    _features(store, games, rows, draft=draft)
    if sorted((game["game_id"], game["slate_date"]) for game in games) != sorted((scope["game_id"], scope["slate_date"]) for scope in receipt["scopes"]):
        raise ValueError("parent receipt game scope mismatch")
    if sorted(source["game_id"] for source in request["frozen_sources"]) != sorted(game["game_id"] for game in games):
        raise ValueError("one unchanged frozen source per game required")
    sealed = []
    for game in games:
        frozen_ref = next(source["source_ref"] for source in request["frozen_sources"] if source["game_id"] == game["game_id"])
        frozen = store.resolve(frozen_ref)
        original = store.resolve(game["issued_source_ref"] if draft else game["frozen_board_source_ref"])
        if {key: value for key, value in frozen.items() if key != "frozen"} != {key: value for key, value in original.items() if key != "frozen"}:
            raise ValueError("freeze cannot change original feature/forecast source")
        new_game = {key: value for key, value in game.items() if key != "issued_source_ref"}
        new_game.update(frozen_at=frozen["frozen"]["frozen_at"], frozen_board_source_ref=frozen_ref)
        if not draft and new_game["frozen_at"] != game["frozen_at"]:
            raise ValueError("cannot replace the original frozen checkpoint")
        if draft and not _instant(game["issued_at"]) <= _instant(receipt["recorded_at"]) < _instant(game["scheduled_start_at"]):
            raise ValueError("parent was not recorded prospectively")
        _shape(new_game, "Game")
        _source(store, new_game, frozen, frozen=True)
        sealed.append(new_game)
    outcomes, coverage = (store.resolve(request[key]) for key in ("outcomes_ref", "coverage_ref"))
    # Current readiness may change; earlier disclosures remain in the selected coverage ledger.
    old_coverage = store.resolve(parent["coverage_ref"])
    _shape(coverage, "Coverage")
    coverage = {"games": coverage["games"], "exclusions": list(coverage["exclusions"])}
    for exclusion in old_coverage["exclusions"]:
        if exclusion not in coverage["exclusions"]:
            coverage["exclusions"].append(exclusion)
    previous = store.resolve(parent["outcomes_ref"]) if parent["outcomes_ref"] else []
    _outcomes(store, outcomes, rows, previous, sealed)
    _coverage(store, coverage, sealed, rows, outcomes)
    receipt_ref = store.add("receipt", {"version": "forge-pp-shot-capture-receipt-v1", "phase": "sealed",
        "recorded_at": _now().isoformat(), "scopes": receipt["scopes"], "request_ref": store.add_raw("request", request_raw),
        "parent_manifest_ref": store.add_raw("parent-manifest", parent_raw), "recorder_sha256": _hash(Path(__file__).read_bytes()),
        "qualification_blockers": ["semantic_hash_and_exact_code_replay_unverified", "original_feature_availability_requires_qualification",
            "captured_query_selection_not_verified_against_issued_code", "PP_window_weighting_requires_qualification", "PP_strength_definition_and_completeness_require_qualification"]})
    manifest = {**parent, "version": PACKET_VERSION, "packet_id": request["packet_id"], "exported_at": _now().isoformat(),
        "games_ref": store.add("games", sealed), "outcomes_ref": request["outcomes_ref"], "coverage_ref": store.add("coverage", coverage),
        "capture_receipt_ref": receipt_ref, "checkpoint_policy": "frozen_final_pregame"}
    return _publish(output, store, manifest)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    record = commands.add_parser("record", help="record original pregame evidence; no collection/model execution")
    record.add_argument("--request", type=Path, required=True)
    record.add_argument("--output", type=Path, required=True)
    seal = commands.add_parser("seal", help="append freeze/label revisions into a fresh immutable packet")
    seal.add_argument("--parent-manifest", type=Path, required=True)
    seal.add_argument("--request", type=Path, required=True)
    seal.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = record_pregame(args.request, args.output) if args.command == "record" else seal_packet(args.parent_manifest, args.request, args.output)
    except (ValueError, OSError, RuntimeError, KeyError, TypeError) as error:
        parser.exit(2, f"capture rejected: {error}\n")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .audit import run_audit
from .challenger_freeze import freeze_challenger_dataset
from .challenger_features import TARGETS, build_validation_features
from .challenger_model import train_validation_challenger, verify_validation_challenger_artifact
from .contract import (
    DEVELOPMENT_END,
    TARGET_SEASON,
    load_and_verify_contract,
    load_and_verify_validation_contract,
    repository_root,
)
from .features import build_features
from .freeze import freeze_dataset, freeze_prospective_dataset
from .io import assert_output_outside_repository, read_json, require_database_url, write_json
from .lockbox import complete_lockbox_evidence_once, evaluate_lockbox_once, evaluate_prospective_once
from .model import seal_for_lockbox, train_baseline, verify_model_artifact, verify_serving_bundle
from .scoring import evaluate_range


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="python -m modeling.player_forecasts")
    commands = root.add_subparsers(dest="command", required=True)
    audit = commands.add_parser("audit")
    audit.add_argument("--output", type=Path, required=True)
    freeze = commands.add_parser("freeze")
    freeze.add_argument("--output", type=Path, required=True)
    freeze.add_argument("--history-season", type=int, action="append", default=[20242025])
    validation_freeze = commands.add_parser("freeze-validation-challenger")
    validation_freeze.add_argument("--output", type=Path, required=True)
    validation_freeze.add_argument(
        "--history-season", type=int, action="append", default=[20232024, 20242025]
    )
    validation_features = commands.add_parser("build-validation-features")
    validation_features.add_argument("--freeze", type=Path, required=True)
    validation_features.add_argument("--target", action="append", choices=list(TARGETS))
    validation_train = commands.add_parser("train-validation-challenger")
    validation_train.add_argument("--freeze", type=Path, required=True)
    validation_verify = commands.add_parser("verify-validation-challenger-artifact")
    validation_verify.add_argument("--artifact", type=Path, required=True)
    prospective_freeze = commands.add_parser("freeze-prospective")
    prospective_freeze.add_argument("--output", type=Path, required=True)
    prospective_freeze.add_argument("--artifact", type=Path, required=True)
    prospective_freeze.add_argument("--primary-receipt", type=Path, required=True)
    prospective_freeze.add_argument(
        "--history-season", type=int, action="append", default=[20242025, 20252026]
    )
    for name in ("build-features", "train", "evaluate-development"):
        command = commands.add_parser(name)
        command.add_argument("--freeze", type=Path, required=True)
    seal = commands.add_parser("seal-for-lockbox")
    seal.add_argument("--freeze", type=Path, required=True)
    verify = commands.add_parser("verify-artifact")
    verify.add_argument("--artifact", type=Path, required=True)
    bundle = commands.add_parser("verify-serving-bundle")
    bundle.add_argument("--artifact", type=Path, required=True)
    bundle.add_argument("--primary-receipt", type=Path, required=True)
    bundle.add_argument("--evidence", type=Path, required=True)
    lockbox = commands.add_parser("evaluate-lockbox")
    lockbox.add_argument("--freeze", type=Path, required=True)
    lockbox.add_argument("--receipt", type=Path, required=True)
    complete = commands.add_parser("complete-lockbox-evidence")
    complete.add_argument("--freeze", type=Path, required=True)
    complete.add_argument("--receipt", type=Path, required=True)
    complete.add_argument("--output", type=Path, required=True)
    prospective = commands.add_parser("evaluate-prospective")
    prospective.add_argument("--freeze", type=Path, required=True)
    prospective.add_argument("--primary-receipt", type=Path, required=True)
    prospective.add_argument("--output", type=Path, required=True)
    prospective.add_argument("--start", required=True)
    prospective.add_argument("--end", required=True)
    return root


def main() -> None:
    arguments = parser().parse_args()
    if arguments.command in {
        "freeze-validation-challenger", "build-validation-features", "train-validation-challenger",
        "verify-validation-challenger-artifact",
    }:
        load_and_verify_validation_contract()
    else:
        load_and_verify_contract()
    if arguments.command == "audit":
        assert_output_outside_repository(arguments.output, repository_root())
        result = run_audit(require_database_url(), TARGET_SEASON)
        write_json(arguments.output, result)
    elif arguments.command == "freeze":
        assert_output_outside_repository(arguments.output, repository_root())
        result = freeze_dataset(require_database_url(), arguments.output, arguments.history_season)
    elif arguments.command == "freeze-validation-challenger":
        assert_output_outside_repository(arguments.output, repository_root())
        result = freeze_challenger_dataset(
            require_database_url(), arguments.output, arguments.history_season
        )
    elif arguments.command == "build-validation-features":
        result = build_validation_features(
            arguments.freeze,
            tuple(arguments.target) if arguments.target else TARGETS,
        )
    elif arguments.command == "train-validation-challenger":
        result = train_validation_challenger(arguments.freeze)
    elif arguments.command == "verify-validation-challenger-artifact":
        result = verify_validation_challenger_artifact(arguments.artifact)
    elif arguments.command == "freeze-prospective":
        assert_output_outside_repository(arguments.output, repository_root())
        result = freeze_prospective_dataset(
            require_database_url(),
            arguments.output,
            arguments.history_season,
            arguments.artifact,
            arguments.primary_receipt,
        )
    elif arguments.command == "build-features":
        result = build_features(arguments.freeze)
        manifest = read_json(arguments.freeze / "manifest.json")
        manifest["features"] = result
        write_json(arguments.freeze / "manifest.json", manifest)
    elif arguments.command == "train":
        result = train_baseline(arguments.freeze)
    elif arguments.command == "evaluate-development":
        result = evaluate_range(arguments.freeze, None, DEVELOPMENT_END)
    elif arguments.command == "seal-for-lockbox":
        result = seal_for_lockbox(arguments.freeze)
    elif arguments.command == "verify-artifact":
        result = verify_model_artifact(arguments.artifact)
    elif arguments.command == "verify-serving-bundle":
        result = verify_serving_bundle(
            arguments.artifact,
            arguments.primary_receipt,
            arguments.evidence,
        )
    elif arguments.command == "complete-lockbox-evidence":
        assert_output_outside_repository(arguments.output, repository_root())
        result = complete_lockbox_evidence_once(arguments.freeze, arguments.receipt, arguments.output)
    elif arguments.command == "evaluate-prospective":
        assert_output_outside_repository(arguments.output, repository_root())
        result = evaluate_prospective_once(
            arguments.freeze,
            arguments.primary_receipt,
            arguments.output,
            arguments.start,
            arguments.end,
        )
    else:
        assert_output_outside_repository(arguments.receipt, repository_root())
        result = evaluate_lockbox_once(arguments.freeze, arguments.receipt)
    print(json.dumps(result, indent=2, sort_keys=True, default=str))


if __name__ == "__main__":
    main()

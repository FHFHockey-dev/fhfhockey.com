from __future__ import annotations

import argparse
import json
from pathlib import Path

from .audit import run_audit
from .advanced import (
    build_advanced_settlement_bundle,
    evaluate_advanced_batch,
    evaluate_fantasy_batch,
    freeze_advanced_sources,
    project_advanced_release,
    run_advanced_source_audit,
    train_advanced_artifact,
)
from .challenger_freeze import freeze_challenger_dataset
from .challenger_features import TARGETS, build_validation_features
from .challenger_model import train_validation_challenger, verify_validation_challenger_artifact
from .contract import (
    ADVANCED_SEASON_CONTRACT_VERSION,
    FANTASY_SEASON_CONTRACT_VERSION,
    SEASON_CONTRACT_VERSION,
    DEVELOPMENT_END,
    TARGET_SEASON,
    load_and_verify_contract,
    load_and_verify_season_contract,
    load_and_verify_validation_contract,
    repository_root,
)
from .features import build_features
from .freeze import freeze_dataset, freeze_prospective_dataset
from .io import assert_output_outside_repository, read_json, require_database_url, write_json
from .lockbox import complete_lockbox_evidence_once, evaluate_lockbox_once, evaluate_prospective_once
from .model import seal_for_lockbox, train_baseline, verify_model_artifact, verify_serving_bundle
from .scoring import evaluate_range
from .rookies import capture_player_landings
from .season import (
    build_season_settlement_bundle,
    freeze_season_dataset,
    project_season_release,
    run_season_audit,
    train_season_artifact,
    verify_season_release_bundle,
    verify_season_settlement_bundle,
)


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
    season_audit = commands.add_parser("season-audit")
    season_audit.add_argument("--output", type=Path, required=True)
    season_freeze = commands.add_parser("season-freeze")
    season_freeze.add_argument("--output", type=Path, required=True)
    season_freeze.add_argument(
        "--history-season", type=int, action="append", default=[20232024, 20242025]
    )
    season_freeze.add_argument(
        "--base-freeze",
        type=Path,
        help="Reuse checksum-verified historical files while refreshing current identities and official state.",
    )
    season_train = commands.add_parser("season-train")
    season_train.add_argument("--freeze", type=Path, required=True)
    season_train.add_argument("--output", type=Path, required=True)
    season_train.add_argument(
        "--contract-version",
        choices=(SEASON_CONTRACT_VERSION, FANTASY_SEASON_CONTRACT_VERSION),
        default=SEASON_CONTRACT_VERSION,
    )
    season_train.add_argument("--rookie-freeze", type=Path)
    rookie_freeze = commands.add_parser("season-rookie-freeze")
    rookie_freeze.add_argument("--freeze", type=Path, required=True)
    rookie_freeze.add_argument("--output", type=Path, required=True)
    rookie_freeze.add_argument("--workers", type=int, default=12)
    season_project = commands.add_parser("season-project")
    season_project.add_argument("--freeze", type=Path, required=True)
    season_project.add_argument("--artifact", type=Path, required=True)
    season_project.add_argument("--output", type=Path, required=True)
    season_project.add_argument("--view", choices=("opening", "current", "ros"), required=True)
    season_project.add_argument("--cutoff", required=True)
    season_verify = commands.add_parser("season-verify")
    season_verify.add_argument("--bundle", type=Path, required=True)
    season_settle = commands.add_parser("season-settle")
    season_settle.add_argument("--freeze", type=Path, required=True)
    season_settle.add_argument("--output", type=Path, required=True)
    season_settle.add_argument("--cutoff", required=True)
    season_settle.add_argument(
        "--contract-version",
        choices=(SEASON_CONTRACT_VERSION, FANTASY_SEASON_CONTRACT_VERSION),
        default=SEASON_CONTRACT_VERSION,
    )
    season_settlement_verify = commands.add_parser("season-settlement-verify")
    season_settlement_verify.add_argument("--bundle", type=Path, required=True)
    season_v4_evaluate = commands.add_parser("season-v4-evaluate")
    season_v4_evaluate.add_argument("--artifact", type=Path, required=True)
    season_v4_evaluate.add_argument("--output", type=Path, required=True)
    season_advanced_audit = commands.add_parser("season-advanced-audit")
    season_advanced_audit.add_argument("--output", type=Path, required=True)
    season_advanced_freeze = commands.add_parser("season-advanced-freeze")
    season_advanced_freeze.add_argument("--output", type=Path, required=True)
    season_advanced_freeze.add_argument("--v4-receipt", type=Path, required=True)
    season_advanced_freeze.add_argument(
        "--history-season",
        type=int,
        action="append",
        default=[20222023, 20232024, 20242025, 20252026],
    )
    season_advanced_train = commands.add_parser("season-advanced-train")
    season_advanced_train.add_argument("--freeze", type=Path, required=True)
    season_advanced_train.add_argument("--v4-artifact", type=Path, required=True)
    season_advanced_train.add_argument("--output", type=Path, required=True)
    season_advanced_evaluate = commands.add_parser("season-advanced-evaluate")
    season_advanced_evaluate.add_argument("--artifact", type=Path, required=True)
    season_advanced_evaluate.add_argument("--output", type=Path, required=True)
    season_advanced_project = commands.add_parser("season-advanced-project")
    season_advanced_project.add_argument("--artifact", type=Path, required=True)
    season_advanced_project.add_argument("--v4-bundle", type=Path, required=True)
    season_advanced_project.add_argument("--receipt", type=Path, required=True)
    season_advanced_project.add_argument("--output", type=Path, required=True)
    season_advanced_settle = commands.add_parser("season-advanced-settle")
    season_advanced_settle.add_argument("--base-settlement", type=Path, required=True)
    season_advanced_settle.add_argument("--advanced-freeze", type=Path, required=True)
    season_advanced_settle.add_argument("--output", type=Path, required=True)
    return root


def main() -> None:
    arguments = parser().parse_args()
    season_commands = {
        "season-audit", "season-freeze", "season-train", "season-project", "season-verify",
        "season-settle", "season-settlement-verify", "season-rookie-freeze",
        "season-v4-evaluate", "season-advanced-audit", "season-advanced-freeze",
        "season-advanced-train", "season-advanced-evaluate", "season-advanced-project",
        "season-advanced-settle",
    }
    if arguments.command in season_commands:
        contract_version = getattr(arguments, "contract_version", SEASON_CONTRACT_VERSION)
        if arguments.command in {"season-rookie-freeze", "season-v4-evaluate"}:
            contract_version = FANTASY_SEASON_CONTRACT_VERSION
        elif arguments.command in {
            "season-advanced-audit", "season-advanced-freeze", "season-advanced-train",
            "season-advanced-evaluate", "season-advanced-project",
            "season-advanced-settle",
        }:
            contract_version = ADVANCED_SEASON_CONTRACT_VERSION
        load_and_verify_season_contract(contract_version)
    elif arguments.command in {
        "freeze-validation-challenger", "build-validation-features", "train-validation-challenger",
        "verify-validation-challenger-artifact",
    }:
        load_and_verify_validation_contract()
    else:
        load_and_verify_contract()
    if arguments.command == "season-audit":
        assert_output_outside_repository(arguments.output, repository_root())
        result = run_season_audit(require_database_url())
        write_json(arguments.output, result)
    elif arguments.command == "season-freeze":
        assert_output_outside_repository(arguments.output, repository_root())
        result = freeze_season_dataset(
            require_database_url(), arguments.output, arguments.history_season, arguments.base_freeze
        )
    elif arguments.command == "season-train":
        assert_output_outside_repository(arguments.output, repository_root())
        result = train_season_artifact(
            arguments.freeze,
            arguments.output,
            contract_version=arguments.contract_version,
            rookie_freeze=arguments.rookie_freeze,
        )
    elif arguments.command == "season-rookie-freeze":
        assert_output_outside_repository(arguments.output, repository_root())
        result = capture_player_landings(
            arguments.freeze,
            arguments.output,
            max_workers=arguments.workers,
        )
    elif arguments.command == "season-project":
        assert_output_outside_repository(arguments.output, repository_root())
        result = project_season_release(
            arguments.freeze,
            arguments.artifact,
            arguments.output,
            arguments.view,
            arguments.cutoff,
        )
    elif arguments.command == "season-verify":
        result = verify_season_release_bundle(arguments.bundle)
    elif arguments.command == "season-settle":
        assert_output_outside_repository(arguments.output, repository_root())
        result = build_season_settlement_bundle(
            arguments.freeze,
            arguments.output,
            arguments.cutoff,
            arguments.contract_version,
        )
    elif arguments.command == "season-settlement-verify":
        result = verify_season_settlement_bundle(arguments.bundle)
    elif arguments.command == "season-v4-evaluate":
        assert_output_outside_repository(arguments.output, repository_root())
        result = evaluate_fantasy_batch(arguments.artifact, arguments.output)
    elif arguments.command == "season-advanced-audit":
        assert_output_outside_repository(arguments.output, repository_root())
        result = run_advanced_source_audit(require_database_url())
        write_json(arguments.output, result)
    elif arguments.command == "season-advanced-freeze":
        assert_output_outside_repository(arguments.output, repository_root())
        result = freeze_advanced_sources(
            require_database_url(),
            arguments.output,
            arguments.history_season,
            arguments.v4_receipt,
        )
    elif arguments.command == "season-advanced-train":
        assert_output_outside_repository(arguments.output, repository_root())
        result = train_advanced_artifact(
            arguments.freeze,
            arguments.v4_artifact,
            arguments.output,
        )
    elif arguments.command == "season-advanced-evaluate":
        assert_output_outside_repository(arguments.output, repository_root())
        result = evaluate_advanced_batch(arguments.artifact, arguments.output)
    elif arguments.command == "season-advanced-project":
        assert_output_outside_repository(arguments.output, repository_root())
        result = project_advanced_release(
            arguments.artifact,
            arguments.v4_bundle,
            arguments.receipt,
            arguments.output,
        )
    elif arguments.command == "season-advanced-settle":
        assert_output_outside_repository(arguments.output, repository_root())
        result = build_advanced_settlement_bundle(
            arguments.base_settlement,
            arguments.advanced_freeze,
            arguments.output,
        )
    elif arguments.command == "audit":
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

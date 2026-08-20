from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
import hashlib
import math
from pathlib import Path
import random
from typing import Any

from .contract import (
    ADVANCED_SEASON_CONTRACT_SHA256,
    ADVANCED_SEASON_CONTRACT_VERSION,
    FANTASY_SEASON_CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_VERSION,
)
from .database import readonly_connection, stream_query
from .io import canonical_json, read_json, read_jsonl, write_json, write_jsonl
from .season import (
    GOALIE_FANTASY_V4_TARGETS,
    GOALIE_TARGETS,
    SKATER_FANTASY_V4_TARGETS,
    SKATER_TARGETS,
)


SKATER_ADVANCED_TARGETS = (
    "SHOT_ATTEMPTS",
    "UNBLOCKED_SHOT_ATTEMPTS",
    "EXPECTED_GOALS",
    "EXPECTED_PRIMARY_ASSISTS",
    "EXPECTED_SECONDARY_ASSISTS",
    "HIGH_DANGER_SHOTS",
    "MID_RANGE_SHOTS",
    "LONG_RANGE_SHOTS",
    "RUSH_SHOTS",
    "REBOUND_SHOTS",
    "REBOUNDS_CREATED",
    "ON_ICE_SHOT_ATTEMPTS_FOR",
    "ON_ICE_SHOT_ATTEMPTS_AGAINST",
    "ON_ICE_UNBLOCKED_ATTEMPTS_FOR",
    "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST",
    "ON_ICE_EXPECTED_GOALS_FOR",
    "ON_ICE_EXPECTED_GOALS_AGAINST",
)

GOALIE_ADVANCED_TARGETS = (
    "EXPECTED_GOALS_AGAINST_GOALIE",
    "HIGH_DANGER_SHOTS_AGAINST_GOALIE",
    "HIGH_DANGER_GOALS_AGAINST_GOALIE",
    "MID_RANGE_SHOTS_AGAINST_GOALIE",
    "MID_RANGE_GOALS_AGAINST_GOALIE",
    "LONG_RANGE_SHOTS_AGAINST_GOALIE",
    "LONG_RANGE_GOALS_AGAINST_GOALIE",
)

TEAM_ADVANCED_TARGETS = (
    "TEAM_SHOT_ATTEMPTS_FOR",
    "TEAM_SHOT_ATTEMPTS_AGAINST",
    "TEAM_UNBLOCKED_ATTEMPTS_FOR",
    "TEAM_UNBLOCKED_ATTEMPTS_AGAINST",
    "TEAM_EXPECTED_GOALS_FOR",
    "TEAM_EXPECTED_GOALS_AGAINST",
    "TEAM_HIGH_DANGER_SHOTS_FOR",
    "TEAM_HIGH_DANGER_SHOTS_AGAINST",
    "TEAM_PACE",
)

DEVELOPMENT_END = date(2026, 1, 2)
VALIDATION_START = date(2026, 1, 3)
VALIDATION_END = date(2026, 4, 16)
DANGER_TAXONOMY_VERSION = "player-forecasts-v5-distance-bands-v1"

PLAYER_ON_ICE_QUERY = """
with champion as (
  select model_version
  from public.nhl_xg_model_registry
  where prediction_type = 'shot_goal'
    and model_approved is true
    and approval_status = 'approved'
  order by is_champion desc, is_active desc, registered_at desc, model_version
  limit 1
), events as (
  select feature.game_id, feature.season_id, feature.game_date,
         feature.event_id, feature.period_number,
         feature.period_seconds_elapsed, feature.event_owner_team_id,
         feature.is_unblocked_shot_attempt,
         coalesce(prediction.xg, 0)::double precision as xg
  from public.nhl_xg_shot_features feature
  left join champion on true
  left join public.nhl_xg_shot_predictions prediction
    on prediction.model_version = champion.model_version
   and prediction.prediction_type = 'shot_goal'
   and prediction.feature_version = feature.feature_version
   and prediction.game_id = feature.game_id
   and prediction.event_id = feature.event_id
   and prediction.model_approved is true
  where feature.season_id = any(%s)
    and feature.is_penalty_shot_event is false
    and feature.is_shootout_event is false
), player_events as (
  select distinct shift.game_id, shift.season_id, shift.game_date,
         shift.player_id, shift.team_id, event.event_id,
         event.event_owner_team_id, event.is_unblocked_shot_attempt,
         event.xg
  from public.nhl_api_shift_rows shift
  join events event
    on event.game_id = shift.game_id
   and event.period_number = shift.period
   and event.period_seconds_elapsed >= shift.start_seconds
   and event.period_seconds_elapsed <= shift.end_seconds
  where shift.season_id = any(%s)
    and shift.duration_seconds > 0
)
select season_id, game_id, game_date, player_id, team_id,
       count(*) filter (where event_owner_team_id = team_id)::integer
         as on_ice_shot_attempts_for,
       count(*) filter (where event_owner_team_id <> team_id)::integer
         as on_ice_shot_attempts_against,
       count(*) filter (
         where event_owner_team_id = team_id and is_unblocked_shot_attempt
       )::integer as on_ice_unblocked_attempts_for,
       count(*) filter (
         where event_owner_team_id <> team_id and is_unblocked_shot_attempt
       )::integer as on_ice_unblocked_attempts_against,
       coalesce(sum(xg) filter (where event_owner_team_id = team_id), 0)::double precision
         as on_ice_expected_goals_for,
       coalesce(sum(xg) filter (where event_owner_team_id <> team_id), 0)::double precision
         as on_ice_expected_goals_against
from player_events
group by season_id, game_id, game_date, player_id, team_id
order by season_id, game_id, player_id, team_id
"""


SOURCE_TABLES: dict[str, dict[str, Any]] = {
    "normalized_play_by_play": {
        "table": "nhl_api_pbp_events",
        "select": "season_id, game_id, game_date, event_id, period_number, period_seconds_elapsed, event_owner_team_id, type_desc_key, scoring_player_id, shooting_player_id, assist1_player_id, assist2_player_id",
        "order": "season_id, game_id, event_id",
        "approved": None,
    },
    "official_shifts": {
        "table": "nhl_api_shift_rows",
        "select": "season_id, game_id, game_date, player_id, team_id, period, start_seconds, end_seconds, duration_seconds",
        "order": "season_id, game_id, player_id, period, start_seconds",
        "approved": None,
    },
    "shot_features": {
        "table": "nhl_xg_shot_features",
        "select": "feature_version, game_id, event_id, season_id, game_date, event_owner_team_id, shooter_player_id, goalie_in_net_id, is_goal, is_shot_on_goal, is_unblocked_shot_attempt, is_rebound_shot, is_rush_shot, shot_distance_feet, is_penalty_shot_event, is_shootout_event, is_empty_net_event",
        "order": "season_id, game_id, event_id, feature_version",
        "approved": None,
    },
    "shot_predictions": {
        "table": "nhl_xg_shot_predictions",
        "select": "model_version, prediction_type, feature_version, game_id, event_id, season_id, game_date, event_owner_team_id, shooter_player_id, goalie_in_net_id, xg, model_approved",
        "order": "season_id, game_id, event_id, model_version, prediction_type",
        "approved": "model_approved",
    },
    "shot_assist_candidates": {
        "table": "nhl_xg_shot_assist_candidates",
        "select": "model_version, feature_version, season_id, game_id, game_date, event_id, event_owner_team_id, shooter_player_id, shot_assist_player_id, candidate_rank, expected_primary_assists, confidence_tier",
        "order": "season_id, game_id, event_id, candidate_rank, shot_assist_player_id",
        "approved": None,
    },
    "player_xg": {
        "table": "nhl_xg_player_game_aggregates",
        "select": "model_version, feature_version, season_id, game_id, game_date, player_id, team_id, ixg, goals, shot_attempts, source_model_approved",
        "order": "season_id, game_id, player_id, model_version",
        "approved": "source_model_approved",
    },
    "player_created_xg": {
        "table": "nhl_xg_player_created_xg_game_aggregates",
        "select": "model_version, feature_version, season_id, game_id, game_date, player_id, team_id, shot_assist_created_xg, transition_created_xg, rebound_created_xg, created_xg, shot_assist_events, transition_events, rebound_events",
        "order": "season_id, game_id, player_id, model_version",
        "approved": None,
    },
    "player_rebounds": {
        "table": "nhl_xg_rebound_control_player_game_aggregates",
        "select": "rebound_model_version, feature_version, season_id, game_id, game_date, player_id, team_id, expected_rebounds_created, actual_rebounds_created, rebound_source_shots, source_model_approved, confidence",
        "order": "season_id, game_id, player_id, rebound_model_version",
        "approved": "source_model_approved",
    },
    "goalie_xg": {
        "table": "nhl_xg_goalie_game_aggregates",
        "select": "model_version, feature_version, season_id, game_id, game_date, goalie_player_id, team_id, opponent_team_id, xg_against, goals_against, shots_against, goals_saved_above_expected, source_model_approved",
        "order": "season_id, game_id, goalie_player_id, model_version",
        "approved": "source_model_approved",
    },
    "goalie_rebounds": {
        "table": "nhl_xg_rebound_control_goalie_game_aggregates",
        "select": "rebound_model_version, feature_version, season_id, game_id, game_date, goalie_player_id, team_id, opponent_team_id, expected_rebounds_allowed, actual_rebounds_allowed, rebound_control_saved_above_expected, rebound_source_shots_against, source_model_approved, confidence",
        "order": "season_id, game_id, goalie_player_id, rebound_model_version",
        "approved": "source_model_approved",
    },
    "team_xg": {
        "table": "nhl_xg_team_game_aggregates",
        "select": "model_version, feature_version, season_id, game_id, game_date, team_id, opponent_team_id, is_home, xg_for, xg_against, goals_for, goals_against, shot_attempts_for, shot_attempts_against, source_model_approved",
        "order": "season_id, game_id, team_id, model_version",
        "approved": "source_model_approved",
    },
}


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_status(connection: Any, name: str, spec: dict[str, Any]) -> dict[str, Any]:
    table = str(spec["table"])
    exists = connection.execute(
        "select pg_catalog.to_regclass(%s) is not null as present",
        (f"public.{table}",),
    ).fetchone()["present"]
    if not exists:
        return {
            "source": name,
            "table": table,
            "present": False,
            "rows": 0,
            "approvedRows": 0,
            "games": 0,
            "seasons": [],
        }
    columns = {
        str(row["column_name"])
        for row in connection.execute(
            """
            select column_name from information_schema.columns
            where table_schema = 'public' and table_name = %s
            """,
            (table,),
        ).fetchall()
    }
    approved = str(spec["approved"]) if spec.get("approved") else None
    approved_expression = (
        f"count(*) filter (where {approved} is true)" if approved else "count(*)"
    )
    freshness_column = next(
        (
            candidate
            for candidate in ("updated_at", "created_at", "fetched_at", "ingested_at")
            if candidate in columns
        ),
        None,
    )
    freshness_expression = (
        f"max({freshness_column})::text" if freshness_column else "null::text"
    )
    row = connection.execute(
        f"""
        select count(*)::bigint as rows,
               {approved_expression}::bigint as approved_rows,
               count(distinct game_id)::bigint as games,
               coalesce(array_agg(distinct season_id order by season_id)
                 filter (where season_id is not null), '{{}}') as seasons,
               {freshness_expression} as source_fresh_at
        from public.{table}
        """
    ).fetchone()
    return {
        "source": name,
        "table": table,
        "present": True,
        "rows": int(row["rows"]),
        "approvedRows": int(row["approved_rows"]),
        "games": int(row["games"]),
        "seasons": [int(value) for value in row["seasons"]],
        "sourceFreshAt": row["source_fresh_at"],
    }


def run_advanced_source_audit(database_url: str) -> dict[str, Any]:
    with readonly_connection(database_url) as connection:
        sources = {
            name: _source_status(connection, name, spec)
            for name, spec in SOURCE_TABLES.items()
        }
        registry_present = connection.execute(
            "select pg_catalog.to_regclass('public.nhl_xg_model_registry') is not null as present"
        ).fetchone()["present"]
        registry = []
        if registry_present:
            registry = [
                dict(row)
                for row in connection.execute(
                    """
                    select model_version, prediction_type, feature_version,
                           artifact_checksum, calibration_fingerprint,
                           approval_status, model_approved, is_active, is_champion
                    from public.nhl_xg_model_registry
                    where model_approved is true and approval_status = 'approved'
                    order by prediction_type, is_champion desc, is_active desc,
                             registered_at desc, model_version
                    """
                ).fetchall()
            ]
    approved_types = {str(row["prediction_type"]) for row in registry}
    required = (
        "normalized_play_by_play",
        "official_shifts",
        "shot_features",
        "shot_predictions",
        "shot_assist_candidates",
        "player_xg",
        "goalie_xg",
        "team_xg",
    )
    blockers = [
        f"{name}_missing_or_empty"
        for name in required
        if not sources[name]["present"] or sources[name]["rows"] == 0
    ]
    if sources["shot_predictions"]["approvedRows"] == 0:
        blockers.append("approved_shot_predictions_missing")
    if "shot_goal" not in approved_types:
        blockers.append("approved_shot_goal_registry_artifact_missing")
    if "rebound_creation" not in approved_types:
        blockers.append("approved_rebound_registry_artifact_missing")
    return {
        "schemaVersion": "player-forecast-advanced-source-audit-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "sources": sources,
        "approvedModels": registry,
        "targetSources": {
            "shot_attempts_and_danger": ["shot_features", "shot_predictions"],
            "expected_goals": ["shot_predictions", "player_xg", "goalie_xg", "team_xg"],
            "expected_primary_assists": ["shot_assist_candidates"],
            "expected_secondary_assists": ["normalized_play_by_play", "shot_assist_candidates", "player_created_xg"],
            "on_ice_shares": ["official_shifts", "normalized_play_by_play", "shot_predictions"],
            "rebounds": ["player_rebounds", "goalie_rebounds"],
        },
        "dangerTaxonomy": {
            "status": "must_be_versioned_in_feature_payload",
            "policy": "No distance bucket is inferred or coerced during the source audit.",
        },
        "blockers": sorted(set(blockers)),
        "eligibleForFreeze": not blockers,
    }


def evaluate_fantasy_batch(artifact_dir: Path, output: Path) -> dict[str, Any]:
    artifact_path = artifact_dir / "season-artifact.json"
    report_path = artifact_dir / "training-report.json"
    artifact_manifest_path = artifact_dir / "artifact-manifest.json"
    artifact = read_json(artifact_path)
    report = read_json(report_path)
    artifact_manifest = read_json(artifact_manifest_path)
    if (
        artifact.get("contractVersion") != FANTASY_SEASON_CONTRACT_VERSION
        or artifact.get("contractChecksum") != FANTASY_SEASON_CONTRACT_SHA256
        or artifact_manifest.get("artifactChecksum") != _file_sha256(artifact_path)
    ):
        raise RuntimeError("v4 artifact contract or checksum mismatch")
    policies = report.get("targetPolicies") or artifact.get("selectionEvidence") or {}
    required = {
        "forward": SKATER_TARGETS + SKATER_FANTASY_V4_TARGETS,
        "defense": SKATER_TARGETS + SKATER_FANTASY_V4_TARGETS,
        "goalie": GOALIE_TARGETS + GOALIE_FANTASY_V4_TARGETS,
    }
    target_results: list[dict[str, Any]] = []
    for population, targets in required.items():
        for target in targets:
            policy = (policies.get(population) or {}).get(target) or {}
            selected = policy.get("validationMae")
            baseline = policy.get("baselineMae")
            coverage = policy.get("calibration80Coverage")
            calibration_method = policy.get("calibrationMethod")
            loss_noninferior = bool(
                selected is not None
                and baseline is not None
                and math.isfinite(float(selected))
                and math.isfinite(float(baseline))
                and float(selected) <= float(baseline) + 1e-12
            )
            calibrated = bool(
                coverage is not None
                and 0.75 <= float(coverage) <= 0.85
                and calibration_method == "rolling_origin_randomized_conformal_p10_p90"
            )
            target_results.append({
                "population": population,
                "target": target,
                "rows": int(policy.get("rows") or 0),
                "players": int(policy.get("players") or 0),
                "selectedModel": policy.get("modelFamily"),
                "baselineModel": policy.get("baselineModel"),
                "validationMae": selected,
                "baselineMae": baseline,
                "chronologicalLift": policy.get("chronologicalLift"),
                "calibration80Coverage": coverage,
                "calibrationObservedCoverage": policy.get("calibrationObservedCoverage"),
                "calibrationTieProbability": policy.get("calibrationTieProbability"),
                "calibrationMethod": calibration_method,
                "lossNoninferior": loss_noninferior,
                "calibrationAccepted": calibrated,
                "fallback": bool(policy.get("fallback")),
            })
    rookie_validation = (
        (artifact.get("review") or {}).get("rookieModel") or {}
    ).get("validation") or {}
    blockers = []
    for result in target_results:
        if result["rows"] <= 0:
            blockers.append(f"{result['population']}:{result['target']}:missing_support")
        if not result["lossNoninferior"]:
            blockers.append(f"{result['population']}:{result['target']}:loss_regression")
        if not result["calibrationAccepted"]:
            blockers.append(f"{result['population']}:{result['target']}:interval_calibration")
    if rookie_validation.get("eligibleForServing") is not True:
        blockers.append("rookie_model_validation")
    unsigned = {
        "schemaVersion": "player-forecast-fantasy-v4-evaluation-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": FANTASY_SEASON_CONTRACT_SHA256,
        "artifactChecksum": artifact_manifest["artifactChecksum"],
        "targetResults": target_results,
        "rookieValidation": rookie_validation,
        "blockers": sorted(set(blockers)),
        "eligibleForAdvancedBatch": not blockers,
        "evidencePolicy": "2025-26 is chronological validation/training evidence, not a new blind test.",
    }
    receipt = {
        **unsigned,
        "receiptHash": hashlib.sha256(canonical_json(unsigned).encode()).hexdigest(),
    }
    write_json(output, receipt)
    return receipt


def freeze_advanced_sources(
    database_url: str,
    output: Path,
    seasons: list[int],
    v4_receipt_path: Path,
) -> dict[str, Any]:
    receipt = read_json(v4_receipt_path)
    unsigned_receipt = {
        key: value for key, value in receipt.items() if key != "receiptHash"
    }
    if (
        receipt.get("schemaVersion") != "player-forecast-fantasy-v4-evaluation-v1"
        or receipt.get("contractVersion") != FANTASY_SEASON_CONTRACT_VERSION
        or receipt.get("contractChecksum") != FANTASY_SEASON_CONTRACT_SHA256
        or receipt.get("eligibleForAdvancedBatch") is not True
        or receipt.get("receiptHash")
        != hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest()
    ):
        raise RuntimeError("advanced source freeze requires a passing checksum-bound v4 receipt")
    audit = run_advanced_source_audit(database_url)
    if audit["eligibleForFreeze"] is not True:
        raise RuntimeError(
            "advanced source audit is blocked: " + ", ".join(audit["blockers"])
        )
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "source-audit.json", audit)
    files: dict[str, dict[str, Any]] = {}
    with readonly_connection(database_url) as connection:
        for name, spec in SOURCE_TABLES.items():
            approved = str(spec["approved"]) if spec.get("approved") else None
            approved_clause = f" and {approved} is true" if approved else ""
            query = (
                f"select {spec.get('select', '*')} from public.{spec['table']} "
                f"where season_id = any(%s){approved_clause} order by {spec['order']}"
            )
            row_count, checksum = write_jsonl(
                output / f"{name}.jsonl",
                stream_query(connection, f"advanced_{name}", query, (seasons,)),
            )
            files[name] = {
                "path": f"{name}.jsonl",
                "rows": row_count,
                "sha256": checksum,
            }
        row_count, checksum = write_jsonl(
            output / "player_on_ice.jsonl",
            stream_query(
                connection,
                "advanced_player_on_ice",
                PLAYER_ON_ICE_QUERY,
                (seasons, seasons),
            ),
        )
        files["player_on_ice"] = {
            "path": "player_on_ice.jsonl",
            "rows": row_count,
            "sha256": checksum,
        }
    manifest = {
        "schemaVersion": "player-forecast-advanced-source-freeze-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "historySeasons": sorted(set(int(season) for season in seasons)),
        "v4Receipt": {
            "path": str(v4_receipt_path.resolve()),
            "sha256": _file_sha256(v4_receipt_path),
            "receiptHash": receipt["receiptHash"],
        },
        "sourceAudit": {
            "path": "source-audit.json",
            "sha256": _file_sha256(output / "source-audit.json"),
        },
        "files": files,
        "availabilityPolicy": "Only recorded cutoff-safe source rows are frozen; missing rows remain missing and never become zero.",
        "trainingStatus": "source_frozen_not_trained",
    }
    manifest["manifestHash"] = hashlib.sha256(
        canonical_json(manifest).encode()
    ).hexdigest()
    write_json(output / "manifest.json", manifest)
    return manifest


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if math.isfinite(parsed) else default


def _day(value: Any) -> date:
    return date.fromisoformat(str(value)[:10])


def _rounded(value: float) -> float:
    return round(float(value), 10)


def _quantile(values: list[float], probability: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(float(value) for value in values)
    rank = max(0, min(len(ordered) - 1, math.ceil(probability * (len(ordered) + 1)) - 1))
    return ordered[rank]


def _verified_v4_artifact(path: Path) -> tuple[dict[str, Any], str]:
    artifact_path = path / "season-artifact.json" if path.is_dir() else path
    artifact = read_json(artifact_path)
    checksum = _file_sha256(artifact_path)
    if (
        artifact.get("contractVersion") != FANTASY_SEASON_CONTRACT_VERSION
        or artifact.get("contractChecksum") != FANTASY_SEASON_CONTRACT_SHA256
    ):
        raise RuntimeError("advanced training requires a checksum-bound v4 artifact")
    manifest_path = artifact_path.parent / "artifact-manifest.json"
    if manifest_path.exists() and read_json(manifest_path).get("artifactChecksum") != checksum:
        raise RuntimeError("v4 artifact checksum does not match its manifest")
    return artifact, checksum


def _assert_advanced_freeze(path: Path) -> dict[str, Any]:
    manifest = read_json(path / "manifest.json")
    if (
        manifest.get("schemaVersion") != "player-forecast-advanced-source-freeze-v1"
        or manifest.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION
        or manifest.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256
    ):
        raise RuntimeError("advanced source freeze contract mismatch")
    for metadata in (manifest.get("files") or {}).values():
        source_path = path / str(metadata["path"])
        if _file_sha256(source_path) != metadata.get("sha256"):
            raise RuntimeError(f"advanced source checksum mismatch: {metadata['path']}")
    return manifest


def _empty_observation(entity_id: int, game_id: int, game_date: Any, team_id: Any, targets: tuple[str, ...]) -> dict[str, Any]:
    return {
        "entityId": entity_id,
        "gameId": game_id,
        "gameDate": str(game_date)[:10],
        "teamId": int(team_id) if team_id is not None else None,
        "values": {target: 0.0 for target in targets},
    }


def _fit_rate_policy(
    observations: list[dict[str, Any]],
    target: str,
    prior_strength: float,
    source_game_coverage: float,
) -> tuple[dict[str, Any], dict[str, float]]:
    rows = [
        (int(row["entityId"]), _day(row["gameDate"]), _number(row["values"].get(target)))
        for row in observations
    ]
    development = [row for row in rows if row[1] <= DEVELOPMENT_END]
    validation = [row for row in rows if VALIDATION_START <= row[1] <= VALIDATION_END]
    fit_rows = development or rows
    prior = sum(row[2] for row in fit_rows) / max(1, len(fit_rows))
    development_by_entity: dict[int, list[float]] = defaultdict(list)
    for entity_id, _, value in fit_rows:
        development_by_entity[entity_id].append(value)
    challenger_rates = {
        entity_id: (sum(values) + prior_strength * prior) / (len(values) + prior_strength)
        for entity_id, values in development_by_entity.items()
    }
    baseline_errors = [abs(value - prior) for _, _, value in validation]
    challenger_errors = [
        abs(value - challenger_rates.get(entity_id, prior))
        for entity_id, _, value in validation
    ]
    baseline_mae = sum(baseline_errors) / max(1, len(baseline_errors))
    challenger_mae = sum(challenger_errors) / max(1, len(challenger_errors))
    sufficient = len(validation) >= 100 and len({row[0] for row in validation}) >= 20
    selected_challenger = sufficient and challenger_mae <= baseline_mae + 1e-12
    selected_errors = challenger_errors if selected_challenger else baseline_errors
    residual_quantile = _quantile(selected_errors, 0.8)
    below = sum(error < residual_quantile for error in selected_errors)
    ties = sum(math.isclose(error, residual_quantile, rel_tol=0, abs_tol=1e-12) for error in selected_errors)
    tie_probability = (
        min(1.0, max(0.0, (0.8 * len(selected_errors) - below) / ties))
        if ties else 0.0
    )
    expected_coverage = (
        (below + tie_probability * ties) / len(selected_errors)
        if selected_errors else 0.0
    )
    inclusive_coverage = (
        sum(error <= residual_quantile + 1e-12 for error in selected_errors) / len(selected_errors)
        if selected_errors else 0.0
    )
    selected_ties = 0
    for (entity_id, observed_day, _), error in zip(validation, selected_errors):
        if not math.isclose(error, residual_quantile, rel_tol=0, abs_tol=1e-12):
            continue
        draw = int(
            hashlib.sha256(
                f"{target}:{entity_id}:{observed_day.isoformat()}".encode()
            ).hexdigest()[:16],
            16,
        ) / float(16 ** 16)
        if draw < tie_probability:
            selected_ties += 1
    observed_coverage = (
        (below + selected_ties) / len(selected_errors)
        if selected_errors else 0.0
    )
    full_prior = sum(row[2] for row in rows) / max(1, len(rows))
    all_by_entity: dict[int, list[float]] = defaultdict(list)
    for entity_id, _, value in rows:
        all_by_entity[entity_id].append(value)
    rates = {
        str(entity_id): _rounded(
            (sum(values) + prior_strength * full_prior) / (len(values) + prior_strength)
            if selected_challenger else full_prior
        )
        for entity_id, values in all_by_entity.items()
    }
    policy = {
        "target": target,
        "rows": len(validation),
        "players": len({row[0] for row in validation}),
        "trainingRows": len(fit_rows),
        "fullRows": len(rows),
        "modelFamily": "empirical_bayes_rate" if selected_challenger else "population_rate",
        "baselineModel": "population_rate",
        "validationMae": _rounded(challenger_mae if selected_challenger else baseline_mae),
        "challengerValidationMae": _rounded(challenger_mae),
        "baselineMae": _rounded(baseline_mae),
        "chronologicalLift": _rounded(
            0.0 if baseline_mae <= 0 else (baseline_mae - challenger_mae) / baseline_mae
        ),
        "fallback": not selected_challenger,
        "fallbackReason": None if selected_challenger else (
            "insufficient_chronological_support" if not sufficient else "challenger_did_not_beat_baseline"
        ),
        "baselineRate": _rounded(full_prior),
        "priorStrengthGames": prior_strength,
        "residual80PerGame": _rounded(residual_quantile),
        "calibration80Coverage": _rounded(expected_coverage),
        "calibrationObservedCoverage": _rounded(observed_coverage),
        "calibrationInclusiveCoverage": _rounded(inclusive_coverage),
        "calibrationTieProbability": _rounded(tie_probability),
        "calibrationMethod": "chronological_randomized_conformal_absolute_residual_v1",
        "sourceGameCoverage": _rounded(source_game_coverage),
        "eligibleForServing": sufficient and source_game_coverage >= 0.95,
    }
    return policy, rates


def _v4_assist_policy(
    v4_artifact: dict[str, Any],
    population: str,
    target: str,
    candidate_game_coverage: float,
) -> dict[str, Any]:
    source_target = "PRIMARY_ASSISTS" if target == "EXPECTED_PRIMARY_ASSISTS" else "SECONDARY_ASSISTS"
    source = ((v4_artifact.get("selectionEvidence") or {}).get(population) or {}).get(source_target) or {}
    return {
        "target": target,
        "rows": int(source.get("rows") or 0),
        "players": int(source.get("players") or 0),
        "trainingRows": int(source.get("rows") or 0),
        "fullRows": int(source.get("rows") or 0),
        "modelFamily": "validated_fantasy_v4_assist_expectation",
        "baselineModel": source.get("baselineModel") or "population_rate",
        "validationMae": source.get("validationMae"),
        "challengerValidationMae": source.get("validationMae"),
        "baselineMae": source.get("baselineMae"),
        "chronologicalLift": source.get("chronologicalLift"),
        "fallback": True,
        "fallbackReason": "shot_assist_candidate_game_coverage_below_0.80",
        "servingSource": source_target,
        "baselineRate": 0.0,
        "priorStrengthGames": None,
        "residual80PerGame": source.get("residual80PerGame") or 0.0,
        "calibration80Coverage": source.get("calibration80Coverage"),
        "calibrationObservedCoverage": source.get("calibrationObservedCoverage"),
        "calibrationTieProbability": source.get("calibrationTieProbability"),
        "calibrationMethod": source.get("calibrationMethod"),
        "sourceGameCoverage": 1.0,
        "shotAssistCandidateGameCoverage": _rounded(candidate_game_coverage),
        "eligibleForServing": bool(source.get("rows")) and bool(source.get("players")),
    }


def train_advanced_artifact(
    freeze: Path,
    v4_artifact_path: Path,
    output: Path,
) -> dict[str, Any]:
    manifest = _assert_advanced_freeze(freeze)
    v4_artifact, v4_checksum = _verified_v4_artifact(v4_artifact_path)
    output.mkdir(parents=True, exist_ok=False)
    source_audit = read_json(freeze / "source-audit.json")
    if source_audit.get("eligibleForFreeze") is not True:
        raise RuntimeError("advanced source audit is not eligible for training")
    players = {
        int(value["fhfhPlayerId"]): value
        for value in (v4_artifact.get("players") or {}).values()
    }
    fhfh_by_nhl = {
        int(value["nhlPlayerId"]): fhfh_id
        for fhfh_id, value in players.items()
        if value.get("nhlPlayerId") is not None
    }
    skater_games: dict[tuple[int, int], dict[str, Any]] = {}
    goalie_games: dict[tuple[int, int], dict[str, Any]] = {}
    team_games: dict[tuple[int, int], dict[str, Any]] = {}

    def skater_observation(nhl_id: Any, game_id: Any, game_date: Any, team_id: Any) -> dict[str, Any] | None:
        if nhl_id is None:
            return None
        fhfh_id = fhfh_by_nhl.get(int(nhl_id))
        if fhfh_id is None or players[fhfh_id].get("population") not in {"forward", "defense"}:
            return None
        key = (fhfh_id, int(game_id))
        return skater_games.setdefault(
            key,
            _empty_observation(fhfh_id, int(game_id), game_date, team_id, SKATER_ADVANCED_TARGETS),
        )

    def goalie_observation(nhl_id: Any, game_id: Any, game_date: Any, team_id: Any) -> dict[str, Any] | None:
        if nhl_id is None:
            return None
        fhfh_id = fhfh_by_nhl.get(int(nhl_id))
        if fhfh_id is None or players[fhfh_id].get("population") != "goalie":
            return None
        key = (fhfh_id, int(game_id))
        return goalie_games.setdefault(
            key,
            _empty_observation(fhfh_id, int(game_id), game_date, team_id, GOALIE_ADVANCED_TARGETS),
        )

    def team_observation(team_id: Any, game_id: Any, game_date: Any) -> dict[str, Any] | None:
        if team_id is None:
            return None
        key = (int(team_id), int(game_id))
        return team_games.setdefault(
            key,
            _empty_observation(int(team_id), int(game_id), game_date, team_id, TEAM_ADVANCED_TARGETS),
        )

    for row in read_jsonl(freeze / "player_on_ice.jsonl"):
        observation = skater_observation(
            row.get("player_id"), row.get("game_id"), row.get("game_date"), row.get("team_id")
        )
        if observation is None:
            continue
        values = observation["values"]
        values["ON_ICE_SHOT_ATTEMPTS_FOR"] = _number(row.get("on_ice_shot_attempts_for"))
        values["ON_ICE_SHOT_ATTEMPTS_AGAINST"] = _number(row.get("on_ice_shot_attempts_against"))
        values["ON_ICE_UNBLOCKED_ATTEMPTS_FOR"] = _number(row.get("on_ice_unblocked_attempts_for"))
        values["ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST"] = _number(row.get("on_ice_unblocked_attempts_against"))
        values["ON_ICE_EXPECTED_GOALS_FOR"] = _number(row.get("on_ice_expected_goals_for"))
        values["ON_ICE_EXPECTED_GOALS_AGAINST"] = _number(row.get("on_ice_expected_goals_against"))

    game_teams: dict[int, tuple[int, int]] = {}
    for row in read_jsonl(freeze / "team_xg.jsonl"):
        team_id = int(row["team_id"])
        opponent_id = int(row["opponent_team_id"])
        game_id = int(row["game_id"])
        game_teams[game_id] = (team_id, opponent_id)
        observation = team_observation(team_id, game_id, row.get("game_date"))
        if observation is None:
            continue
        values = observation["values"]
        values["TEAM_EXPECTED_GOALS_FOR"] = _number(row.get("xg_for"))
        values["TEAM_EXPECTED_GOALS_AGAINST"] = _number(row.get("xg_against"))

    distance_present = 0
    distance_missing = 0
    for row in read_jsonl(freeze / "shot_features.jsonl"):
        if row.get("is_penalty_shot_event") is True or row.get("is_shootout_event") is True:
            continue
        game_id = int(row["game_id"])
        game_date = row.get("game_date")
        team_id = row.get("event_owner_team_id")
        skater = skater_observation(
            row.get("shooter_player_id"), game_id, game_date, team_id
        )
        is_unblocked = row.get("is_unblocked_shot_attempt") is True
        distance_raw = row.get("shot_distance_feet")
        distance = None
        if distance_raw is not None:
            candidate = _number(distance_raw, float("nan"))
            if math.isfinite(candidate) and candidate >= 0:
                distance = candidate
        danger_target = None
        if distance is None:
            distance_missing += 1
        else:
            distance_present += 1
            danger_target = (
                "HIGH_DANGER_SHOTS"
                if distance <= 20
                else "MID_RANGE_SHOTS" if distance <= 40 else "LONG_RANGE_SHOTS"
            )
        if skater is not None:
            values = skater["values"]
            values["SHOT_ATTEMPTS"] += 1
            if is_unblocked:
                values["UNBLOCKED_SHOT_ATTEMPTS"] += 1
            if danger_target:
                values[danger_target] += 1
            if row.get("is_rush_shot") is True:
                values["RUSH_SHOTS"] += 1
            if row.get("is_rebound_shot") is True:
                values["REBOUND_SHOTS"] += 1

        owner = team_observation(team_id, game_id, game_date)
        pair = game_teams.get(game_id)
        opponent_id = None
        if pair and team_id is not None:
            opponent_id = pair[1] if pair[0] == int(team_id) else pair[0]
        opponent = team_observation(opponent_id, game_id, game_date)
        if owner:
            owner["values"]["TEAM_SHOT_ATTEMPTS_FOR"] += 1
        if opponent:
            opponent["values"]["TEAM_SHOT_ATTEMPTS_AGAINST"] += 1
        if is_unblocked:
            if owner:
                owner["values"]["TEAM_UNBLOCKED_ATTEMPTS_FOR"] += 1
            if opponent:
                opponent["values"]["TEAM_UNBLOCKED_ATTEMPTS_AGAINST"] += 1
        if danger_target == "HIGH_DANGER_SHOTS":
            if owner:
                owner["values"]["TEAM_HIGH_DANGER_SHOTS_FOR"] += 1
            if opponent:
                opponent["values"]["TEAM_HIGH_DANGER_SHOTS_AGAINST"] += 1

        if (
            row.get("goalie_in_net_id") is not None
            and row.get("is_empty_net_event") is not True
            and row.get("is_shot_on_goal") is True
        ):
            goalie = goalie_observation(
                row.get("goalie_in_net_id"), game_id, game_date, opponent_id
            )
            if goalie is not None and danger_target:
                goalie_target = danger_target.replace("SHOTS", "SHOTS_AGAINST_GOALIE")
                goalie["values"][goalie_target] += 1
                if row.get("is_goal") is True:
                    goalie["values"][goalie_target.replace("SHOTS", "GOALS")] += 1

    shot_goal_model = next(
        (
            str(row["model_version"])
            for row in source_audit.get("approvedModels") or []
            if row.get("prediction_type") == "shot_goal" and row.get("is_champion") is True
        ),
        None,
    )
    for row in read_jsonl(freeze / "shot_predictions.jsonl"):
        if row.get("prediction_type") != "shot_goal" or (
            shot_goal_model and row.get("model_version") != shot_goal_model
        ):
            continue
        xg = _number(row.get("xg"))
        skater = skater_observation(
            row.get("shooter_player_id"), row.get("game_id"), row.get("game_date"), row.get("event_owner_team_id")
        )
        if skater is not None:
            skater["values"]["EXPECTED_GOALS"] += xg

    for row in read_jsonl(freeze / "player_rebounds.jsonl"):
        observation = skater_observation(
            row.get("player_id"), row.get("game_id"), row.get("game_date"), row.get("team_id")
        )
        if observation is not None:
            observation["values"]["REBOUNDS_CREATED"] = _number(row.get("expected_rebounds_created"))

    for row in read_jsonl(freeze / "goalie_xg.jsonl"):
        observation = goalie_observation(
            row.get("goalie_player_id"), row.get("game_id"), row.get("game_date"), row.get("team_id")
        )
        if observation is not None:
            observation["values"]["EXPECTED_GOALS_AGAINST_GOALIE"] = _number(row.get("xg_against"))

    for observation in team_games.values():
        values = observation["values"]
        values["TEAM_PACE"] = (
            values["TEAM_SHOT_ATTEMPTS_FOR"] + values["TEAM_SHOT_ATTEMPTS_AGAINST"]
        ) / 2

    source_games = max(
        1,
        int((source_audit.get("sources") or {}).get("shot_features", {}).get("games") or 0),
    )
    assist_games = int(
        (source_audit.get("sources") or {}).get("shot_assist_candidates", {}).get("games") or 0
    )
    assist_coverage = assist_games / source_games
    policies: dict[str, dict[str, Any]] = {}
    player_rates: dict[str, dict[str, float]] = defaultdict(dict)
    for population in ("forward", "defense"):
        population_rows = [
            row for row in skater_games.values()
            if players[int(row["entityId"])].get("population") == population
        ]
        policies[population] = {}
        for target in SKATER_ADVANCED_TARGETS:
            if target in {"EXPECTED_PRIMARY_ASSISTS", "EXPECTED_SECONDARY_ASSISTS"}:
                policy = _v4_assist_policy(
                    v4_artifact, population, target, assist_coverage
                )
                rates: dict[str, float] = {}
            else:
                policy, rates = _fit_rate_policy(
                    population_rows, target, 10.0, 1.0
                )
            policies[population][target] = policy
            for entity_id, rate in rates.items():
                player_rates[entity_id][target] = rate

    policies["goalie"] = {}
    for target in GOALIE_ADVANCED_TARGETS:
        policy, rates = _fit_rate_policy(
            list(goalie_games.values()), target, 8.0, 1.0
        )
        policies["goalie"][target] = policy
        for entity_id, rate in rates.items():
            player_rates[entity_id][target] = rate

    policies["team"] = {}
    team_rates: dict[str, dict[str, float]] = defaultdict(dict)
    for target in TEAM_ADVANCED_TARGETS:
        policy, rates = _fit_rate_policy(
            list(team_games.values()), target, 15.0, 1.0
        )
        policies["team"][target] = policy
        for entity_id, rate in rates.items():
            team_rates[entity_id][target] = rate

    missing_distance_rate = distance_missing / max(1, distance_present + distance_missing)
    artifact = {
        "schemaVersion": "player-forecast-season-advanced-artifact-v1",
        "artifactVersion": "advanced-v5-empirical-bayes-v1",
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "metricSetVersion": "advanced-v5",
        "seasonId": 20262027,
        "trainingCutoffAt": "2026-04-16T23:59:59Z",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "codeVersion": "season-advanced-v1",
        "featureSchemaVersion": "player-forecast-season-advanced-v5",
        "baseV4ArtifactChecksum": v4_checksum,
        "sourceFreezeManifestHash": manifest["manifestHash"],
        "dangerTaxonomy": {
            "version": DANGER_TAXONOMY_VERSION,
            "highDangerMaximumFeet": 20,
            "midRangeMaximumFeet": 40,
            "missingDistanceRows": distance_missing,
            "presentDistanceRows": distance_present,
            "missingDistanceRate": _rounded(missing_distance_rate),
        },
        "approvedSourceModels": source_audit.get("approvedModels") or [],
        "players": {
            str(fhfh_id): {
                "fhfhPlayerId": fhfh_id,
                "nhlPlayerId": player.get("nhlPlayerId"),
                "population": player.get("population"),
                "teamId": player.get("teamId"),
                "rates": player_rates.get(str(fhfh_id), {}),
            }
            for fhfh_id, player in sorted(players.items())
        },
        "teams": {
            str(team_id): {"teamId": int(team_id), "rates": rates}
            for team_id, rates in sorted(team_rates.items(), key=lambda item: int(item[0]))
        },
        "targetPolicies": policies,
        "review": {
            "sourceAudit": source_audit,
            "shotAssistCandidateGameCoverage": _rounded(assist_coverage),
            "assistFallback": assist_coverage < 0.8,
            "evidencePolicy": "2025-26 is validation/training evidence, not a new blind test.",
            "prospectiveEvidence": "Await untouched 2026-27 outcomes before champion promotion.",
        },
    }
    vectors = {
        "players": {
            key: artifact["players"][key]
            for key in sorted(artifact["players"], key=int)[:5]
        },
        "teams": {
            key: artifact["teams"][key]
            for key in sorted(artifact["teams"], key=int)[:5]
        },
    }
    artifact["goldenVectors"] = [{
        "name": "advanced-rate-replay-v1",
        "input": vectors,
        "expectedHash": hashlib.sha256(canonical_json(vectors).encode()).hexdigest(),
    }]
    write_json(output / "season-artifact.json", artifact)
    report = {
        "schemaVersion": "player-forecast-season-advanced-training-report-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "targetPolicies": policies,
        "sourceAudit": source_audit,
        "dangerTaxonomy": artifact["dangerTaxonomy"],
        "evidencePolicy": artifact["review"]["evidencePolicy"],
    }
    write_json(output / "training-report.json", report)
    artifact_checksum = _file_sha256(output / "season-artifact.json")
    artifact_manifest = {
        "schemaVersion": "player-forecast-season-advanced-artifact-manifest-v1",
        "artifactChecksum": artifact_checksum,
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "sourceFreezeManifestHash": manifest["manifestHash"],
        "baseV4ArtifactChecksum": v4_checksum,
        "files": {
            "season-artifact.json": artifact_checksum,
            "training-report.json": _file_sha256(output / "training-report.json"),
        },
    }
    artifact_manifest["manifestHash"] = hashlib.sha256(
        canonical_json(artifact_manifest).encode()
    ).hexdigest()
    write_json(output / "artifact-manifest.json", artifact_manifest)
    return artifact_manifest


def evaluate_advanced_batch(artifact_path: Path, output: Path) -> dict[str, Any]:
    root = artifact_path if artifact_path.is_dir() else artifact_path.parent
    artifact = read_json(root / "season-artifact.json")
    manifest = read_json(root / "artifact-manifest.json")
    if (
        artifact.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION
        or artifact.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256
        or manifest.get("artifactChecksum") != _file_sha256(root / "season-artifact.json")
    ):
        raise RuntimeError("advanced artifact contract or checksum mismatch")
    target_results: list[dict[str, Any]] = []
    blockers: list[str] = []
    required = {
        "forward": SKATER_ADVANCED_TARGETS,
        "defense": SKATER_ADVANCED_TARGETS,
        "goalie": GOALIE_ADVANCED_TARGETS,
        "team": TEAM_ADVANCED_TARGETS,
    }
    policies = artifact.get("targetPolicies") or {}
    for population, targets in required.items():
        for target in targets:
            policy = (policies.get(population) or {}).get(target) or {}
            validation_mae = policy.get("validationMae")
            baseline_mae = policy.get("baselineMae")
            expected_coverage = policy.get("calibration80Coverage")
            observed_coverage = policy.get("calibrationObservedCoverage")
            source_coverage = _number(policy.get("sourceGameCoverage"), -1)
            eligible = policy.get("eligibleForServing") is True
            finite_loss = (
                validation_mae is not None
                and baseline_mae is not None
                and math.isfinite(float(validation_mae))
                and math.isfinite(float(baseline_mae))
            )
            calibrated = (
                expected_coverage is not None
                and 0.75 <= float(expected_coverage) <= 0.85
                and observed_coverage is not None
                and 0.75 <= float(observed_coverage) <= 0.85
            )
            if not eligible:
                blockers.append(f"{population}:{target}:serving_ineligible")
            if not finite_loss:
                blockers.append(f"{population}:{target}:loss_missing")
            if not calibrated:
                blockers.append(f"{population}:{target}:interval_calibration")
            if source_coverage < 0.95:
                blockers.append(f"{population}:{target}:source_coverage")
            target_results.append({
                "population": population,
                **policy,
                "finiteChronologicalLoss": finite_loss,
                "calibrationAccepted": calibrated,
                "sourceCoverageAccepted": source_coverage >= 0.95,
            })
    vectors = (artifact.get("goldenVectors") or [{}])[0]
    replay_hash = hashlib.sha256(
        canonical_json(vectors.get("input") or {}).encode()
    ).hexdigest()
    golden_replay = replay_hash == vectors.get("expectedHash")
    if not golden_replay:
        blockers.append("golden_vector_replay")
    source_audit = (artifact.get("review") or {}).get("sourceAudit") or {}
    if source_audit.get("eligibleForFreeze") is not True:
        blockers.append("advanced_source_audit")
    unsigned = {
        "schemaVersion": "player-forecast-advanced-v5-evaluation-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "artifactChecksum": manifest["artifactChecksum"],
        "targetResults": target_results,
        "sourceAudit": source_audit,
        "goldenVectorReplay": {
            "passed": golden_replay,
            "expectedHash": vectors.get("expectedHash"),
            "actualHash": replay_hash,
        },
        "blockers": sorted(set(blockers)),
        "eligibleForRelease": not blockers,
        "evidencePolicy": "2025-26 is validation/training evidence, not a new blind test.",
        "promotionPolicy": "Prospective 2026-27 evidence remains required for champion promotion.",
    }
    receipt = {
        **unsigned,
        "receiptHash": hashlib.sha256(canonical_json(unsigned).encode()).hexdigest(),
    }
    write_json(output, receipt)
    return receipt


def _assert_advanced_receipt(path: Path, artifact_checksum: str) -> dict[str, Any]:
    receipt = read_json(path)
    unsigned = {key: value for key, value in receipt.items() if key != "receiptHash"}
    if (
        receipt.get("schemaVersion") != "player-forecast-advanced-v5-evaluation-v1"
        or receipt.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION
        or receipt.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256
        or receipt.get("artifactChecksum") != artifact_checksum
        or receipt.get("eligibleForRelease") is not True
        or receipt.get("receiptHash") != hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
    ):
        raise RuntimeError("advanced projection requires a passing checksum-bound v5 receipt")
    return receipt


def _advanced_reconcile(values: dict[str, float], population: str) -> dict[str, float]:
    reconciled = {key: _rounded(_number(value)) for key, value in values.items()}
    if population == "goalie":
        reconciled["GOALS_SAVED_ABOVE_EXPECTED"] = _rounded(
            reconciled.get("EXPECTED_GOALS_AGAINST_GOALIE", 0)
            - reconciled.get("GOALS_AGAINST_GOALIE", 0)
        )
        for danger in ("HIGH_DANGER", "MID_RANGE", "LONG_RANGE"):
            shots = reconciled.get(f"{danger}_SHOTS_AGAINST_GOALIE", 0)
            goals = min(shots, reconciled.get(f"{danger}_GOALS_AGAINST_GOALIE", 0))
            reconciled[f"{danger}_GOALS_AGAINST_GOALIE"] = _rounded(goals)
            saves = max(0.0, shots - goals)
            reconciled[f"{danger}_SAVES_GOALIE"] = _rounded(saves)
            reconciled[f"{danger}_SAVE_PERCENTAGE_GOALIE"] = _rounded(
                saves / shots if shots > 0 else 0
            )
        return reconciled
    reconciled["EXPECTED_ASSISTS"] = _rounded(
        reconciled.get("EXPECTED_PRIMARY_ASSISTS", 0)
        + reconciled.get("EXPECTED_SECONDARY_ASSISTS", 0)
    )
    for label, for_target, against_target in (
        ("ON_ICE_CF_PERCENTAGE", "ON_ICE_SHOT_ATTEMPTS_FOR", "ON_ICE_SHOT_ATTEMPTS_AGAINST"),
        ("ON_ICE_FF_PERCENTAGE", "ON_ICE_UNBLOCKED_ATTEMPTS_FOR", "ON_ICE_UNBLOCKED_ATTEMPTS_AGAINST"),
        ("ON_ICE_XGF_PERCENTAGE", "ON_ICE_EXPECTED_GOALS_FOR", "ON_ICE_EXPECTED_GOALS_AGAINST"),
    ):
        for_value = reconciled.get(for_target, 0)
        against_value = reconciled.get(against_target, 0)
        reconciled[label] = _rounded(
            for_value / (for_value + against_value)
            if for_value + against_value > 0 else 0
        )
    return reconciled


def _reconciled_quantiles(
    p10: dict[str, float],
    p50: dict[str, float],
    p90: dict[str, float],
    population: str,
) -> tuple[dict[str, float], dict[str, float], dict[str, float]]:
    low = _advanced_reconcile(p10, population)
    median = _advanced_reconcile(p50, population)
    high = _advanced_reconcile(p90, population)
    targets = set(low) | set(median) | set(high)
    for target in targets:
        center = _number(median.get(target))
        low[target] = _rounded(min(_number(low.get(target), center), center))
        high[target] = _rounded(max(_number(high.get(target), center), center))
        median[target] = _rounded(center)
    return low, median, high


def _policy_for(artifact: dict[str, Any], population: str, target: str) -> dict[str, Any]:
    return ((artifact.get("targetPolicies") or {}).get(population) or {}).get(target) or {}


def _advanced_rate(artifact: dict[str, Any], player_id: int, population: str, target: str) -> float:
    player = (artifact.get("players") or {}).get(str(player_id)) or {}
    rate = (player.get("rates") or {}).get(target)
    if rate is not None:
        return max(0.0, _number(rate))
    return max(0.0, _number(_policy_for(artifact, population, target).get("baselineRate")))


def _simulation_quantiles(
    means: dict[str, float],
    variances: dict[str, float],
    seed: str,
    draws: int = 1000,
) -> tuple[dict[str, float], dict[str, float], dict[str, float]]:
    rng = random.Random(int(hashlib.sha256(seed.encode()).hexdigest()[:16], 16))
    samples: dict[str, list[float]] = {target: [] for target in means}
    correlation = 0.65
    independent_weight = math.sqrt(1 - correlation * correlation)
    for _ in range(draws):
        common = rng.gauss(0, 1)
        for target, mean in means.items():
            deviation = correlation * common + independent_weight * rng.gauss(0, 1)
            value = mean + math.sqrt(max(0.0, variances.get(target, 0))) * deviation
            samples[target].append(max(0.0, value))
    return (
        {target: _rounded(_quantile(values, 0.10)) for target, values in samples.items()},
        {target: _rounded(_quantile(values, 0.50)) for target, values in samples.items()},
        {target: _rounded(_quantile(values, 0.90)) for target, values in samples.items()},
    )


def _write_jsonl_stream(path: Path, rows: Any) -> tuple[int, str]:
    return write_jsonl(path, rows)


def project_advanced_release(
    advanced_artifact_path: Path,
    v4_bundle: Path,
    receipt_path: Path,
    output: Path,
) -> dict[str, Any]:
    artifact_root = advanced_artifact_path if advanced_artifact_path.is_dir() else advanced_artifact_path.parent
    artifact_file = artifact_root / "season-artifact.json"
    artifact = read_json(artifact_file)
    artifact_checksum = _file_sha256(artifact_file)
    artifact_manifest = read_json(artifact_root / "artifact-manifest.json")
    if (
        artifact.get("contractVersion") != ADVANCED_SEASON_CONTRACT_VERSION
        or artifact.get("contractChecksum") != ADVANCED_SEASON_CONTRACT_SHA256
        or artifact_manifest.get("artifactChecksum") != artifact_checksum
    ):
        raise RuntimeError("advanced artifact contract or checksum mismatch")
    receipt = _assert_advanced_receipt(receipt_path, artifact_checksum)
    v4_manifest = read_json(v4_bundle / "import-manifest.json")
    if (
        v4_manifest.get("contractVersion") != FANTASY_SEASON_CONTRACT_VERSION
        or v4_manifest.get("contractChecksum") != FANTASY_SEASON_CONTRACT_SHA256
        or v4_manifest.get("artifactChecksum") != artifact.get("baseV4ArtifactChecksum")
    ):
        raise RuntimeError("advanced projection requires its exact validated v4 base release")
    for metadata in (v4_manifest.get("files") or {}).values():
        path = v4_bundle / str(metadata["path"])
        if _file_sha256(path) != metadata.get("sha256"):
            raise RuntimeError(f"v4 bundle checksum mismatch: {metadata['path']}")
    output.mkdir(parents=True, exist_ok=False)
    v4_players = {
        int(row["fhfh_player_id"]): row
        for row in read_jsonl(v4_bundle / v4_manifest["files"]["player-aggregates"]["path"])
    }
    v4_teams = {
        int(row["team_id"]): row
        for row in read_jsonl(v4_bundle / v4_manifest["files"]["team-aggregates"]["path"])
    }
    aggregate_means: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    aggregate_variances: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    component_counts: dict[int, int] = defaultdict(int)
    fallback_flags: dict[int, set[str]] = defaultdict(set)

    def game_rows():
        for row in read_jsonl(v4_bundle / v4_manifest["files"]["game-outputs"]["path"]):
            player_id = int(row["fhfhPlayerId"])
            population = str(row["population"])
            targets = GOALIE_ADVANCED_TARGETS if population == "goalie" else SKATER_ADVANCED_TARGETS
            probability = _number(row.get("playingProbability"))
            conditional = dict(row.get("conditionalMeans") or {})
            unconditional = dict(row.get("unconditionalMeans") or {})
            baseline = dict(row.get("baselineUnconditionalMeans") or {})
            variances = dict(row.get("variances") or {})
            quantiles = {
                key: dict((row.get("quantiles") or {}).get(key) or {})
                for key in ("p10", "p50", "p90")
            }
            row_fallbacks = set(str(flag) for flag in row.get("fallbackFlags") or [])
            for target in targets:
                policy = _policy_for(artifact, population, target)
                if target == "EXPECTED_PRIMARY_ASSISTS":
                    conditional_value = _number(conditional.get("PRIMARY_ASSISTS"))
                    mean = _number(unconditional.get("PRIMARY_ASSISTS"))
                    low = _number(quantiles["p10"].get("PRIMARY_ASSISTS"))
                    high = _number(quantiles["p90"].get("PRIMARY_ASSISTS"))
                    baseline_value = _number(baseline.get("PRIMARY_ASSISTS"), mean)
                elif target == "EXPECTED_SECONDARY_ASSISTS":
                    conditional_value = _number(conditional.get("SECONDARY_ASSISTS"))
                    mean = _number(unconditional.get("SECONDARY_ASSISTS"))
                    low = _number(quantiles["p10"].get("SECONDARY_ASSISTS"))
                    high = _number(quantiles["p90"].get("SECONDARY_ASSISTS"))
                    baseline_value = _number(baseline.get("SECONDARY_ASSISTS"), mean)
                else:
                    conditional_value = _advanced_rate(artifact, player_id, population, target)
                    mean = conditional_value * probability
                    residual = max(0.0, _number(policy.get("residual80PerGame")))
                    conditional_variance = max(conditional_value, residual * residual)
                    variance = probability * conditional_variance + probability * (1 - probability) * conditional_value ** 2
                    low = max(0.0, mean - 1.2815515655 * math.sqrt(max(0.0, variance)))
                    high = mean + 1.2815515655 * math.sqrt(max(0.0, variance))
                    baseline_value = probability * max(
                        0.0, _number(policy.get("baselineRate"), conditional_value)
                    )
                if target in {"EXPECTED_PRIMARY_ASSISTS", "EXPECTED_SECONDARY_ASSISTS"}:
                    variance = max(0.0, ((high - low) / (2 * 1.2815515655)) ** 2)
                conditional[target] = _rounded(conditional_value)
                unconditional[target] = _rounded(mean)
                baseline[target] = _rounded(baseline_value)
                variances[target] = _rounded(variance)
                quantiles["p10"][target] = _rounded(min(low, mean))
                quantiles["p50"][target] = _rounded(mean)
                quantiles["p90"][target] = _rounded(max(high, mean))
                aggregate_means[player_id][target] += mean
                aggregate_variances[player_id][target] += variance
                if policy.get("fallback") is True:
                    flag = f"advanced_v5_{target.lower()}_fallback"
                    row_fallbacks.add(flag)
                    fallback_flags[player_id].add(flag)
            for danger in ("HIGH_DANGER", "MID_RANGE", "LONG_RANGE"):
                if population != "goalie":
                    break
                shots = f"{danger}_SHOTS_AGAINST_GOALIE"
                goals = f"{danger}_GOALS_AGAINST_GOALIE"
                for target_map in (conditional, unconditional, baseline, quantiles["p10"], quantiles["p50"], quantiles["p90"]):
                    target_map[goals] = _rounded(min(_number(target_map.get(shots)), _number(target_map.get(goals))))
            component_counts[player_id] += 1
            row["conditionalMeans"] = conditional
            row["unconditionalMeans"] = unconditional
            row["baselineUnconditionalMeans"] = baseline
            row["variances"] = variances
            row["quantiles"] = quantiles
            row["fallbackFlags"] = sorted(row_fallbacks)
            unsigned = {key: value for key, value in row.items() if key != "componentHash"}
            row["componentHash"] = hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
            yield row

    game_count, game_checksum = _write_jsonl_stream(output / "game-outputs.jsonl", game_rows())

    def player_rows():
        for player_id, source in sorted(v4_players.items()):
            population = str(source["population"])
            means = dict(source.get("model_means") or {})
            p10 = dict(source.get("p10") or {})
            p50 = dict(source.get("p50") or {})
            p90 = dict(source.get("p90") or {})
            advanced_means = dict(aggregate_means.get(player_id) or {})
            advanced_variances = dict(aggregate_variances.get(player_id) or {})
            low, median, high = _simulation_quantiles(
                advanced_means,
                advanced_variances,
                f"{artifact_checksum}:{v4_manifest['runHash']}:{player_id}",
            ) if advanced_means else ({}, {}, {})
            means.update({key: _rounded(value) for key, value in advanced_means.items()})
            p10.update(low)
            p50.update(median)
            p90.update(high)
            means = _advanced_reconcile(means, population)
            p10, p50, p90 = _reconciled_quantiles(p10, p50, p90, population)
            source["model_means"] = means
            source["p10"] = p10
            source["p50"] = p50
            source["p90"] = p90
            source["fallback_flags"] = sorted(
                set(str(flag) for flag in source.get("fallback_flags") or [])
                | fallback_flags.get(player_id, set())
            )
            source["component_manifest"] = list(source.get("component_manifest") or [])
            source["provenance"] = {
                **dict(source.get("provenance") or {}),
                "advancedV5": {
                    "componentCount": component_counts.get(player_id, 0),
                    "artifactVersion": artifact["artifactVersion"],
                    "artifactChecksum": artifact_checksum,
                    "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
                    "dangerTaxonomyVersion": DANGER_TAXONOMY_VERSION,
                    "evidence": "2025-26 validation/training; prospective 2026-27 pending",
                    "simulation": "deterministic_gaussian_copula_v1",
                    "simulationDraws": 1000,
                    "sourceFreezeManifestHash": artifact["sourceFreezeManifestHash"],
                    "withinPlayerTargetCorrelation": 0.65,
                },
            }
            unsigned = {key: value for key, value in source.items() if key != "aggregate_hash"}
            source["aggregate_hash"] = hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
            yield source

    player_count, player_checksum = _write_jsonl_stream(
        output / "player-aggregates.jsonl", player_rows()
    )
    schedule_path = Path(str(v4_manifest["schedule"]["path"]))
    if not schedule_path.is_absolute():
        schedule_path = v4_bundle / schedule_path
    schedule = read_json(schedule_path)
    cutoff = datetime.fromisoformat(str(v4_manifest["cutoffAt"]).replace("Z", "+00:00"))
    games_by_team: dict[int, int] = defaultdict(int)
    for game in schedule:
        scheduled = datetime.fromisoformat(str(game["scheduled_start_at"]).replace("Z", "+00:00"))
        if v4_manifest["view"] == "ros" and scheduled <= cutoff:
            continue
        games_by_team[int(game["home_team_id"])] += 1
        games_by_team[int(game["away_team_id"])] += 1

    def team_rows():
        for team_id, source in sorted(v4_teams.items()):
            games = games_by_team.get(team_id, 0)
            rates = ((artifact.get("teams") or {}).get(str(team_id)) or {}).get("rates") or {}
            model_means: dict[str, float] = {}
            p10: dict[str, float] = {}
            p50: dict[str, float] = {}
            p90: dict[str, float] = {}
            for target in TEAM_ADVANCED_TARGETS:
                policy = _policy_for(artifact, "team", target)
                rate = max(0.0, _number(rates.get(target), _number(policy.get("baselineRate"))))
                mean = rate if target == "TEAM_PACE" else rate * games
                residual = max(0.0, _number(policy.get("residual80PerGame")))
                width = residual if target == "TEAM_PACE" else residual * math.sqrt(max(1, games))
                model_means[target] = _rounded(mean)
                p10[target] = _rounded(max(0.0, mean - width))
                p50[target] = _rounded(mean)
                p90[target] = _rounded(mean + width)
            source["model_means"] = model_means
            source["p10"] = p10
            source["p50"] = p50
            source["p90"] = p90
            source["provenance"] = {
                **dict(source.get("provenance") or {}),
                "advancedV5": {
                    "artifactChecksum": artifact_checksum,
                    "componentGames": games,
                    "dangerTaxonomyVersion": DANGER_TAXONOMY_VERSION,
                },
            }
            unsigned = {key: value for key, value in source.items() if key != "aggregate_hash"}
            source["aggregate_hash"] = hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
            yield source

    team_count, team_checksum = _write_jsonl_stream(
        output / "team-aggregates.jsonl", team_rows()
    )
    files = {
        "game-outputs": {"path": "game-outputs.jsonl", "rows": game_count, "sha256": game_checksum},
        "player-aggregates": {"path": "player-aggregates.jsonl", "rows": player_count, "sha256": player_checksum},
        "team-aggregates": {"path": "team-aggregates.jsonl", "rows": team_count, "sha256": team_checksum},
    }
    run_hash = hashlib.sha256(canonical_json({
        "artifactChecksum": artifact_checksum,
        "baseRunHash": v4_manifest["runHash"],
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "files": files,
        "view": v4_manifest["view"],
        "cutoffAt": v4_manifest["cutoffAt"],
    }).encode()).hexdigest()
    bundle = {
        **v4_manifest,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": ADVANCED_SEASON_CONTRACT_VERSION,
        "contractChecksum": ADVANCED_SEASON_CONTRACT_SHA256,
        "metricSetVersion": "advanced-v5",
        "artifactPath": str(artifact_file.resolve()),
        "artifactChecksum": artifact_checksum,
        "artifactVersion": artifact["artifactVersion"],
        "featureSchemaVersion": artifact["featureSchemaVersion"],
        "trainingCutoffAt": artifact["trainingCutoffAt"],
        "codeVersion": artifact["codeVersion"],
        "runHash": run_hash,
        "files": files,
        "advancedEvaluationReceipt": {
            "path": str(receipt_path.resolve()),
            "sha256": _file_sha256(receipt_path),
            "receiptHash": receipt["receiptHash"],
        },
        "healthStatus": "healthy",
        "healthSummary": {
            **dict(v4_manifest.get("healthSummary") or {}),
            "advancedV5Eligible": True,
            "advancedSourceAuditPassed": True,
            "prospective202627Evidence": "pending_games",
        },
    }
    write_json(output / "import-manifest.json", bundle)
    return bundle

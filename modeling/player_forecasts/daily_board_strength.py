"""Strength-specific historical challengers; never modifies serving projections."""
from __future__ import annotations

import argparse
import hashlib
import math
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from .contract import repository_root
from .daily_board import _metrics, _paired
from .daily_board_data import NORMALIZER_VERSION, validate_range
from .io import assert_output_outside_repository, canonical_json, read_json, read_jsonl, write_json, write_jsonl

STRENGTHS = ("EV", "PP", "PK")
CATEGORIES = ("GOALS", "ASSISTS", "SHOTS_ON_GOAL")
MODELS = ("observed_history_rate", "total_usage_rate", "strength_usage_rate", "strength_shrinkage")


def _number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def strength_baselines(records: list[dict], *, recent_games=5, recent_weight=0.5, prior_minutes=180.0) -> dict:
    if type(recent_games) is not int or not 1 <= recent_games <= 20 or not _number(recent_weight) or recent_weight > 1 or not _number(prior_minutes) or prior_minutes <= 0:
        raise ValueError("invalid fixed strength policy")
    policy = {"version": "starter-board-strength-policy-v1", "recentGames": recent_games,
        "recentWeight": recent_weight, "priorMinutes": prior_minutes, "historyLagDays": 2,
        "pool": "same-season prior-position verified strength exposures",
        "historyScope": "available exported observations, not a claim of complete season history",
        "refitPolicy": "fixed coefficients; completed history advances without evaluation-driven tuning"}
    ordered = sorted(records, key=lambda row: (row["game_date"], row["game_id"], row["player_id"]))
    if ordered:
        validate_range(ordered[0]["game_date"], ordered[-1]["game_date"])
    seen = set()
    for row in ordered:
        identity = row["game_id"], row["player_id"]
        if identity in seen:
            raise ValueError("duplicate strength-history player game")
        seen.add(identity)
        if row.get("normalizerVersion") != NORMALIZER_VERSION or row.get("evidence_classification") != "historical_reconstruction":
            raise ValueError("corrected historical strength export required")
    history, pools = defaultdict(list), defaultdict(list)
    results, exclusions, index = [], Counter(), 0

    def valid_usage(row):
        return row.get("strength_status", {}).get("usage") == "verified" and all(_number(row["outcomes"].get(f"{s}_TOI")) for s in STRENGTHS)

    def valid_rates(row):
        return valid_usage(row) and row.get("strength_status", {}).get("rates") == "verified" and all(
            _number(row["outcomes"].get(f"{s}_{c}")) for s in STRENGTHS for c in CATEGORIES)

    for row in ordered:
        allowed = (date.fromisoformat(row["game_date"]) - timedelta(days=2)).isoformat()
        while index < len(ordered) and ordered[index]["game_date"] <= allowed:
            old = ordered[index]
            index += 1
            if old.get("population") != "skater" or not old.get("historical_team_membership_verified"):
                continue
            history[old["season_id"], old["player_id"]].append(old)
            if valid_rates(old):
                pools[old["season_id"], old["position"]].append(old)
        if row.get("population") != "skater":
            exclusions["non_skater"] += 1
            continue
        if not row.get("historical_team_membership_verified"):
            exclusions["unverified_target_membership"] += 1
            continue
        past = history[row["season_id"], row["player_id"]]
        if not past:
            exclusions["no_prior_appearance"] += 1
            continue
        # Do not disguise a missing recent role observation by silently reaching
        # further back for five older complete games.
        recent = past[-recent_games:]
        if not all(valid_usage(old) for old in recent):
            exclusions["recent_usage_incomplete"] += 1
            continue
        usage_history = [old for old in past if valid_usage(old)]
        rate_history = [old for old in past if valid_rates(old)]
        if not rate_history:
            exclusions["no_verified_prior_rates"] += 1
            continue
        position = past[-1]["position"]
        pool = pools[row["season_id"], position]
        season_usage = {s: sum(old["outcomes"][f"{s}_TOI"] for old in usage_history) / len(usage_history) for s in STRENGTHS}
        usage = {s: (1 - recent_weight) * season_usage[s]
            + recent_weight * sum(old["outcomes"][f"{s}_TOI"] for old in recent) / len(recent) for s in STRENGTHS}
        total_usage = sum(usage.values())
        total_exposure = sum(old["outcomes"][f"{s}_TOI"] for old in rate_history for s in STRENGTHS)
        if total_exposure <= 0:
            exclusions["no_positive_prior_exposure"] += 1
            continue
        estimates = {f"{s}_TOI": {m: season_usage[s] if m == "observed_history_rate" else usage[s] for m in MODELS} for s in STRENGTHS}
        fallback_strengths, missing = [], False
        for s in STRENGTHS:
            exposure = sum(old["outcomes"][f"{s}_TOI"] for old in rate_history)
            pool_exposure = sum(old["outcomes"][f"{s}_TOI"] for old in pool)
            if usage[s] > 0 and pool_exposure <= 0:
                missing = True
                break
            if usage[s] > 0 and exposure == 0:
                fallback_strengths.append(s)
            for c in CATEGORIES:
                count = sum(old["outcomes"][f"{s}_{c}"] for old in rate_history)
                pooled_count = sum(old["outcomes"][f"{s}_{c}"] for old in pool)
                prior_rate = pooled_count / pool_exposure if pool_exposure else 0
                own_rate = count / exposure if exposure else prior_rate
                estimates[f"{s}_{c}"] = {
                    "observed_history_rate": count / len(rate_history),
                    "total_usage_rate": total_usage * count / total_exposure,
                    "strength_usage_rate": usage[s] * own_rate,
                    "strength_shrinkage": usage[s] * (count + prior_minutes * prior_rate) / (exposure + prior_minutes),
                }
        if missing:
            exclusions["positive_usage_without_prior_strength_exposure"] += 1
            continue
        for c in (*CATEGORIES, "TOI"):
            target = "TIME_ON_ICE_PER_GAME" if c == "TOI" else c
            estimates[target] = {m: sum(estimates[f"{s}_{c}"][m] for s in STRENGTHS) for m in MODELS}
        estimates["PP_POINTS"] = {m: estimates["PP_GOALS"][m] + estimates["PP_ASSISTS"][m] for m in MODELS}
        inputs = {old["row_hash"]: old for old in (*past, *pool)}
        results.append({"game_id": row["game_id"], "game_date": row["game_date"], "player_id": row["player_id"],
            "team_id": row["team_id"], "population": "skater", "outcomes": row["outcomes"], "estimates": estimates,
            "conditioning": "conditional_playing", "evidence_classification": "historical_reconstruction",
            "maximum_feature_game_date": max(old["game_date"] for old in inputs.values()),
            "feature_time_basis": "completed_game_date_plus_two_days",
            "feature_hash": hashlib.sha256(canonical_json({"rows": sorted(inputs), "policy": policy}).encode()).hexdigest(),
            "priorOnlyStrengths": fallback_strengths, "verifiedUsageHistoryRows": len(usage_history),
            "verifiedRateHistoryRows": len(rate_history), "missingOlderUsageRows": len(past) - len(usage_history),
            "segments": {"position": position, "usage_tier": "high" if total_usage >= 20 else "medium" if total_usage >= 12 else "low",
                "traded": past[-1]["team_id"] != row["team_id"]}})
    return {"rows": results, "exclusions": dict(exclusions), "policy": policy}


def evaluate_strength_freeze(freeze: Path, output: Path, start: str, end: str) -> dict:
    validate_range(start, end)
    assert_output_outside_repository(output, repository_root())
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("normalizerVersion") != NORMALIZER_VERSION:
        raise ValueError("corrected strength normalizer manifest required")
    validate_range(manifest["start"], manifest["end"])
    if not manifest["start"] <= start <= end <= manifest["end"]:
        raise ValueError("evaluation dates must be inside the frozen dataset")
    history_file = freeze / "history.jsonl"
    source_hash = hashlib.sha256(history_file.read_bytes()).hexdigest()
    if source_hash != manifest["files"]["history.jsonl"]["sha256"]:
        raise ValueError("history checksum mismatch")
    records = list(read_jsonl(history_file))
    if len(records) != manifest["rows"] or any(not manifest["start"] <= row["game_date"] <= manifest["end"] for row in records):
        raise ValueError("frozen row count or dates disagree")
    predictions = strength_baselines(records)
    scored = [{**row, "target_key": target, "outcome": row["outcomes"][target], "estimates": values}
        for row in predictions["rows"] if start <= row["game_date"] <= end
        for target, values in row["estimates"].items() if _number(row["outcomes"].get(target))]
    reports = {}
    for target in sorted({row["target_key"] for row in scored}):
        rows = [row for row in scored if row["target_key"] == target]
        reports[target] = {"models": {model: _metrics(rows, model, False) for model in MODELS},
            "pairedAgainstTotalUsage": {model: {unit: _paired(rows, "total_usage_rate", unit, champion=model)
                for unit in ("game", "slate")} for model in ("strength_usage_rate", "strength_shrinkage")},
            "segments": {dimension: {str(value): {model: _metrics([r for r in rows if r["segments"][dimension] == value], model, False) for model in MODELS}
                for value in sorted({r["segments"][dimension] for r in rows})} for dimension in ("position", "usage_tier", "traded")}}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    count, checksum = write_jsonl(output / "evaluation.jsonl", scored)
    report = {"version": "starter-board-strength-development-report-v1", "policy": predictions["policy"],
        "sourceChecksum": source_hash, "forecastChecksum": checksum, "codeHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "evaluationStart": start, "evaluationEnd": end, "targetRows": count,
        "historyStart": manifest["start"], "historyEnd": manifest["end"],
        "evaluationSkaterRows": sum(row.get("population") == "skater" and start <= row["game_date"] <= end for row in records),
        "evaluatedPlayerGames": len({(row["game_id"], row["player_id"]) for row in scored}),
        "evaluatedGames": len({row["game_id"] for row in scored}), "evaluatedSlates": len({row["game_date"] for row in scored}),
        "historyExclusions": predictions["exclusions"], "reports": reports, "promotionEligible": False,
        "status": "historical_descriptive_only" if scored else "insufficient_eligible_history",
        "limitations": ["Fixed coefficients, no hyperparameter search or automatic serving change.",
            "Historical two-day lag is a reconstruction assumption, not source arrival evidence.",
            "Incomplete recent usage and unavailable strength exposure are excluded, never filled with zeros.",
            "Rates use only the supplied historical window; this is not necessarily a complete season-rate baseline.",
            "Targets are conditional on recorded appearances; participation is not modeled.",
            "No current-FORGE, full fantasy-score, joint distribution or feasible-lineup comparison is established.",
            "Historical samples and paired intervals cannot satisfy prospective promotion gates.",
            "Small segments and older missing-history selection require further evaluation."]}
    write_json(output / "report.json", report)
    for name in ("report.json", "evaluation.jsonl"):
        (output / name).chmod(0o600)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evaluation-start", required=True)
    parser.add_argument("--evaluation-end", required=True)
    args = parser.parse_args()
    report = evaluate_strength_freeze(args.freeze, args.output, args.evaluation_start, args.evaluation_end)
    print(canonical_json({key: report[key] for key in ("status", "evaluatedGames", "evaluatedSlates", "evaluatedPlayerGames", "promotionEligible")}))


if __name__ == "__main__":
    main()

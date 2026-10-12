"""Offline PP shot-rate engineering ablation; never issues forecasts or scores accuracy."""
from __future__ import annotations

import argparse
import hashlib
import math
import subprocess
from pathlib import Path
from typing import Any

from .contract import LOCKBOX_END, LOCKBOX_START, repository_root
from .io import assert_output_outside_repository, canonical_json, read_json, write_json

VERSION = "forge-pp-shot-support-engineering-v1"
BASE_SHA = "76d507ea84634a91a69f61648d0a58e85e76571b"
PRIOR_MINUTES = (5, 15, 30, 60, 120)
# Pin the unchanged implementation whose pre-bound PP rate is reproduced below.
BASELINE_DEPENDENCIES = {
    "web/lib/projections/stages/skater-stage.ts": "fc28ab78fd9c57bf6e1d76bae7acaea9b0ebc3cb228a7b219881c9f5342ab4ab",
    "web/lib/projections/calculators/skater-adjustments.ts": "56f377a7cba8263872d4668b2d8d97340bf8daca61895ef2b81ce9c768b47fdf",
    "web/lib/projections/constants/projection-weights.ts": "4cc2f11cb60f937e95fde1d6a66c3969acaa6b5b2411ae82165737f8ab8d816b",
    "web/lib/projections/utils/number-utils.ts": "46a78073bdc6336c44dfe0ffb5e33370c5c1730ab74c4fc23a7fe6937e858222",
    "web/lib/rollingPlayerMetricCompatibility.ts": "1c6de9c8a74efa5e2eee5ce8b78c1d7951c91426e496566d3666a0c817b9ce22",
}
PROTOCOL = {
    "version": VERSION,
    "hypothesis": "PP rate support comes from PP exposure in the selected rate window, not EV evidence or average TOI.",
    "target": "PP_SHOTS_ON_GOAL",
    "horizon": "one scheduled regular-season game at a common recorded cutoff",
    "rateUnit": "shots_per_60_pp_minutes",
    "exposureUnit": "cumulative_pp_seconds_converted_to_minutes",
    "conditioning": "conditional_playing; unconditional counts require compatible existing participation and workload evidence",
    "unchanged": ["raw_rate_selection", "toi", "participation", "context", "conversion", "role_bounds", "reconciliation", "fallback_rate_8"],
    "priorMinutesGrid": list(PRIOR_MINUTES),
    "split": {"unit": "whole_slate", "fractions": [0.6, 0.2, 0.2],
        "dates": None, "datesStatus": "not_available_without_qualified_packet",
        "rounding": "floor(0.6*N) training; floor(0.2*N) validation; remainder test",
        "protectedInclusive": [LOCKBOX_START, LOCKBOX_END],
        "priorUse": "reused windows are retrospective diagnostics, not untouched evidence"},
    "population": "cutoff-known eligible players, including eventual nonparticipants; never selected by realized GP",
    "comparators": ["unchanged_forge", "carry_forward_rate", "pooled_rate"],
    "primaryLoss": "mean_squared_error_on_unconditional_pp_shot_counts",
    "selection": "validation MSE only; ties choose larger prior minutes; test once after freezing parameters",
    "acceptance": {"relativeTestMseImprovement": 0.02, "pairedSlateLower95Above": 0,
        "minimumTestSlates": 20, "minimumTestPlayerGames": 1000,
        "maximumSubgroupMseRegression": 0.05, "minimumSubgroupRows": 100,
        "maximumRuntimeIncrease": 0.1, "bootstrapResamples": 2000, "seed": 20261003,
        "requiredReports": ["MAE", "ranking", "bias", "coverage", "sample_sizes", "F_D", "thin_PP", "rookies", "trades", "availability"],
        "independentReviewRequired": True},
    "maximumExecutionSeconds": 1800,
    "uncertainty": "no player prediction intervals are issued; paired uncertainty concerns loss differences only",
    "lineage": "retain code/config/input/population/schedule/settlement hashes and original availability timestamps",
    "integration": "only after evidence and acceptance; dedicated default-off gate included in replay configuration",
}
MISSING_PACKET = {
    "version": VERSION,
    "required": [
        "Original pregame population and identity/team-stint records, including eventual nonparticipants.",
        "Immutable captured FORGE inputs and revisions, with matching code/config hashes and original availability timestamps.",
        "Cutoff-known authoritative schedule revision and per-game horizon.",
        "PP rate and cumulative PP exposure from the same last5 or all window, with source-completeness proof.",
        "Existing workload/participation evidence with explicit conditioning and retained dependence.",
        "Complete settled outcomes; nonparticipation zeros require official completeness. Later corrections are labels only.",
        "Previous-use record, chronological split dates frozen before tuning, and enough unprotected test slates/player-games.",
    ],
    "forbiddenSubstitutes": ["mutable_present_day_rows", "synthetic_fixtures", "row_counts_without_receipts", "realized_participant_only_population"],
}


def _number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def pp_rate_ablation(row: dict[str, Any], *, baseline_weight: float, context_multiplier: float,
                     prior_minutes: float, exposure_complete: bool) -> dict[str, Any]:
    """Compare pre-bound rates only. Completeness is an input assertion, not certification."""
    if not _number(baseline_weight) or baseline_weight > 1 or not _number(context_multiplier):
        raise ValueError("finite baseline weight in [0,1] and nonnegative context required")
    if type(prior_minutes) not in (int, float) or prior_minutes not in PRIOR_MINUTES:
        raise ValueError("use the predeclared prior-minute grid")
    if type(exposure_complete) is not bool:
        raise ValueError("exposure completeness must be explicit")
    window, raw_rate = None, 8.0
    for candidate_window in ("last5", "all"):
        # Canonical-first compatibility; numeric zero is an observation.
        value = row.get(f"sog_per_60_{candidate_window}")
        if value is None:
            value = row.get(f"sog_per_60_avg_{candidate_window}")
        if value is not None:
            if not _number(value):
                raise ValueError("invalid PP rate")
            window, raw_rate = candidate_window, value
            break
    def rate(weight: float) -> float:
        return min(28.0, max(2.0, raw_rate * context_multiplier * weight + (1 - weight) * 8))
    baseline = rate(baseline_weight)
    seconds = row.get(f"toi_seconds_total_{window}") if window else None
    reason = "missing_pp_rate" if window is None else (
        "missing_or_unverified_pp_exposure" if not exposure_complete or not _number(seconds) else None)
    if reason is None and seconds == 0 and raw_rate > 0:
        reason = "positive_rate_without_exposure"
    weight = None if reason else (seconds / 60) / (seconds / 60 + prior_minutes)
    return {"window": window, "rawRate": raw_rate, "priorMinutes": prior_minutes,
        "exposureMinutes": seconds / 60 if _number(seconds) else None,
        "baselineRate": baseline, "candidateRate": baseline if reason else rate(weight),
        "candidateWeight": weight, "fallbackFlag": reason,
        "scope": "pre_bound_rate_mechanics_only", "unit": "shots_per_60_pp_minutes"}


def engineering_fixtures() -> list[dict[str, Any]]:
    def case(name: str, row: dict, complete: bool = True) -> dict:
        return {"id": name, "evidenceClass": "fictional", "row": row,
            "baseline_weight": 0.8, "context_multiplier": 1.1, "exposure_complete": complete}
    return [
        case("recent_window", {"sog_per_60_last5": 12, "toi_seconds_total_last5": 600, "toi_seconds_total_all": 30000}),
        case("all_window_legacy_rate", {"sog_per_60_avg_all": 12, "toi_seconds_total_all": 1800}),
        case("observed_zero_shots", {"sog_per_60_last5": 0, "toi_seconds_total_last5": 300}),
        case("complete_zero_exposure", {"sog_per_60_last5": 0, "toi_seconds_total_last5": 0}),
        case("missing_recent_exposure", {"sog_per_60_last5": 12, "toi_seconds_total_all": 30000}),
        case("unverified_exposure", {"sog_per_60_last5": 12, "toi_seconds_total_last5": 600}, False),
        case("contradictory_zero_exposure", {"sog_per_60_last5": 12, "toi_seconds_total_last5": 0}),
        case("missing_rate", {}),
    ]


def export_engineering(output: Path, inventory_path: Path | None = None) -> dict[str, Any]:
    root = repository_root()
    assert_output_outside_repository(output, root)
    # Also protect the primary checkout when running from an isolated worktree.
    common = subprocess.check_output(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=root, text=True).strip()
    assert_output_outside_repository(output, Path(common).parent)
    for relative, expected in BASELINE_DEPENDENCIES.items():
        if hashlib.sha256((root / relative).read_bytes()).hexdigest() != expected:
            raise ValueError(f"baseline dependency changed: {relative}")
    inventory = read_json(inventory_path) if inventory_path else None
    if inventory is not None and not isinstance(inventory, dict):
        raise ValueError("evidence inventory must be an object; it cannot authorize evaluation")
    fixtures = engineering_fixtures()
    mechanics = [{"id": case["id"], "evidenceClass": case["evidenceClass"],
        "results": [pp_rate_ablation(case["row"], prior_minutes=k,
            **{key: case[key] for key in ("baseline_weight", "context_multiplier", "exposure_complete")}) for k in PRIOR_MINUTES]}
        for case in fixtures]
    report = {"version": VERSION, "status": "insufficient_authentic_evidence", "decision": "retain_baseline",
        "baseSha": BASE_SHA,
        "checkoutSha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
        "harnessHash": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "baselineDependencies": BASELINE_DEPENDENCIES,
        "inventory": inventory, "inventoryHash": hashlib.sha256(inventory_path.read_bytes()).hexdigest() if inventory_path else None,
        "engineeringCaseCount": len(fixtures), "priorSettings": len(PRIOR_MINUTES),
        "predictiveEvidenceQualified": False, "predictiveTrials": [], "selectedPriorMinutes": None,
        "holdoutResults": None, "accuracyImprovement": None, "servingEnabled": False,
        "limitations": ["Fictional cases demonstrate rate mechanics only.",
            "An inventory is discovery evidence, not an authenticated forecast/outcome packet.",
            "No count forecasts, tuning, predictive losses, player intervals or release decisions are produced.",
            "Exposure selection follows a rate window; matching weighted denominators still require source qualification.",
            "No production module imports this harness; FORGE, RSO and Starter Board behavior is unchanged."]}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    documents = {"protocol.json": PROTOCOL, "fixtures.json": fixtures, "mechanics.json": mechanics,
        "missing-evidence.json": MISSING_PACKET}
    report["artifactHashes"] = {}
    for name, payload in documents.items():
        write_json(output / name, payload)
        (output / name).chmod(0o600)
        report["artifactHashes"][name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    write_json(output / "report.json", report)
    (output / "report.json").chmod(0o600)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--inventory", type=Path)
    args = parser.parse_args()
    report = export_engineering(args.output, args.inventory)
    print(canonical_json({key: report[key] for key in ("status", "decision", "engineeringCaseCount", "predictiveEvidenceQualified")}))


if __name__ == "__main__":
    main()

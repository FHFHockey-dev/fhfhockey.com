#!/usr/bin/env python3
"""Deterministic F3 falsification probes, standard library only.

Research algebra, not an execution of the application or a fitted forecast.
Run: python exposure_synthetic.py --repo /workspace/shared/fhfhockey.com
No network, raw historical labels, imports from the app, or repository writes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = [
    "web/lib/projections/stages/skater-stage.ts",
    "web/lib/projections/calculators/skater-adjustments.ts",
    "web/lib/projections/seasonBootstrap.ts",
    "web/lib/projections/reconcile.ts",
    "web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts",
    "web/lib/supabase/Upserts/rollingMetricAggregation.ts",
    "web/lib/supabase/Upserts/rollingPlayerMetricMath.ts",
]


def valid(x):
    return x is not None and math.isfinite(x) and x >= 0


def row(seconds, count):
    return {"seconds": seconds, "count": count}


def stats(rows):
    """Faithful neutral-input subset of simple versus ratio accumulation.

    All rows with positive TOI are strength appearances. Ratio last5 uses the
    last five appearances, retaining missing-count slots. Simple aggregates
    independently skip nulls. No reconstructed rates in these cases.
    """
    times = [r["seconds"] for r in rows if valid(r["seconds"])]
    counts = [r["count"] for r in rows if valid(r["count"])]
    appearances = [r for r in rows if valid(r["seconds"]) and r["seconds"] > 0]
    recent_times = times[-5:]

    def paired(selected):
        selected = [r for r in selected if valid(r["seconds"]) and r["seconds"] > 0 and valid(r["count"])]
        return {"C": sum(r["count"] for r in selected),
                "E_minutes": sum(r["seconds"] for r in selected) / 60,
                "observations": len(selected)}

    all_pair, recent_pair = paired(appearances), paired(appearances[-5:])
    return {
        "mean_seconds_all": sum(times) / len(times) if times else None,
        "total_seconds_all": sum(times) if times else None,
        "mean_seconds_last5": sum(recent_times) / len(recent_times) if recent_times else None,
        "shots_total_all": sum(counts) if counts else None,
        "all_pair": all_pair, "recent_pair": recent_pair,
        "generic_last5_minutes": sum(recent_times) / 60,
    }


def heuristic_weight(ev, pp, cumulative=False):
    key = "total_seconds_all" if cumulative else "mean_seconds_all"
    T = sum(s[key] or 0 for s in (ev, pp))
    C = sum(s["shots_total_all"] or 0 for s in (ev, pp))
    return round(0.58 * T / (T + 900) + 0.42 * C / (C + 45), 4)


def rate(pair):
    return 60 * pair["C"] / pair["E_minutes"] if pair["E_minutes"] > 0 else None


def reference(pair, r0=6, tau=15):
    # Exact Gamma-Poisson posterior mean for the DECLARED matched scope.
    E, C = pair["E_minutes"], pair["C"]
    return {"rate": (60 * C + tau * r0) / (E + tau),
            "data_weight": E / (E + tau),
            "support": "observed" if E > 0 else "unknown_or_no_exposure",
            "C": C, "E_minutes": E}


def slice_forecast(ev_rows, pp_rows=(), strength="ev"):
    """Stage slice BEFORE role bounds, availability, team reconciliation/bootstrap.

    Context multipliers = 1, no deployment prior; global SOG clamps retained.
    Does not purport to reproduce the whole application.
    """
    ev, pp = stats(ev_rows), stats(pp_rows)
    selected = ev if strength == "ev" else pp
    r0, default_seconds, lower, upper = (6, 700, 1.5, 20) if strength == "ev" else (8, 120, 2, 28)
    raw = rate(selected["recent_pair"])
    raw = rate(selected["all_pair"]) if raw is None else raw
    raw = r0 if raw is None else raw
    avg = selected["mean_seconds_all"]
    avg = default_seconds if avg is None else avg
    recent = selected["mean_seconds_last5"]
    recent = avg if recent is None else recent
    out = {"raw_recent_or_fallback_rate": raw, "support": selected}
    for name, cumulative in (("current", False), ("cumulative_only", True)):
        w = heuristic_weight(ev, pp, cumulative)
        r = min(upper, max(lower, w * raw + (1 - w) * r0))
        toi = round(w * recent + (1 - w) * avg, 3)
        out[name] = {"weight": w, "rate": r, "toi_seconds": toi, "count_mean": toi * r / 3600}
    out["reference_recent"] = reference(selected["recent_pair"], r0)
    out["reference_static_all"] = reference(selected["all_pair"], r0)
    return out


def bootstrap_weight(n, previous=True, fantasy=False):
    p = min(1, max(0, n) / 20)
    denominator = p + (1 - p) * (0.4 * previous + 0.6 * fantasy)
    # blendSeasonBootstrap falls back to the finite organic input when no
    # positive-weight prior/category parts exist, including n=0 here.
    return p / denominator if denominator else 1.0


def normalized(values, target):
    return [target * x / sum(values) for x in values]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    args = parser.parse_args()
    results = {"assumptions": [
        "No fitted parameters or real outcomes. Each row is synthetic.",
        "Rate reference tau=15 minutes is an illustrative fixed pseudo-exposure, not calibrated.",
        "Current/cumulative formulas include four-decimal weight rounding and global rate clamps.",
        "Neutral context/no role bounds/no availability; application-wide claims require full offline replay.",
        "Reference_recent and reference_static_all assume different stationary scopes; neither is established NHL truth.",
    ], "source_sha256": {f: hashlib.sha256((args.repo / f).read_bytes()).hexdigest() for f in FILES}}

    results["same_rate_different_history"] = {
        str(n): slice_forecast([row(1200, 2)] * n) for n in (1, 5, 80, 800)}
    # The exact same recent 100 minutes / 20 shots remain untouched.
    results["append_old_zero_events"] = {
        str(n): slice_forecast([row(1200, 0)] * (n - 5) + [row(1200, 4)] * 5)
        for n in (5, 80, 800)}
    results["cross_strength"] = {
        str(n): slice_forecast([row(1200, 2)] * n, [row(300, 1)], "pp")
        for n in (1, 80, 800)}
    results["zero_vs_missing"] = {
        "zero": slice_forecast([row(1200, 0)] * 5),
        "missing": slice_forecast([row(1200, None)] * 5)}
    missing_rows = [row(1200, 1)] + [row(1200, None)] * 4
    paired = stats(missing_rows)
    generic_E = paired["generic_last5_minutes"]
    # A naive generic-TOI fix would invent count equivalents from the observed rate.
    invented_pair = {"C": rate(paired["recent_pair"]) * generic_E / 60,
                     "E_minutes": generic_E}
    results["missing_pair_mismatch"] = {
        "inputs": missing_rows, "stats": paired,
        "matched_reference": reference(paired["recent_pair"]),
        "generic_exposure_pseudocount_reference": reference(invented_pair)}

    # Exact partition invariance, versus updating the same observations twice.
    old, recent = {"C": 0, "E_minutes": 80}, {"C": 10, "E_minutes": 20}
    all_pair = {"C": 10, "E_minutes": 100}
    r0, tau = 4.9, 50
    baseline = reference(all_pair, r0, tau)["rate"]
    old_post = reference(old, r0, tau)["rate"]
    sequential = (60 * recent["C"] + (old["E_minutes"] + tau) * old_post) / (100 + tau)
    duplicate = reference({"C": 20, "E_minutes": 120}, r0, tau)["rate"]
    recent_w = 20 / (20 + 120)
    blend = recent_w * 30 + (1 - recent_w) * baseline
    results["overlapping_recent_history"] = {
        "history_includes_recent": all_pair, "recent_subset": recent,
        "correct_static_posterior": baseline, "correct_disjoint_sequential_update": sequential,
        "wrong_duplicate_sequential_posterior": duplicate,
        "existing_HIT_recent_blend": blend,
        "interpretation": "Existing blend is explicit recency weighting, not alleged to equal duplicate Bayesian update."}

    # Same evidence can describe a durable role change or a transient low-TOI run.
    shifted = slice_forecast([row(1200, 2)] * 75 + [row(600, 1)] * 5)
    risks = {}
    for world, mean in (("durable_10_minute_role", 1), ("temporary_dip_then_20_minutes", 2)):
        risks[world] = {name: mean + (shifted[name]["count_mean"] - mean) ** 2
                        for name in ("current", "cumulative_only")}
    results["minutes_shift"] = {"stage_slice": shifted,
        "assumed_Poisson_future_means": {"durable_10_minute_role": 1, "temporary_dip_then_20_minutes": 2},
        "analytic_expected_MSE": risks,
        "reference_rate": 6,
        "reference_expected_count_with_correct_exogenous_minutes": {"10_minutes": 1, "20_minutes": 2}}
    results["bootstrap_effective_organic_weight"] = {
        str(n): {"nominal": n / 20,
                 "actual_path_previous_present_fantasy_disabled": bootstrap_weight(n),
                 "previous_missing_fantasy_disabled": bootstrap_weight(n, False),
                 "counterfactual_both_priors_present": bootstrap_weight(n, True, True)}
        for n in (0, 1, 5, 10, 20)}
    results["reconciliation"] = {
        "before_uniform_change": normalized([1, 2], 6),
        "after_uniform_change": normalized([2, 4], 6),
        "after_nonuniform_change": normalized([2, 2], 6)}

    a, b = results["append_old_zero_events"]["5"], results["append_old_zero_events"]["800"]
    pp1, pp800 = results["cross_strength"]["1"], results["cross_strength"]["800"]
    checks = {
        "all_static_partition_invariance": math.isclose(baseline, sequential),
        "same_recent_data_reference_unchanged": a["reference_recent"] == b["reference_recent"],
        "cumulative_fix_increases_recent_rate_after_old_zeros": b["cumulative_only"]["rate"] > a["cumulative_only"]["rate"],
        "static_reference_decreases_after_old_zeros": b["reference_static_all"]["rate"] < a["reference_static_all"]["rate"],
        "PP_reference_independent_of_added_EV": pp1["reference_recent"] == pp800["reference_recent"],
        "PP_cumulative_fix_changes_with_EV_only": pp1["cumulative_only"]["rate"] != pp800["cumulative_only"]["rate"],
        "zero_missing_current_weights_conflated": results["zero_vs_missing"]["zero"]["current"]["weight"] == results["zero_vs_missing"]["missing"]["current"]["weight"],
        "zero_missing_reference_support_distinct": results["zero_vs_missing"]["zero"]["reference_recent"]["support"] != results["zero_vs_missing"]["missing"]["reference_recent"]["support"],
        "risk_winner_reverses_with_workload_assumption": risks["durable_10_minute_role"]["cumulative_only"] < risks["durable_10_minute_role"]["current"] and risks["temporary_dip_then_20_minutes"]["current"] < risks["temporary_dip_then_20_minutes"]["cumulative_only"],
        "team_uniform_scaling_cancels": results["reconciliation"]["before_uniform_change"] == results["reconciliation"]["after_uniform_change"],
    }
    assert all(checks.values()), checks
    results["reproduction_checks"] = checks
    output = HERE / "exposure-synthetic-results.json"
    output.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n")
    print(f"PASS: {len(checks)} deterministic reproduction checks; {output}")
    for section in ("append_old_zero_events", "cross_strength"):
        for n, value in results[section].items():
            print(section, n, "current", round(value["current"]["rate"], 6),
                  "cumulative", round(value["cumulative_only"]["rate"], 6),
                  "reference_recent", round(value["reference_recent"]["rate"], 6),
                  "reference_all", round(value["reference_static_all"]["rate"], 6))
    print("minutes_shift", json.dumps(risks, sort_keys=True))


if __name__ == "__main__":
    main()

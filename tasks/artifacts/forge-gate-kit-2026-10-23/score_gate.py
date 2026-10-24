"""Portable offline FORGE scorer. Standard library only; never executes a capture.

Shared math comes from the task2/task3 scorers. Defaults remain 2,000 game-cluster
replicates, seed 1, and historical percentile order statistics (50, 1949).
"""
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import random

HEADS = ["G", "A", "PPP", "SOG", "HIT", "BLK", "FP"]
FP_W = {"G": 3, "A": 2, "PPP": 1, "SOG": 0.2, "HIT": 0.2, "BLK": 0.25}
VARIANTS = ["va", "vc"]  # Legacy score_gate CLI defaults only.
REPS, SEED = 2000, 1


def num(value):
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def heads_of(row):
    def total(*keys):
        values = [num(row.get(k)) for k in keys]
        return None if None in values else sum(values)
    heads = {"G": total("proj_goals_es", "proj_goals_pp"),
             "A": total("proj_assists_es", "proj_assists_pp"),
             "PPP": total("proj_goals_pp", "proj_assists_pp"),
             "SOG": total("proj_shots_es", "proj_shots_pp"),
             "HIT": total("proj_hits"), "BLK": total("proj_blocks")}
    heads["FP"] = fantasy_points(heads)
    return heads


def fantasy_points(heads):
    return None if any(heads[h] is None for h in FP_W) else sum(FP_W[h] * heads[h] for h in FP_W)


def table_chain(chain, table):
    return bool(chain and chain[0].get("method") == "from" and chain[0].get("args") == [table])


def player_rows(capture):
    rows = []
    for chain in capture.get("intendedWrites") or []:
        if table_chain(chain, "forge_player_projections"):
            for op in chain[1:]:
                args = op.get("args") or []
                if op.get("method") == "upsert" and args and isinstance(args[0], list):
                    rows.extend(args[0])
    return rows


def identity_value(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not str(value).isdigit():
        raise ValueError("player/game identities must be positive integer IDs")
    if int(value) <= 0:
        raise ValueError("player/game identities must be positive integer IDs")
    return str(int(value))


def identity(row):
    return identity_value(row.get("game_id")), identity_value(row.get("player_id"))


def index_rows(rows, source):
    indexed = {}
    for row in rows:
        key = identity(row)
        if key in indexed:
            raise ValueError(f"duplicate player-game identity in {source}: {key}")
        indexed[key] = row
    return indexed


def positions(capture):
    """Read the captured players response, independently of JSON whitespace/key order."""
    result = {}
    for read in (capture.get("payload") or {}).get("reads") or []:
        if not table_chain(read.get("request"), "players"):
            continue
        response = read.get("result") or {}
        for player in response.get("data") or []:
            if "position" not in player:
                continue
            pid = identity_value(player.get("id"))
            raw = player["position"]
            pos = "D" if raw == "D" else "F" if raw in ("F", "C", "L", "R", "LW", "RW") else "?"
            if pid in result and result[pid] != pos:
                raise ValueError(f"conflicting captured position for player {pid}")
            result[pid] = pos
    return result


def row_date(row):
    value = str(row.get("date", ""))[:10]
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("actuals/hits-blocks rows require an ISO date") from None
    return value


def load_cohort(out_dir, base, cand, actuals_path, hb_path):
    variants = [base, cand]
    if base == cand or any(not v or v in (".", "..") or Path(v).name != v for v in variants):
        raise ValueError("baseline and candidate must be distinct directory names")
    checks, hashes = Counter(), {}

    def read(path):
        path = Path(path)
        data = path.read_bytes()
        hashes[str(path)] = hashlib.sha256(data).hexdigest()
        return json.loads(data)

    actuals = index_rows(read(actuals_path), "actuals")
    hb = index_rows(read(hb_path), "hits/blocks")
    for source in (actuals, hb):
        for row in source.values():
            row_date(row)
    checks["source_actual_rows"] = len(actuals)
    checks["source_hb_rows"] = len(hb)
    files = {v: {p.name for p in (Path(out_dir) / v).iterdir() if p.is_file() and p.suffix == ".json"} for v in variants}
    common = files[base] & files[cand]
    for v in variants:
        checks[f"unpaired_capture_files_{v}"] = len(files[v] - common)
    rows, seen, cohort_dates = [], set(), set()
    for filename in sorted(common):
        capture_date = filename[:10]
        date.fromisoformat(capture_date)
        cohort_dates.add(capture_date)
        by, pos = {}, {}
        for v in variants:
            cap = read(Path(out_dir) / v / filename)
            if (cap.get("payload") or {}).get("slateDate", capture_date) != capture_date:
                raise ValueError(f"capture date disagrees with filename: {v}/{filename}")
            if (cap.get("diagnostics", {}).get("replay") or {}).get("matched") is not True:
                checks[f"replay_not_matched_{v}"] += 1
            by[v] = index_rows([r for r in player_rows(cap) if num(r.get("horizon_games")) == 1], f"{v}/{filename}")
            pos[v] = positions(cap)
        for key in sorted(by[base].keys() | by[cand].keys()):
            if key in seen:
                raise ValueError(f"player-game identity repeated across capture files: {key}")
            seen.add(key)
            if not all(key in by[v] for v in variants):
                checks["drop_not_in_both"] += 1
                continue
            a = actuals.get(key)
            if a is None:
                checks["drop_not_dressed"] += 1
                continue
            if row_date(a) != capture_date:
                checks["drop_actual_date_mismatch"] += 1
                continue
            e = hb.get(key) or {}
            if e and row_date(e) != capture_date:
                checks["hb_date_mismatch"] += 1
                e = {}
            truth = {"G": num(a.get("goals")), "A": num(a.get("assists")),
                     "PPP": num(a.get("pp_points")), "SOG": num(a.get("shots")),
                     "HIT": num(e.get("hits")), "BLK": num(e.get("blocked_shots"))}
            truth["FP"] = fantasy_points(truth)
            known = {pos[v].get(key[1], "?") for v in variants} - {"?"}
            if len(known) > 1:
                raise ValueError(f"baseline/candidate position mismatch: {key}")
            rows.append({"key": key, "game": key[0], "pos": next(iter(known), "?"),
                         "truth": truth, "preds": {v: heads_of(by[v][key]) for v in variants}})
    checks["paired_capture_files"] = len(common)
    checks["matched_games"] = len({r["game"] for r in rows})
    checks["dressed_paired_rows"] = len(rows)
    checks["actual_rows_on_capture_dates"] = sum(row_date(a) in cohort_dates for a in actuals.values())
    checks["unknown_position_rows"] = sum(r["pos"] == "?" for r in rows)
    return {"rows": rows, "variants": variants, "checks": dict(checks), "sha256": hashes}


def use(rows, head, variants):
    return [r for r in rows if r["truth"][head] is not None and all(r["preds"][v][head] is not None for v in variants)]


def ratio(a, b):
    return a / b if b else None


def ranked(rows, variant, head):
    return sorted(rows, key=lambda r: (r["preds"][variant][head], r["game"], r["key"][1]))


def deciles(rows, variant, head):
    ordered = ranked(rows, variant, head)
    n = len(ordered)
    result = []
    for d in range(10):
        bucket = ordered[d * n // 10:(d + 1) * n // 10]
        pred = sum(r["preds"][variant][head] for r in bucket)
        actual = sum(r["truth"][head] for r in bucket)
        result.append({"n": len(bucket), "pred": pred, "actual": actual, "ratio": ratio(actual, pred)})
    return result


def stats(rows, variant, head):
    errors = [r["preds"][variant][head] - r["truth"][head] for r in rows]
    pred = sum(r["preds"][variant][head] for r in rows)
    actual = sum(r["truth"][head] for r in rows)
    relative = ratio(pred, actual)
    return {"n": len(rows), "mae": ratio(sum(map(abs, errors)), len(rows)),
            "bias": ratio(sum(errors), len(rows)), "rel": relative - 1 if relative is not None else None,
            "rmse": math.sqrt(sum(e * e for e in errors) / len(rows)) if rows else None,
            "top": deciles(rows, variant, head)[9]["ratio"]}


def cluster_samples(rows, reps=REPS, seed=SEED):
    if reps < 40:
        raise ValueError("at least 40 bootstrap replicates required")
    by_game = {}
    for row in rows:
        by_game.setdefault(row["game"], []).append(row)
    games = sorted(by_game)
    rnd = random.Random(seed)
    for _ in range(reps):
        yield [r for game in (rnd.choice(games) for _ in games) for r in by_game[game]]


def interval(values):
    """Do not silently condition a CI on only the defined bootstrap draws."""
    defined = [x for x in values if x is not None and math.isfinite(x)]
    result = {"bounds": None, "valid_reps": len(defined), "reps": len(values)}
    if len(defined) == len(values) and defined:
        defined.sort()
        result["bounds"] = (defined[int(.025 * len(values))], defined[int(.975 * len(values)) - 1])
    return result


def subtract(a, b):
    return None if a is None or b is None else a - b


def bootstrap(rows, head, base, cand, reps=REPS, seed=SEED):
    draws = {"delta_bias": [], "delta_rmse": []}
    variant_draws = {v: {"rel": [], "top": []} for v in (base, cand)}
    for sample in cluster_samples(rows, reps, seed):
        a, c = stats(sample, base, head), stats(sample, cand, head)
        draws["delta_bias"].append(subtract(c["bias"], a["bias"]))
        draws["delta_rmse"].append(subtract(c["rmse"], a["rmse"]))
        for v, s in ((base, a), (cand, c)):
            for metric in ("rel", "top"):
                variant_draws[v][metric].append(s[metric])
    return {"delta_bias": interval(draws["delta_bias"]), "delta_rmse": interval(draws["delta_rmse"]),
            "variants": {v: {m: interval(xs) for m, xs in variant_draws[v].items()} for v in (base, cand)}}


def mz(rows, variant, head):
    if not rows:
        return {"n": 0, "slope": None, "intercept": None, "reason": "empty paired category"}
    xs = [r["preds"][variant][head] for r in rows]
    ys = [r["truth"][head] for r in rows]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    variance = sum((x - mx) ** 2 for x in xs)
    if not variance:
        return {"n": len(xs), "slope": None, "intercept": None, "reason": "constant predictions"}
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / variance
    return {"n": len(xs), "slope": slope, "intercept": my - slope * mx, "reason": None}


def defense_share(rows, variant=None):
    # Keep the MZ script's historical floor(n/10) representation diagnostic.
    value = (lambda r: r["truth"]["FP"]) if variant is None else (lambda r: r["preds"][variant]["FP"])
    ordered = sorted(rows, key=lambda r: (-value(r), r["game"], r["key"][1]))
    top = ordered[:len(rows) // 10]
    return {"top_n": len(top), "top_d": sum(r["pos"] == "D" for r in top),
            "all_n": len(rows), "all_d": sum(r["pos"] == "D" for r in rows),
            "unknown_n": sum(r["pos"] == "?" for r in rows)}


def legacy_gate(head, values):
    # Task2's exact numerical gates; this is not the full F1/F3/F4 qualification.
    return (values["top"] is not None and abs(values["top"] - 1) <= .10
            and (head not in ("FP", "HIT", "SOG") or
                 (values["rel"] is not None and abs(values["rel"]) <= .10)))


def fmt(value, spec=".4f"):
    return "unavailable" if value is None else format(value, spec)


def ci(value, spec=".4f"):
    if value["bounds"] is None:
        return f"unavailable ({value['valid_reps']}/{value['reps']} defined draws)"
    return "[" + ", ".join(fmt(x, spec) for x in value["bounds"]) + "]"


def checks_report(cohort):
    print("Offline scoring only; this report does not establish model qualification.\n")
    print(f"Bootstrap: {REPS} replicates, seed {SEED}, paired game clusters; candidate minus baseline.\n")
    for key, value in sorted(cohort["checks"].items()):
        print(f"- {key}: {value}")
    print("\nInput SHA256 (only files read):")
    for path, digest in sorted(cohort["sha256"].items()):
        print(f"- `{path}`: `{digest}`")
    print()


def main(out_dir, actuals_path, hb_path, base="va", cand="vc"):
    from score_pair import report
    cohort = load_cohort(out_dir, base, cand, actuals_path, hb_path)
    report(cohort)
    print("## Legacy Task2 numerical checks (not full model qualification)\n")
    print("FP/HIT/SOG relative bias ±10%; every head top decile 0.9–1.1.\n")
    for head in HEADS:
        values = stats(use(cohort["rows"], head, cohort["variants"]), cand, head)
        print(f"- {head}: {'yes' if legacy_gate(head, values) else 'NO / unavailable'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out_dir")
    parser.add_argument("actuals")
    parser.add_argument("hits_blocks")
    parser.add_argument("--base", default="va")
    parser.add_argument("--candidate", default="vc")
    args = parser.parse_args()
    main(args.out_dir, args.actuals, args.hits_blocks, args.base, args.candidate)

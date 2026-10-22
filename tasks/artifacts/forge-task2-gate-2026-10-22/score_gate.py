"""Task 2 gate scorer: variants va (master) and vc (variant c) on identical games.

Per head (G, A, PPP, SOG, HIT, BLK, FP): n, MAE, bias, relative bias (sum pred / sum actual - 1), RMSE,
forecast-binned deciles by each variant's own prediction (sum actual / sum pred), and a paired
cluster bootstrap by game (c minus a) for bias and RMSE. Dressed player-games only (actual row present).
Usage: python3 score_gate.py RECON_OUT ACTUALS HITS_BLOCKS > report.md
"""
import hashlib, json, math, os, random, sys

HEADS = ["G", "A", "PPP", "SOG", "HIT", "BLK", "FP"]
FP_W = {"G": 3, "A": 2, "PPP": 1, "SOG": 0.2, "HIT": 0.2, "BLK": 0.25}
VARIANTS = ["va", "vc"]


def num(v):
    if v is None or v == "" or isinstance(v, bool):
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def heads_of(row):
    def s(*keys):
        vals = [num(row.get(k)) for k in keys]
        return None if any(v is None for v in vals) else sum(vals)
    h = {"G": s("proj_goals_es", "proj_goals_pp"), "A": s("proj_assists_es", "proj_assists_pp"),
         "PPP": s("proj_goals_pp", "proj_assists_pp"), "SOG": s("proj_shots_es", "proj_shots_pp"),
         "HIT": s("proj_hits"), "BLK": s("proj_blocks")}
    h["FP"] = None if any(h[k] is None for k in FP_W) else sum(FP_W[k] * h[k] for k in FP_W)
    return h


def player_rows(capture):
    out = []
    for chain in capture.get("intendedWrites") or []:
        if not chain or chain[0].get("method") != "from" or chain[0].get("args", [None])[0] != "forge_player_projections":
            continue
        for op in chain[1:]:
            if op.get("method") == "upsert" and isinstance(op.get("args", [None])[0], list):
                out.extend(op["args"][0])
    return out


def sha_dir(path):
    h = hashlib.sha256()
    for name in sorted(os.listdir(path)):
        h.update(name.encode())
        with open(os.path.join(path, name), "rb") as fh:
            h.update(hashlib.sha256(fh.read()).digest())
    return h.hexdigest()


def sha_file(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main(out_dir, actuals_path, hb_path):
    actuals = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(actuals_path))}
    hb = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(hb_path))}
    stems = sorted(set.intersection(*[{f[:-5] for f in os.listdir(os.path.join(out_dir, v)) if f.endswith(".json")} for v in VARIANTS]))
    rows, checks = [], {}
    bump = lambda k: checks.__setitem__(k, checks.get(k, 0) + 1)
    for stem in stems:
        date = stem[:10]
        by = {}
        for v in VARIANTS:
            cap = json.load(open(os.path.join(out_dir, v, stem + ".json")))
            if not (cap.get("diagnostics", {}).get("replay") or {}).get("matched"):
                bump(f"replay_not_matched_{v}")
            by[v] = {f"{r['game_id']}:{r['player_id']}": r for r in player_rows(cap) if num(r.get("horizon_games")) == 1}
        for key in sorted(by["va"]):
            if key not in by["vc"]:
                bump("drop_not_in_both"); continue
            a = actuals.get(key)
            if not a or str(a.get("date", date))[:10] != date:
                bump("drop_not_dressed"); continue
            e = hb.get(key) or {}
            truth = {"G": num(a.get("goals")), "A": num(a.get("assists")), "PPP": num(a.get("pp_points")),
                     "SOG": num(a.get("shots")), "HIT": num(e.get("hits")), "BLK": num(e.get("blocked_shots"))}
            truth["FP"] = None if any(truth[k] is None for k in FP_W) else sum(FP_W[k] * truth[k] for k in FP_W)
            preds = {v: heads_of(by[v][key]) for v in VARIANTS}
            rows.append({"game": key.split(":")[0], "truth": truth, "preds": preds})
    checks["games"] = len(stems)
    checks["rows"] = len(rows)

    def use(head):
        return [r for r in rows if r["truth"][head] is not None and all(r["preds"][v][head] is not None for v in VARIANTS)]

    def stats(rs, v, head):
        err = [r["preds"][v][head] - r["truth"][head] for r in rs]
        n = len(err)
        sp = sum(r["preds"][v][head] for r in rs); sa = sum(r["truth"][head] for r in rs)
        return {"n": n, "mae": sum(map(abs, err)) / n, "bias": sum(err) / n, "rmse": math.sqrt(sum(x * x for x in err) / n),
                "rel": sp / sa - 1 if sa else float("nan")}

    def deciles(rs, v, head):
        s = sorted(rs, key=lambda r: (r["preds"][v][head], r["game"]))
        n = len(s); out = []
        for d in range(10):
            b = s[d * n // 10:(d + 1) * n // 10]
            sp = sum(r["preds"][v][head] for r in b); sa = sum(r["truth"][head] for r in b)
            out.append((len(b), sp / len(b), sa / len(b), sa / sp if sp else float("nan")))
        return out

    def boot(rs, head, reps=2000, seed=1):
        games = sorted({r["game"] for r in rs}); byg = {g: [r for r in rs if r["game"] == g] for g in games}
        rnd = random.Random(seed); db, dr = [], []
        for _ in range(reps):
            sample = [r for g in (rnd.choice(games) for _ in games) for r in byg[g]]
            a, c = stats(sample, "va", head), stats(sample, "vc", head)
            db.append(c["bias"] - a["bias"]); dr.append(c["rmse"] - a["rmse"])
        ci = lambda xs: (sorted(xs)[int(0.025 * reps)], sorted(xs)[int(0.975 * reps) - 1])
        return ci(db), ci(dr)

    p = print
    p("# Task 2 gate: reconstruction backtest, master (va) vs variant c (vc)\n")
    p("## Inputs\n\n| input | sha256 |\n|---|---|")
    for v in VARIANTS:
        p(f"| captures {v} ({len(os.listdir(os.path.join(out_dir, v)))} files) | {sha_dir(os.path.join(out_dir, v))} |")
    p(f"| actuals `{os.path.basename(actuals_path)}` | {sha_file(actuals_path)} |\n| hits/blocks `{os.path.basename(hb_path)}` | {sha_file(hb_path)} |\n")
    p("## Checks\n\n" + "\n".join(f"- {k}: {v}" for k, v in sorted(checks.items())) + "\n")
    p("## Per head\n\n| head | variant | n | MAE | bias | rel. bias | RMSE | top decile Σact/Σpred | Δbias c−a [95% CI] | ΔRMSE c−a [95% CI] |")
    p("|---|---|---|---|---|---|---|---|---|---|")
    summary = {}
    for h in HEADS:
        rs = use(h)
        (b0, b1), (r0, r1) = boot(rs, h)
        for v in VARIANTS:
            s = stats(rs, v, h); top = deciles(rs, v, h)[9][3]
            summary[(h, v)] = (s, top)
            tail = f"{stats(rs, 'vc', h)['bias'] - stats(rs, 'va', h)['bias']:+.4f} [{b0:+.4f}, {b1:+.4f}] | {stats(rs, 'vc', h)['rmse'] - stats(rs, 'va', h)['rmse']:+.4f} [{r0:+.4f}, {r1:+.4f}]" if v == "vc" else " | "
            p(f"| {h} | {v} | {s['n']} | {s['mae']:.4f} | {s['bias']:+.4f} | {s['rel']:+.1%} | {s['rmse']:.4f} | {top:.3f} | {tail} |")
    p("\n## Forecast-binned deciles (own prediction), Σactual/Σpred\n")
    p("| head | variant | " + " | ".join(f"d{d+1}" for d in range(10)) + " |\n|---|---|" + "---|" * 10)
    for h in HEADS:
        for v in VARIANTS:
            p(f"| {h} | {v} | " + " | ".join(f"{x[3]:.2f}" for x in deciles(use(h), v, h)) + " |")
    p("\n## Gate (variant c): FP, HIT, SOG relative bias and every head's top-decile ratio within ±10%\n")
    p("| head | rel. bias | top decile | pass |\n|---|---|---|---|")
    for h in HEADS:
        s, top = summary[(h, "vc")]
        gated_bias = h in ("FP", "HIT", "SOG")
        ok = (not gated_bias or abs(s["rel"]) <= 0.10) and abs(top - 1) <= 0.10
        p(f"| {h} | {s['rel']:+.1%}{'' if gated_bias else ' (not gated)'} | {top:.3f} | {'yes' if ok else 'NO'} |")


if __name__ == "__main__":
    main(*sys.argv[1:4])

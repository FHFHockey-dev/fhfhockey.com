"""Paired gate scorer for one candidate against a baseline variant, overall and by position (F/D).

Per head (G, A, PPP, SOG, HIT, BLK, FP): n, bias, relative bias, RMSE, own-forecast top-decile
sum actual / sum pred, and seed-1 2,000-rep game-cluster bootstrap CIs for the candidate-minus-
baseline bias and RMSE, plus forecast-binned deciles. Dressed player-games only; positions come
from the captured players read.
Usage: python3 score_pair.py OUT_DIR BASE CAND ACTUALS HITS_BLOCKS
"""
import json, math, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import score_gate as sg  # noqa: E402

HEADS = ["G", "A", "PPP", "SOG", "HIT", "BLK", "FP"]


def main(out_dir, base, cand, actuals_path, hb_path):
    actuals = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(actuals_path))}
    hb = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(hb_path))}
    variants = [base, cand]
    stems = sorted(set.intersection(*[{f[:-5] for f in os.listdir(os.path.join(out_dir, v)) if f.endswith(".json")} for v in variants]))
    rows, pos, unmatched = [], {}, 0
    for stem in stems:
        date = stem[:10]
        by = {}
        for v in variants:
            text = open(os.path.join(out_dir, v, stem + ".json")).read()
            for pid, p in re.findall(r'\{"id":(\d+),"team_id":\d+,"position":"([A-Z])"\}', text):
                pos[pid] = "D" if p == "D" else "F"
            cap = json.loads(text)
            if not (cap.get("diagnostics", {}).get("replay") or {}).get("matched"):
                unmatched += 1
            by[v] = {f"{r['game_id']}:{r['player_id']}": r for r in sg.player_rows(cap) if sg.num(r.get("horizon_games")) == 1}
        for key in by[base]:
            a = actuals.get(key)
            if key not in by[cand] or not a or str(a.get("date", date))[:10] != date:
                continue
            e = hb.get(key) or {}
            t = {"G": sg.num(a.get("goals")), "A": sg.num(a.get("assists")), "PPP": sg.num(a.get("pp_points")),
                 "SOG": sg.num(a.get("shots")), "HIT": sg.num(e.get("hits")), "BLK": sg.num(e.get("blocked_shots"))}
            t["FP"] = None if any(t[k] is None for k in sg.FP_W) else sum(sg.FP_W[k] * t[k] for k in sg.FP_W)
            rows.append({"game": key.split(":")[0], "pos": pos.get(key.split(":")[1], "?"), "truth": t,
                         "preds": {v: sg.heads_of(by[v][key]) for v in variants}})

    def use(rs, h):
        return [r for r in rs if r["truth"][h] is not None and all(r["preds"][v][h] is not None for v in variants)]

    def stats(rs, v, h):
        err = [r["preds"][v][h] - r["truth"][h] for r in rs]
        n = len(err); sp = sum(r["preds"][v][h] for r in rs); sa = sum(r["truth"][h] for r in rs)
        s = sorted(rs, key=lambda r: (r["preds"][v][h], r["game"])); top = s[9 * n // 10:]
        tp = sum(r["preds"][v][h] for r in top)
        return {"n": n, "bias": sum(err) / n, "rel": sp / sa - 1 if sa else float("nan"),
                "rmse": math.sqrt(sum(x * x for x in err) / n), "top": sum(r["truth"][h] for r in top) / tp if tp else float("nan")}

    def deciles(rs, v, h):
        s = sorted(rs, key=lambda r: (r["preds"][v][h], r["game"])); n = len(s); out = []
        for d in range(10):
            b = s[d * n // 10:(d + 1) * n // 10]; sp = sum(r["preds"][v][h] for r in b)
            out.append(sum(r["truth"][h] for r in b) / sp if sp else float("nan"))
        return out

    def boot(rs, h, reps=2000):
        games = sorted({r["game"] for r in rs}); byg = {g: [r for r in rs if r["game"] == g] for g in games}
        rnd = random.Random(1); db, dr, dt = [], [], []
        for _ in range(reps):
            smp = [r for g in (rnd.choice(games) for _ in games) for r in byg[g]]
            a, c = stats(smp, base, h), stats(smp, cand, h)
            db.append(c["bias"] - a["bias"]); dr.append(c["rmse"] - a["rmse"]); dt.append(c["top"])
        q = lambda xs: (sorted(xs)[int(0.025 * reps)], sorted(xs)[int(0.975 * reps) - 1])
        return q(db), q(dr), q(dt)

    print(f"# Paired gate: {cand} vs {base}\n")
    print(f"Games {len(stems)}; dressed player-games {len(rows)} (F {sum(r['pos']=='F' for r in rows)}, D {sum(r['pos']=='D' for r in rows)}, unknown {sum(r['pos']=='?' for r in rows)}); captures without a matched replay: {unmatched}.\n")
    for group in ("all", "F", "D"):
        rs_all = rows if group == "all" else [r for r in rows if r["pos"] == group]
        print(f"## {group}\n\n| head | n | bias {base} → {cand} | rel. bias {base} → {cand} | RMSE {base} → {cand} | top decile {base} → {cand} [cand 95% CI] | Δbias [95% CI] | ΔRMSE [95% CI] |")
        print("|---|---|---|---|---|---|---|---|")
        for h in HEADS:
            rs = use(rs_all, h); a, c = stats(rs, base, h), stats(rs, cand, h); (b0, b1), (r0, r1), (t0, t1) = boot(rs, h)
            print(f"| {h} | {c['n']} | {a['bias']:+.4f} → {c['bias']:+.4f} | {a['rel']:+.1%} → {c['rel']:+.1%} | {a['rmse']:.4f} → {c['rmse']:.4f} | "
                  f"{a['top']:.3f} → {c['top']:.3f} [{t0:.3f}, {t1:.3f}] | {c['bias']-a['bias']:+.4f} [{b0:+.4f}, {b1:+.4f}] | {c['rmse']-a['rmse']:+.4f} [{r0:+.4f}, {r1:+.4f}] |")
        print("\nForecast-binned deciles, Σactual/Σpred:\n\n| head | variant | " + " | ".join(f"d{i+1}" for i in range(10)) + " |\n|---|---|" + "---|" * 10)
        for h in HEADS:
            for v in variants:
                print(f"| {h} | {v} | " + " | ".join(f"{x:.2f}" for x in deciles(use(rs_all, h), v, h)) + " |")
        print()


if __name__ == "__main__":
    main(*sys.argv[1:6])

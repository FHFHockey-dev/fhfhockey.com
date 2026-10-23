"""Bootstrap (by game, 2000 reps, seed 1) CIs for relative bias and top-decile Σactual/Σpred per variant."""
import random, sys, json
sys.argv = [sys.argv[0]] + sys.argv[1:]
import importlib.util
spec = importlib.util.spec_from_file_location("sg", sys.argv[1]); sg = importlib.util.module_from_spec(spec); spec.loader.exec_module(sg)
out_dir, act, hb = sys.argv[2:5]
# Rebuild rows using the scorer's code path by capturing its globals
import io, contextlib
rows_holder = {}
orig_main = sg.main
src = open(sys.argv[1]).read()
# minimal re-implementation of the join using sg helpers
import os, math
actuals = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(act))}
hbm = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(hb))}
stems = sorted(set.intersection(*[{f[:-5] for f in os.listdir(os.path.join(out_dir, v)) if f.endswith(".json")} for v in sg.VARIANTS]))
rows = []
for stem in stems:
    date = stem[:10]
    by = {v: {f"{r['game_id']}:{r['player_id']}": r for r in sg.player_rows(json.load(open(os.path.join(out_dir, v, stem + ".json")))) if sg.num(r.get("horizon_games")) == 1} for v in sg.VARIANTS}
    for key in by["va"]:
        a = actuals.get(key)
        if key not in by["vc"] or not a or str(a.get("date", date))[:10] != date: continue
        e = hbm.get(key) or {}
        t = {"G": sg.num(a.get("goals")), "A": sg.num(a.get("assists")), "PPP": sg.num(a.get("pp_points")), "SOG": sg.num(a.get("shots")), "HIT": sg.num(e.get("hits")), "BLK": sg.num(e.get("blocked_shots"))}
        t["FP"] = None if any(t[k] is None for k in sg.FP_W) else sum(sg.FP_W[k] * t[k] for k in sg.FP_W)
        rows.append({"game": key.split(":")[0], "truth": t, "preds": {v: sg.heads_of(by[v][key]) for v in sg.VARIANTS}})
def metrics(rs, v, h):
    sp = sum(r["preds"][v][h] for r in rs); sa = sum(r["truth"][h] for r in rs)
    s = sorted(rs, key=lambda r: (r["preds"][v][h], r["game"])); top = s[9 * len(s) // 10:]
    return sp / sa - 1, sum(r["truth"][h] for r in top) / sum(r["preds"][v][h] for r in top)
games = sorted({r["game"] for r in rows}); byg = {g: [r for r in rows if r["game"] == g] for g in games}
print("| head | variant | rel. bias [95% CI] | top decile [95% CI] |\n|---|---|---|---|")
for h in ["FP", "HIT", "SOG", "BLK", "G", "A", "PPP"]:
    use = lambda rs: [r for r in rs if r["truth"][h] is not None and all(r["preds"][v][h] is not None for v in sg.VARIANTS)]
    for v in sg.VARIANTS:
        rnd = random.Random(1); rb, td = [], []
        for _ in range(2000):
            smp = use([r for g in (rnd.choice(games) for _ in games) for r in byg[g]])
            x, y = metrics(smp, v, h); rb.append(x); td.append(y)
        rb.sort(); td.sort(); x, y = metrics(use(rows), v, h)
        print(f"| {h} | {v} | {x:+.1%} [{rb[50]:+.1%}, {rb[1949]:+.1%}] | {y:.3f} [{td[50]:.3f}, {td[1949]:.3f}] |")

"""Mincer-Zarnowitz slope/intercept (actual on predicted) per head and the D share of the top FP decile."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import score_gate as sg
out, variants, act_p, hb_p = sys.argv[1], sys.argv[2].split(","), sys.argv[3], sys.argv[4]
act = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(act_p))}
hb = {f"{a['game_id']}:{a['player_id']}": a for a in json.load(open(hb_p))}
rows = {v: {} for v in variants}; pos = {}
for f in sorted(os.listdir(os.path.join(out, variants[0]))):
    if not f.endswith(".json"): continue
    for v in variants:
        text = open(os.path.join(out, v, f)).read()
        for pid, p in re.findall(r'\{"id":(\d+),"team_id":\d+,"position":"([A-Z])"\}', text): pos[pid] = "D" if p == "D" else "F"
        for r in sg.player_rows(json.loads(text)):
            k = f"{r['game_id']}:{r['player_id']}"
            if sg.num(r.get("horizon_games")) == 1 and k in act: rows[v][k] = sg.heads_of(r)
keys = sorted(set.intersection(*[set(rows[v]) for v in variants]))
def truth(k):
    a, e = act[k], hb.get(k) or {}
    t = {"G": a["goals"], "A": a["assists"], "PPP": a["pp_points"], "SOG": a["shots"], "HIT": e.get("hits"), "BLK": e.get("blocked_shots")}
    t["FP"] = None if any(t[h] is None for h in sg.FP_W) else sum(sg.FP_W[h] * t[h] for h in sg.FP_W)
    return t
T = {k: truth(k) for k in keys}
print("| head | " + " | ".join(f"MZ slope {v} (intercept)" for v in variants) + " |\n|---|" + "---|" * len(variants))
for h in ["G", "A", "PPP", "SOG", "FP"]:
    cells = []
    for v in variants:
        xs = [rows[v][k][h] for k in keys if T[k][h] is not None]; ys = [T[k][h] for k in keys if T[k][h] is not None]
        n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
        b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
        cells.append(f"{b:.3f} ({my - b * mx:+.3f})")
    print(f"| {h} | " + " | ".join(cells) + " |")
for v in variants:
    ranked = sorted(keys, key=lambda k: -rows[v][k]["FP"]); top = ranked[: len(ranked) // 10]
    print(f"\n{v}: D in top FP decile {sum(pos.get(k.split(':')[1]) == 'D' for k in top)}/{len(top)}; D share of all rows {sum(pos.get(k.split(':')[1]) == 'D' for k in keys)}/{len(keys)}; actual-top-decile D {sum(pos.get(k.split(':')[1]) == 'D' for k in sorted(keys, key=lambda k: -T[k]['FP'])[: len(keys)//10])}")

"""Offline validation of the BLSH opportunity adjustment (decision 3). Read-only; no network or database.

Usage: python3 -I validate.py <dev-history.jsonl> <out.json>
Origins: non-overlapping 5-game windows in 2023-24 with 50 prior games (any season) for the reference,
plus the next 10 games for the persistence check. Cohort PP rates are pooled from 2022-23 only.
"""
import json
import math
import sys
from collections import defaultdict

FP_W = {"goals": 3, "assists": 2, "pp_points": 1, "shots": 0.2, "hits": 0.2, "blocked_shots": 0.25}
NEED = ["toi_per_game", "pp_toi_per_game", "goals", "assists", "pp_points", "shots", "hits", "blocked_shots"]
KS = [0, 600, 1800, 3600, 7200]
K_DEFAULT = 3600
BAND = 0.5


def pos(code):
    return "D" if code == "D" else ("F" if code in ("F", "C", "L", "R", "LW", "RW") else None)


def load(path):
    rows = defaultdict(list)
    with open(path) as f:
        for line in f:
            r = json.loads(line)
            if r.get("games_played") != 1 or any(r.get(k) is None for k in NEED) or r["toi_per_game"] <= 0:
                continue
            p = pos(r.get("position_code"))
            if p is None or r["pp_toi_per_game"] > r["toi_per_game"]:
                continue
            g = {
                "id": r["id"], "date": r["date"], "season": r["season_id"], "pos": p,
                "toi": float(r["toi_per_game"]), "pp": float(r["pp_toi_per_game"]),
                "goals": r["goals"], "assists": r["assists"], "ppp": r["pp_points"],
                "fp": sum(r[k] * w for k, w in FP_W.items()), "pts": r["goals"] + r["assists"],
            }
            rows[r["player_id"]].append(g)
    for v in rows.values():
        v.sort(key=lambda g: (g["date"], g["id"]))
    return rows


def cohort(rows):
    out = {}
    for p in ("F", "D"):
        games = [g for v in rows.values() for g in v if g["pos"] == p and g["season"] == 20222023]
        goals = sum(g["goals"] for g in games); pts = sum(g["pts"] for g in games)
        gshare = goals / pts
        pp = sum(g["pp"] for g in games); ppp = sum(g["ppp"] for g in games)
        out[p] = {"pts": ppp / pp, "fp": ppp * (3 + gshare) / pp, "goalShare": gshare}
    return out


def mean(xs):
    return sum(xs) / len(xs) if xs else float("nan")


def sd(xs):
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def split_expectation(ref, track, coh, k, w_toi, w_pp):
    """Two-state rates from the reference; PP rate shrunk toward the cohort PP rate with k pseudo-seconds."""
    tot = sum(g["toi"] for g in ref); pp = sum(g["pp"] for g in ref); y = sum(g[track] for g in ref)
    goals = sum(g["goals"] for g in ref); pts = sum(g["pts"] for g in ref)
    gshare = goals / pts if pts > 0 else coh["goalShare"]
    c = 1.0 if track == "pts" else 3 + gshare
    v_pp = c * sum(g["ppp"] for g in ref)
    r_np = (y - v_pp) / (tot - pp)
    cr = coh[track]
    r_pp = (v_pp + k * cr) / (pp + k) if pp + k > 0 else cr
    e = r_np * (w_toi - w_pp) + r_pp * w_pp
    res = [g[track] - (r_np * (g["toi"] - g["pp"]) + r_pp * g["pp"]) for g in ref]
    var_rate = (w_pp ** 2) * c * r_pp / (pp + k) if pp + k > 0 else 0.0
    scale = math.sqrt(len_w * sd(res) ** 2 + var_rate)
    return e, scale, r_np, r_pp


len_w = 5


def bucket(d, edges=(-60, -20, 20, 60)):
    labels = ["< -60", "-60..-20", "-20..20", "20..60", "> 60"]
    for i, e in enumerate(edges):
        if d < e:
            return labels[i]
    return labels[-1]


def direction(z):
    return "balanced" if abs(z) < BAND else ("sell" if z > 0 else "buy")


def main(path, out):
    rows = load(path)
    coh = cohort(rows)
    origins = []
    for pid, games in rows.items():
        i = 50
        while i + 5 <= len(games):
            w = games[i:i + 5]
            if w[0]["season"] != 20232024 or len({g["pos"] for g in games[i - 50:i + 5]}) != 1:
                i += 5
                continue
            ref = games[i - 50:i]
            nxt = games[i + 5:i + 15]
            p = w[0]["pos"]
            o = {"pid": pid, "pos": p, "refTOI": mean([g["toi"] for g in ref]), "refPP": mean([g["pp"] for g in ref]),
                 "wTOI": mean([g["toi"] for g in w]), "wPP": mean([g["pp"] for g in w]),
                 "nTOI": mean([g["toi"] for g in nxt]) if len(nxt) == 10 else None,
                 "nPP": mean([g["pp"] for g in nxt]) if len(nxt) == 10 else None, "tracks": {}}
            w_toi = sum(g["toi"] for g in w); w_pp = sum(g["pp"] for g in w)
            for t in ("fp", "pts"):
                y = sum(g[t] for g in w)
                per_game = [g[t] for g in ref]
                e_a = 5 * mean(per_game); s_a = sd(per_game) * math.sqrt(5)
                e_toi = sum(per_game) / sum(g["toi"] for g in ref) * w_toi
                splits = {k: split_expectation(ref, t, coh[p], k, w_toi, w_pp) for k in KS}
                nxt_y = sum(g[t] for g in nxt) if len(nxt) == 10 else None
                o["tracks"][t] = {"y": y, "eA": e_a, "sA": s_a, "eTOI": e_toi,
                                  "eSplit": {k: s[0] for k, s in splits.items()}, "sSplit": splits[K_DEFAULT][1],
                                  "next": nxt_y, "nextTOI": sum(g["toi"] for g in nxt) if len(nxt) == 10 else None,
                                  "nextPP": sum(g["pp"] for g in nxt) if len(nxt) == 10 else None,
                                  "rates": splits[K_DEFAULT][2:]}
            origins.append(o)
            i += 5

    result = {"origins": len(origins), "players": len({o["pid"] for o in origins}), "cohort": coh, "tracks": {}}
    for t in ("fp", "pts"):
        tr = {}
        # 1. Bias by opportunity change bucket: mean (observed - expected) per method.
        for key, field in (("deltaPP", lambda o: o["wPP"] - o["refPP"]), ("deltaTOI", lambda o: o["wTOI"] - o["refTOI"])):
            groups = defaultdict(list)
            for o in origins:
                groups[bucket(field(o))].append(o)
            tab = {}
            for b in ["< -60", "-60..-20", "-20..20", "20..60", "> 60"]:
                g = groups.get(b, [])
                if not g:
                    continue
                def stat(fn):
                    r = [o["tracks"][t]["y"] - fn(o) for o in g]
                    return {"bias": round(mean(r), 4), "mae": round(mean([abs(x) for x in r]), 4)}
                tab[b] = {"n": len(g), "perGame": stat(lambda o: o["tracks"][t]["eA"]), "totalTOI": stat(lambda o: o["tracks"][t]["eTOI"]),
                          "split": stat(lambda o: o["tracks"][t]["eSplit"][K_DEFAULT])}
            tr[key] = tab
        # 2. k grid on all origins and on PP promotions with little personal PP history.
        promo = [o for o in origins if o["wPP"] - o["refPP"] > 60]
        thin = [o for o in promo if o["refPP"] < 30]
        tr["kGrid"] = {str(k): {
            "maeAll": round(mean([abs(o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][k]) for o in origins]), 4),
            "biasPromo": round(mean([o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][k] for o in promo]), 4),
            "biasThinPromo": round(mean([o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][k] for o in thin]), 4) if thin else None,
            "maeThinPromo": round(mean([abs(o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][k]) for o in thin]), 4) if thin else None,
        } for k in KS}
        tr["kGrid"]["nPromo"] = len(promo); tr["kGrid"]["nThinPromo"] = len(thin)
        tr["maeOverall"] = {"perGame": round(mean([abs(o["tracks"][t]["y"] - o["tracks"][t]["eA"]) for o in origins]), 4),
                            "totalTOI": round(mean([abs(o["tracks"][t]["y"] - o["tracks"][t]["eTOI"]) for o in origins]), 4),
                            "split": round(mean([abs(o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][K_DEFAULT]) for o in origins]), 4)}
        # 3. Scale sanity: SD of z and share inside the balanced band.
        za = [(o["tracks"][t]["y"] - o["tracks"][t]["eA"]) / o["tracks"][t]["sA"] for o in origins if o["tracks"][t]["sA"] > 0]
        zb = [(o["tracks"][t]["y"] - o["tracks"][t]["eSplit"][K_DEFAULT]) / o["tracks"][t]["sSplit"] for o in origins if o["tracks"][t]["sSplit"] > 0]
        tr["zScale"] = {"sdZa": round(sd(za), 3), "sdZb": round(sd(zb), 3), "bandShareA": round(mean([abs(z) < BAND for z in za]), 3),
                        "bandShareB": round(mean([abs(z) < BAND for z in zb]), 3)}
        # 4. Agreement of the two comparisons' directions.
        agree = defaultdict(int)
        for o in origins:
            x = o["tracks"][t]
            if x["sA"] > 0 and x["sSplit"] > 0:
                agree[(direction((x["y"] - x["eA"]) / x["sA"]), direction((x["y"] - x["eSplit"][K_DEFAULT]) / x["sSplit"]))] += 1
        tr["directionCrosstab"] = {f"{a}|{b}": n for (a, b), n in sorted(agree.items())}
        # 5. Forward check (secondary): next-10 per-game production minus reference per-game mean, by window direction.
        fwd = defaultdict(list)
        for o in origins:
            x = o["tracks"][t]
            if x["next"] is None or x["sA"] <= 0 or x["sSplit"] <= 0:
                continue
            da = direction((x["y"] - x["eA"]) / x["sA"]); db = direction((x["y"] - x["eSplit"][K_DEFAULT]) / x["sSplit"])
            fwd[f"{da}|{db}"].append(x["next"] / 10 - x["eA"] / 5)
        tr["next10PerGameMinusBaseline"] = {k: {"n": len(v), "mean": round(mean(v), 4)} for k, v in sorted(fwd.items())}
        result["tracks"][t] = tr
    # 6. Persistence of opportunity changes into the next 10 games.
    pers = {}
    for name, a, b, c in (("ppUp60", "refPP", "wPP", "nPP"), ("toiUp60", "refTOI", "wTOI", "nTOI")):
        up = [o for o in origins if o[c] is not None and o[b] - o[a] > 60]
        down = [o for o in origins if o[c] is not None and o[b] - o[a] < -60]
        for label, grp in ((name, up), (name.replace("Up", "Down"), down)):
            ratios = sorted((o[c] - o[a]) / (o[b] - o[a]) for o in grp)
            pers[label] = {"n": len(grp), "meanRetained": round(mean(ratios), 3), "medianRetained": round(ratios[len(ratios) // 2], 3) if ratios else None,
                           "shareRetainedHalf": round(mean([r >= 0.5 for r in ratios]), 3) if ratios else None}
    result["persistence"] = pers
    json.dump(result, open(out, "w"), indent=1)
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

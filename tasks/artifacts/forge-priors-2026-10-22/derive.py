"""Derive F/D x strength priors and split-half k from priors-aggregate.json (complete seasons 2023-24..2025-26)."""
import json, sys
rows = json.load(open(sys.argv[1]))
full = [r for r in rows if r["season"] in (20232024, 20242025, 20252026)]
out = {"seasons": [20232024, 20242025, 20252026], "leagueAssistsPerGoal": {}, "priors": {}}
f = lambda x: float(x) if x is not None else None
for s in ("ES", "PP", "PK"):
    g = sum(r["g"] for r in full if r["strength"] == s); a = sum(r["a"] for r in full if r["strength"] == s)
    out["leagueAssistsPerGoal"][s] = round(a / g, 4)
for pos in ("F", "D"):
    for s in ("ES", "PP", "PK"):
        rs = [r for r in full if r["pos"] == pos and r["strength"] == s]
        tot = {k: sum(r[k] for r in rs) for k in ("g", "a", "a1", "pts", "sog", "on_ice_gf", "toi_s")}
        def k_of(rkey, nkey):
            vals = [(f(r[rkey]), f(r[nkey])) for r in rs if f(r[rkey]) is not None]
            rbar = sum(v[0] for v in vals) / len(vals); nbar = sum(v[1] for v in vals) / len(vals)
            return {"r": round(rbar, 4), "nPerHalf": round(nbar, 3), "k": round(nbar * (1 - rbar) / rbar, 1) if rbar > 0.02 else None}
        hours = tot["toi_s"] / 3600
        out["priors"][f"{pos}:{s}"] = {
            "assistShare": round(tot["a"] / tot["on_ice_gf"], 4), "ipp": round(tot["pts"] / tot["on_ice_gf"], 4),
            "goalShare": round(tot["g"] / tot["on_ice_gf"], 4), "primaryShareOfAssists": round(tot["a1"] / tot["a"], 4),
            "sogPer60": round(tot["sog"] / hours, 4), "shootingPct": round(tot["g"] / tot["sog"], 4),
            "goalsPer60": round(tot["g"] / hours, 4), "assistsPer60": round(tot["a"] / hours, 4), "onIceGfPer60": round(tot["on_ice_gf"] / hours, 4),
            "kAssistShareOnIceGoals": k_of("r_as", "gf_per_half"), "kSogPer60Hours": k_of("r_sog60", "hours_per_half"),
            "kShootingPctShots": k_of("r_sh", "sog_per_half"),
        }
print(json.dumps(out, indent=1))

import json, statistics as st, collections as C, sys
d = json.load(open(sys.argv[1])); P = d["profiles"]
print("profiles", len(P), "missingRefRows>0", sum(p["missingRefRows"] > 0 for p in P))
for t, name in enumerate(["FP", "G+A", "GS"]):
    a = C.Counter("available" if p["tracks"][t]["a"] else p["tracks"][t]["aReason"] for p in P)
    b = C.Counter("available" if p["tracks"][t]["b"] else p["tracks"][t]["bReason"] for p in P)
    print(name, "a:", dict(a)); print(name, "b:", dict(b))
fp = lambda p: p["tracks"][0]
print("FP assessment:", dict(C.Counter((fp(p)["dir"], fp(p)["reason"]) for p in P)))
print("saved list x FP direction:")
x = C.Counter((p["list"], fp(p)["dir"]) for p in P)
for k, v in sorted(x.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))): print("  ", k, v)
print("saved list x FP reason:")
x = C.Counter((p["list"], fp(p)["reason"]) for p in P if p["list"])
for k, v in sorted(x.items(), key=lambda kv: (str(kv[0][0]), -kv[1])): print("  ", k, v)
def med(xs):
    xs = [v for v in xs if v is not None]; return (round(st.median(xs), 1), len(xs)) if xs else None
for lst in ("BL", "SH"):
    g = [p for p in P if p["list"] == lst]
    print("saved", lst, "median dTOI, dPP", med([p["toiDelta"] for p in g]), med([p["ppDelta"] for p in g]))
for dr in ("buy_low_evidence", "sell_high_evidence"):
    g = [p for p in P if fp(p)["dir"] == dr]
    print("new FP", dr, "n", len(g), "qualified", sum(fp(p)["qualified"] for p in g), "median dTOI, dPP", med([p["toiDelta"] for p in g]), med([p["ppDelta"] for p in g]))
# examples: saved SH now balanced by opportunity
ex = [p for p in P if p["list"] == "SH" and fp(p)["reason"] == "opportunity_explains_per_game_gap"]
ex.sort(key=lambda p: p["rank"] or 999)
for p in ex[:5]: print("EX", p["rank"], p["name"], p["toiDelta"], p["ppDelta"], "|", p["headlineText"][:220])
ex = [p for p in P if p["list"] == "BL" and fp(p)["reason"] in ("opportunity_explains_per_game_gap",)]
ex.sort(key=lambda p: p["rank"] or 999)
for p in ex[:3]: print("EXBL", p["rank"], p["name"], p["toiDelta"], p["ppDelta"], "|", p["headlineText"][:220])
ex = [p for p in P if fp(p)["reason"] == "opposite_directions_role_persistence_unknown"]
for p in ex[:3]: print("EXOPP", p["list"], p["name"], p["toiDelta"], p["ppDelta"], "|", p["headlineText"][:260])
print("TEXT", P[0]["name"], P[0]["toiText"], "||", P[0]["ppText"])

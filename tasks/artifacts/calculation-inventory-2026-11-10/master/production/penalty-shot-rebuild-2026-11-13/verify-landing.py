import json, os, sys, time, urllib.request
TMP = os.environ["TMPDIR"]
base = {}
for f in ("summary-canary.log", "summary-rest.log"):
    for line in open(os.path.join(TMP, f)):
        if '"event": "baseline"' in line:
            e = json.loads(line); base.setdefault(e["game"], e)
# shooter team / defending team / official (shooting team SOG, goals) / date from the penalty-shot rebuild readback
meta = {2026020065: (54, 10, "2026-10-08"), 2026020094: (55, 4, "2026-10-13"), 2026020101: (18, 54, "2026-10-13"),
        2026020119: (21, 5, "2026-10-16"), 2026020131: (18, 19, "2026-10-17"), 2026020150: (12, 23, "2026-10-20"),
        2026020159: (26, 2, "2026-10-22"), 2026020203: (16, 17, "2026-10-29")}
def get(path):
    with urllib.request.urlopen("https://fhfhockey.com" + path, timeout=60) as r:
        return json.loads(r.read())
B = "fromSeasonId=20262027&throughSeasonId=20262027&seasonType=regularSeason&scoreState=allScores&displayMode=counts&scope=dateRange&minimumToiSeconds=0"
ok = True
for g, (st, dt, d) in meta.items():
    e = base[g]; sh, go = e["shooter"], e["goalie"]; exp = e["shooter_all_expected"]; gexp = e.get("goalie_all_expected", {})
    q = f"{B}&startDate={d}&endDate={d}"
    pa = [r for r in get(f"/api/v1/underlying-stats/players?{q}&strength=allStrengths&statMode=individual&teamId={st}")["rows"] if r["playerId"] == sh][0]
    pe = [r for r in get(f"/api/v1/underlying-stats/players?{q}&strength=evenStrength&statMode=individual&teamId={st}")["rows"] if r["playerId"] == sh]
    gr = [r for r in get(f"/api/v1/underlying-stats/goalies?{q}&strength=allStrengths&teamId={dt}")["rows"] if r["playerId"] == go][0]
    allok = all(pa[k] == exp[k] for k in ("goals", "shots", "iCf", "iFf")) and pa["gamesPlayed"] == 1
    gok = all(gr.get(k) == v for k, v in gexp.items() if k in gr)
    esrow = {k: pe[0][k] for k in ("goals", "shots")} if pe else None
    print(json.dumps({"game": g, "shooter": sh, "served_all": {k: pa[k] for k in ("gamesPlayed", "goals", "shots", "iCf", "iFf")}, "expected": exp, "all_ok": allok,
                      "served_es": esrow, "goalie": go, "served_goalie": {k: gr.get(k) for k in ("gamesPlayed", "shotsAgainst", "saves", "goalsAgainst")}, "goalie_expected": gexp, "goalie_ok": gok}))
    ok = ok and allok and gok
    time.sleep(1)
print("ALL_OK" if ok else "MISMATCH")

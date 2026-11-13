import json, time, urllib.request
official = {2026020065: ("2026-10-08", {10: (24, 3), 54: (43, 3)}), 2026020094: ("2026-10-13", {4: (26, 2), 55: (31, 2)}),
            2026020101: ("2026-10-13", {18: (28, 2), 54: (25, 5)}), 2026020119: ("2026-10-16", {5: (32, 2), 21: (32, 5)}),
            2026020131: ("2026-10-17", {18: (24, 5), 19: (26, 2)}), 2026020150: ("2026-10-20", {12: (44, 6), 23: (17, 3)}),
            2026020159: ("2026-10-22", {2: (43, 2), 26: (27, 3)}), 2026020203: ("2026-10-29", {16: (19, 1), 17: (31, 4)})}
B = "fromSeasonId=20262027&throughSeasonId=20262027&seasonType=regularSeason&scoreState=allScores&displayMode=counts&scope=dateRange&minimumToiSeconds=0&strength=allStrengths"
ok = True
for g, (d, teams) in official.items():
    ids = list(teams)
    for t in ids:
        opp = [x for x in ids if x != t][0]
        with urllib.request.urlopen(f"https://fhfhockey.com/api/v1/underlying-stats/teams?{B}&startDate={d}&endDate={d}&teamId={t}", timeout=60) as r:
            rows = json.loads(r.read())["rows"]
        row = [x for x in rows if x["teamId"] == t][0]
        want = {"sf": teams[t][0], "gf": teams[t][1], "sa": teams[opp][0], "ga": teams[opp][1], "gamesPlayed": 1}
        got = {k: row[k] for k in want}
        good = got == want
        ok = ok and good
        print(json.dumps({"game": g, "team": t, "served": got, "official": want, "ok": good}))
        time.sleep(0.5)
print("ALL_OK" if ok else "MISMATCH")

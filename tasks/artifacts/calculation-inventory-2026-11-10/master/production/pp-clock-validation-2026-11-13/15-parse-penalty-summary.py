# Decision 151 O4 (F11): parse one NHL HTML Game Summary page fetched by
# 13-fetch-penalty-summaries.sh. Prints JSON: the visitor and home penalty
# tables, the "Power Plays (Goals-Opp./PPTime)" rows (visitor first), the
# power-play strength breakdown, and the goaltender TEAM TOTALS rows (EV, PP,
# SH, TOT). The page is data only. Run with `python3 -I`, from outside the
# directory that holds the pages.
#   python3 -I 15-parse-penalty-summary.py <GS-page.HTM>
import html
import json
import re
import sys

src = open(sys.argv[1], encoding="latin-1").read()


def tokens(chunk):
    chunk = re.sub(r"(?is)<(script|style).*?</\1>", "", chunk)
    texts = (" ".join(html.unescape(p).replace("\xa0", " ").split()) for p in re.split(r"<[^>]+>", chunk))
    return [t for t in texts if t]


start = src.find('id="PenaltySummary"')
toks = tokens(src[start:src.find("BY PERIOD", start)])[1:]  # drop the attribute fragment
tables, current, pp_rows = [], None, []
n = 0
while n < len(toks):
    t = toks[n]
    if toks[n:n + 6] == ["#", "Per", "Time", "Player", "PIM", "Penalty"]:
        current = []
        tables.append(current)
        n += 6
        continue
    if t.startswith("Power Plays"):
        pp_rows.append(toks[n + 1])
        n += 2
        continue
    if t.startswith("TOT"):
        n += 2
        continue
    if (current is not None and re.fullmatch(r"\d+", t) and int(t) == len(current) + 1
            and re.fullmatch(r"\d+|OT|SO", toks[n + 1]) and re.fullmatch(r"\d+:\d\d", toks[n + 2])):
        m, player = n + 3, []
        # Player cells (sweater number + name, or a bench label) end at the PIM integer.
        while not (re.fullmatch(r"\d+", toks[m]) and player and not re.fullmatch(r"\d+", player[-1])):
            player.append(toks[m])
            m += 1
        current.append({"per": toks[n + 1], "time": toks[n + 2], "player": " ".join(player),
                        "pim": int(toks[m]), "penalty": toks[m + 1]})
        n = m + 2
        continue
    n += 1

pp_start = src.find("POWER PLAYS (Goals-Occurrences / Time)")
strength = tokens(src[pp_start:src.find("EVEN STRENGTH", pp_start)])
goalies = tokens(src[src.find("GOALTENDER SUMMARY"):src.find("OFFICIALS", src.find("GOALTENDER SUMMARY"))])
team_totals = [goalies[i + 1:i + 5] for i, t in enumerate(goalies) if t == "TEAM TOTALS"]
print(json.dumps({"tables": tables, "ppRows": pp_rows, "strength": strength,
                  "goalieTeamTotals_EV_PP_SH_TOT": team_totals}, indent=1))

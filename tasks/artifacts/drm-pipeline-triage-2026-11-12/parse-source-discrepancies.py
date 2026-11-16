"""Compare cached NHL TH/TV printed intervals to captured JSON; offline only."""
import datetime
import hashlib
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
AFFECTED = {
    2026020009: {8481122: 3, 8485406: 6, 8476474: 9, 8479996: 9, 8483695: 8},
    2026020205: {8477951: 1, 8482699: 1, 8476389: 1, 8480855: 2, 8478831: 2, 8477220: 2, 8483431: 1},
}


def seconds(clock):
    if not re.fullmatch(r"\d+:[0-5]\d", clock):
        raise ValueError(f"Invalid clock {clock!r}")
    m, s = map(int, clock.split(":"))
    return m * 60 + s


def union(intervals):
    output = []
    for item in sorted(intervals, key=lambda x: (x["period"], x["start"], x["end"])):
        if output and output[-1]["period"] == item["period"] and item["start"] <= output[-1]["end"]:
            output[-1]["end"] = max(output[-1]["end"], item["end"])
        else:
            output.append({"period": item["period"], "start": item["start"], "end": item["end"]})
    return output


def union_seconds(intervals):
    return sum(row["end"] - row["start"] for row in union(intervals))


def coverage_difference(left, right):
    result, covered = [], union(right)
    for interval in union(left):
        cursor = interval["start"]
        for other in covered:
            if other["period"] != interval["period"] or other["end"] <= cursor:
                continue
            if other["start"] >= interval["end"]:
                break
            if other["start"] > cursor:
                result.append({"period": interval["period"], "start": cursor, "end": min(other["start"], interval["end"])})
            cursor = max(cursor, other["end"])
            if cursor >= interval["end"]:
                break
        if cursor < interval["end"]:
            result.append({"period": interval["period"], "start": cursor, "end": interval["end"]})
    return result


def key(row):
    return row["period"], row["start"], row["end"]


def json_intervals(rows, player_id):
    result = []
    for row in rows:
        if row.get("playerId") != player_id or row.get("typeCode") != 517:
            continue
        start, end, duration = seconds(row["startTime"]), seconds(row["endTime"]), seconds(row["duration"])
        if end == 0:
            end = start + duration
        if end - start != duration:
            raise ValueError(f"JSON endpoints/duration mismatch for {player_id}")
        result.append({"shiftNumber": row["shiftNumber"], "period": row["period"], "start": start, "end": end, "duration": duration, "startClock": row["startTime"], "endClock": row["endTime"]})
    return result


def parse_report(game, report_type):
    gid, pbp = game["game_id"], game["pbp"]
    path = Path("/tmp") / f"drm-{report_type}{gid % 1000000:06d}.HTM"
    raw = path.read_bytes()
    soup = BeautifulSoup(raw.decode("utf-8"), "html.parser")
    page_text = soup.get_text(" ", strip=True)
    if not re.search(rf"\bGame\s+{gid % 10000:04d}\s+Final\b", page_text):
        raise ValueError("Game identity mismatch")
    date = re.search(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})", page_text)
    if not date or datetime.datetime.strptime(date[1], "%B %d, %Y").date().isoformat() != pbp["gameDate"]:
        raise ValueError("Game date mismatch")
    team = pbp["homeTeam" if report_type == "TH" else "awayTeam"]
    team_name = f'{team["placeName"]["default"]} {team["commonName"]["default"]}'.upper()
    single_cells = [tr.find_all(["td", "th"], recursive=False) for tr in soup.find_all("tr")]
    if not any(len(cells) == 1 and cells[0].get_text(" ", strip=True) == team_name for cells in single_cells):
        raise ValueError(f"Missing exact team report header {team_name}")
    roster = {p["sweaterNumber"]: p for p in pbp["rosterSpots"] if p["teamId"] == team["id"]}
    by_player = {}
    for table in soup.find_all("table"):
        current = None
        for tr in table.find_all("tr", recursive=False):
            cells = tr.find_all(["td", "th"], recursive=False)
            text = [c.get_text(" ", strip=True) for c in cells]
            if len(cells) == 1 and cells[0].get("colspan") == "8":
                if cells[0].find("table"):
                    if current is None:
                        continue
                    for summary_tr in cells[0].find_all("tr"):
                        values = [c.get_text(" ", strip=True) for c in summary_tr.find_all(["td", "th"], recursive=False)]
                        if len(values) == 7 and values[0] == "TOT":
                            by_player[current]["summary"] = {name: seconds(value) for name, value in zip(["total", "es", "pp", "pk"], values[3:7])}
                    continue
                match = re.match(r"^(\d{1,2})\s+\D", text[0])
                if match:
                    jersey = int(match[1])
                    if jersey not in roster:
                        raise ValueError(f"Unknown printed jersey {jersey}")
                    current = roster[jersey]["playerId"]
                    if current in by_player:
                        raise ValueError(f"Duplicate player section {current}")
                    by_player[current] = {"jersey": jersey, "intervals": [], "summary": None}
                continue
            if current is None or len(text) != 6 or not text[0].isdigit():
                continue
            period = 4 if text[1] == "OT" else int(text[1])
            start_clock, end_clock = text[2].split("/")[0].strip(), text[3].split("/")[0].strip()
            start, end, duration = seconds(start_clock), seconds(end_clock), seconds(text[4])
            if end - start != duration:
                raise ValueError(f"Printed endpoints/duration disagree for {current}: {text}")
            by_player[current]["intervals"].append({"shiftNumber": int(text[0]), "period": period, "start": start, "end": end, "duration": duration, "startClock": start_clock, "endClock": end_clock})
    return {
        "gameId": gid, "reportType": report_type, "teamId": team["id"], "teamHeader": team_name,
        "sourceUrl": f"https://www.nhl.com/scores/htmlreports/20262027/{report_type}{gid % 1000000:06d}.HTM",
        "sourceSha256": hashlib.sha256(raw).hexdigest(), "dateVerified": pbp["gameDate"]
    }, by_player


def main():
    fixture = json.loads((ROOT / "live-replay.json").read_text())
    official = json.loads((ROOT / "official-player-clocks.json").read_text())
    official_by_id = {(r["gameId"], r["playerId"]): r for r in official["rows"]}
    output = {"method": "Independent interval union of captured/current JSON and fresh official TH/TV printed intervals, compared with independently parsed ES summary", "reports": [], "currentJsonResponses": [], "players": []}
    for game in fixture["games"]:
        gid = game["game_id"]
        if gid not in AFFECTED:
            continue
        current_path = Path("/tmp") / f"drm-current-shifts-{gid}.json"
        current_bytes = current_path.read_bytes()
        current = json.loads(current_bytes)
        if current["total"] > len(current["data"]) or any(row.get("gameId") != gid for row in current["data"]):
            raise ValueError("Current JSON response does not cover the exact declared game scope")
        output["currentJsonResponses"].append({
            "gameId": gid, "declaredRows": current["total"], "returnedRows": len(current["data"]),
            "sourceUrl": f"https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={gid}&start=0&limit=1000",
            "sourceSha256": hashlib.sha256(current_bytes).hexdigest()
        })
        roster = {p["playerId"]: p for p in game["pbp"]["rosterSpots"]}
        for report_type in ["TH", "TV"]:
            meta, parsed = parse_report(game, report_type)
            output["reports"].append(meta)
            for player_id, root_delta in AFFECTED[gid].items():
                if roster[player_id]["teamId"] != meta["teamId"]:
                    continue
                printed = parsed[player_id]
                if printed["summary"] is None:
                    raise ValueError(f"Missing printed summary for {player_id}")
                raw_rows = json_intervals(game["shift_payload"]["data"], player_id)
                current_rows = json_intervals(current["data"], player_id)
                raw_total, printed_total = union_seconds(raw_rows), union_seconds(printed["intervals"])
                current_total = union_seconds(current_rows)
                official_fact = official_by_id[(gid, player_id)]
                official_total = official_fact["seconds"]["total"]
                raw_set, printed_set = {key(r) for r in raw_rows}, {key(r) for r in printed["intervals"]}
                if raw_total - official_total != root_delta:
                    raise ValueError(f"Independent source union does not reproduce root delta for {player_id}")
                output["players"].append({
                    "gameId": gid, "playerId": player_id, "teamId": meta["teamId"], "jersey": printed["jersey"],
                    "sourceUrl": meta["sourceUrl"], "officialSummaryUrl": official_fact["sourceUrl"],
                    "capturedRawIntervalRows": len(raw_rows), "printedIntervalRows": len(printed["intervals"]),
                    "capturedRawUnionSeconds": raw_total, "printedIntervalUnionSeconds": printed_total,
                    "currentJsonUnionSeconds": current_total,
                    "currentJsonMatchesOfficial": current_total == official_total,
                    "currentJsonDeltaSeconds": current_total - official_total,
                    "currentJsonExcessCoverageIntervals": coverage_difference(current_rows, printed["intervals"]),
                    "printedDurationSumSeconds": sum(r["duration"] for r in printed["intervals"]),
                    "printedSummarySeconds": printed["summary"], "officialEsReportSeconds": official_fact["seconds"],
                    "deltaCapturedMinusOfficialSeconds": raw_total - official_total,
                    "printedUnionMatchesPrintedSummary": printed_total == printed["summary"]["total"],
                    "printedSummaryMatchesOfficialEs": printed["summary"] == official_fact["seconds"],
                    "capturedOnlyIntervals": [r for r in raw_rows if key(r) not in printed_set],
                    "printedOnlyIntervals": [r for r in printed["intervals"] if key(r) not in raw_set],
                    "capturedExcessCoverageIntervals": coverage_difference(raw_rows, printed["intervals"]),
                    "printedMissingCoverageIntervals": coverage_difference(printed["intervals"], raw_rows),
                    "commonLogicalIntervalCount": len(raw_set & printed_set),
                    "cause": "captured JSON source superseded: current JSON now matches official reports" if current_total == official_total else "current JSON endpoint still disagrees with official printed intervals and summaries",
                    "limit": "No input clocks capped or adjusted. Two bounded complete JSON reads were diagnostic only; immutable captured fixture unchanged."
                })
    output["affectedPlayers"] = len(output["players"])
    output["allPrintedIntervalsMatchOfficialSummaries"] = all(p["printedUnionMatchesPrintedSummary"] and p["printedSummaryMatchesOfficialEs"] for p in output["players"])
    (ROOT / "source-discrepancies.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"affectedPlayers": output["affectedPlayers"], "allPrintedIntervalsMatchOfficialSummaries": output["allPrintedIntervalsMatchOfficialSummaries"], "players": [{k:p[k] for k in ["gameId", "playerId", "deltaCapturedMinusOfficialSeconds", "capturedExcessCoverageIntervals", "printedMissingCoverageIntervals"]} for p in output["players"]]}, indent=2))


if __name__ == "__main__":
    main()

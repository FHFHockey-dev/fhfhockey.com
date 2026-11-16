"""Parse cached official ES/GS reports; no network requests or database work."""
import argparse
import datetime
import hashlib
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent


def seconds(clock):
    if not re.fullmatch(r"\d+:[0-5]\d", clock):
        raise ValueError(f"Invalid official clock: {clock!r}")
    minutes, remainder = map(int, clock.split(":"))
    return minutes * 60 + remainder


def parse_game(game, report_path, report_type):
    game_id, pbp = game["game_id"], game["pbp"]
    report_url = f"https://www.nhl.com/scores/htmlreports/20262027/{report_type}{game_id % 1000000:06d}.HTM"
    raw = report_path.read_bytes()
    soup = BeautifulSoup(raw.decode("utf-8"), "html.parser")
    page_text = soup.get_text(" ", strip=True)
    if not re.search(rf"\bGame\s+{game_id % 10000:04d}\s+Final\b", page_text):
        raise ValueError(f"Official report game identity does not match {game_id}")
    date_match = re.search(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})", page_text)
    if not date_match or datetime.datetime.strptime(date_match[1], "%B %d, %Y").date().isoformat() != pbp["gameDate"]:
        raise ValueError(f"Official report date does not match {game_id}")
    team_names = {
        f'{team["placeName"]["default"]} {team["commonName"]["default"]}'.upper(): team
        for team in [pbp["awayTeam"], pbp["homeTeam"]]
    }
    roster = {}
    for player in pbp["rosterSpots"]:
        key = (player["teamId"], player["sweaterNumber"])
        if key in roster:
            raise ValueError(f"Duplicate captured roster jersey identity {key}")
        roster[key] = player

    facts, seen_teams, unplayed_goalies = [], [], []
    for table in soup.find_all("table"):
        current_team, toi_start, expect_subheader = None, None, False
        for tr in table.find_all("tr", recursive=False):
            cells = tr.find_all(["td", "th"], recursive=False)
            text = [cell.get_text(" ", strip=True) for cell in cells]
            if len(cells) >= 3 and cells[0].get("colspan") == "3" and "TOI" in text:
                if text[0] not in team_names:
                    raise ValueError(f"Unexpected official team header {text[0]!r}")
                current_team = team_names[text[0]]
                seen_teams.append(current_team["id"])
                toi_index = text.index("TOI")
                expected_span = "6" if report_type == "ES" else "4"
                if cells[toi_index].get("colspan") != expected_span:
                    raise ValueError(f"Official {report_type} TOI column span differs")
                toi_start = sum(int(cell.get("colspan", 1)) for cell in cells[:toi_index])
                expect_subheader = True
                continue
            if expect_subheader:
                valid = text == ["TOT", "SHF", "AVG", "PP", "SH", "EV"] if report_type == "ES" else text[:4] == ["EV", "PP", "SH", "TOT"]
                if not valid:
                    raise ValueError(f"Unexpected official TOI subheaders: {text}")
                expect_subheader = False
                continue
            field_count = 6 if report_type == "ES" else 4
            if current_team is None or len(text) < toi_start + field_count or not text[0].isdigit():
                continue
            if report_type == "ES" and text[1] == "G":
                continue  # ES lists goalie names but deliberately leaves their TOI fields blank.
            jersey = int(text[0])
            player = roster.get((current_team["id"], jersey))
            expect_goalie = report_type == "GS"
            if not player or (player["positionCode"] == "G") != expect_goalie or (expect_goalie and text[1] != "G"):
                raise ValueError(f"Unresolved official {report_type} identity: game {game_id}, team {current_team['id']}, jersey {jersey}")
            if expect_goalie and all(not value for value in text[toi_start:toi_start + 4]):
                unplayed_goalies.append({"playerId": player["playerId"], "teamId": current_team["id"], "jersey": jersey, "clocks": None})
                continue
            indices = [0, 3, 4, 5] if report_type == "ES" else [3, 1, 2, 0]
            total, pp, pk, es = [text[toi_start + index] for index in indices]
            clocks = {"total": total, "es": es, "pp": pp, "pk": pk}
            values = {key: seconds(value) for key, value in clocks.items()}
            if values["total"] != values["es"] + values["pp"] + values["pk"]:
                raise ValueError(f"Official TOI does not reconcile for player {player['playerId']}")
            facts.append({
                "gameId": game_id,
                "playerId": player["playerId"],
                "teamId": current_team["id"],
                "teamAbbreviation": current_team["abbrev"],
                "jersey": jersey,
                "playerType": "goalie" if expect_goalie else "skater",
                "reportType": report_type,
                "clocks": clocks,
                "seconds": values,
                "sourceUrl": report_url,
            })
    expected_teams = [pbp["awayTeam"]["id"], pbp["homeTeam"]["id"]]
    if seen_teams != expected_teams:
        raise ValueError(f"Official team header order differs: {seen_teams} != {expected_teams}")
    if report_type == "ES":
        expected_players = {p["playerId"] for p in pbp["rosterSpots"] if p["positionCode"] != "G"}
    else:
        stored_ids = {row["player_id"] for row in game["stored"]}
        expected_players = {p["playerId"] for p in pbp["rosterSpots"] if p["positionCode"] == "G" and p["playerId"] in stored_ids}
    actual_players = {row["playerId"] for row in facts}
    if len(actual_players) != len(facts) or actual_players != expected_players:
        raise ValueError(f"Official roster coverage differs: missing {expected_players - actual_players}, extra {actual_players - expected_players}")
    return {
        "gameId": game_id,
        "sourceUrl": report_url,
        "reportType": report_type,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "gameDateVerified": pbp["gameDate"],
        "headerTeamsVerified": expected_teams,
        "playerRows": len(facts),
        "unplayedGoalies": unplayed_goalies,
        "identityMethod": "exact official team header plus jersey joined to captured PBP rosterSpots; no name matching",
    }, facts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-dir", type=Path, default=Path("/tmp"))
    args = parser.parse_args()
    fixture = json.loads((ROOT / "live-replay.json").read_text())
    output = {"observedDate": "2026-11-12", "method": "Official NHL ES skaters and GS played goalies; strict header/date/game identity and team+jersey roster join", "games": [], "rows": [], "unavailable": []}
    for game in fixture["games"]:
        for report_type in ["ES", "GS"]:
            file = args.report_dir / f"drm-{report_type}{game['game_id'] % 1000000:06d}.HTM"
            if not file.exists():
                output["unavailable"].append({"gameId": game["game_id"], "reportType": report_type, "reason": "Cached report absent; parser performs no requests"})
                continue
            metadata, rows = parse_game(game, file, report_type)
            output["games"].append(metadata)
            output["rows"].extend(rows)
    output["skaterRows"] = sum(row["playerType"] == "skater" for row in output["rows"])
    output["goalieRows"] = sum(row["playerType"] == "goalie" for row in output["rows"])
    output["playerRows"] = len(output["rows"])
    old_checks = json.loads((ROOT / "OFFICIAL-CLOCK-CHECK.json").read_text())
    by_player_game = {(row["gameId"], row["playerId"]): row for row in output["rows"]}
    output["priorGoalieChecks"] = []
    for old in old_checks["games"]:
        fact = by_player_game.get((old["gameId"], old["playerId"]))
        expected = old["officialGoalieStrength"]
        matches = fact is not None and all(fact["seconds"][key] == seconds(expected[key]) for key in ["es", "pp", "pk"])
        output["priorGoalieChecks"].append({"gameId": old["gameId"], "playerId": old["playerId"], "matches": matches})
        if not matches:
            raise ValueError(f"Fresh official goalie facts differ from prior independent checksum: {old['gameId']}/{old['playerId']}")
    (ROOT / "official-player-clocks.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({"reports": len(output["games"]), "skaterRows": output["skaterRows"], "goalieRows": output["goalieRows"], "playerRows": output["playerRows"], "priorGoalieChecks": output["priorGoalieChecks"], "unavailable": output["unavailable"]}, indent=2))


if __name__ == "__main__":
    main()

"""Explicit scratch evidence from an official final NHL Playing Roster report.

Names and sweater numbers are evidence, not NHL player IDs. This module never
turns the final report into a pregame candidate list or labels missing players.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
import re
import unicodedata


@dataclass
class _Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def text(self) -> str:
        return " ".join(" ".join(child.text() if isinstance(child, _Node) else child
            for child in self.children).split())

    def nodes(self, tag: str | None = None):
        for child in self.children:
            if isinstance(child, _Node):
                if tag is None or child.tag == tag:
                    yield child
                yield from child.nodes(tag)


class _ReportParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = _Node("root")
        self.stack = [self.root]
        self.count = 0

    def handle_starttag(self, tag, attrs):
        self.count += 1
        if self.count > 10000 or len(self.stack) > 60:
            raise ValueError("roster report structure exceeds bounds")
        node = _Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def _name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).upper().split())


def normalize_roster_report(html: str, boxscore: dict) -> dict:
    if not isinstance(html, str) or len(html.encode()) > 1_000_000:
        raise ValueError("bounded roster report HTML required")
    game_id = boxscore.get("id")
    if not isinstance(game_id, int) or len(str(game_id)) != 10 or boxscore.get("gameState") != "OFF":
        raise ValueError("final official game identity required")
    parser = _ReportParser()
    parser.feed(html)
    parser.close()

    def section(identifier):
        found = [node for node in parser.root.nodes() if node.attrs.get("id") == identifier]
        if len(found) != 1:
            raise ValueError(f"exactly one roster report {identifier} section required")
        return found[0]

    info = [node.text() for node in section("GameInfo").nodes("td")]
    parsed_date = date.fromisoformat(boxscore["gameDate"])
    month = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")[parsed_date.month - 1]
    expected_date = f"{month} {parsed_date.day}, {parsed_date.year}"
    if "Final" not in info or f"Game {game_id % 10000:04d}" not in info or not any(
        re.fullmatch(r"[A-Za-z]+, " + re.escape(expected_date), value) for value in info):
        raise ValueError("roster report game, date or final status mismatch")

    teams = [boxscore[side] for side in ("awayTeam", "homeTeam")]
    for identifier, team in zip(("Visitor", "Home"), teams):
        place = team.get("placeName", {}).get("default")
        common = team.get("commonName", {}).get("default")
        if not place or not common:
            raise ValueError("official full team names required for roster identity")
        names = [node.attrs["alt"] for node in section(identifier).nodes("img") if node.attrs.get("alt")]
        if len(names) != 1 or _name(names[0]) != _name(f"{place} {common}"):
            raise ValueError("roster report home/away identity mismatch")

    columns = [node for node in section("Scratches").children if isinstance(node, _Node) and node.tag == "td"]
    if len(columns) != 2:
        raise ValueError("both scratch columns required")
    scratches = []
    for column, team, side in zip(columns, teams, ("awayTeam", "homeTeam")):
        tables = list(column.nodes("table"))
        if len(tables) != 1:
            raise ValueError("one scratch table per team required")
        rows = [[node.text() for node in row.children if isinstance(node, _Node) and node.tag == "td"]
            for row in tables[0].nodes("tr")]
        if not rows or rows[0] != ["#", "Pos", "Name"] or len(rows) > 31:
            raise ValueError("scratch table header or size mismatch")
        seen_numbers, seen_names = set(), set()
        dressed = {player.get("sweaterNumber") for group in boxscore["playerByGameStats"][side].values()
            if isinstance(group, list) for player in group}
        for cells in rows[1:]:
            if len(cells) != 3 or not re.fullmatch(r"\d{1,2}", cells[0]) or cells[1] not in {"C", "L", "R", "D", "F", "G"}:
                raise ValueError("invalid explicit scratch row")
            number, position, name = int(cells[0]), cells[1], _name(cells[2])
            if not name or not any(char.isalpha() for char in name) or number in seen_numbers or name in seen_names or number in dressed:
                raise ValueError("ambiguous or contradictory scratch identity")
            seen_numbers.add(number)
            seen_names.add(name)
            scratches.append({"teamId": team["id"], "name": name, "sweaterNumber": number,
                "position": position, "population": "goalie" if position == "G" else "skater",
                "participation": 0, "identityStatus": "requires_pregame_candidate_match"})
    return {"status": "verified", "sourceKind": "nhl_final_playing_roster", "scratches": scratches,
        "limitation": "Explicit scratch labels require a unique pregame candidate identity match; all other missing participation labels remain unknown."}

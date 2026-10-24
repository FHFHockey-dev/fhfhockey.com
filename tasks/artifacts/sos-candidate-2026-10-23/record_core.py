#!/usr/bin/env python3
"""Offline, standard-library-only checks of the proposed FHFH record-SOS contract.

All fixtures are invented. There is no network, provider, database, or app access.
Run: python sos_synthetic.py --output SOS-SYNTHETIC-RESULTS.json
"""

import argparse
from collections import Counter
from dataclasses import dataclass
from fractions import Fraction as F
import io
import json
from pathlib import Path
import unittest


@dataclass(frozen=True)
class Game:
    game_id: str
    home: str
    away: str
    outcome: str


OUTCOMES = {f"{side}_{phase}" for side in ("home", "away")
            for phase in ("reg", "ot", "so")}
MODES = {"final_win", "regulation_equivalent", "points_credit"}


def credits(game, mode):
    home_won = game.outcome.startswith("home_")
    regulation = game.outcome.endswith("_reg")
    winner, loser = (F(1), F(0))
    if mode == "regulation_equivalent" and not regulation:
        return F(1, 2), F(1, 2)
    if mode == "points_credit" and not regulation:
        loser = F(1, 2)
    return (winner, loser) if home_won else (loser, winner)


class RecordSOS:
    """No implicit dropping/reweighting; missing rates propagate to the composite."""

    def __init__(self, teams, games, mode="final_win", kappa=F(2), mu=None):
        self.teams = tuple(sorted(set(teams)))
        self.games = tuple(games)
        self.mode, self.kappa = mode, F(kappa)
        if mode not in MODES or self.kappa < 0:
            raise ValueError("Unknown outcome mode or negative prior games")
        if mu is None and mode == "points_credit":
            raise ValueError("Points-credit prior must be declared explicitly")
        self.mu = F(1, 2) if mu is None else F(mu)
        if not 0 <= self.mu <= 1:
            raise ValueError("Prior credit mean must be within [0, 1]")
        ids = set()
        for game in self.games:
            if game.game_id in ids:
                raise ValueError("Duplicate canonical game ID")
            ids.add(game.game_id)
            if (game.home == game.away or game.home not in self.teams
                    or game.away not in self.teams or game.outcome not in OUTCOMES):
                raise ValueError("Invalid fixture")

    def entries(self, team):
        for game in self.games:
            if game.home == team:
                yield game.away, credits(game, self.mode)[0]
            elif game.away == team:
                yield game.home, credits(game, self.mode)[1]

    def rate(self, team, excluded=frozenset()):
        selected = [value for opponent, value in self.entries(team)
                    if opponent not in excluded]
        n, total = len(selected), sum(selected, F(0))
        denom = F(n) + self.kappa
        return {
            "eligible_games": n,
            "credit_total": total,
            "value": (total + self.kappa * self.mu) / denom if denom else None,
            "prior_weight": self.kappa / denom if denom else None,
            "state": "observed" if n else ("prior_only" if denom else "unavailable"),
        }

    def components(self):
        edges = {team: set() for team in self.teams}
        for game in self.games:
            edges[game.home].add(game.away)
            edges[game.away].add(game.home)
        unseen, output = set(self.teams), []
        while unseen:
            start = min(unseen)
            component, stack = set(), [start]
            while stack:
                team = stack.pop()
                if team not in component:
                    component.add(team)
                    stack.extend(edges[team] - component)
            unseen -= component
            output.append(sorted(component))
        return output

    def score(self, focal, fixture_opponents=None):
        if focal not in self.teams:
            raise ValueError("Unknown focal team")
        history = Counter(opponent for opponent, _ in self.entries(focal))
        future = fixture_opponents is not None
        outer = Counter(fixture_opponents) if future else history
        if any(team not in self.teams or team == focal for team in outer):
            raise ValueError("Invalid outer opponent")
        n_outer = sum(outer.values())
        own = self.rate(focal)
        output = {
            "focal": focal,
            "window": "future_fixture_list" if future else "historical_fixtures",
            "mode": self.mode, "kappa": self.kappa, "mu": self.mu,
            "historical_focal_games": sum(history.values()),
            "outer_fixture_count": n_outer,
            "unique_outer_opponents": len(outer),
            "own_rate": own,
            "schedule_components": self.components(),
            "opponents": [],
            "owp": None, "oowp": None, "sos": None, "rpi_style": None,
            "direct_prior_only_fixture_weight": None,
            "second_hop_prior_only_weight": None,
            "state": "no_fixtures" if not n_outer else "available",
        }
        if not n_outer:
            return output
        owp, oowp, owp_available, oowp_available = F(0), F(0), True, True
        direct_prior_only, second_prior_only = F(0), F(0)
        for opponent in sorted(outer):
            weight = F(outer[opponent], n_outer)
            direct = self.rate(opponent, {focal})
            if direct["state"] == "prior_only":
                direct_prior_only += weight
            if direct["value"] is None:
                owp_available = False
            else:
                owp += weight * direct["value"]
            inner_counts = Counter(other for other, _ in self.entries(opponent)
                                   if other != focal)
            inner_n, inner, details, inner_available = sum(inner_counts.values()), F(0), [], True
            fallback = not inner_n
            if fallback:
                # Explicit structural fallback in the memo, not observed evidence.
                inner = self.mu
                second_prior_only += weight
            else:
                for second in sorted(inner_counts):
                    inner_weight = F(inner_counts[second], inner_n)
                    second_rate = self.rate(second, {focal, opponent})
                    if second_rate["state"] == "prior_only":
                        second_prior_only += weight * inner_weight
                    details.append({"team": second, "weight": inner_weight,
                                    "rate": second_rate})
                    if second_rate["value"] is None:
                        inner_available = False
                    else:
                        inner += inner_weight * second_rate["value"]
            if inner_available:
                oowp += weight * inner
            else:
                oowp_available = False
            output["opponents"].append({
                "team": opponent, "fixtures": outer[opponent], "weight": weight,
                "direct_rate_excluding_focal": direct,
                "second_hop_fixture_count": inner_n,
                "second_hop_structural_prior_only": fallback,
                "second_hop": details,
                "second_hop_mean": inner if inner_available else None,
            })
        output["owp"] = owp if owp_available else None
        output["oowp"] = oowp if oowp_available else None
        output["direct_prior_only_fixture_weight"] = direct_prior_only
        output["second_hop_prior_only_weight"] = second_prior_only
        if owp_available and oowp_available:
            output["sos"] = F(2, 3) * owp + F(1, 3) * oowp
            if not future:
                output["rpi_style"] = F(1, 4) * own["value"] + F(1, 2) * owp + F(1, 4) * oowp
        else:
            output["state"] = "missing_required_component"
        return output


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


def weighting_games():
    games = [Game(f"IA{n}", "I", "A", "home_reg") for n in range(3)]
    games += [Game("IB", "I", "B", "home_reg")]
    games += [Game(f"AX{n}", "A", "X", "home_reg" if n < 4 else "away_reg")
              for n in range(5)]
    games += [Game(f"BY{n}", "B", "Y", "home_reg" if n == 0 else "away_reg")
              for n in range(10)]
    return games


def feedback_games(flip=False):
    return [Game("IA1", "I", "A", "away_reg" if flip else "home_reg"),
            Game("IA2", "I", "A", "away_reg" if flip else "home_reg"),
            Game("IB", "I", "B", "away_reg" if flip else "home_reg"),
            Game("AB", "A", "B", "home_reg"),
            Game("AC", "A", "C", "away_reg"),
            Game("BC", "B", "C", "home_reg"),
            Game("BD", "B", "D", "away_reg"),
            Game("CD", "C", "D", "home_reg")]


def naive_owp(model, focal):
    opponents = [opponent for opponent, _ in model.entries(focal)]
    return sum((model.rate(opponent)["value"] for opponent in opponents), F(0)) / len(opponents)


def naive_two_hop(model, focal):
    """Negative control: ordinary opponents' OWP lets the focal team re-enter."""
    outer = [opponent for opponent, _ in model.entries(focal)]
    inner_means = []
    for intermediary in outer:
        inner = [other for other, _ in model.entries(intermediary)]
        inner_means.append(sum((model.rate(other, {intermediary})["value"]
                               for other in inner), F(0)) / len(inner))
    return sum(inner_means, F(0)) / len(inner_means)


def neighbor_average(values):
    """Triangle K3: symmetric, connected, non-bipartite averaging matrix."""
    return [sum((value for j, value in enumerate(values) if j != i), F(0)) / 2
            for i in range(3)]


def recursion_examples():
    seed, unanchored, anchored = [F(1), F(0), F(0)], [F(1), F(0), F(0)], [F(1), F(0), F(0)]
    alpha, steps = F(3, 4), 40
    for _ in range(steps):
        unanchored = neighbor_average(unanchored)
        averaged = neighbor_average(anchored)
        anchored = [(1 - alpha) * y + alpha * p for y, p in zip(seed, averaged)]
    pair, periodic_states = [F(1), F(0)], [[F(1), F(0)]]
    for _ in range(2):
        pair = [pair[1], pair[0]]
        periodic_states.append(pair)
    return {"seed": seed, "iterations": steps,
            "unanchored": unanchored, "unanchored_limit": [F(1, 3)] * 3,
            "anchored_alpha": alpha, "anchored": anchored,
            "anchored_limit": [F(5, 11), F(3, 11), F(3, 11)],
            "bipartite_two_node_states": periodic_states}


class ContractTests(unittest.TestCase):
    def test_no_games_is_not_observed_average_schedule(self):
        score = RecordSOS("ABCD", []).score("A")
        self.assertEqual(score["own_rate"]["value"], F(1, 2))
        self.assertEqual(score["own_rate"]["state"], "prior_only")
        self.assertEqual(score["state"], "no_fixtures")
        self.assertIsNone(score["sos"])
        self.assertEqual(score["schedule_components"], [["A"], ["B"], ["C"], ["D"]])

    def test_one_game_excludes_head_to_head(self):
        model = RecordSOS("AB", [Game("1", "A", "B", "home_reg")])
        a, b = model.score("A"), model.score("B")
        self.assertEqual(a["sos"], F(1, 2))
        self.assertEqual(b["sos"], F(1, 2))
        self.assertEqual(a["rpi_style"], F(13, 24))
        self.assertEqual(b["rpi_style"], F(11, 24))
        self.assertTrue(a["opponents"][0]["second_hop_structural_prior_only"])
        self.assertEqual(a["direct_prior_only_fixture_weight"], 1)
        self.assertEqual(a["second_hop_prior_only_weight"], 1)

    def test_repeated_opponents_unequal_histories_not_interchangeable(self):
        model = RecordSOS("IABXY", weighting_games(), kappa=0)
        self.assertEqual(model.score("I")["owp"], F(5, 8))
        unique_mean, pooled_unique, pooled_repeated = F(9, 20), F(1, 3), F(13, 25)
        self.assertEqual(len({F(5, 8), unique_mean, pooled_unique, pooled_repeated}), 4)

    def test_shrunk_composite_has_exact_hand_checked_value(self):
        score = RecordSOS("IABXY", weighting_games()).score("I")
        self.assertEqual(score["owp"], F(97, 168))
        self.assertEqual(score["oowp"], F(1, 2))
        self.assertEqual(score["sos"], F(139, 252))
        self.assertEqual(score["rpi_style"], F(209, 336))
        self.assertEqual([o["weight"] for o in score["opponents"]], [F(3, 4), F(1, 4)])

    def test_unsmoothed_missing_second_hop_is_not_dropped(self):
        score = RecordSOS("IABXY", weighting_games(), kappa=0).score("I")
        self.assertEqual(score["owp"], F(5, 8))
        self.assertIsNone(score["oowp"])
        self.assertIsNone(score["sos"])
        self.assertEqual(score["state"], "missing_required_component")

    def test_observed_zero_with_positive_denominator_is_valid(self):
        games = [Game("IA", "I", "A", "home_reg"),
                 Game("AB", "A", "B", "away_reg"),
                 Game("BC", "B", "C", "away_reg")]
        model = RecordSOS("IABC", games, kappa=0)
        rate = model.rate("A", {"I"})
        self.assertEqual(rate["eligible_games"], 1)
        self.assertEqual(rate["value"], F(0))
        self.assertEqual(rate["state"], "observed")
        score = model.score("I")
        self.assertEqual(score["owp"], F(0))
        self.assertEqual(score["oowp"], F(0))
        self.assertEqual(score["sos"], F(0))
        self.assertEqual(score["rpi_style"], F(1, 4))
        self.assertEqual(score["state"], "available")

    def test_known_future_fixtures_can_be_all_prior_not_no_fixtures(self):
        model = RecordSOS("IAB", [])
        no_fixtures, known_future = model.score("I", []), model.score("I", ["A", "B"])
        self.assertIsNone(no_fixtures["sos"])
        self.assertEqual(no_fixtures["state"], "no_fixtures")
        self.assertEqual(known_future["sos"], F(1, 2))
        self.assertEqual(known_future["historical_focal_games"], 0)
        self.assertEqual(known_future["direct_prior_only_fixture_weight"], 1)
        self.assertEqual(known_future["second_hop_prior_only_weight"], 1)
        self.assertIsNone(known_future["rpi_style"])

    def test_focal_result_feedback_is_excluded(self):
        before = RecordSOS("IABCD", feedback_games())
        after = RecordSOS("IABCD", feedback_games(flip=True))
        for mode in sorted(MODES):
            mu = F(11, 20) if mode == "points_credit" else None
            left = RecordSOS("IABCD", feedback_games(), mode=mode, mu=mu).score("I")
            right = RecordSOS("IABCD", feedback_games(True), mode=mode, mu=mu).score("I")
            for key in ("owp", "oowp", "sos"):
                self.assertEqual(left[key], right[key])
            self.assertNotEqual(left["rpi_style"], right["rpi_style"])
        self.assertNotEqual(naive_owp(before, "I"), naive_owp(after, "I"))
        self.assertNotEqual(naive_two_hop(before, "I"), naive_two_hop(after, "I"))
        self.assertEqual(before.score("I")["sos"], F(769, 1620))

    def test_disconnected_components_are_visible_not_new_evidence(self):
        games = [Game("AB", "A", "B", "home_reg"), Game("CD", "C", "D", "home_reg")]
        model = RecordSOS("ABCD", games)
        self.assertEqual(model.components(), [["A", "B"], ["C", "D"]])
        self.assertEqual(model.score("A")["rpi_style"], model.score("C")["rpi_style"])
        self.assertEqual(model.score("A")["sos"], F(1, 2))
        changed = RecordSOS("ABCD", [games[0], Game("CD", "C", "D", "away_reg")])
        self.assertEqual(model.score("A"), changed.score("A"))

    def test_credit_modes_and_non_zero_sum_points_are_explicit(self):
        game = Game("OT", "A", "B", "home_ot")
        self.assertEqual(credits(game, "final_win"), (F(1), F(0)))
        self.assertEqual(credits(game, "regulation_equivalent"), (F(1, 2), F(1, 2)))
        self.assertEqual(credits(game, "points_credit"), (F(1), F(1, 2)))
        self.assertEqual(sum(credits(game, "points_credit")), F(3, 2))
        with self.assertRaises(ValueError):
            RecordSOS("AB", [game], mode="points_credit")
        # One regulation and one OT game: 5 awarded points / 8 possible team-points.
        games = [Game("R", "A", "B", "home_reg"), game]
        model = RecordSOS("AB", games, mode="points_credit", kappa=0, mu=F(11, 20))
        self.assertEqual((model.rate("A")["value"] + model.rate("B")["value"]) / 2, F(5, 8))
        self.assertEqual(F(5, 8), F(1, 2) + F(1, 2) / 4)

    def test_future_list_changes_outer_weights_not_history(self):
        model = RecordSOS("IABXY", weighting_games())
        historical = model.score("I")
        repeated = model.score("I", ["A", "A", "A", "B"])
        balanced = model.score("I", ["A", "B"])
        self.assertEqual(historical["sos"], repeated["sos"])
        self.assertEqual(balanced["owp"], F(37, 84))
        self.assertEqual(balanced["sos"], F(29, 63))
        self.assertIsNone(repeated["rpi_style"])
        self.assertIsNone(model.score("I", [])["sos"])

    def test_input_order_and_team_labels_do_not_change_values(self):
        games = feedback_games()
        first = RecordSOS("IABCD", games).score("I")
        reverse = RecordSOS("DCBAI", reversed(games)).score("I")
        self.assertEqual(first, reverse)
        renamed = [Game(g.game_id, "z" + g.home, "z" + g.away, g.outcome) for g in games]
        last = RecordSOS(["z" + t for t in "IABCD"], renamed).score("zI")
        for key in ("owp", "oowp", "sos", "rpi_style"):
            self.assertEqual(first[key], last[key])

    def test_duplicate_ids_and_invalid_fixtures_are_rejected(self):
        game = Game("1", "A", "B", "home_reg")
        for games in ([game, game], [Game("2", "A", "A", "home_reg")],
                      [Game("3", "A", "C", "home_reg")]):
            with self.assertRaises(ValueError):
                RecordSOS("AB", games)

    def test_scores_stay_bounded_and_each_defined_mix_normalizes(self):
        for mode in sorted(MODES):
            mu = F(11, 20) if mode == "points_credit" else None
            model = RecordSOS("IABCD", feedback_games(), mode=mode, mu=mu)
            for team in model.teams:
                score = model.score(team)
                for key in ("owp", "oowp", "sos", "rpi_style",
                            "direct_prior_only_fixture_weight", "second_hop_prior_only_weight"):
                    self.assertTrue(0 <= score[key] <= 1)
                self.assertEqual(sum(o["weight"] for o in score["opponents"]), 1)
                for opponent in score["opponents"]:
                    if opponent["second_hop"]:
                        self.assertEqual(sum(o["weight"] for o in opponent["second_hop"]), 1)

    def test_naive_triangle_collapse_and_anchored_noncollapse(self):
        examples = recursion_examples()
        for actual, expected in zip(examples["unanchored"], examples["unanchored_limit"]):
            self.assertLess(abs(actual - expected), F(1, 10**11))
        for actual, expected in zip(examples["anchored"], examples["anchored_limit"]):
            self.assertLess(abs(actual - expected), F(1, 10**11))
        self.assertNotEqual(examples["anchored_limit"][0], examples["anchored_limit"][1])
        self.assertEqual(examples["bipartite_two_node_states"],
                         [[F(1), F(0)], [F(0), F(1)], [F(1), F(0)]])


def encode(value):
    if isinstance(value, F):
        return {"exact": str(value), "decimal": float(value)}
    if isinstance(value, dict):
        return {str(key): encode(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [encode(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="SOS-SYNTHETIC-RESULTS.json")
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests)
    names = [test.id().split(".")[-1] for test in suite]
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    before, after = RecordSOS("IABCD", feedback_games()), RecordSOS("IABCD", feedback_games(True))
    disconnected = RecordSOS("ABCD", [Game("AB", "A", "B", "home_reg"),
                                       Game("CD", "C", "D", "home_reg")])
    output = {
        "scope": "Invented fixtures only; arithmetic and contract checks, not an NHL backtest",
        "implementation": "Python standard library; Fraction arithmetic; no stochastic draws",
        "contract": {
            "outcome_default": "final_win: 1/0, inclusive of OT and shootout",
            "prior_default": "kappa=2, mu=1/2; demonstration only, not calibrated",
            "fixture_weighting": "Outer n_ij/n_i; future list changes only outer counts",
            "direct_exclusion": "Opponent rate excludes every game against focal i",
            "second_hop_exclusion": "Intermediary opponent mix excludes i; rate of k excludes i and intermediary j",
            "missing_policy": "No fixtures => no schedule score; zero unsmoothed denominator/no eligible games => unavailable composite; observed zero credit with positive denominator => valid zero; no intermediary alternatives => explicit prior-only fallback",
            "points_exception": "Ordinary scoring only; exceptional standings-point forfeiture not modeled",
        },
        "tests": {"run": result.testsRun, "failures": len(result.failures),
                  "errors": len(result.errors), "successful": result.wasSuccessful(), "names": names},
        "test_log": "\n".join(f"Ran {result.testsRun} tests (elapsed omitted for deterministic output)"
                              if line.startswith("Ran ") else line
                              for line in stream.getvalue().splitlines()) + "\n",
        "fixtures": {"unequal_histories": [vars(g) for g in weighting_games()],
                     "focal_flip_before": [vars(g) for g in feedback_games()],
                     "focal_flip_after": [vars(g) for g in feedback_games(True)]},
        "examples": {
            "no_games": RecordSOS("ABCD", []).score("A"),
            "known_future_all_prior": RecordSOS("IAB", []).score("I", ["A", "B"]),
            "one_game": RecordSOS("AB", [Game("AB", "A", "B", "home_reg")]).score("A"),
            "unequal_histories_unsmoothed": RecordSOS("IABXY", weighting_games(), kappa=0).score("I"),
            "unequal_histories_smoothed": RecordSOS("IABXY", weighting_games()).score("I"),
            "future_balanced": RecordSOS("IABXY", weighting_games()).score("I", ["A", "B"]),
            "focal_result_flip": {"before": before.score("I"), "after": after.score("I"),
                                  "naive_unexcluded_owp_before": naive_owp(before, "I"),
                                  "naive_unexcluded_owp_after": naive_owp(after, "I"),
                                  "naive_ordinary_two_hop_before": naive_two_hop(before, "I"),
                                  "naive_ordinary_two_hop_after": naive_two_hop(after, "I")},
            "disconnected": {"A": disconnected.score("A"), "C": disconnected.score("C")},
            "naive_recursion": recursion_examples(),
        },
    }
    Path(args.output).write_text(json.dumps(encode(output), indent=2) + "\n", encoding="utf-8")
    print(stream.getvalue(), end="")
    print(f"Wrote {args.output}")
    raise SystemExit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Offline tests for summary-refresh.py's pure helpers (no DB, no network). Run: python3 -I test_summary_refresh.py"""
import copy
import glob
import importlib.util
import os
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "summary_refresh", os.path.join(os.path.dirname(os.path.abspath(__file__)), "summary-refresh.py"))
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)

G, SHOOTER, MATE, GOALIE = 2026020065, 8478403, 8470000, 8475683
P = sr.PREFIX


def metrics(goals=0, shots=5, icf=7, iff=5, sa=0, sv=0, ga=0):
    return {"individual": {"goals": goals, "shots": shots, "iCf": icf, "iFf": iff, "ixg": 0.85},
            "goalies": {"shotsAgainst": sa, "saves": sv, "goalsAgainst": ga, "hdShotsAgainst": 0},
            "onIce": {"gf": 1, "sf": 9}, "toiSeconds": 1598}


def payload(rows):
    return {"version": 1, "formulaRevision": 2, "generatedAt": "x",
            "rows": [{"playerId": pid, "metrics": m} for pid, m in rows.items()]}


def game_heads(goal_in, shooter_goals=0, shooter_shots=5, goalie=(20, 18, 2)):
    """Player partition heads for one game; goal_in = score states holding the penalty shot."""
    heads = {}
    for mode in ("individual", "goalies", "onIce"):
        for strength in ("allStrengths", "evenStrength"):
            for state in ("allScores", "tied", "leading", "trailing", "upOne"):
                url = f"{P}{mode}/{strength}/{G}" if state == "allScores" else f"{P}{mode}/{strength}/{state}/{G}"
                moved = strength == "allStrengths" and state in goal_in
                if mode == "individual":
                    rows = {SHOOTER: metrics(goals=shooter_goals if moved else 0, shots=shooter_shots if moved else 5,
                                             icf=8 if moved else 7, iff=6 if moved else 5),
                            MATE: metrics()}
                elif mode == "goalies":
                    sa, sv, ga = goalie if moved else (19, 18, 1)
                    rows = {GOALIE: metrics(sa=sa, sv=sv, ga=ga)}
                else:
                    rows = {SHOOTER: metrics(), MATE: metrics()}
                heads[url] = payload(rows)
    return heads


BEFORE = game_heads(goal_in=())
GOOD_AFTER = game_heads(goal_in=("allScores", "leading", "upOne"), shooter_goals=1, shooter_shots=6)


class Helpers(unittest.TestCase):
    def test_parse_partition(self):
        self.assertEqual(sr.parse_partition(f"{P}individual/allStrengths/{G}"), ("individual", "allStrengths", "allScores"))
        self.assertEqual(sr.parse_partition(f"{P}goalies/allStrengths/tied/{G}"), ("goalies", "allStrengths", "tied"))
        self.assertIsNone(sr.parse_partition(f"derived://other/{G}"))

    def test_expected_move(self):
        self.assertEqual(sr.expected_move("individual", "goal"), {"individual": {"goals": 1, "shots": 1, "iCf": 1, "iFf": 1}})
        self.assertEqual(sr.expected_move("goalies", "save"), {"goalies": {"shotsAgainst": 1, "saves": 1, "goalsAgainst": 0}})
        self.assertEqual(sr.expected_move("onIce", "goal"), {})

    def test_clean_refresh_of_a_penalty_shot_goal_passes(self):
        self.assertEqual(sr.partition_problems(BEFORE, GOOD_AFTER, SHOOTER, GOALIE, "goal"), [])

    def test_readback_catches_each_failure(self):
        cases = {
            "allScores missed it": game_heads(goal_in=("leading",), shooter_goals=1, shooter_shots=6),
            "two primary score states": game_heads(goal_in=("allScores", "leading", "tied"), shooter_goals=1, shooter_shots=6),
            "moved in a strength split": None,
            "on-ice changed": None,
            "teammate changed": None,
            "wrong amount (save counted as goal)": game_heads(goal_in=("allScores", "leading"), shooter_goals=1, shooter_shots=6),
            "old formula revision": None,
            "partition dropped": None,
        }
        split = copy.deepcopy(GOOD_AFTER)
        split[f"{P}individual/evenStrength/{G}"] = GOOD_AFTER[f"{P}individual/allStrengths/{G}"]
        cases["moved in a strength split"] = split
        on_ice = copy.deepcopy(GOOD_AFTER)
        on_ice[f"{P}onIce/allStrengths/{G}"]["rows"][0]["metrics"]["onIce"]["gf"] = 2
        cases["on-ice changed"] = on_ice
        mate = copy.deepcopy(GOOD_AFTER)
        mate[f"{P}individual/allStrengths/{G}"]["rows"][1]["metrics"]["individual"]["shots"] = 6
        cases["teammate changed"] = mate
        old = copy.deepcopy(GOOD_AFTER)
        old[f"{P}onIce/evenStrength/{G}"]["formulaRevision"] = 1
        cases["old formula revision"] = old
        dropped = copy.deepcopy(GOOD_AFTER)
        del dropped[f"{P}onIce/evenStrength/upOne/{G}"]
        cases["partition dropped"] = dropped
        for name, after in cases.items():
            result = "save" if name.startswith("wrong amount") else "goal"
            with self.subTest(name):
                self.assertNotEqual(sr.partition_problems(BEFORE, after, SHOOTER, GOALIE, result), [])

    def test_goalie_table_readback(self):
        def table(heads):
            return {(sr.parse_partition(u)[1], sr.parse_partition(u)[2]): p
                    for u, p in heads.items() if sr.parse_partition(u)[0] == "goalies"}
        self.assertEqual(sr.goalie_table_problems(table(BEFORE), table(GOOD_AFTER), GOALIE, "goal"), [])
        self.assertNotEqual(sr.goalie_table_problems(table(BEFORE), table(BEFORE), GOALIE, "goal"), [])
        save_after = table(game_heads(goal_in=("allScores", "tied"), goalie=(20, 19, 1)))
        self.assertEqual(sr.goalie_table_problems(table(BEFORE), save_after, GOALIE, "save"), [])
        self.assertNotEqual(sr.goalie_table_problems(table(BEFORE), save_after, GOALIE, "goal"), [])

    def test_orphan_partitions_are_left_untouched(self):
        # 2026020094-style: an empty-net partition from a 2026-11-09 build (no formula revision) that the
        # current builder no longer writes. The refresh leaves it as it is; the readback requires exactly that.
        orphan_url = f"{P}individual/withEmptyNet/{G}"
        orphan = {"version": 1, "generatedAt": "2026-11-09", "rows": [{"playerId": SHOOTER, "metrics": metrics()}]}
        before = dict(BEFORE, **{orphan_url: orphan})
        after = dict(GOOD_AFTER, **{orphan_url: copy.deepcopy(orphan)})
        orphans = sr.orphan_keys(before)
        self.assertEqual(orphans, {orphan_url})
        self.assertEqual(sr.partition_problems(before, after, SHOOTER, GOALIE, "goal", orphans), [])
        # Without the orphan rule it would be flagged as an old revision.
        self.assertNotEqual(sr.partition_problems(before, after, SHOOTER, GOALIE, "goal"), [])
        changed = copy.deepcopy(after)
        changed[orphan_url]["rows"][0]["metrics"]["individual"]["shots"] = 9
        self.assertNotEqual(sr.partition_problems(before, changed, SHOOTER, GOALIE, "goal", orphans), [])

    def test_baseline_gate(self):
        heads = {u: {"f": "2026-11-12T20:11:00Z", "p": p} for u, p in BEFORE.items()}
        goalies = {("allStrengths", "allScores"): {"f": "2026-11-12T20:23:00Z", "p": BEFORE[f"{P}goalies/allStrengths/{G}"]}}
        self.assertEqual(sr.baseline_problems(heads, goalies), [])
        old = dict(heads, **{f"{P}onIce/withEmptyNet/{G}": {"f": "2026-11-09T15:03:23Z", "p": {"version": 1, "rows": []}}})
        self.assertEqual(sr.baseline_problems(old, goalies), [])
        newer = dict(heads, **{f"{P}onIce/withEmptyNet/{G}": {"f": "2026-11-13T09:00:00Z", "p": {"version": 1, "rows": []}}})
        self.assertNotEqual(sr.baseline_problems(newer, goalies), [])
        no_current = {u: {"f": h["f"], "p": dict(h["p"], formulaRevision=1)} for u, h in heads.items()}
        self.assertNotEqual(sr.baseline_problems(no_current, goalies), [])

    def test_windows(self):
        self.assertIsNotNone(sr.window_at(8 * 60 + 5))
        self.assertIsNotNone(sr.window_at(9 * 60 + 15, sr.CALL_MARGIN_MIN))
        self.assertIsNotNone(sr.window_at(11 * 60 + 30))
        self.assertIsNone(sr.window_at(18 * 60, sr.CALL_MARGIN_MIN))


class ResumeEvidence(unittest.TestCase):
    """Astra A3-02: a resume never overwrites pre-write evidence and never re-baselines a done game."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sr-a302-")
        self.saved = {name: getattr(sr, name) for name in ("OUT", "log", "player_heads", "goalie_rows", "stop")}
        self.events = []
        sr.OUT = self.tmp
        sr.log = lambda **kw: self.events.append(kw)

        def fake_stop(code, reason, **kw):
            raise AssertionError(f"stop {code}: {reason} {kw}")
        sr.stop = fake_stop
        sr.player_heads = lambda g: {
            f"{P}individual/allStrengths/{g}": {"f": "2026-11-12T20:11:00Z", "p": payload({SHOOTER: metrics()})},
            f"{P}goalies/allStrengths/{g}": {"f": "2026-11-12T20:11:00Z", "p": payload({GOALIE: metrics(sa=20, sv=18, ga=2)})},
        }
        sr.goalie_rows = lambda g: {("allStrengths", "allScores"): {"f": "2026-11-12T20:23:00Z", "p": payload({GOALIE: metrics()})}}

    def tearDown(self):
        for name, value in self.saved.items():
            setattr(sr, name, value)

    def test_resume_with_the_canary_done_leaves_its_before_files_alone(self):
        canary = sr.MANIFEST[0][0]
        legacy = os.path.join(self.tmp, f"summary-before-{canary}.jsonl")
        first = os.path.join(self.tmp, f"summary-before-{canary}-20261113T183000Z-111-01.jsonl")
        for path, text in ((legacy, "legacy\n"), (first, "true pre-refresh rows: Eichel 0 G / 5 S\n")):
            with open(path, "w") as f:
                f.write(text)
        done = {str(canary)}
        plan = sr.planned_games(done, len(sr.MANIFEST))
        self.assertEqual([m[0] for m in plan], [m[0] for m in sr.MANIFEST[1:]])

        sr.preflight(plan, done)

        self.assertEqual(open(first).read(), "true pre-refresh rows: Eichel 0 G / 5 S\n")
        self.assertEqual(open(legacy).read(), "legacy\n")
        self.assertEqual(sorted(glob.glob(os.path.join(self.tmp, f"summary-*-{canary}*"))), sorted([legacy, first]))
        baselined = [e["game"] for e in self.events if e.get("event") == "baseline"]
        self.assertNotIn(canary, baselined)
        self.assertEqual(baselined, [m[0] for m in plan])
        done_events = [e for e in self.events if e.get("event") == "already_done"]
        self.assertEqual([e["game"] for e in done_events], [canary])
        self.assertTrue(done_events[0]["authority_before"].endswith(os.path.basename(first)))
        for g in baselined:
            self.assertEqual(len(glob.glob(os.path.join(self.tmp, f"summary-before-{g}-*.jsonl"))), 1)

    def test_an_existing_evidence_file_is_never_truncated(self):
        g = sr.MANIFEST[1][0]
        path = os.path.join(self.tmp, f"summary-before-{g}-x.jsonl")
        with open(path, "w") as f:
            f.write("keep me\n")
        with self.assertRaises(FileExistsError):
            sr.write_evidence(path, "overwrite\n")
        self.assertEqual(open(path).read(), "keep me\n")

    def test_repeated_snapshots_of_a_game_add_files_and_the_first_stays_authority(self):
        g = sr.MANIFEST[2][0]
        sr.snapshot(g, "before")
        sr.snapshot(g, "before")
        sr.snapshot(g, "after")
        befores = sorted(glob.glob(os.path.join(self.tmp, f"summary-before-{g}-*.jsonl")))
        self.assertEqual(len(befores), 2)
        self.assertEqual(sr.authority_file("summary-before", g, "jsonl"), befores[0])
        self.assertEqual(len(glob.glob(os.path.join(self.tmp, f"summary-after-{g}-*.jsonl"))), 1)


if __name__ == "__main__":
    unittest.main()

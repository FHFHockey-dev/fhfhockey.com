#!/usr/bin/env python3
"""Offline tests for ps-rebuild.py's pure helpers (no DB, no network). Run: python3 -I test_ps_rebuild.py"""
import copy
import glob
import importlib.util
import os
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ps_rebuild", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ps-rebuild.py"))
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)

G = 2026020065  # home 54 scored a penalty shot; 54 won the shootout 4-3 (boxscore score includes the SO goal)
BOX = {"homeTeam": {"id": 54, "sog": 43, "score": 4}, "awayTeam": {"id": 10, "sog": 24, "score": 3},
       "gameOutcome": {"lastPeriodType": "SO"}}


def player(pid, team, es_shots, es_goals, marker=None, ps_shots=None, ps_goals=None):
    return {"game_id": G, "player_id": pid, "team_id": team, "opponent_team_id": 10 if team == 54 else 54,
            "game_date": "2026-10-08", "shots_es": es_shots, "shots_pp": 1, "shots_pk": 0, "goals_es": es_goals,
            "goals_pp": 0, "goals_pk": 0, "assists_es": 0, "assists_pp": 0, "assists_pk": 0, "toi_es_seconds": 900,
            "toi_pp_seconds": 60, "toi_pk_seconds": 30, "shots_ps": ps_shots, "goals_ps": ps_goals,
            "penalty_shot_split_version": marker}


def team(tid, shots_es, goals_es, shots_pp, goals_pp, marker=None, ps=(None, None)):
    return {"game_id": G, "team_id": tid, "shots_es": shots_es, "shots_pp": shots_pp, "shots_pk": 0,
            "goals_es": goals_es, "goals_pp": goals_pp, "goals_pk": 0, "shots_ps": ps[0], "goals_ps": ps[1],
            "penalty_shot_split_version": marker}


BEFORE = {"players": {1: player(1, 54, 5, 2), 2: player(2, 10, 3, 0)},
          "teams": {54: team(54, 40, 3, 3, 0), 10: team(10, 21, 2, 3, 1)}}
AFTER = {"players": {1: player(1, 54, 4, 1, 1, 1, 1), 2: player(2, 10, 3, 0, 1, 0, 0)},
         "teams": {54: team(54, 39, 2, 3, 0, 1, (1, 1)), 10: team(10, 21, 2, 3, 1, 1, (0, 0))}}


class Helpers(unittest.TestCase):
    def test_official_totals_remove_the_shootout_winners_extra_goal(self):
        self.assertEqual(ps.official_totals(BOX), {54: (43, 3), 10: (24, 3)})
        reg = dict(BOX, gameOutcome={"lastPeriodType": "REG"})
        self.assertEqual(ps.official_totals(reg), {54: (43, 4), 10: (24, 3)})

    def test_all_situation_adds_ps_only_on_split_rows(self):
        self.assertEqual(ps.all_situation(BEFORE["teams"][54]), (43, 3))
        self.assertEqual(ps.all_situation(AFTER["teams"][54]), (43, 3))
        stray = dict(BEFORE["teams"][54], shots_ps=5, goals_ps=5)
        self.assertEqual(ps.all_situation(stray), (43, 3))

    def test_expected_ps_follows_the_manifest(self):
        self.assertEqual(ps.expected_ps(G, 54), (1, 1))
        self.assertEqual(ps.expected_ps(G, 10), (0, 0))
        self.assertEqual(ps.expected_ps(2026020094, 55), (1, 0))

    def test_clean_rebuild_passes_the_readback(self):
        official = ps.official_totals(BOX)
        self.assertEqual(ps.readback_problems(G, BEFORE, AFTER, official, True), [])

    def test_readback_catches_each_failure(self):
        official = ps.official_totals(BOX)
        cases = {}
        lost = copy.deepcopy(AFTER); lost["players"][1]["shots_ps"] = 0; lost["teams"][54]["shots_ps"] = 0
        cases["penalty shot lost"] = lost
        double = copy.deepcopy(AFTER); double["players"][1]["shots_es"] = 5; double["teams"][54]["shots_es"] = 40
        cases["penalty shot counted twice"] = double
        legacy = copy.deepcopy(AFTER); legacy["teams"][10]["penalty_shot_split_version"] = None
        cases["row left legacy"] = legacy
        dropped = copy.deepcopy(AFTER); del dropped["players"][2]
        cases["player row dropped"] = dropped
        toi = copy.deepcopy(AFTER); toi["players"][2]["toi_pp_seconds"] = 61
        cases["TOI changed"] = toi
        for name, after in cases.items():
            with self.subTest(name):
                self.assertNotEqual(ps.readback_problems(G, BEFORE, after, official, True), [])

    def test_a_reported_baseline_mismatch_is_held_to_unchanged(self):
        official = {54: (44, 3), 10: (24, 3)}  # pre-existing difference of one home shot
        self.assertNotEqual(ps.readback_problems(G, BEFORE, AFTER, official, True), [])
        self.assertEqual(ps.readback_problems(G, BEFORE, AFTER, official, False), [])

    def test_window_gate(self):
        self.assertIsNotNone(ps.window_at(10 * 60 + 25))
        self.assertIsNotNone(ps.window_at(9 * 60 + 40, ps.CALL_MARGIN_MIN))
        self.assertIsNone(ps.window_at(18 * 60, ps.CALL_MARGIN_MIN))


class ResumeEvidence(unittest.TestCase):
    """Astra A3-02: a resume never re-baselines a done game and never overwrites evidence."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="ps-a302-")
        self.saved = {name: getattr(ps, name) for name in ("OUT", "log", "rows_for", "official_for", "stop")}
        self.events = []
        ps.OUT = self.tmp
        ps.log = lambda **kw: self.events.append(kw)

        def fake_stop(code, reason, **kw):
            raise AssertionError(f"stop {code}: {reason} {kw}")
        ps.stop = fake_stop
        self.read = []
        ps.rows_for = lambda g: (self.read.append(g), copy.deepcopy(AFTER))[1]
        ps.official_for = lambda g: ps.official_totals(BOX)

    def tearDown(self):
        for name, value in self.saved.items():
            setattr(ps, name, value)

    def test_resume_baselines_only_planned_games(self):
        done = {str(ps.MANIFEST[0][0])}
        plan = ps.planned_games(done)
        baseline = ps.preflight(plan, done)
        self.assertNotIn(ps.MANIFEST[0][0], baseline)
        self.assertNotIn(ps.MANIFEST[0][0], self.read)
        self.assertEqual(sorted(baseline), sorted(g for g, _d in plan))
        self.assertEqual([e["game"] for e in self.events if e["event"] == "already_done"], [ps.MANIFEST[0][0]])

    def test_evidence_is_never_truncated_and_the_first_file_is_authority(self):
        first = ps.write_evidence(ps.evidence_path("before", G, "json"), '{"pre": true}')
        with self.assertRaises(FileExistsError):
            ps.write_evidence(first, "{}")
        self.assertEqual(open(first).read(), '{"pre": true}')
        second = ps.write_evidence(ps.evidence_path("before", G, "json"), "{}")
        self.assertNotEqual(first, second)
        self.assertEqual(ps.authority_file("before", G, "json"), first)
        self.assertEqual(len(glob.glob(os.path.join(self.tmp, f"before-{G}-*.json"))), 2)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Offline tests for team-refresh.py's pure helpers (no DB, no network). Run: python3 -I test_team_refresh.py"""
import copy
import glob
import importlib.util
import json
import os
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "team_refresh", os.path.join(os.path.dirname(os.path.abspath(__file__)), "team-refresh.py"))
tr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tr)

# 2026020131: home 18 scored the penalty shot; official 18: 24 SOG / 5 G, 19: 26 / 2.
G, SHOOTER, OPP = 2026020131, 18, 19


def change(stored, rebuilt):
    return {"stored": stored, "rebuilt": rebuilt}


def game_diffs(game=G, shooter=SHOOTER, opp=OPP, goal=True, sf=(23, 24), gf=(4, 5), state="tied"):
    out = []
    for score_state in ("allScores", state, "withinOne"):
        shooter_changes = {"cf": change(40, 41), "ff": change(30, 31), "sf": change(*sf)}
        opp_changes = {"ca": change(40, 41), "fa": change(30, 31), "sa": change(*sf)}
        if goal:
            shooter_changes["gf"] = change(*gf)
            opp_changes["ga"] = change(*gf)
        out.append({"game_id": game, "team_id": shooter, "strength": "allStrengths", "score_state": score_state,
                    "changes": shooter_changes})
        out.append({"game_id": game, "team_id": opp, "strength": "allStrengths", "score_state": score_state,
                    "changes": opp_changes})
    return out


def all_games_clean():
    diffs, official = [], {}
    for game, shooter, result in tr.MANIFEST:
        opp = shooter + 1000
        goal = result == "goal"
        diffs += game_diffs(game, shooter, opp, goal, sf=(23, 24), gf=(4, 5))
        official[game] = {shooter: (24, 5 if goal else 4), opp: (26, 2)}
    return diffs, official


class Helpers(unittest.TestCase):
    def test_official_totals(self):
        box = {"homeTeam": {"id": 54, "sog": 43, "score": 4}, "awayTeam": {"id": 10, "sog": 24, "score": 3},
               "gameOutcome": {"lastPeriodType": "SO"}}
        self.assertEqual(tr.official_totals(box), {54: (43, 3), 10: (24, 3)})

    def test_expected_changes(self):
        self.assertEqual(tr.expected_changes(18, 18, "goal"), {"cf": 1, "ff": 1, "sf": 1, "gf": 1})
        self.assertEqual(tr.expected_changes(19, 18, "save"), {"ca": 1, "fa": 1, "sa": 1})

    def test_clean_diff_passes(self):
        diffs, official = all_games_clean()
        self.assertEqual(tr.diff_problems(diffs, [], official), [])

    def test_diff_catches_each_failure(self):
        diffs, official = all_games_clean()
        cases = {}
        es = copy.deepcopy(diffs); es[0]["strength"] = "evenStrength"
        cases["moved a strength split"] = (es, [], official)
        twice = copy.deepcopy(diffs); twice[0]["changes"]["sf"] = change(23, 25)
        cases["counted twice"] = (twice, [], official)
        xg = copy.deepcopy(diffs); xg[0]["changes"]["xgf"] = change(1.0, 1.2)
        cases["xG changed"] = (xg, [], official)
        no_all = [d for d in diffs if not (d["game_id"] == G and d["score_state"] == "allScores")]
        cases["allScores missing"] = (no_all, [], official)
        two_primary = diffs + [dict(d, score_state="leading") for d in diffs if d["game_id"] == G and d["score_state"] == "tied"]
        cases["two primary states"] = (two_primary, [], official)
        other_game = diffs + [dict(diffs[0], game_id=2026029999)]
        cases["unexpected game"] = (other_game, [], official)
        missing = copy.deepcopy(diffs); missing[0]["missing"] = True
        cases["stored row missing"] = (missing, [], official)
        cases["stale keys"] = (diffs, [{"game_id": G}], official)
        wrong_official = copy.deepcopy(official); wrong_official[G] = {SHOOTER: (25, 5), OPP: (26, 2)}
        cases["rebuilt SF differs from the boxscore"] = (diffs, [], wrong_official)
        for name, (d, stale, off) in cases.items():
            with self.subTest(name):
                self.assertNotEqual(tr.diff_problems(d, stale, off), [])

    def test_readback(self):
        key = (SHOOTER, "allStrengths", "allScores")
        other = (SHOOTER, "evenStrength", "allScores")
        before = {key: {"sf": 23, "gf": 4, "xgf": 1.5, "updated_at": "a"}, other: {"sf": 23, "gf": 4, "xgf": 1.5}}
        approved = [{"game_id": G, "team_id": SHOOTER, "strength": "allStrengths", "score_state": "allScores",
                     "changes": {"sf": change(23, 24), "gf": change(4, 5)}}]
        after = {key: {"sf": 24, "gf": 5, "xgf": 1.5000000001, "updated_at": "b"}, other: {"sf": 23, "gf": 4, "xgf": 1.5}}
        self.assertEqual(tr.readback_problems(before, after, approved), [])
        drift = copy.deepcopy(after); drift[other]["sf"] = 24
        self.assertNotEqual(tr.readback_problems(before, drift, approved), [])
        short = copy.deepcopy(after); short[key]["gf"] = 4
        self.assertNotEqual(tr.readback_problems(before, short, approved), [])

    def test_windows(self):
        self.assertIsNotNone(tr.window_at(10 * 60))
        self.assertIsNone(tr.window_at(18 * 60, tr.CALL_MARGIN_MIN))


class ResumeEvidence(unittest.TestCase):
    """Astra A3-02: evidence and the approved diff are never overwritten; done games are never re-diffed."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="tr-a302-")
        self.saved = (tr.OUT, tr.APPROVED)
        tr.OUT = self.tmp
        tr.APPROVED = os.path.join(self.tmp, "team-diff-approved.json")

    def tearDown(self):
        tr.OUT, tr.APPROVED = self.saved

    def test_planned_diff_ignores_done_games_and_keeps_the_approved_file(self):
        diffs, official = all_games_clean()
        body = {"diffs": diffs, "staleKeys": []}
        problems, first = tr.record_diff(body, "sha", official, tr.MANIFEST)
        self.assertEqual(problems, [])
        approved_text = open(tr.APPROVED).read()

        # Resume with the first game done: only the planned games are diffed and checked.
        plan = tr.planned_games({str(tr.MANIFEST[0][0])})
        planned_ids = {g for g, _t, _r in plan}
        resumed = {"diffs": [d for d in diffs if d["game_id"] in planned_ids], "staleKeys": []}
        self.assertEqual(tr.diff_problems(resumed["diffs"], [], official, plan), [])
        problems, second = tr.record_diff(resumed, "sha", official, plan)
        self.assertEqual(problems, [])
        self.assertNotEqual(first, second)
        self.assertEqual(open(tr.APPROVED).read(), approved_text)

        # A diff that still passes the penalty-shot rules but differs from the approved one (here the stored CF
        # moved since approval) is refused, and the approved file is kept.
        changed = copy.deepcopy(resumed)
        changed["diffs"][0]["changes"]["cf"] = change(39, 40)
        self.assertEqual(tr.diff_problems(changed["diffs"], [], official, plan), [])
        problems, _ = tr.record_diff(changed, "sha", official, plan)
        self.assertEqual(len(problems), 1)
        self.assertIn("approved diff", problems[0])
        self.assertEqual(open(tr.APPROVED).read(), approved_text)
        self.assertEqual(len(glob.glob(os.path.join(self.tmp, "team-diff-planned-*.json"))), 3)

    def test_a_rejected_first_diff_never_becomes_the_approved_diff(self):
        diffs, official = all_games_clean()
        problems, _ = tr.record_diff({"diffs": diffs[1:], "staleKeys": []}, "sha", official, tr.MANIFEST)
        self.assertNotEqual(problems, [])
        self.assertFalse(os.path.exists(tr.APPROVED))

    def test_evidence_is_never_truncated(self):
        path = tr.evidence_path("team-before", G, "json")
        tr.write_evidence(path, json.dumps({"rows": "pre-write"}))
        with self.assertRaises(FileExistsError):
            tr.write_evidence(path, "overwrite")
        self.assertEqual(json.loads(open(path).read()), {"rows": "pre-write"})
        later = tr.write_evidence(tr.evidence_path("team-before", G, "json"), "{}")
        self.assertNotEqual(later, path)
        self.assertEqual(tr.authority_file("team-before", G, "json"), path)


class ResumeExecutePath(unittest.TestCase):
    """A3-02 closing bar: main(--execute) on a resume (one game done, one pending). Every DB, HTTP and clock
    touchpoint is stubbed. Covers (a) only the pending game is diffed, against the ORIGINAL approved diff, then
    written; (b) a changed diff stops before any write; and the per-game diff call's dry-run check."""

    STUBBED = ("OUT", "DONE", "APPROVED", "MANIFEST", "PAUSE_S", "guard", "window_gate", "deployment_problems",
               "manifest_problems", "read_secret", "official_for", "post", "stored_rows")
    COMPLETED, PENDING = (2026020094, 55, "save"), (2026020131, SHOOTER, "goal")

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="tr-resume-")
        self.saved = {name: getattr(tr, name) for name in self.STUBBED}
        self.saved_argv = sys.argv
        tr.MANIFEST = [self.COMPLETED, self.PENDING]
        tr.OUT = self.tmp
        tr.DONE = os.path.join(self.tmp, "team-refresh.done")
        tr.APPROVED = os.path.join(self.tmp, "team-diff-approved.json")
        tr.PAUSE_S = 0
        with open(tr.DONE, "w") as f:
            f.write(f"{self.COMPLETED[0]}\n")
        self.originals = {
            os.path.join(self.tmp, f"team-before-{self.COMPLETED[0]}.json"): "legacy rows of the completed game\n",
            os.path.join(self.tmp, f"team-before-{self.COMPLETED[0]}-20261113T190000Z-111-01.json"): "true pre-write rows\n",
        }
        for path, text in self.originals.items():
            with open(path, "w") as f:
                f.write(text)
        self.approved_diffs = game_diffs(self.PENDING[0], SHOOTER, OPP, goal=True)
        with open(tr.APPROVED, "w") as f:
            json.dump({"body": {"diffs": self.approved_diffs}}, f)
        self.approved_bytes = open(tr.APPROVED, "rb").read()
        before = {(d["team_id"], d["strength"], d["score_state"]): {k: v["stored"] for k, v in d["changes"].items()}
                  for d in self.approved_diffs}
        before[(SHOOTER, "evenStrength", "allScores")] = {"sf": 23, "gf": 4}
        after = {key: dict(row) for key, row in before.items()}
        for d in self.approved_diffs:
            after[(d["team_id"], d["strength"], d["score_state"])].update({k: v["rebuilt"] for k, v in d["changes"].items()})

        self.calls, self.reads, self.written = [], [], {"done": False}
        # What the stubbed route answers to a per-game diff call; a test may replace it.
        self.diff_body = {"success": True, "dryRun": True, "rowsUpserted": 0, "diffsTruncated": False,
                          "diffs": copy.deepcopy(self.approved_diffs), "staleKeys": []}
        tr.guard = lambda: None
        tr.window_gate = lambda tag: None
        tr.deployment_problems = lambda: ("sha", [])
        tr.manifest_problems = lambda: []
        tr.read_secret = lambda: "secret"
        tr.official_for = lambda g: {SHOOTER: (24, 5), OPP: (26, 2)}

        def post(query, secret):
            self.calls.append(query)
            if query.get("dryRun") == "false":
                self.written["done"] = True
                return 0.1, {"success": True, "dryRun": False, "rowsUpserted": 140, "rowsGenerated": 140, "staleKeyCount": 0}
            return 0.1, copy.deepcopy(self.diff_body)
        tr.post = post

        def stored_rows(g):
            self.reads.append(g)
            return copy.deepcopy(after if self.written["done"] else before)
        tr.stored_rows = stored_rows
        sys.argv = ["team-refresh.py", "--execute"]

    def tearDown(self):
        for name, value in self.saved.items():
            setattr(tr, name, value)
        sys.argv = self.saved_argv

    def assert_completed_game_untouched(self):
        for path, text in self.originals.items():
            self.assertEqual(open(path).read(), text)
        self.assertEqual(sorted(glob.glob(os.path.join(self.tmp, f"*{self.COMPLETED[0]}*"))), sorted(self.originals))
        self.assertNotIn(self.COMPLETED[0], self.reads)
        self.assertTrue(all(q["gameIds"] == str(self.PENDING[0]) for q in self.calls))
        self.assertEqual(open(tr.APPROVED, "rb").read(), self.approved_bytes)

    def snapshot_files(self):
        return sorted(glob.glob(os.path.join(self.tmp, "team-before-*")) + glob.glob(os.path.join(self.tmp, "team-after-*")))

    def run_expecting_stop_before_any_write(self, code):
        """TJ's bar: the run stops with `code`, and (1) no dryRun=false call, (2) no team-before or team-after
        file added (OUT globbed before and after), (3) the done file and (4) team-diff-approved.json are
        byte-identical. The completed game's files are unchanged too."""
        files_before = self.snapshot_files()
        done_bytes = open(tr.DONE, "rb").read()
        with self.assertRaises(SystemExit) as stopped:
            tr.main()
        self.assertEqual(stopped.exception.code, code)
        self.assertEqual([q for q in self.calls if q.get("dryRun") == "false"], [])
        self.assertEqual(self.snapshot_files(), files_before)
        self.assertEqual(open(tr.DONE, "rb").read(), done_bytes)
        self.assertEqual(open(tr.APPROVED, "rb").read(), self.approved_bytes)
        self.assert_completed_game_untouched()

    def test_resume_touches_only_the_pending_game(self):
        """(a) One diff call for the pending game only, compared with the original approved diff, then one write."""
        tr.main()
        self.assert_completed_game_untouched()
        self.assertEqual(self.calls, [
            {"seasonId": tr.SEASON, "gameIds": str(self.PENDING[0]), "diff": "true"},
            {"seasonId": tr.SEASON, "gameIds": str(self.PENDING[0]), "dryRun": "false"},
        ])
        self.assertEqual(len(glob.glob(os.path.join(self.tmp, f"team-before-{self.PENDING[0]}-*.json"))), 1)
        self.assertEqual(len(glob.glob(os.path.join(self.tmp, f"team-after-{self.PENDING[0]}-*.json"))), 1)
        self.assertEqual(open(tr.DONE).read().split(), [str(self.COMPLETED[0]), str(self.PENDING[0])])

    def test_a_changed_diff_stops_before_any_write(self):
        """(b) The pending game's fresh diff differs from team-diff-approved.json (one cf value moved): exit 6,
        no write call, no snapshot, not marked done, approved file byte-identical."""
        self.diff_body["diffs"][0]["changes"]["cf"] = change(41, 42)
        self.run_expecting_stop_before_any_write(6)
        self.assertEqual(self.calls, [{"seasonId": tr.SEASON, "gameIds": str(self.PENDING[0]), "diff": "true"}])

    def test_a_per_game_diff_call_that_is_not_a_complete_dry_run_stops_before_any_snapshot(self):
        """Hardening: the execute-path diff call is checked like diff mode's (dryRun, rowsUpserted 0, not
        truncated) before comparing; otherwise exit 2 before any snapshot or write."""
        cases = {
            "dryRun missing": {k: v for k, v in self.diff_body.items() if k != "dryRun"},
            "dryRun false": dict(self.diff_body, dryRun=False),
            "rowsUpserted 1": dict(self.diff_body, rowsUpserted=1),
            "diffsTruncated true": dict(self.diff_body, diffsTruncated=True),
        }
        for name, body in cases.items():
            with self.subTest(name):
                self.calls.clear()
                tr.post = lambda query, secret, body=body: (self.calls.append(query), (0.1, copy.deepcopy(body)))[1]
                self.run_expecting_stop_before_any_write(2)
                self.assertEqual(len(self.calls), 1)


if __name__ == "__main__":
    unittest.main()

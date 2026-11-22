"""Offline tests for the strict Daily FORGE acceptance checker.

Positive controls reuse the real Nov 21 recovery reader bodies (run ced8d73f, games 0360-0372), relabelled as a scheduled
full-slate run; every other case mutates exactly one piece of evidence. Each reproduced false pass is shown to pass the
legacy checker and to fail the strict one. Run: python3 -I -m unittest discover -s tests -v (from acceptance/).
"""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ACCEPTANCE = HERE.parent
RECOVERY = ACCEPTANCE.parent / "recovery" / "run"
sys.path.insert(0, str(ACCEPTANCE))
import summarize  # noqa: E402

RUN_ID = "ced8d73f-caaf-4d61-afd4-61492817f340"
RUN_DATE, SRC_DATE = "2026-11-21", "2026-11-20"
GAMES = list(range(2026020360, 2026020373))
STARTCHART = json.loads((RECOVERY / "startchart.json").read_text())
RSO = json.loads((RECOVERY / "rso.json").read_text())


def base(kind):
    src_games = [] if kind == "offday" else [{"id": 2026020350}, {"id": 2026020351}]
    db = {
        "at": "2026-11-21T11:15:05Z",
        "pipeline": [{"scope": f"daily_incremental:{RUN_DATE}", "stage": s, "status": "complete"} for s in sorted(summarize.EXPECTED_STAGES)],
        "runs": [{"run_id": RUN_ID, "status": "succeeded", "created_at": "2026-11-21T10:20:00+00:00", "git_sha": "x" * 40,
                  "scope": {"mode": "full_slate"}}],
        "player_rows": {f"{RUN_ID}:{g}": 36 for g in GAMES},
        "nst": [{"run_time": "2026-11-21T10:06:00+00:00", "status": "success", "state": "skipped_no_completed_games",
                 "verifiedOffDates": [SRC_DATE], "missingScheduleDates": [], "planned": 0, "networkAttempts": 0}]
        if kind == "offday" else
        [{"run_time": "2026-11-21T10:06:00+00:00", "status": "success", "state": "attempts_finished_coverage_unverified",
          "verifiedOffDates": [], "missingScheduleDates": [], "planned": 20, "networkAttempts": 20}],
    }
    return {
        "schedule_run": {"gameWeek": [{"date": RUN_DATE, "numberOfGames": len(GAMES), "games": [{"id": g} for g in GAMES]}]},
        "schedule_source": {"gameWeek": [{"date": SRC_DATE, "numberOfGames": len(src_games), "games": src_games}]},
        "db": db, "startchart": copy.deepcopy(STARTCHART), "rso": copy.deepcopy(RSO), "sc_http": 200, "rso_http": 200,
    }


def write(ev, folder):
    files = {"schedule-run.json": ev["schedule_run"], "schedule-source.json": ev["schedule_source"], "db.json": ev["db"],
             "startchart.json": ev["startchart"], "rso.json": ev["rso"]}
    for name, value in files.items():
        (folder / name).write_text(json.dumps(value))
    for name, code in (("sc.headers", ev["sc_http"]), ("rso.headers", ev["rso_http"])):
        (folder / name).write_text(f"HTTP/2 {code} \ncontent-type: application/json\n")


def strict(ev, kind):
    checks, facts = summarize.evaluate(ev, RUN_DATE, SRC_DATE, kind)
    return bool(checks) and all(checks.values()), checks, facts


def legacy(ev):
    with tempfile.TemporaryDirectory() as tmp:
        write(ev, Path(tmp))
        out = subprocess.run([sys.executable, "-I", str(HERE / "legacy_summarize.py"), tmp, RUN_DATE, SRC_DATE],
                             capture_output=True, text=True, check=True)
        return json.loads(out.stdout)["pass"]


class PositiveControls(unittest.TestCase):
    def test_scheduled_nonempty_control_passes(self):
        ok, checks, facts = strict(base("control"), "control")
        self.assertTrue(ok, checks)
        self.assertEqual(facts["runId"], RUN_ID)
        self.assertEqual((facts["writerMissing"], facts["startChartMissing"], facts["dailyRsoMissing"]), ([], [], []))

    def test_scheduled_offday_passes(self):
        ok, checks, _ = strict(base("offday"), "offday")
        self.assertTrue(ok, checks)
        self.assertTrue(checks["nst_verified_off_day"] and checks["nst_zero_requests_explicit"])

    def test_main_writes_acceptance_from_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(base("offday"), Path(tmp))
            code = summarize.main(["summarize.py", tmp, RUN_DATE, SRC_DATE, "offday"])
            result = json.loads((Path(tmp) / "ACCEPTANCE.json").read_text())
        self.assertEqual(code, 0)
        self.assertTrue(result["pass"])
        self.assertTrue(all(result["receiptSha256"].values()))


class ReproducedFalsePasses(unittest.TestCase):
    """Each case passed the legacy checker; the strict checker must reject it."""

    def assertRejected(self, ev, kind, failing):
        self.assertTrue(legacy(ev), "expected the legacy checker to reproduce the false pass")
        ok, checks, _ = strict(ev, kind)
        self.assertFalse(ok)
        self.assertFalse(checks[failing], checks)

    def test_fp1_run_date_missing_from_schedule(self):
        ev = base("control")
        ev["schedule_run"] = {"gameWeek": [{"date": "2026-11-23", "numberOfGames": 1, "games": [{"id": 2026020380}]}]}
        self.assertRejected(ev, "control", "run_schedule_explicit_nonempty")

    def test_fp2_partial_stage_evidence(self):
        ev = base("control")
        ev["db"]["pipeline"] = [{"scope": f"daily_incremental:{RUN_DATE}", "stage": "core_entity_freshness", "status": "complete"}]
        self.assertRejected(ev, "control", "pipeline_stages_complete")

    def test_fp3_selected_games_recovery_instead_of_scheduled_run(self):
        ev = base("control")
        ev["db"]["runs"] = [{"run_id": RUN_ID, "status": "succeeded", "created_at": "2026-11-21T18:13:59+00:00",
                             "scope": {"mode": "selected_games", "requested_game_ids": GAMES}}]
        self.assertRejected(ev, "control", "one_scheduled_full_slate_run")

    def test_fp4_offday_null_request_evidence(self):
        ev = base("offday")
        ev["db"]["nst"][0].update(planned=None, networkAttempts=None)
        self.assertRejected(ev, "offday", "nst_zero_requests_explicit")


class OtherRejections(unittest.TestCase):
    def rejected(self, ev, kind, failing):
        ok, checks, _ = strict(ev, kind)
        self.assertFalse(ok)
        self.assertFalse(checks[failing], checks)

    def test_offday_source_schedule_missing(self):
        ev = base("offday")
        ev["schedule_source"] = {"gameWeek": []}
        self.rejected(ev, "offday", "source_schedule_matches_kind")

    def test_offday_expected_but_source_had_games(self):
        self.rejected(base("control"), "offday", "source_schedule_matches_kind")

    def test_schedule_count_null_or_mismatched(self):
        ev = base("control")
        ev["schedule_run"]["gameWeek"][0]["numberOfGames"] = None
        self.rejected(ev, "control", "run_schedule_explicit_nonempty")
        ev["schedule_run"]["gameWeek"][0]["numberOfGames"] = len(GAMES) + 1
        self.rejected(ev, "control", "run_schedule_explicit_nonempty")

    def test_ambiguous_two_scheduled_runs(self):
        ev = base("control")
        ev["db"]["runs"].append({"run_id": "b" * 36, "status": "succeeded", "created_at": "2026-11-21T10:40:00+00:00",
                                 "scope": {"mode": "full_slate"}})
        self.rejected(ev, "control", "one_scheduled_full_slate_run")

    def test_run_outside_scheduled_window(self):
        ev = base("control")
        ev["db"]["runs"][0]["created_at"] = "2026-11-13T10:41:30+00:00"
        self.rejected(ev, "control", "one_scheduled_full_slate_run")

    def test_failed_stage(self):
        ev = base("control")
        ev["db"]["pipeline"][0]["status"] = "failed"
        self.rejected(ev, "control", "pipeline_stages_complete")

    def test_writer_missing_one_game(self):
        ev = base("control")
        del ev["db"]["player_rows"][f"{RUN_ID}:{GAMES[0]}"]
        self.rejected(ev, "control", "writer_rows_cover_expected")

    def test_daily_rso_rows_from_another_run(self):
        ev = base("control")
        ev["rso"]["bridgeForecasts"]["runs"] = [["forge-daily-bridge-v1:other"] + r[1:] for r in ev["rso"]["bridgeForecasts"]["runs"]]
        self.rejected(ev, "control", "daily_rso_covers_expected_under_run")

    def test_start_chart_selects_other_run(self):
        ev = base("control")
        ev["startchart"]["projectionRunId"] = "other"
        self.rejected(ev, "control", "start_chart_selects_run")

    def test_reader_http_error(self):
        ev = base("control")
        ev["rso_http"] = 500
        self.rejected(ev, "control", "daily_rso_http_200")

    def test_offday_nst_row_outside_window_or_unverified(self):
        ev = base("offday")
        ev["db"]["nst"][0]["run_time"] = "2026-11-21T13:00:00+00:00"
        self.rejected(ev, "offday", "nst_verified_off_day")
        ev = base("offday")
        ev["db"]["nst"][0]["verifiedOffDates"] = []
        self.rejected(ev, "offday", "nst_verified_off_day")

    def test_offday_any_nonzero_request_in_window(self):
        ev = base("offday")
        ev["db"]["nst"].append(dict(ev["db"]["nst"][0], networkAttempts=3, planned=3))
        self.rejected(ev, "offday", "nst_zero_requests_explicit")

    def test_missing_db_receipt(self):
        ev = base("control")
        ev["db"] = None
        self.rejected(ev, "control", "pipeline_stages_complete")


if __name__ == "__main__":
    unittest.main()

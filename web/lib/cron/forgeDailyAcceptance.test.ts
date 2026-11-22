import { describe, expect, it } from "vitest";
import { DAILY_ACCEPTANCE_EXPECTED_STAGES, evaluateDailyAcceptance, scheduleDayGameIds, type DailyAcceptanceEvidence,
  type DailyAcceptanceKind } from "./forgeDailyAcceptance";

const RUN_ID = "ced8d73f-caaf-4d61-afd4-61492817f340", RUN_DATE = "2026-11-21", SRC_DATE = "2026-11-20";
const GAMES = Array.from({ length: 13 }, (_, i) => 2026020360 + i);

function base(kind: DailyAcceptanceKind): DailyAcceptanceEvidence {
  const srcGames = kind === "offday" ? [] : [{ id: 2026020350 }, { id: 2026020351 }];
  return {
    scheduleRun: { gameWeek: [{ date: RUN_DATE, numberOfGames: GAMES.length, games: GAMES.map(id => ({ id })) }] },
    scheduleSource: { gameWeek: [{ date: SRC_DATE, numberOfGames: srcGames.length, games: srcGames }] },
    pipeline: [...DAILY_ACCEPTANCE_EXPECTED_STAGES].map(stage => ({ scope: `daily_incremental:${RUN_DATE}`, stage, status: "complete" })),
    nst: kind === "offday"
      ? [{ run_time: "2026-11-21T10:06:00+00:00", status: "success", state: "skipped_no_completed_games", verifiedOffDates: [SRC_DATE],
        missingScheduleDates: [], planned: 0, networkAttempts: 0 }]
      : [{ run_time: "2026-11-21T10:06:00+00:00", status: "success", state: "attempts_finished_coverage_unverified", verifiedOffDates: [],
        missingScheduleDates: [], planned: 20, networkAttempts: 20 }],
    runs: [{ run_id: RUN_ID, status: "succeeded", created_at: "2026-11-21T10:20:00+00:00", scope: { mode: "full_slate" } }],
    playerRowKeys: GAMES.map(game_id => ({ run_id: RUN_ID, game_id })),
    startChart: { projectionRunId: RUN_ID, players: GAMES.map(game_id => ({ row_key: `${RUN_ID}:${game_id}:8478402:1`, game_id })) },
    dailyRso: { bridgeForecasts: { runs: [[`forge-daily-bridge-v1:${RUN_ID}`, "x"]], rows: GAMES.map(game => ["10028", String(game), 0, "t", {}]) } },
    startChartHttp: 200, dailyRsoHttp: 200,
  };
}
const evaluate = (ev: DailyAcceptanceEvidence, kind: DailyAcceptanceKind) => evaluateDailyAcceptance(ev, RUN_DATE, SRC_DATE, kind);
function rejected(ev: DailyAcceptanceEvidence, kind: DailyAcceptanceKind, failing: string) {
  const result = evaluate(ev, kind);
  expect(result.pass).toBe(false);
  expect(result.checks[failing]).toBe(false);
}

describe("daily FORGE acceptance: positive controls", () => {
  it("passes a scheduled nonempty control", () => {
    const result = evaluate(base("control"), "control");
    expect(result.pass).toBe(true);
    expect(result.facts).toMatchObject({ runId: RUN_ID, writerMissing: [], startChartMissing: [], dailyRsoMissing: [] });
  });
  it("passes a scheduled off-day", () => {
    const result = evaluate(base("offday"), "offday");
    expect(result.pass).toBe(true);
    expect(result.checks).toMatchObject({ nst_verified_off_day: true, nst_zero_requests_explicit: true });
  });
});

describe("daily FORGE acceptance: false passes the first local checker allowed", () => {
  it("rejects a run date missing from the schedule", () => {
    const ev = base("control");
    ev.scheduleRun = { gameWeek: [{ date: "2026-11-23", numberOfGames: 1, games: [{ id: 2026020380 }] }] };
    rejected(ev, "control", "run_schedule_explicit_nonempty");
  });
  it("rejects partial stage evidence", () => {
    const ev = base("control");
    ev.pipeline = [{ scope: `daily_incremental:${RUN_DATE}`, stage: "core_entity_freshness", status: "complete" }];
    rejected(ev, "control", "pipeline_stages_complete");
  });
  it("rejects a selected_games recovery run in place of the scheduled run", () => {
    const ev = base("control");
    ev.runs = [{ run_id: RUN_ID, status: "succeeded", created_at: "2026-11-21T18:13:59+00:00", scope: { mode: "selected_games", requested_game_ids: GAMES } }];
    rejected(ev, "control", "one_scheduled_full_slate_run");
  });
  it("rejects an off-day with null request evidence", () => {
    const ev = base("offday");
    (ev.nst as any[])[0] = { ...(ev.nst as any[])[0], planned: null, networkAttempts: null };
    rejected(ev, "offday", "nst_zero_requests_explicit");
  });
});

describe("daily FORGE acceptance: other rejections", () => {
  it("rejects a missing or game-bearing off-day source schedule", () => {
    const ev = base("offday");
    ev.scheduleSource = { gameWeek: [] };
    rejected(ev, "offday", "source_schedule_matches_kind");
    rejected(base("control"), "offday", "source_schedule_matches_kind");
  });
  it("rejects a null or mismatched schedule count", () => {
    expect(scheduleDayGameIds({ gameWeek: [{ date: RUN_DATE, numberOfGames: null, games: [{ id: 1 }] }] }, RUN_DATE)).toBeNull();
    expect(scheduleDayGameIds({ gameWeek: [{ date: RUN_DATE, numberOfGames: 2, games: [{ id: 1 }] }] }, RUN_DATE)).toBeNull();
    expect(scheduleDayGameIds({ gameWeek: [{ date: RUN_DATE, numberOfGames: 0, games: [] }] }, RUN_DATE)).toEqual([]);
  });
  it("rejects two scheduled runs and a run outside the window", () => {
    const two = base("control");
    (two.runs as any[]).push({ run_id: "b".repeat(36), status: "succeeded", created_at: "2026-11-21T10:40:00+00:00", scope: { mode: "full_slate" } });
    rejected(two, "control", "one_scheduled_full_slate_run");
    const early = base("control");
    (early.runs as any[])[0].created_at = "2026-11-13T10:41:30+00:00";
    rejected(early, "control", "one_scheduled_full_slate_run");
  });
  it("rejects a failed stage, a failed run and a missing writer game", () => {
    const stage = base("control");
    (stage.pipeline as any[])[0].status = "failed";
    rejected(stage, "control", "pipeline_stages_complete");
    const run = base("control");
    (run.runs as any[])[0].status = "failed";
    rejected(run, "control", "scheduled_run_succeeded");
    const writer = base("control");
    writer.playerRowKeys = (writer.playerRowKeys as any[]).slice(1);
    rejected(writer, "control", "writer_rows_cover_expected");
  });
  it("rejects readers that serve another run or fail", () => {
    const rso = base("control");
    (rso.dailyRso as any).bridgeForecasts.runs = [["forge-daily-bridge-v1:other", "x"]];
    rejected(rso, "control", "daily_rso_covers_expected_under_run");
    const sc = base("control");
    (sc.startChart as any).projectionRunId = "other";
    rejected(sc, "control", "start_chart_selects_run");
    const scRows = base("control");
    (scRows.startChart as any).players = GAMES.map(game_id => ({ row_key: `other:${game_id}:1:1`, game_id }));
    rejected(scRows, "control", "start_chart_covers_expected_under_run");
    const http = base("control");
    http.dailyRsoHttp = 500;
    rejected(http, "control", "daily_rso_http_200");
  });
  it("rejects off-day NST evidence outside the window, unverified, or with any request", () => {
    const late = base("offday");
    (late.nst as any[])[0].run_time = "2026-11-21T13:00:00+00:00";
    rejected(late, "offday", "nst_verified_off_day");
    const unverified = base("offday");
    (unverified.nst as any[])[0].verifiedOffDates = [];
    rejected(unverified, "offday", "nst_verified_off_day");
    const extra = base("offday");
    (extra.nst as any[]).push({ ...(extra.nst as any[])[0], planned: 3, networkAttempts: 3 });
    rejected(extra, "offday", "nst_zero_requests_explicit");
  });
  it("rejects missing evidence and an unknown kind", () => {
    const empty = base("control");
    Object.assign(empty, { pipeline: null, runs: null, playerRowKeys: null, startChart: null, dailyRso: null });
    expect(evaluate(empty, "control").pass).toBe(false);
    expect(evaluateDailyAcceptance(base("control"), RUN_DATE, SRC_DATE, "other" as DailyAcceptanceKind).pass).toBe(false);
  });
});

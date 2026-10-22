import { describe, expect, it } from "vitest";

import {
  ROUTE_RUNNER_PROJECTION_ELSEWHERE_WAIT_MS,
  ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS,
  ROUTE_RUNNER_STEP_DEADLINE_MS,
  applyStallGuard,
  buildBypassRequeuePath,
  buildStepQuery,
  buildTimeline,
  checkFreshnessBypass,
  classifyStepResult,
  describeFreshnessBlock,
  estimateEtaMs,
  extractStepProgress,
  formatEventLine,
  mergeJobProgress,
  parseRunnerInput,
  readJobProgress,
  requestsFreshnessBypass
} from "./core";
import { ROUTE_RUNNER_ROUTES } from "./registry";

const NST = ROUTE_RUNNER_ROUTES["/api/v1/db/update-nst-gamelog"];
const ROLLING = ROUTE_RUNNER_ROUTES["/api/v1/db/update-rolling-player-averages"];
const PROJECTION = ROUTE_RUNNER_ROUTES["/api/v1/db/run-projection-v2"];

function projectionPartial(reason: string, completedGames: number | null, date = "2026-10-22") {
  return {
    statusCode: 207,
    body: {
      success: false,
      operationStatus: "partial",
      resume: {
        required: true,
        reason,
        runId: "run-1",
        completedGames,
        totalGames: completedGames == null ? null : 12,
        pendingGames: completedGames == null ? null : 12 - completedGames,
        request: { date, horizonGames: "1" }
      }
    }
  };
}

describe("parseRunnerInput", () => {
  it("accepts an allowlisted path with its query", () => {
    expect(
      parseRunnerInput("/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-01&endDate=2026-03-07")
    ).toEqual({
      ok: true,
      routePath: "/api/v1/db/update-nst-gamelog",
      query: { runMode: "incremental", startDate: "2026-03-01", endDate: "2026-03-07" },
      contract: "nst_resume",
      ignoredParams: []
    });
  });

  it("accepts a pasted fhfhockey.com or localhost URL as its path", () => {
    const parsed = parseRunnerInput(" https://fhfhockey.com/api/v1/db/update-wgo-totals?season=20252026 ");
    expect(parsed).toMatchObject({ ok: true, routePath: "/api/v1/db/update-wgo-totals", query: { season: "20252026" } });
    expect(parseRunnerInput("http://localhost:3000/api/v1/db/update-nst-goalies")).toMatchObject({ ok: true, contract: "next_start_date" });
    expect(parseRunnerInput("https://preview.example/api/v1/db/update-nst-goalies", ["https://preview.example"])).toMatchObject({ ok: true });
  });

  it("rejects other hosts, non-api paths and routes off the allowlist", () => {
    expect(parseRunnerInput("https://evil.example/api/v1/db/update-wgo-totals")).toEqual({
      ok: false,
      error: "Paste a path (/api/...) or a URL from this site."
    });
    expect(parseRunnerInput("/db/runner")).toMatchObject({ ok: false });
    const offList = parseRunnerInput("/api/v1/db/update-teams");
    expect(offList.ok).toBe(false);
    expect(!offList.ok && offList.error).toContain("not on the route runner allowlist");
  });

  it("drops runner-owned params and rejects repeated params", () => {
    expect(
      parseRunnerInput("/api/v1/db/update-rolling-player-averages?startDate=2026-01-01&deadlineAt=1&maxRuntimeMs=5")
    ).toMatchObject({ ok: true, query: { startDate: "2026-01-01" }, ignoredParams: ["deadlineAt", "maxRuntimeMs"] });
    expect(parseRunnerInput("/api/v1/db/update-wgo-totals?season=1&season=2")).toEqual({
      ok: false,
      error: 'Repeated parameter "season" is not supported.'
    });
  });

  it("accepts single-date projection runs only", () => {
    expect(parseRunnerInput("/api/v1/db/run-projection-v2?date=2026-10-22&gameIds=1,2&maxDurationMs=9")).toEqual({
      ok: true,
      routePath: "/api/v1/db/run-projection-v2",
      query: { date: "2026-10-22", gameIds: "1,2" },
      contract: "projection_resume",
      ignoredParams: ["maxDurationMs"]
    });
    const range = parseRunnerInput("/api/v1/db/run-projection-v2?date=2026-10-22&endDate=2026-10-24");
    expect(!range.ok && range.error).toContain("single-date runs only");
    const missing = parseRunnerInput("/api/v1/db/run-projection-v2?gameIds=1");
    expect(!missing.ok && missing.error).toBe("/api/v1/db/run-projection-v2 needs date.");
  });
});

describe("buildStepQuery", () => {
  it("sets the NST deadline inside the tick and leaves other params alone", () => {
    const query = buildStepQuery(NST, { startDate: "2026-03-01", deadlineAt: "1" }, 1_000_000, 1_000_500);
    expect(query).toEqual({
      startDate: "2026-03-01",
      deadlineAt: String(1_000_000 + ROUTE_RUNNER_STEP_DEADLINE_MS - 20_000)
    });
  });

  it("gives the rolling route a claim budget that shrinks with tick time", () => {
    const query = buildStepQuery(ROLLING, { startDate: "2026-01-01", disableRuntimeBudget: "true" }, 0, 10_000);
    expect(query).toEqual({ startDate: "2026-01-01", deadlineAt: "210000", maxRuntimeMs: "170000" });
  });

  it("fits the projection budget inside the step deadline", () => {
    expect(buildStepQuery(PROJECTION, { date: "2026-10-22", maxDurationMs: "999999" }, 0, 5_000)).toEqual({
      date: "2026-10-22",
      maxDurationMs: String(ROUTE_RUNNER_STEP_DEADLINE_MS - 40_000 - 5_000)
    });
  });
});

describe("classifyStepResult", () => {
  const sent = { runMode: "incremental", startDate: "2026-03-01", endDate: "2026-03-07" };
  const continuation = (query: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    statusCode: 207,
    body: {
      success: false,
      operationStatus: "continuation_required",
      resume: { required: true, request: { query } },
      nstProgress: { auditPersistence: "confirmed", continuation: { nextIndex: 40, totalUrls: 400 } },
      ...extra
    }
  });

  it("continues NST with resume.request.query and drops deadlineAt", () => {
    const decision = classifyStepResult(
      "nst_resume",
      continuation({ ...sent, deadlineAt: "123", cursor: "40" }),
      sent,
      ["deadlineAt"]
    );
    expect(decision).toEqual({
      kind: "continue",
      nextQuery: { ...sent, cursor: "40" },
      reason: "NST continuation: cursor 40 of 400."
    });
  });

  it("fails an NST continuation that changes scope, rewinds or is unacknowledged", () => {
    expect(classifyStepResult("nst_resume", continuation({ ...sent, endDate: "2026-04-01", cursor: "40" }), sent, ["deadlineAt"]).kind).toBe("fail");
    expect(classifyStepResult("nst_resume", continuation({ ...sent, cursor: "40" }), { ...sent, cursor: "40" }, ["deadlineAt"]).kind).toBe("fail");
    expect(
      classifyStepResult("nst_resume", continuation({ ...sent, cursor: "40" }, { nstProgress: { auditPersistence: "not_confirmed" } }), sent)
    ).toEqual({ kind: "fail", reason: "NST continuation has no confirmed progress acknowledgement." });
  });

  it("completes NST on 200 success and waits 30 min on 503 source_down", () => {
    expect(classifyStepResult("nst_resume", { statusCode: 200, body: { success: true, operationStatus: "completed" } }, sent).kind).toBe("complete");
    expect(
      classifyStepResult("nst_resume", { statusCode: 503, body: { success: false, operationStatus: "source_down", message: "NST 522" } }, sent)
    ).toEqual({
      kind: "wait",
      delayMs: ROUTE_RUNNER_SOURCE_DOWN_WAIT_MS,
      reason: "Source down (503 source_down); replaying the same query in 30 min: NST 522"
    });
  });

  it("fails other 5xx and success:false without a continuation", () => {
    expect(classifyStepResult("nst_resume", { statusCode: 500, body: { success: false, error: "boom" } }, sent)).toEqual({ kind: "fail", reason: "HTTP 500: boom" });
    expect(classifyStepResult("nst_resume", { statusCode: 200, body: { success: false, operationStatus: "blocked" } }, sent).kind).toBe("fail");
    expect(classifyStepResult("once", { statusCode: 502, body: null }, {}).kind).toBe("fail");
  });

  it("continues rolling with resumeFrom and pins the resolved scope", () => {
    const decision = classifyStepResult(
      "rolling_resume_from",
      {
        statusCode: 207,
        body: {
          success: false,
          operationStatus: "partial",
          resume: {
            required: true,
            nextResumeFrom: 8478402,
            remainingPlayerCount: 120,
            request: { startDate: "2026-01-01", endDate: "2026-01-31", executionProfile: "overnight", resumeFrom: 8478402 }
          }
        }
      },
      { startDate: "2026-01-01", endDate: "2026-01-31", fastMode: "true" },
      ROLLING.runnerParams
    );
    expect(decision).toEqual({
      kind: "continue",
      nextQuery: { startDate: "2026-01-01", endDate: "2026-01-31", fastMode: "true", executionProfile: "overnight", resumeFrom: "8478402" },
      reason: "Rolling: 120 players left; resumeFrom 8478402."
    });
  });

  it("continues a maxPlayers-bounded 200 and completes when no cursor remains", () => {
    expect(
      classifyStepResult("rolling_resume_from", { statusCode: 200, body: { success: true, runSummary: { nextResumeFrom: 8470001 } } }, { maxPlayers: "10" })
    ).toMatchObject({ kind: "continue", nextQuery: { maxPlayers: "10", resumeFrom: "8470001" } });
    expect(
      classifyStepResult("rolling_resume_from", { statusCode: 200, body: { success: true, runSummary: { nextResumeFrom: null } } }, {}).kind
    ).toBe("complete");
    expect(classifyStepResult("rolling_resume_from", { statusCode: 422, body: { success: false, message: "Freshness" } }, {}).kind).toBe("fail");
  });

  it("follows nextStartDate while the route reports unfinished work", () => {
    expect(
      classifyStepResult(
        "next_start_date",
        { statusCode: 200, body: { success: true, complete: false, nextStartDate: "2026-01-05", remainingDatesCount: 30 } },
        { runMode: "forward", startDate: "2026-01-01" }
      )
    ).toEqual({
      kind: "continue",
      nextQuery: { runMode: "forward", startDate: "2026-01-05" },
      reason: "30 date(s) left; next startDate 2026-01-05."
    });
    expect(classifyStepResult("next_start_date", { statusCode: 200, body: { stoppedEarly: true, nextStartDate: null } }, {}).kind).toBe("fail");
    expect(classifyStepResult("next_start_date", { statusCode: 200, body: { success: true, complete: true } }, {}).kind).toBe("complete");
  });

  it("blocks rolling on a 422 freshness gate and keeps the continuation", () => {
    const decision = classifyStepResult(
      "rolling_resume_from",
      {
        statusCode: 422,
        body: {
          success: false,
          operationStatus: "blocked",
          freshnessGate: { status: "FAIL", blockerCount: 2 },
          resume: { required: true, nextResumeFrom: 8478402, request: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: 8478402 } }
        }
      },
      { startDate: "2026-01-01", endDate: "2026-01-31", fastMode: "true" },
      ROLLING.runnerParams
    );
    expect(decision).toMatchObject({
      kind: "fail",
      blockedBy: "freshness",
      blockerCount: 2,
      nextQuery: { startDate: "2026-01-01", endDate: "2026-01-31", fastMode: "true", resumeFrom: "8478402" }
    });
    expect(decision.reason).toContain("Blocked by freshness checks (HTTP 422, 2 blocker(s))");
    // The broad-window 422 is also "blocked" but has no freshness gate: a plain failure.
    expect(
      classifyStepResult("rolling_resume_from", { statusCode: 422, body: { success: false, operationStatus: "blocked", message: "Window too broad" } }, {})
    ).toEqual({ kind: "fail", reason: "HTTP 422: Window too broad" });
  });

  it("replays projection runtime-budget stops, waits when another call holds the run, and fails the rest", () => {
    const sent = { date: "2026-10-22", gameIds: "1,2" };
    expect(classifyStepResult("projection_resume", projectionPartial("runtime_budget", 5), sent)).toEqual({
      kind: "continue",
      nextQuery: sent,
      progressDone: 5,
      reason: "Projection: 5 of 12 games done; stopped at the runtime budget, replaying the same date."
    });
    expect(classifyStepResult("projection_resume", projectionPartial("run_in_progress_elsewhere", null), sent)).toMatchObject({
      kind: "wait",
      delayMs: ROUTE_RUNNER_PROJECTION_ELSEWHERE_WAIT_MS
    });
    expect(ROUTE_RUNNER_PROJECTION_ELSEWHERE_WAIT_MS).toBeGreaterThanOrEqual(150_000);
    expect(
      classifyStepResult("projection_resume", { statusCode: 200, body: { success: true, gamesProcessed: 12, asOfDate: "2026-10-22" } }, sent)
    ).toEqual({ kind: "complete", reason: "Projection: 12 game(s) projected for 2026-10-22." });
    expect(classifyStepResult("projection_resume", projectionPartial("runtime_budget", 5, "2026-10-21"), sent).kind).toBe("fail");
    expect(classifyStepResult("projection_resume", projectionPartial("other", 5), sent).kind).toBe("fail");
    expect(classifyStepResult("projection_resume", { statusCode: 200, body: { success: false, error: "Timed out" } }, sent)).toEqual({
      kind: "fail",
      reason: "HTTP 200: Timed out"
    });
    expect(classifyStepResult("projection_resume", { statusCode: 422, body: { success: false, error: "Preflight blocked" } }, sent)).toEqual({
      kind: "fail",
      reason: "HTTP 422: Preflight blocked"
    });
    expect(classifyStepResult("projection_resume", { statusCode: 207, body: { success: false } }, sent).kind).toBe("fail");
  });

  it("runs once routes once", () => {
    expect(classifyStepResult("once", { statusCode: 200, body: { success: true, message: "Done" } }, {})).toEqual({ kind: "complete", reason: "HTTP 200: Done" });
    expect(classifyStepResult("once", { statusCode: 207, body: { success: false } }, {}).kind).toBe("fail");
    expect(classifyStepResult("once", { statusCode: 401, body: { message: "Unauthorized." } }, {}).kind).toBe("fail");
  });
});

describe("applyStallGuard", () => {
  const same = { kind: "continue" as const, nextQuery: { a: "1" }, reason: "r" };
  it("counts identical continuations and fails at three", () => {
    expect(applyStallGuard(same, { a: "1" }, 0)).toMatchObject({ stalls: 1, decision: { kind: "continue" } });
    expect(applyStallGuard(same, { a: "1" }, 2)).toMatchObject({ stalls: 3, decision: { kind: "fail" } });
    expect(applyStallGuard(same, { a: "0" }, 2)).toEqual({ decision: same, stalls: 0 });
  });

  it("measures same-query replays by progressDone and keeps the count across waits", () => {
    const replay = (done: number) => ({ ...same, progressDone: done });
    expect(applyStallGuard(replay(5), { a: "1" }, 2, 3)).toEqual({ decision: replay(5), stalls: 0 });
    expect(applyStallGuard(replay(5), { a: "1" }, 0, null)).toMatchObject({ stalls: 0 });
    expect(applyStallGuard(replay(5), { a: "1" }, 1, 5)).toMatchObject({ stalls: 2, decision: { kind: "continue" } });
    expect(applyStallGuard(replay(5), { a: "1" }, 2, 5)).toMatchObject({
      stalls: 3,
      decision: { kind: "fail", reason: "No progress: completed games stayed at 5 for 3 steps in a row." }
    });
    const wait = { kind: "wait" as const, delayMs: 1, reason: "w" };
    expect(applyStallGuard(wait, { a: "1" }, 2, 5)).toEqual({ decision: wait, stalls: 2 });
  });
});

describe("progress", () => {
  it("reads the NST cursor and persisted sources", () => {
    expect(
      extractStepProgress({
        operationStatus: "continuation_required",
        nstProgress: { continuation: { nextIndex: 40, totalUrls: 400 }, sourceOutcomes: { counts: { rows_persisted: 38 } } }
      })
    ).toMatchObject({ rows: 38, rowsUnit: "sources", done: 40, total: 400, unit: "urls", cursor: "cursor 40", operationStatus: "continuation_required" });
  });

  it("reads rolling rows and remaining players, folding them into job progress", () => {
    const first = extractStepProgress({ runSummary: { rowsUpserted: 900, remainingPlayerCount: 850, totalPlayersAfterResumeFilter: 900, nextResumeFrom: 8470001 } });
    expect(first).toMatchObject({ rows: 900, remaining: 850, scopeTotal: 900, unit: "players", cursor: "resumeFrom 8470001" });
    const afterFirst = mergeJobProgress(null, first, 0);
    expect(afterFirst).toMatchObject({ done: 50, total: 900 });
    const second = extractStepProgress({ runSummary: { rowsUpserted: 10, remainingPlayerCount: 800, totalPlayersAfterResumeFilter: 850 } });
    expect(mergeJobProgress(afterFirst, second, 0)).toMatchObject({ done: 100, total: 900 });
  });

  it("reads projection completed games", () => {
    expect(extractStepProgress(projectionPartial("runtime_budget", 5).body)).toMatchObject({ done: 5, total: 12, unit: "games", operationStatus: "partial" });
  });

  it("re-queues only freshness-blocked failed jobs, with the bypass and resumeFrom", () => {
    const job = {
      route_path: "/api/v1/db/update-rolling-player-averages",
      status: "failed",
      next_query: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: "8478402" },
      progress: { blockedBy: "freshness" }
    };
    expect(buildBypassRequeuePath(job)).toBe(
      "/api/v1/db/update-rolling-player-averages?startDate=2026-01-01&endDate=2026-01-31&resumeFrom=8478402&bypassFreshnessBlockers=true"
    );
    expect(buildBypassRequeuePath({ ...job, progress: {} })).toBeNull();
    expect(buildBypassRequeuePath({ ...job, status: "queued" })).toBeNull();
  });

  describe("freshness bypass approval", () => {
    const source = {
      id: "00000000-0000-4000-8000-000000000001",
      route_path: "/api/v1/db/update-rolling-player-averages",
      status: "failed",
      next_query: { startDate: "2026-01-01", endDate: "2026-01-31", resumeFrom: "8478402" },
      progress: { blockedBy: "freshness", blockerCount: 2 },
      last_error: "Blocked by freshness checks (HTTP 422, 2 blocker(s))."
    };
    const requeue = parseRunnerInput(buildBypassRequeuePath(source)!);
    if (!requeue.ok) throw new Error("re-queue path must parse");
    const base = {
      routePath: requeue.routePath,
      query: requeue.query,
      request: { sourceJobId: source.id, blockerCount: 2, confirmed: true },
      sourceJob: source,
      approverId: "admin-1",
      nowIso: "2026-10-22T12:00:00.000Z"
    };

    it("reads the bypass flag and the blocker count shown in the confirmation", () => {
      expect(requestsFreshnessBypass({ bypassFreshnessBlockers: "true" })).toBe(true);
      expect(requestsFreshnessBypass({ bypassFreshnessBlockers: "1" })).toBe(true);
      expect(requestsFreshnessBypass({ bypassFreshnessBlockers: "false" })).toBe(false);
      expect(requestsFreshnessBypass({})).toBe(false);
      expect(describeFreshnessBlock(source)).toEqual({ blockerCount: 2, reason: source.last_error });
      // Jobs blocked before the count was stored fall back to the reason text.
      expect(describeFreshnessBlock({ ...source, progress: { blockedBy: "freshness" } })!.blockerCount).toBe(2);
      expect(describeFreshnessBlock({ ...source, status: "completed" })).toBeNull();
    });

    it("records who approved what, and only for the blocked job's own re-queue", () => {
      expect(checkFreshnessBypass(base)).toEqual({
        ok: true,
        approval: { approvedBy: "admin-1", approvedAt: "2026-10-22T12:00:00.000Z", sourceJobId: source.id, blockerCount: 2, reason: source.last_error }
      });
      expect(checkFreshnessBypass({ ...base, query: { startDate: "2026-01-01" } })).toEqual({ ok: true, approval: null });
    });

    it("never treats the bypass flag alone as approval", () => {
      expect(checkFreshnessBypass({ ...base, approverId: null })).toMatchObject({ ok: false, status: 403 });
      expect(checkFreshnessBypass({ ...base, request: undefined })).toMatchObject({ ok: false, status: 400 });
      expect(checkFreshnessBypass({ ...base, request: { ...base.request, confirmed: "yes" } })).toMatchObject({ ok: false, status: 400 });
      expect(checkFreshnessBypass({ ...base, request: { ...base.request, blockerCount: 1 } })).toMatchObject({ ok: false, status: 409 });
      expect(checkFreshnessBypass({ ...base, sourceJob: { ...source, status: "completed" } })).toMatchObject({ ok: false, status: 409 });
      expect(checkFreshnessBypass({ ...base, query: { ...base.query, endDate: "2026-02-28" } })).toMatchObject({ ok: false, status: 409 });
    });

    it("keeps an approved bypass on the job's progress across steps", () => {
      const approval = checkFreshnessBypass(base);
      if (!approval.ok || !approval.approval) throw new Error("expected an approval");
      const start = readJobProgress({ freshnessBypass: approval.approval });
      const merged = mergeJobProgress(start, extractStepProgress({ runSummary: { rowsUpserted: 5 } }), 0);
      expect(merged.freshnessBypass).toEqual(approval.approval);
    });
  });

  it("reads team-daily dataset rows and generic row counts", () => {
    expect(
      extractStepProgress({ remainingDatesCount: 3, summary: { totalDates: 5, datasetResults: [{ inserted: 32 }, { inserted: 32 }] }, nextStartDate: "2026-01-05" })
    ).toMatchObject({ rows: 64, remaining: 3, scopeTotal: 5, unit: "dates", cursor: "startDate 2026-01-05" });
    expect(extractStepProgress({ totalUpdates: 12 }).rows).toBe(12);
    expect(extractStepProgress({ rowsAffected: -1 }).rows).toBeNull();
  });

  it("builds a timeline, an ETA and terminal lines", () => {
    const events = [
      { id: 1, at: "2026-10-22T10:00:00Z", level: "info", message: "Queued", step: null, status_code: null, rows: null, progress: null, duration_ms: null },
      { id: 2, at: "2026-10-22T10:04:00Z", level: "info", message: "NST continuation: cursor 40 of 400.", step: 1, status_code: 207, rows: 38, progress: { done: 40, total: 400, unit: "urls", rowsTotal: 38, rowsUnit: "sources", operationStatus: "continuation_required" }, duration_ms: 200_000 },
      { id: 3, at: "2026-10-22T10:08:00Z", level: "info", message: "NST continuation: cursor 80 of 400.", step: 2, status_code: 207, rows: 40, progress: { done: 80, total: 400, unit: "urls", rowsTotal: 78 }, duration_ms: 199_000 }
    ];
    const timeline = buildTimeline(events);
    expect(timeline.map((point) => point.rowsTotal)).toEqual([38, 78]);
    expect(estimateEtaMs(timeline)).toBe(32 * 60_000);
    expect(formatEventLine(events[1])).toBe(
      "10:04:00  step 1  HTTP 207  continuation_required  +38 sources  40/400 urls  200.0s  NST continuation: cursor 40 of 400."
    );
  });
});

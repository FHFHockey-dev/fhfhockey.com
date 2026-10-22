/**
 * Route runner allowlist. Only these routes can be queued on /db/runner.
 *
 * Metadata only, safe to import from the browser page. The route handlers are
 * imported statically by pages/api/v1/db/route-runner-tick.ts, whose handler
 * map must cover every path here (checked at compile time).
 *
 * Contracts (how a step's answer becomes the next step):
 * - nst_resume: update-nst-gamelog answers 207 operationStatus
 *   "continuation_required" with resume.request.query (the exact next query);
 *   503 operationStatus "source_down" means NST is down: wait and replay.
 * - rolling_resume_from: update-rolling-player-averages reports
 *   resume.nextResumeFrom / runSummary.nextResumeFrom; the next call passes
 *   resumeFrom=<n>, with the scope pinned from resume.request.
 * - next_start_date: the route reports unfinished work (complete=false or
 *   stoppedEarly=true) and nextStartDate; the next call passes startDate.
 * - projection_resume: run-projection-v2 for one date. 200 success completes;
 *   207 operationStatus "partial" with resume.reason "runtime_budget" replays
 *   the same query (the route resumes its running run); "run_in_progress_
 *   elsewhere" waits 150 s (the route's takeover grace) and replays.
 *   Progress is resume.completedGames, so replays are not stalls while it rises.
 * - once: one call; 2xx without success=false completes.
 *
 * The contract lives here, not on the job row: route_runner_jobs.contract
 * only accepts the first four values, so newer contracts are stored as null
 * (store.ts) and the tick always reads spec.contract.
 */

export type RouteRunnerContract =
  | "nst_resume"
  | "rolling_resume_from"
  | "next_start_date"
  | "projection_resume"
  | "once";

export type RouteRunnerRouteSpec = {
  label: string;
  contract: RouteRunnerContract;
  /** Absolute epoch-ms deadline query param the route honours. */
  deadlineParam?: string;
  /** How long before the step deadline the route's own deadline falls. */
  deadlineHeadroomMs?: number;
  /** Relative claim-budget query param (ms after the route starts). */
  maxRuntimeParam?: string;
  /** Claim budget counted from the tick start. */
  maxRuntimeMs?: number;
  /**
   * Relative runtime-budget query param (ms after the route starts), set so
   * the route stops by the step deadline minus deadlineHeadroomMs.
   */
  budgetParam?: string;
  /** Params a queued run must carry. */
  requiredParams?: readonly string[];
  /** Params a queued run must not carry, with the reason shown. */
  rejectedParams?: { keys: readonly string[]; reason: string };
  /**
   * Params the runner owns. They are dropped from a pasted query and from
   * every continuation, and the runtime ones are set fresh on each step.
   */
  runnerParams?: readonly string[];
  example: string;
  notes: string;
};

export const ROUTE_RUNNER_ROUTES = {
  "/api/v1/db/update-nst-gamelog": {
    label: "NST skater gamelogs",
    contract: "nst_resume",
    deadlineParam: "deadlineAt",
    deadlineHeadroomMs: 20_000,
    runnerParams: ["deadlineAt"],
    example:
      "/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-01&endDate=2026-03-07&overwrite=yes",
    notes:
      "Explicit date scopes (startDate/endDate or dates) continue through 207 resume.request.query with a fresh deadlineAt each step. 503 source_down waits 30 min and replays. Pin endDate so the scope stays the same across days. runMode=reverse has no cursor and runs one step. NST pacing is enforced by the route's shared admission."
  },
  "/api/v1/db/update-rolling-player-averages": {
    label: "Rolling player averages",
    contract: "rolling_resume_from",
    deadlineParam: "deadlineAt",
    deadlineHeadroomMs: 10_000,
    maxRuntimeParam: "maxRuntimeMs",
    maxRuntimeMs: 180_000,
    runnerParams: [
      "deadlineAt",
      "maxRuntimeMs",
      "disableRuntimeBudget",
      "continueDailyWindow"
    ],
    example:
      "/api/v1/db/update-rolling-player-averages?startDate=2025-10-07&endDate=2026-04-16&fastMode=true&executionProfile=overnight",
    notes:
      "Each step stops claiming players at maxRuntimeMs and abandons in-flight ones at deadlineAt (both set by the runner), then continues with resumeFrom=nextResumeFrom. Use explicit startDate/endDate; windows over 15 days also need executionProfile=overnight, confirmBroadRun=true or maxPlayers. Freshness blockers answer 422 unless bypassFreshnessBlockers=true."
  },
  "/api/v1/db/run-projection-v2": {
    label: "FORGE projections (one date)",
    contract: "projection_resume",
    budgetParam: "maxDurationMs",
    // The route checks its budget between games, then writes its receipts;
    // 40 s covers the game in flight and the response.
    deadlineHeadroomMs: 40_000,
    runnerParams: ["maxDurationMs"],
    requiredParams: ["date"],
    rejectedParams: {
      keys: ["startDate", "endDate"],
      reason:
        "run-projection-v2 resumes single-date runs only: use date=YYYY-MM-DD instead of startDate/endDate, one job per date."
    },
    example: "/api/v1/db/run-projection-v2?date=2026-10-22",
    notes:
      "One date per job. Each step gets maxDurationMs to fit the step (set by the runner); a 207 runtime_budget replays the same date and the route continues its run. 207 run_in_progress_elsewhere waits 150 s and replays. Progress is completed games; three steps without a newly completed game stop the job."
  },
  "/api/v1/db/update-nst-team-daily": {
    label: "NST team daily",
    contract: "next_start_date",
    example:
      "/api/v1/db/update-nst-team-daily?runMode=forward&startDate=2025-10-07&endDate=2026-04-16&overwrite=false",
    notes:
      "Stops at its own 220 s budget and answers complete=false with nextStartDate; the runner continues with startDate=nextStartDate. Failed dates are retried first; three identical steps in a row stop the job."
  },
  "/api/v1/db/update-nst-goalies": {
    label: "NST goalies",
    contract: "next_start_date",
    example:
      "/api/v1/db/update-nst-goalies?runMode=incremental&startDate=2025-10-07&overwrite=no",
    notes:
      "Processes a bounded chunk of URLs and answers stoppedEarly=true with nextStartDate; the runner continues with startDate=nextStartDate. With overwrite=yes a chunk smaller than one date (10 URLs) cannot advance; three identical steps in a row stop the job."
  },
  "/api/v1/db/update-nst-current-season": {
    label: "NST current season",
    contract: "once",
    example: "/api/v1/db/update-nst-current-season",
    notes: "No continuation contract: runs once."
  },
  "/api/v1/db/update-wgo-skaters": {
    label: "WGO skaters",
    contract: "once",
    example: "/api/v1/db/update-wgo-skaters?action=all",
    notes:
      "No continuation contract or runtime bound: runs once. A step still running at about 228 s is stopped and retried, up to 3 times. Keep the scope small (a date, startDate/endDate or one season)."
  },
  "/api/v1/db/update-wgo-goalies": {
    label: "WGO goalies",
    contract: "once",
    example:
      "/api/v1/db/update-wgo-goalies?runMode=forward&startDate=2026-01-15&overwrite=true",
    notes:
      "No continuation contract or runtime bound: runs once. A step still running at about 228 s is stopped and retried, up to 3 times."
  },
  "/api/v1/db/update-wgo-totals": {
    label: "WGO skater totals",
    contract: "once",
    example: "/api/v1/db/update-wgo-totals?season=20252026",
    notes:
      "No continuation contract or runtime bound: runs once. season=all is a multi-season run and may not fit one step."
  }
} as const satisfies Record<string, RouteRunnerRouteSpec>;

// route_runner_jobs.contract has a check constraint listing these four
// (migration 20261022133743). Newer contracts are stored as null; the tick
// and the page read the contract from the registry by route_path.
const STORED_CONTRACTS: readonly RouteRunnerContract[] = [
  "nst_resume",
  "rolling_resume_from",
  "next_start_date",
  "once"
];

export function storedContract(contract: RouteRunnerContract): RouteRunnerContract | null {
  return STORED_CONTRACTS.includes(contract) ? contract : null;
}

export type RouteRunnerPath = keyof typeof ROUTE_RUNNER_ROUTES;

export const ROUTE_RUNNER_PATHS = Object.keys(
  ROUTE_RUNNER_ROUTES
) as RouteRunnerPath[];

export function getRouteRunnerSpec(
  path: string
): RouteRunnerRouteSpec | null {
  return Object.prototype.hasOwnProperty.call(ROUTE_RUNNER_ROUTES, path)
    ? ROUTE_RUNNER_ROUTES[path as RouteRunnerPath]
    : null;
}

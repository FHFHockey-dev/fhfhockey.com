/**
 * Query options the /db/runner URL builder offers for each allowlisted route,
 * read from each handler's own parsing. Metadata only, safe for the browser.
 *
 * Left out on purpose: params the runner owns (registry runnerParams, plus
 * the NST cursor it carries in continuations), rolling fullRefresh /
 * fullRefreshMode (table truncation) and autoResume*, NST requestIntervalMs
 * (pacing), and the WGO debug or all-seasons modes that cannot fit one step.
 * A pasted URL may still carry any param; the builder just has no control
 * for it.
 */
import type { RouteRunnerPath } from "./registry";

export type RunnerOptionKind =
  | "choice" // segmented rail of short values; unset = route default
  | "select" // dropdown for longer lists; unset = route default
  | "multi" // several values joined with commas
  | "flag" // checkbox that writes flagValue
  | "date"
  | "text"
  | "number";

export type RunnerOptionGroup = "mode" | "scope" | "advanced";

export type RunnerOption = {
  key: string;
  label: string;
  kind: RunnerOptionKind;
  group: RunnerOptionGroup;
  values?: readonly string[];
  flagValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  help?: string;
};

const NST_SKATER_DATASET_GROUPS = [
  "allStrengths",
  "fiveOnFive",
  "powerPlay",
  "evenStrength",
  "penaltyKill",
  "rankingFreshnessSkaterSources"
] as const;

const NST_SKATER_DATASET_TYPES = [
  "allStrengths",
  "fiveOnFive",
  "powerPlay",
  "evenStrength",
  "penaltyKill"
].flatMap((strength) =>
  ["Counts", "Rates", "CountsOi", "RatesOi"].map((kind) => `${strength}${kind}`)
);

const NST_GOALIE_DATASET_TYPES = [
  "5v5Counts",
  "5v5Rates",
  "evCounts",
  "evRates",
  "allCounts",
  "allRates",
  "ppCounts",
  "ppRates",
  "pkCounts",
  "pkRates"
] as const;

const startDate = (help: string): RunnerOption => ({
  key: "startDate",
  label: "Start date",
  kind: "date",
  group: "scope",
  help
});

const endDate = (help: string): RunnerOption => ({
  key: "endDate",
  label: "End date",
  kind: "date",
  group: "scope",
  help
});

const season = (help: string, key = "season"): RunnerOption => ({
  key,
  label: "Season",
  kind: "text",
  group: "scope",
  placeholder: "20262027",
  help
});

const nstRunMode: RunnerOption = {
  key: "runMode",
  label: "Run mode",
  kind: "choice",
  group: "mode",
  values: ["incremental", "forward", "reverse"]
};

export const ROUTE_RUNNER_OPTIONS = {
  "/api/v1/db/update-nst-gamelog": [
    {
      ...nstRunMode,
      help: "incremental with dates is the resumable backfill. forward refreshes the whole current season (ignores startDate). reverse walks back from startDate in one step."
    },
    {
      key: "overwrite",
      label: "Overwrite",
      kind: "choice",
      group: "mode",
      values: ["yes", "no"],
      help: "Default: no for incremental, yes for forward/reverse. Both refetch and upsert."
    },
    startDate("First date of the scope (YYYY-MM-DD)."),
    endDate("Pin it so the scope, and its saved progress, stay the same across days."),
    {
      key: "dates",
      label: "Exact dates",
      kind: "text",
      group: "scope",
      placeholder: "2026-01-12,2026-04-12",
      help: "Comma-separated dates for surgical gap fills, instead of a range."
    },
    season("Pins the NST season id; defaults to the date's season.", "seasonId"),
    {
      key: "datasetGroup",
      label: "Dataset group",
      kind: "select",
      group: "scope",
      values: NST_SKATER_DATASET_GROUPS,
      help: "One strength family (four tables)."
    },
    {
      key: "datasetType",
      label: "Dataset table",
      kind: "select",
      group: "scope",
      values: NST_SKATER_DATASET_TYPES,
      help: "One table only."
    },
    {
      key: "allowHistoricalDatedRequests",
      label: "Allow historical dates",
      kind: "flag",
      group: "advanced",
      flagValue: "yes",
      help: "Needed for dated requests outside the current season."
    },
    {
      key: "maxRequests",
      label: "Max NST requests per step",
      kind: "number",
      group: "advanced",
      min: 1,
      max: 40,
      help: "1–40, default 40. Shared admission still enforces the NST windows."
    }
  ],
  "/api/v1/db/update-rolling-player-averages": [
    {
      key: "executionProfile",
      label: "Profile",
      kind: "choice",
      group: "mode",
      values: ["daily_incremental", "overnight", "targeted_repair"],
      help: "Windows over 15 days need overnight, Confirm broad run, or Max players."
    },
    {
      key: "strength",
      label: "Strengths",
      kind: "multi",
      group: "mode",
      values: ["all", "5v5", "ev", "pp", "pk"],
      help: "Default: every strength."
    },
    {
      key: "fastMode",
      label: "Fast mode",
      kind: "flag",
      group: "mode",
      flagValue: "true",
      help: "4 players and 4 upserts at a time, diagnostics off."
    },
    startDate("First game date to recompute."),
    endDate("Last game date to recompute."),
    season("Limits games to one season."),
    {
      key: "playerId",
      label: "Player id",
      kind: "number",
      group: "scope",
      placeholder: "8478402",
      help: "One player only."
    },
    {
      key: "resumeFrom",
      label: "Start from player id",
      kind: "number",
      group: "scope",
      help: "Skips players up to and including this id. The runner advances it each step."
    },
    {
      key: "maxPlayers",
      label: "Max players",
      kind: "number",
      group: "scope",
      min: 1,
      help: "Caps players per step; also satisfies the broad-window guard."
    },
    {
      key: "confirmBroadRun",
      label: "Confirm broad run",
      kind: "flag",
      group: "advanced",
      flagValue: "true",
      help: "Deliberately allows a window over 15 days without a player bound."
    },
    {
      key: "bypassFreshnessBlockers",
      label: "Bypass freshness blockers",
      kind: "flag",
      group: "advanced",
      flagValue: "true",
      help: "Without it, stale upstream sources answer 422."
    },
    {
      key: "skipDiagnostics",
      label: "Skip diagnostics",
      kind: "flag",
      group: "advanced",
      flagValue: "true"
    },
    {
      key: "dryRunUpsert",
      label: "Dry run (no writes)",
      kind: "flag",
      group: "advanced",
      flagValue: "true"
    },
    {
      key: "playerConcurrency",
      label: "Player concurrency",
      kind: "number",
      group: "advanced",
      min: 1
    },
    {
      key: "upsertBatchSize",
      label: "Upsert batch size",
      kind: "number",
      group: "advanced",
      min: 1
    },
    {
      key: "upsertConcurrency",
      label: "Upsert concurrency",
      kind: "number",
      group: "advanced",
      min: 1
    }
  ],
  "/api/v1/db/update-nst-team-daily": [
    {
      ...nstRunMode,
      help: "incremental resumes after the latest complete date. forward walks start to end; reverse walks start back to end."
    },
    {
      key: "overwrite",
      label: "Overwrite",
      kind: "choice",
      group: "mode",
      values: ["true", "false"],
      help: "Default: false for incremental, true for forward/reverse. false fetches only missing datasets."
    },
    startDate("Reverse mode starts here and walks back."),
    endDate("Reverse mode walks back to here.")
  ],
  "/api/v1/db/update-nst-goalies": [
    {
      ...nstRunMode,
      help: "incremental and forward walk to today; reverse walks back through past seasons from startDate."
    },
    {
      key: "overwrite",
      label: "Overwrite",
      kind: "choice",
      group: "mode",
      values: ["yes", "no"],
      help: "Default: no for incremental (skips complete dates), yes for forward/reverse."
    },
    startDate("Incremental fetches from here to today; reverse starts here."),
    {
      key: "datasetType",
      label: "Dataset table",
      kind: "select",
      group: "scope",
      values: NST_GOALIE_DATASET_TYPES
    },
    {
      key: "maxUrls",
      label: "Max URLs per step",
      kind: "number",
      group: "advanced",
      min: 1,
      help: "A date is 10 URLs; with overwrite, fewer than 10 cannot advance."
    },
    {
      key: "maxDays",
      label: "Max days",
      kind: "number",
      group: "advanced",
      min: 1
    }
  ],
  "/api/v1/db/update-nst-current-season": [],
  "/api/v1/db/update-wgo-skaters": [
    {
      key: "action",
      label: "Action",
      kind: "choice",
      group: "mode",
      values: ["all", "season"],
      help: "all: current season from the latest stored date. season: rebuild one season (needs Season). Unset with a Date: that one date."
    },
    {
      key: "fullRefresh",
      label: "Full refresh",
      kind: "flag",
      group: "mode",
      flagValue: "true",
      help: "With all: refetch the current season from its start. Unlikely to fit one step."
    },
    {
      key: "date",
      label: "Date",
      kind: "date",
      group: "scope",
      help: "One date, without an action."
    },
    season("With action=season."),
    startDate("With all or season: overrides the automatic start."),
    endDate("With season: last date of the range.")
  ],
  "/api/v1/db/update-wgo-goalies": [
    {
      key: "runMode",
      label: "Run mode",
      kind: "choice",
      group: "mode",
      values: ["incremental", "forward", "reverse", "single"],
      help: "forward, reverse and single need a start date. Don't combine with Action or Date."
    },
    {
      key: "overwrite",
      label: "Overwrite",
      kind: "choice",
      group: "mode",
      values: ["true", "false"],
      help: "Default: false for incremental, true for forward/reverse."
    },
    startDate("Where the run mode starts."),
    {
      key: "action",
      label: "Action",
      kind: "choice",
      group: "mode",
      values: ["all", "fullRefresh"],
      help: "all: from the latest stored date. fullRefresh: every season, or one with Season."
    },
    season("Only with action=fullRefresh."),
    {
      key: "date",
      label: "Date",
      kind: "date",
      group: "scope",
      help: "One date, without a run mode or action."
    }
  ],
  "/api/v1/db/update-wgo-totals": [
    season("A season id, or all for every season (may not fit one step).")
  ]
} as const satisfies Record<RouteRunnerPath, readonly RunnerOption[]>;

export function getRunnerOptions(path: string): readonly RunnerOption[] {
  return Object.prototype.hasOwnProperty.call(ROUTE_RUNNER_OPTIONS, path)
    ? ROUTE_RUNNER_OPTIONS[path as RouteRunnerPath]
    : [];
}

/** The path and params of a pasted path or URL; null when it cannot parse. */
export function splitRunnerUrl(
  input: string
): { path: string; params: URLSearchParams } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, "https://same-origin.invalid");
    return { path: url.pathname.replace(/\/+$/, ""), params: url.searchParams };
  } catch {
    return null;
  }
}

export function joinRunnerUrl(path: string, params: URLSearchParams): string {
  // Commas are legal in a query value and easier to read than %2C.
  const query = params.toString().replace(/%2C/gi, ",");
  return query ? `${path}?${query}` : path;
}

/** The input with one param set, or removed when value is null or blank. */
export function withRunnerParam(
  input: string,
  key: string,
  value: string | null
): string {
  const parts = splitRunnerUrl(input);
  if (!parts) return input;
  if (value == null || value.trim() === "") parts.params.delete(key);
  else parts.params.set(key, value.trim());
  return joinRunnerUrl(parts.path, parts.params);
}

/** Switch to another route, keeping only params that route also offers. */
export function switchRunnerRoute(input: string, nextPath: string): string {
  const parts = splitRunnerUrl(input);
  const offered = new Set(getRunnerOptions(nextPath).map((option) => option.key));
  const kept = new URLSearchParams();
  for (const [key, value] of parts?.params ?? []) {
    if (offered.has(key)) kept.set(key, value);
  }
  return joinRunnerUrl(nextPath, kept);
}

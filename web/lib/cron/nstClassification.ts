export type NstTouchLevel =
  | "direct_remote_nst_fetch"
  | "indirect_nst_derived"
  | "nst_touch_unknown"
  | "no_nst_touch_observed";

const DIRECT_REMOTE_NST_JOBS = new Set([
  "update-nst-gamelog",
  "update-nst-tables-all",
  "update-nst-goalies",
  "update-nst-current-season",
  "update-nst-team-daily",
  "update-nst-team-daily-incremental",
  "update-nst-team-stats-all"
]);

const INDIRECT_NST_DERIVED_JOBS = new Set([
  "update-rolling-player-averages",
  "daily-refresh-player-unified-matview",
  "update-expected-goals",
  "update-wigo-table-stats",
  "daily-refresh-goalie-unified-matview",
  "update-team-ctpi-daily",
  "update-team-power-ratings",
  "update-team-power-ratings-new",
  "refresh-team-power-ratings-daily",
  "update-wgo-averages",
  "rebuild-sustainability-baselines",
  "daily-refresh-player-totals-unified-matview",
  "rebuild-sustainability-priors",
  "rebuild-sustainability-window-z",
  "rebuild-sustainability-score",
  "update-predictions-sko",
  "rebuild-sustainability-trend-bands",
  "run-projection-accuracy"
]);

const NST_UNKNOWN_JOBS = new Set(["update-shift-charts"]);

export function getNstTouchLevel(jobName: string): NstTouchLevel {
  if (DIRECT_REMOTE_NST_JOBS.has(jobName)) {
    return "direct_remote_nst_fetch";
  }

  if (INDIRECT_NST_DERIVED_JOBS.has(jobName)) {
    return "indirect_nst_derived";
  }

  if (NST_UNKNOWN_JOBS.has(jobName)) {
    return "nst_touch_unknown";
  }

  return "no_nst_touch_observed";
}

export function isDirectNstJob(jobName: string): boolean {
  return getNstTouchLevel(jobName) === "direct_remote_nst_fetch";
}

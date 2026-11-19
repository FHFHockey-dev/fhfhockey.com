import { forgeEnvScoped, PREGAME_PUBLICATION_METRIC } from "./forgeScopeProbe";

// Projection runs made off the release path (a localhost dev server) carry a
// null or `local:` git_sha. They stay private: readers drop them before any
// limit, so one can never displace or stand in for a released run.

export const LOCAL_UNKNOWN_GIT_SHA = "local:unknown";

type NotFilterable = { not(column: string, operator: string, value: unknown): unknown; is?(column: string, value: null): unknown };

/** Adds the off-release exclusion to a forge_runs query (or an embedded forge_runs column). Outside a game-scoped FORGE
 * request it also drops pregame publications (forgeScopeProbe.ts), so a one-game run never displaces the daily run. */
export function excludeOffReleaseRuns<Q extends NotFilterable>(query: Q, column = "git_sha"): Q {
  const released = (query.not(column, "is", null) as Q).not(column, "like", "local:*") as Q;
  if (forgeEnvScoped() || column !== "git_sha") return released;
  if (typeof released.is !== "function") throw new Error("forge_runs query cannot exclude pregame publications");
  return released.is(PREGAME_PUBLICATION_METRIC, null) as Q;
}

export function isOffReleaseGitSha(gitSha: string | null | undefined): boolean {
  return gitSha == null || gitSha.startsWith("local:");
}

// A run projects one horizon (metrics.horizon_games; the daily h5 cron run
// shares dates with the h1 runs). Readers pick the latest run of their horizon
// before any limit, so an h5 run can never hide the h1 rows. Runs without the
// stamp fall back to their resume scope key (`h1:full`), or count as h1.
type OrFilterable = { or(filters: string): unknown };

export function runHorizonFilter(horizonGames = 1): string {
  const scopeKey = "metrics->resume->>scope_key";
  return `metrics->>horizon_games.eq.${horizonGames},and(metrics->>horizon_games.is.null,`
    + `or(${scopeKey}.is.null,${scopeKey}.like."h${horizonGames}:*"))`;
}

/** Keeps only forge_runs of one horizon (default h1) in a query. */
export function restrictRunsToHorizon<Q extends OrFilterable>(query: Q, horizonGames = 1): Q {
  return query.or(runHorizonFilter(horizonGames)) as Q;
}

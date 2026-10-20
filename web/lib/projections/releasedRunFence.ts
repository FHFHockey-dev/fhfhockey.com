// Projection runs made off the release path (a localhost dev server) carry a
// null or `local:` git_sha. They stay private: readers drop them before any
// limit, so one can never displace or stand in for a released run.

export const LOCAL_UNKNOWN_GIT_SHA = "local:unknown";

type NotFilterable = { not(column: string, operator: string, value: unknown): unknown };

/** Adds the off-release exclusion to a forge_runs query (or an embedded forge_runs column). */
export function excludeOffReleaseRuns<Q extends NotFilterable>(query: Q, column = "git_sha"): Q {
  return (query.not(column, "is", null) as Q).not(column, "like", "local:*") as Q;
}

export function isOffReleaseGitSha(gitSha: string | null | undefined): boolean {
  return gitSha == null || gitSha.startsWith("local:");
}

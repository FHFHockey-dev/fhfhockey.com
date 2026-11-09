import { teamsInfo } from "lib/teamsInfo";

/**
 * Dates per coverage request. Without a (team, date) index every listed date
 * reads the whole league's rows for that day (~450 skater rows), so a
 * season-long IN list ran past the 3 s statement timeout. Small sequential
 * chunks keep each statement bounded.
 */
export const COVERAGE_DATE_CHUNK = 8;
// A team has well under 40 skater rows on one date.
const MAX_TEAM_ROWS_PER_DATE = 40;

type CoverageQueryResult = PromiseLike<{
  data: Array<{ date: string | null }> | null;
  error: { message?: string } | null;
}>;

export type CoverageClient = {
  from: (table: string) => any;
};

/**
 * Dates (from `dates`) on which `table` has at least one row for the team.
 * Returns null when coverage is unknown (no abbreviation or a failed read);
 * the first failure stops further reads.
 */
export async function fetchTeamBoxScoreDates(
  client: CoverageClient,
  table: string,
  teamColumn: string,
  teamAbbrev: string | undefined,
  dates: string[]
): Promise<Set<string> | null> {
  if (!teamAbbrev) return null;
  const uniqueDates = Array.from(new Set(dates)).sort();
  const covered = new Set<string>();
  for (let i = 0; i < uniqueDates.length; i += COVERAGE_DATE_CHUNK) {
    const chunk = uniqueDates.slice(i, i + COVERAGE_DATE_CHUNK);
    const { data, error } = await (client
      .from(table)
      .select("date")
      .eq(teamColumn, teamAbbrev)
      .in("date", chunk)
      .limit(chunk.length * MAX_TEAM_ROWS_PER_DATE) as CoverageQueryResult);
    if (error) return null;
    for (const row of data ?? []) {
      if (row.date) covered.add(String(row.date).slice(0, 10));
    }
  }
  return covered;
}

/**
 * Team whose schedule defines the player's missed games in a season. The
 * current team applies when the season log is empty or includes it; a season
 * spent with exactly one other team uses that team; otherwise null (unknown).
 */
export function resolveSeasonTeamId(
  currentTeamId: number | null | undefined,
  currentTeamAbbrev: string | undefined,
  seasonLogTeamAbbrevs: Iterable<string | null | undefined>
): number | null {
  const abbrevs = new Set(
    Array.from(seasonLogTeamAbbrevs).filter(
      (abbrev): abbrev is string => typeof abbrev === "string" && abbrev !== ""
    )
  );
  if (abbrevs.size === 0 || (currentTeamAbbrev && abbrevs.has(currentTeamAbbrev))) {
    return currentTeamId ?? null;
  }
  if (abbrevs.size !== 1) return null;
  const [abbrev] = Array.from(abbrevs);
  return (teamsInfo as Record<string, { id: number }>)[abbrev]?.id ?? null;
}

import { computeTeamPowerScore } from "lib/dashboard/teamContext";

export type OpponentStrengthBand = "strong" | "average" | "weak";

export type TeamPowerRatingRow = {
  date: string;
  team_abbreviation: string;
  off_rating: number | null;
  def_rating: number | null;
  pace_rating: number | null;
  pp_tier: number | null;
  pk_tier: number | null;
  trend10: number | null;
};

const MIN_LEAGUE_SNAPSHOT_TEAMS = 30;

export function buildDatedOpponentStrengthIndex(
  rows: readonly TeamPowerRatingRow[]
): Map<string, OpponentStrengthBand> {
  const rowsByDate = new Map<string, TeamPowerRatingRow[]>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const bucket = rowsByDate.get(date) ?? [];
    bucket.push(row);
    rowsByDate.set(date, bucket);
  }

  const result = new Map<string, OpponentStrengthBand>();
  for (const [date, snapshotRows] of rowsByDate) {
    const scored = snapshotRows
      .map((row) => ({
        abbreviation: row.team_abbreviation.trim().toUpperCase(),
        score: computeTeamPowerScore({
          offRating: row.off_rating,
          defRating: row.def_rating,
          paceRating: row.pace_rating,
          ppTier: row.pp_tier,
          pkTier: row.pk_tier,
          trend10: row.trend10
        })
      }))
      .filter((row) => row.abbreviation)
      .sort((left, right) => right.score - left.score || left.abbreviation.localeCompare(right.abbreviation));
    if (scored.length < MIN_LEAGUE_SNAPSHOT_TEAMS) continue;
    const tierSize = Math.ceil(scored.length / 3);
    scored.forEach((row, index) => {
      const band = index < tierSize ? "strong" : index >= scored.length - tierSize ? "weak" : "average";
      result.set(`${date}:${row.abbreviation}`, band);
    });
  }
  return result;
}

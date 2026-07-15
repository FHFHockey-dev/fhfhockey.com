export type RosterPlayerRow = {
  playerId: number;
  teamId: number;
};

export type PlayerImpactRatingInput = {
  player_id: number;
  team_id: number | null;
  snapshot_date: string;
  rating_raw: number;
  sample_toi_seconds: number | null;
  components?: Record<string, number | null> | null;
};

export type RosterImpactFeatures = {
  version: "player_impact_ratings_v1_toi_weighted";
  source: "projected_lineup" | "current_roster" | "unavailable";
  sourceDate: string | null;
  playerCount: number;
  offenseCoverage: number;
  defenseCoverage: number;
  goalieCoverage: number;
  skaterOffenseImpact: number | null;
  skaterDefenseImpact: number | null;
  goalieImpact: number | null;
  skaterOffensePer60OnlyImpact: number | null;
  skaterDefensePer60OnlyImpact: number | null;
  goaliePer60OnlyImpact: number | null;
  specialTeamsContext: number | null;
  fallbackDerived: boolean;
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestByPlayer(
  rows: PlayerImpactRatingInput[],
  sourceAsOfDate: string,
): Map<number, PlayerImpactRatingInput> {
  const latest = new Map<number, PlayerImpactRatingInput>();
  for (const row of rows) {
    if (row.snapshot_date >= sourceAsOfDate) continue;
    const existing = latest.get(row.player_id);
    if (!existing || row.snapshot_date > existing.snapshot_date) {
      latest.set(row.player_id, row);
    }
  }
  return latest;
}

function weightedImpact(
  playerIds: number[],
  rows: Map<number, PlayerImpactRatingInput>,
  ratingForRow: (row: PlayerImpactRatingInput) => number | null = (row) =>
    finite(row.rating_raw),
): { value: number | null; covered: number; sourceDate: string | null } {
  let numerator = 0;
  let denominator = 0;
  let covered = 0;
  let sourceDate: string | null = null;
  for (const playerId of playerIds) {
    const row = rows.get(playerId);
    if (!row) continue;
    const rating = ratingForRow(row);
    if (rating == null) continue;
    const weight = Math.max(1, finite(row.sample_toi_seconds) ?? 1);
    numerator += rating * weight;
    denominator += weight;
    covered += 1;
    if (!sourceDate || row.snapshot_date > sourceDate) sourceDate = row.snapshot_date;
  }
  return {
    value: denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null,
    covered,
    sourceDate,
  };
}

function per60OnlyRating(row: PlayerImpactRatingInput): number | null {
  const rating = finite(row.rating_raw);
  const shrinkage = finite(row.components?.shrinkage);
  if (rating == null || shrinkage == null || shrinkage <= 0) return null;
  return rating / shrinkage;
}

export function buildRosterImpactFeatures(args: {
  teamId: number;
  sourceAsOfDate: string;
  projectedSkaterIds: number[];
  currentRosterRows: RosterPlayerRow[];
  offenseRows: PlayerImpactRatingInput[];
  defenseRows: PlayerImpactRatingInput[];
  goalieRows: PlayerImpactRatingInput[];
  specialTeamsContext: number | null;
}): RosterImpactFeatures {
  const projectedIds = Array.from(
    new Set(args.projectedSkaterIds.filter((id) => Number.isFinite(id))),
  );
  const rosterIds = Array.from(
    new Set(
      args.currentRosterRows
        .filter((row) => row.teamId === args.teamId)
        .map((row) => row.playerId)
        .filter((id) => Number.isFinite(id)),
    ),
  );
  const playerIds = projectedIds.length > 0 ? projectedIds : rosterIds;
  const source = projectedIds.length > 0
    ? "projected_lineup"
    : rosterIds.length > 0
      ? "current_roster"
      : "unavailable";
  const offense = weightedImpact(
    playerIds,
    latestByPlayer(args.offenseRows, args.sourceAsOfDate),
  );
  const defense = weightedImpact(
    playerIds,
    latestByPlayer(args.defenseRows, args.sourceAsOfDate),
  );
  const goalie = weightedImpact(
    rosterIds,
    latestByPlayer(args.goalieRows, args.sourceAsOfDate),
  );
  const offensePer60Only = weightedImpact(
    playerIds,
    latestByPlayer(args.offenseRows, args.sourceAsOfDate),
    per60OnlyRating,
  );
  const defensePer60Only = weightedImpact(
    playerIds,
    latestByPlayer(args.defenseRows, args.sourceAsOfDate),
    per60OnlyRating,
  );
  const goaliePer60Only = weightedImpact(
    rosterIds,
    latestByPlayer(args.goalieRows, args.sourceAsOfDate),
    per60OnlyRating,
  );
  const denominator = Math.max(1, playerIds.length);
  return {
    version: "player_impact_ratings_v1_toi_weighted",
    source,
    sourceDate: [offense.sourceDate, defense.sourceDate, goalie.sourceDate]
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null,
    playerCount: playerIds.length,
    offenseCoverage: Number((offense.covered / denominator).toFixed(4)),
    defenseCoverage: Number((defense.covered / denominator).toFixed(4)),
    goalieCoverage: goalie.covered,
    skaterOffenseImpact: offense.value,
    skaterDefenseImpact: defense.value,
    goalieImpact: goalie.value,
    skaterOffensePer60OnlyImpact: offensePer60Only.value,
    skaterDefensePer60OnlyImpact: defensePer60Only.value,
    goaliePer60OnlyImpact: goaliePer60Only.value,
    specialTeamsContext: finite(args.specialTeamsContext),
    fallbackDerived: source !== "projected_lineup",
  };
}

export type SosStandingRow = {
  season_id: number;
  game_date: string;
  team_id: number;
  team_name: string | null;
  team_abbrev: string | null;
  past_opponent_total_wins: number | null;
  past_opponent_total_losses: number | null;
  past_opponent_total_ot_losses: number | null;
  future_opponent_total_wins: number | null;
  future_opponent_total_losses: number | null;
  future_opponent_total_ot_losses: number | null;
};

export type SosRating = {
  team: string;
  teamId: number;
  date: string;
  past: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  future: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  combinedWinPct: number;
  sosScore: number; // 0-100 scale: combinedWinPct * 100
};

export type CanonicalSosTeam = {
  id: number;
  name: string;
  abbreviation: string;
};

export type CanonicalSosRanking = {
  teamId: number;
  team: string;
  abbreviation: string;
  sos: number;
};

export type CanonicalSosRankings = {
  past: CanonicalSosRanking[];
  future: CanonicalSosRanking[];
};

const pct = (wins: number, losses: number, otl: number): number => {
  const total = wins + losses + otl;
  if (total <= 0) return 0;
  // Use straight win percentage so the league-wide mean sits at ~0.500.
  // Counting OT losses as half-wins inflates the average because every OT game
  // adds an extra half-win but no extra game.
  return wins / total;
};

export function computeSosRatings(rows: SosStandingRow[]): SosRating[] {
  // Take the latest row per team_abbrev
  const latestByTeam = new Map<string, SosStandingRow>();

  rows.forEach((row) => {
    const team = row.team_abbrev ?? String(row.team_id);
    const existing = latestByTeam.get(team);
    if (!existing || row.game_date > existing.game_date) {
      latestByTeam.set(team, row);
    }
  });

  const ratings: SosRating[] = [];
  latestByTeam.forEach((row, team) => {
    const pastWins = row.past_opponent_total_wins ?? 0;
    const pastLosses = row.past_opponent_total_losses ?? 0;
    const pastOtl = row.past_opponent_total_ot_losses ?? 0;
    const futureWins = row.future_opponent_total_wins ?? 0;
    const futureLosses = row.future_opponent_total_losses ?? 0;
    const futureOtl = row.future_opponent_total_ot_losses ?? 0;

    const pastPct = pct(pastWins, pastLosses, pastOtl);
    const futurePct = pct(futureWins, futureLosses, futureOtl);
    const pastGames = pastWins + pastLosses + pastOtl;
    const futureGames = futureWins + futureLosses + futureOtl;
    const combinedWinPct =
      pastGames + futureGames > 0
        ? (pastPct * pastGames + futurePct * futureGames) /
          (pastGames + futureGames)
        : (pastPct + futurePct) / 2;

    ratings.push({
      team,
      teamId: row.team_id,
      date: row.game_date,
      past: {
        wins: pastWins,
        losses: pastLosses,
        otl: pastOtl,
        winPct: pastPct,
      },
      future: {
        wins: futureWins,
        losses: futureLosses,
        otl: futureOtl,
        winPct: futurePct,
      },
      combinedWinPct,
      sosScore: Number((combinedWinPct * 100).toFixed(2)),
    });
  });

  return ratings.sort((a, b) => b.sosScore - a.sosScore);
}

export function buildCanonicalSosRankings(
  rows: SosStandingRow[],
  teams: CanonicalSosTeam[],
): CanonicalSosRankings {
  const currentTeamsById = new Map(teams.map((team) => [team.id, team]));
  const currentRows = rows.filter((row) => currentTeamsById.has(row.team_id));
  const latestValidByTeamId = new Map<number, SosStandingRow>();

  for (const row of currentRows) {
    const pastTotal =
      (row.past_opponent_total_wins ?? 0) +
      (row.past_opponent_total_losses ?? 0) +
      (row.past_opponent_total_ot_losses ?? 0);
    const futureTotal =
      (row.future_opponent_total_wins ?? 0) +
      (row.future_opponent_total_losses ?? 0) +
      (row.future_opponent_total_ot_losses ?? 0);
    if (pastTotal === 0 && futureTotal === 0) continue;

    const existing = latestValidByTeamId.get(row.team_id);
    if (!existing || row.game_date > existing.game_date) {
      latestValidByTeamId.set(row.team_id, row);
    }
  }

  const past: CanonicalSosRanking[] = [];
  const future: CanonicalSosRanking[] = [];

  for (const [teamId, row] of latestValidByTeamId) {
    const team = currentTeamsById.get(teamId);
    if (!team) continue;

    const pastWins = row.past_opponent_total_wins ?? 0;
    const pastLosses = row.past_opponent_total_losses ?? 0;
    const pastOtl = row.past_opponent_total_ot_losses ?? 0;
    const futureWins = row.future_opponent_total_wins ?? 0;
    const futureLosses = row.future_opponent_total_losses ?? 0;
    const futureOtl = row.future_opponent_total_ot_losses ?? 0;

    past.push({
      teamId,
      team: team.name,
      abbreviation: team.abbreviation,
      sos: Number(pct(pastWins, pastLosses, pastOtl).toFixed(3)),
    });
    future.push({
      teamId,
      team: team.name,
      abbreviation: team.abbreviation,
      sos: Number(pct(futureWins, futureLosses, futureOtl).toFixed(3)),
    });
  }

  past.sort((a, b) => b.sos - a.sos);
  future.sort((a, b) => b.sos - a.sos);
  return { past, future };
}

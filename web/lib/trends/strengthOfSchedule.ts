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
        winPct: pastPct
      },
      future: {
        wins: futureWins,
        losses: futureLosses,
        otl: futureOtl,
        winPct: futurePct
      },
      combinedWinPct,
      sosScore: Number((combinedWinPct * 100).toFixed(2))
    });
  });

  return ratings.sort((a, b) => b.sosScore - a.sosScore);
}

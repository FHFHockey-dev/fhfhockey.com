import type { ShareTeam, SocialShareSnapshot } from "./types";

export type MondayGridGame = { id: number; opponent: ShareTeam; home: boolean; counted: boolean };
export type MondayGridCell = { date: string; selected: boolean; offNight: boolean; games: MondayGridGame[] };
export type MondayGridRow = {
  team: ShareTeam;
  /** Null for an untrusted edition (it never publishes order) and for teams with no remaining games (no score). */
  rank: number | null;
  score: number;
  remainingGames: number;
  offNightGames: number;
  cells: MondayGridCell[];
};

/** Same opportunity rule as selectScheduleDates: selected, scheduled, regular, known future start. */
export function countsAsOpportunity(snapshot: SocialShareSnapshot, game: SocialShareSnapshot["games"][number]) {
  return game.gameType === 2 && game.status === "scheduled" && game.startTimeUtc !== null &&
    snapshot.selectedDates.includes(game.date) && Date.parse(game.startTimeUtc) > Date.parse(snapshot.generatedAt);
}

/**
 * One row per team in Game Grid weekScore order (trusted) or alphabetical order (untrusted),
 * with one cell per Monday-Sunday date. Postponed, cancelled and nonregular games are omitted;
 * elapsed, live, unknown and unselected games stay visible but do not count.
 */
export function mondayGridRows(snapshot: SocialShareSnapshot, trusted: boolean): MondayGridRow[] {
  const rows = trusted ? snapshot.rows : [...snapshot.rows].sort((a, b) => a.team.abbreviation.localeCompare(b.team.abbreviation) || a.team.id - b.team.id);
  return rows.map(row => ({
    team: row.team,
    rank: trusted && row.remainingGames > 0 ? row.rank : null,
    score: row.score,
    remainingGames: row.remainingGames,
    offNightGames: row.offNightGames,
    cells: snapshot.days.map(day => ({
      date: day.date,
      selected: day.selected,
      offNight: day.offNight,
      games: row.games
        .filter(game => game.date === day.date && game.gameType === 2 && !["postponed", "cancelled"].includes(game.status))
        .sort((a, b) => (a.startTimeUtc ?? "").localeCompare(b.startTimeUtc ?? "") || a.id - b.id)
        .map(game => {
          const home = game.homeTeam.id === row.team.id;
          return { id: game.id, opponent: home ? game.awayTeam : game.homeTeam, home, counted: countsAsOpportunity(snapshot, game) };
        }),
    })),
  }));
}

/**
 * Count colouring for a GP or off-nights column (TJ, ticket 12). Distinct values, highest first:
 * highest = green ("high"), second-highest = white ("second"), lowest = red ("low"), anything in
 * between = yellow ("between"). Two distinct values: green and red. One value: neutral (white), never
 * red. Ties share their tier. Each column is ranked on its own.
 */
export type CountTier = "high" | "second" | "between" | "low" | "neutral";
export function countTiers(values: readonly number[]): Map<number, CountTier> {
  const distinct = [...new Set(values)].sort((a, b) => b - a);
  return new Map(distinct.map((value, index): [number, CountTier] => [value,
    distinct.length === 1 ? "neutral" : index === 0 ? "high" : index === distinct.length - 1 ? "low" : index === 1 ? "second" : "between"]));
}

/** GP and off-night tiers over every team row in the edition (its selected dates). */
export function editionCountTiers(snapshot: SocialShareSnapshot) {
  return { gp: countTiers(snapshot.rows.map(row => row.remainingGames)), off: countTiers(snapshot.rows.map(row => row.offNightGames)) };
}

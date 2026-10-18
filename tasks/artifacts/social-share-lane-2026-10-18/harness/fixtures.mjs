// SYNTHETIC schedule fixtures for local preview mechanics only.
// Matchups, start times and states are invented. They are not NHL data,
// not a captured edition and not current recommendations.

export const WEEK_START = "2026-10-19"; // Monday
export const SEASON = 20262027;
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Fixed rotation order (abbreviation, id). Long names lead so they appear in
// the top three and exercise wrapping: Columbus Blue Jackets, Vegas Golden Knights.
const TEAMS = [
  ["CBJ", 29], ["VGK", 54], ["TOR", 10], ["WSH", 15], ["UTA", 68], ["SJS", 28], ["NJD", 1], ["NYI", 2],
  ["NYR", 3], ["PHI", 4], ["PIT", 5], ["BOS", 6], ["BUF", 7], ["MTL", 8], ["OTT", 9], ["CAR", 12],
  ["FLA", 13], ["TBL", 14], ["CHI", 16], ["DET", 17], ["NSH", 18], ["STL", 19], ["CGY", 20], ["COL", 21],
  ["EDM", 22], ["VAN", 23], ["ANA", 24], ["DAL", 25], ["LAK", 26], ["MIN", 30], ["WPG", 52], ["SEA", 55],
];
// Games per day. Off-nights (<= 8 league games): Mon, Wed, Fri, Sun.
const PER_DAY = [4, 11, 5, 12, 4, 13, 6];

function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Start times in UTC. October 2026 is EDT (UTC-4): 19:00 ET = 23:00Z; late games roll into the next UTC day. */
function startUtc(date, slot) {
  if (slot % 4 === 3) return `${addDays(date, 1)}T02:30:00Z`; // 22:30 ET, next UTC calendar day
  if (slot % 4 === 2) return `${addDays(date, 1)}T02:00:00Z`; // 22:00 ET
  return `${date}T23:00:00Z`; // 19:00 ET
}

export function syntheticGames() {
  const games = [];
  const load = new Map(TEAMS.map(([abbr]) => [abbr, 0]));
  let id = 2026020101;
  PER_DAY.forEach((count, dayIndex) => {
    const date = addDays(WEEK_START, dayIndex);
    // Greedy minimum load (ties by fixed order) keeps every team at 3-4 games.
    const playing = TEAMS.map((team, index) => ({ team, index })).sort((a, b) => load.get(a.team[0]) - load.get(b.team[0]) || a.index - b.index).slice(0, count * 2)
      // Day-specific permutation so opponents vary through the week.
      .sort((a, b) => (a.index * (2 * dayIndex + 3)) % 37 - (b.index * (2 * dayIndex + 3)) % 37);
    for (let slot = 0; slot < count; slot++) {
      const [awayAbbr, awayId] = playing[slot * 2].team, [homeAbbr, homeId] = playing[slot * 2 + 1].team;
      load.set(awayAbbr, load.get(awayAbbr) + 1); load.set(homeAbbr, load.get(homeAbbr) + 1);
      games.push({ id: id++, season: SEASON, gameType: 2, gameDate: date, startTimeUTC: startUtc(date, slot), gameState: "FUT", gameScheduleState: "OK",
        homeTeam: { id: homeId, abbrev: homeAbbr }, awayTeam: { id: awayId, abbrev: awayAbbr } });
    }
  });
  return games;
}

/** Applies "as of" game states: games that started before `asOf` are final. */
export function withStates(games, asOf) {
  return games.map(game => Date.parse(game.startTimeUTC) <= Date.parse(asOf) ? { ...game, gameState: "OFF" } : game);
}

/** October reader shape: team/day indexed copies, daily counts, coverage and FHFH retrieval time. No provider update time. */
export function octoberIndexedSchedule(games, retrievedAt) {
  const data = {};
  for (const game of games) {
    const day = DAYS[(Date.parse(`${game.gameDate}T00:00:00Z`) - Date.parse(`${WEEK_START}T00:00:00Z`)) / 86400000];
    for (const team of [game.homeTeam, game.awayTeam]) (data[team.id] ??= {})[day] = game;
  }
  const coveredDates = DAYS.map((_, i) => addDays(WEEK_START, i));
  const numGamesPerDay = coveredDates.map(date => games.filter(game => game.gameDate === date).length);
  return { data, numGamesPerDay, coveredDates, retrievedAt };
}

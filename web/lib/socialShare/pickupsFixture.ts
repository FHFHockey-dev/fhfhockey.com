import type { Database } from "lib/supabase/database-generated.types";
import { activeTeamAbbreviations } from "lib/teamsInfo";

/**
 * Fixture contract for the Monday pickups card. It mirrors a read-only `yahoo_players` select;
 * nothing here reads Supabase. The live read path is not connected (see players.ts).
 *
 * Rules the card must follow when built (taken from existing readers, not invented):
 * - Ownership: the latest valid `ownership_timeline` point ({ date: YYYY-MM-DD, value: 0–100 }),
 *   else `percent_ownership`; values outside 0–100 or non-numeric are unknown
 *   (pages/api/v1/transactions/ownership-snapshots.ts `resolveOwnership`).
 * - Positions: `eligible_positions` is an array of { position } objects
 *   (lib/rosterScheduleOptimizer/yahooEligibilityCache.ts). F = C/LW/RW, D = D, G = G; a
 *   dual-eligible player goes in the group of its primary (first-listed) position.
 * - Team: `editorial_team_abbreviation` uses Yahoo aliases (LA, NJ, SJ, TB, WAS, MON) that map
 *   to NHL abbreviations (lib/integrations/yahoo/planningConfirmations.ts).
 * - Bands: rostered 30–49%, 20–29% and under 20% (TJ, CLAUDE-20261024-010 and SS1-4-O1),
 *   each player in one band, top 3 per F/D/G, from the top Week Score teams only. Ownership older
 *   than yesterday or totals older than 72 h drop that player.
 */
export type YahooPlayerRow = Database["public"]["Tables"]["yahoo_players"]["Row"];
export const PICKUP_OWNERSHIP_COLUMNS = [
  "player_key", "player_id", "player_name", "editorial_team_abbreviation", "display_position",
  "eligible_positions", "position_type", "percent_ownership", "ownership_timeline", "status", "season", "last_updated",
] as const satisfies readonly (keyof YahooPlayerRow)[];
export type PickupOwnershipRow = Pick<YahooPlayerRow, typeof PICKUP_OWNERSHIP_COLUMNS[number]>;
export const PICKUP_TIERS = [50, 30, 20] as const;
export const PICKUP_YAHOO_TEAM_ALIASES: Record<string, string> = { LA: "LAK", NJ: "NJD", SJ: "SJS", TB: "TBL", WAS: "WSH", MON: "MTL" };

const FIXTURE_POSITIONS = [["C"], ["LW", "RW"], ["RW"], ["D"], ["D"], ["G"]] as const;

/**
 * Fictional players ("Fixture Player N") on real team aliases, with ownership spread across all
 * three tiers. Invented values only: never presented as Yahoo data.
 */
export function fictionalPickupRows(season: number, observedOn: string, teams: readonly string[] = ["NJ", "TB", "BOS", "LA", "SEA", "UTA"]): PickupOwnershipRow[] {
  return teams.flatMap((team, teamIndex) => FIXTURE_POSITIONS.map((positions, index) => {
    const id = 90000 + teamIndex * 10 + index, ownership = [64, 44, 27, 18, 9, 3][(teamIndex + index) % 6];
    return {
      player_key: `465.p.${id}`, player_id: String(id), player_name: `Fixture Player ${id}`,
      editorial_team_abbreviation: team, display_position: positions.join(","),
      eligible_positions: positions.map(position => ({ position })), position_type: positions[0] === "G" ? "G" : "P",
      percent_ownership: ownership, ownership_timeline: [{ date: observedOn, value: ownership }],
      status: null, season, last_updated: `${observedOn}T09:00:00Z`,
    };
  }));
}

const NHL_TO_YAHOO = Object.fromEntries(Object.entries(PICKUP_YAHOO_TEAM_ALIASES).map(([yahoo, nhl]) => [nhl, yahoo]));
const ROSTER = [["C"], ["C", "LW"], ["LW"], ["RW"], ["RW", "C"], ["D"], ["D"], ["D"], ["G"], ["G"]] as const;

/**
 * Deterministic fictional sources for every active team, shaped like the real read-only rows:
 * yahoo_players (ownership), yahoo_nhl_player_map_read (Yahoo key → NHL id) and the WGO
 * skater/goalie season totals. Names are "Fixture TEAM-n"; every value is invented.
 */
export function fictionalPlayerSources(season: number, observedOn: string, statsUpdatedAt: string, seed = 4242) {
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 15), 2246822519) + 0x7f4a7c15 >>> 0) / 4294967296);
  const yahooSeason = Math.floor(season / 10000), round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
  const yahoo: PickupOwnershipRow[] = [], map: { yahoo_player_id: string | null; nhl_player_id: string | null }[] = [];
  const skaters: { player_id: number; player_name: string | null; season: string; games_played: number | null; points_per_game: number | null; goals: number | null; shots: number | null; hits: number | null; blocked_shots: number | null; current_team_abbreviation: string | null; updated_at: string | null }[] = [];
  const goalies: { goalie_id: number; goalie_name: string | null; season_id: number; games_played: number | null; games_started: number | null; quality_starts_pct: number | null; save_pct: number | null; current_team_abbreviation: string | null; updated_at: string | null }[] = [];
  [...activeTeamAbbreviations].forEach((abbrev, teamIndex) => {
    const team = String(abbrev);
    ROSTER.forEach((positions, index) => {
      const yahooId = 80000 + teamIndex * 20 + index, nhlId = 8470000 + teamIndex * 20 + index, name = `Fixture ${team}-${index + 1}`;
      const ownership = Math.round(2 + random() * 70), goalie = positions[0] === "G";
      // A few invented statuses exercise the playable-status rule.
      const status = (teamIndex + index) % 23 === 0 ? "IR" : (teamIndex + index) % 17 === 0 ? "DTD" : null;
      yahoo.push({
        player_key: `465.p.${yahooId}`, player_id: String(yahooId), player_name: name,
        editorial_team_abbreviation: NHL_TO_YAHOO[team] ?? team, display_position: positions.join(","),
        eligible_positions: positions.map(position => ({ position })), position_type: goalie ? "G" : "P",
        percent_ownership: ownership, ownership_timeline: [{ date: observedOn, value: ownership }],
        status, season: yahooSeason, last_updated: `${observedOn}T09:00:00Z`,
      });
      map.push({ yahoo_player_id: `465.p.${yahooId}`, nhl_player_id: String(nhlId) });
      if (goalie) {
        const starter = index === 8;
        // Some backups stay under the minimum-starts rule.
        const backupStarts = teamIndex % 3 === 0 ? 2 : 3;
        goalies.push({ goalie_id: nhlId, goalie_name: name, season_id: season, games_played: starter ? 8 : backupStarts, games_started: starter ? 8 : backupStarts,
          quality_starts_pct: round(0.3 + random() * 0.4, 3), save_pct: round(0.88 + random() * 0.045, 3), current_team_abbreviation: team, updated_at: statsUpdatedAt });
      } else {
        const defense = positions[0] === "D", games = 6 + Math.floor(random() * 6);
        // Same random() order as before ticket 22; goals derive from points without drawing (fixture values stay put).
        const ppg = round((defense ? 0.15 : 0.25) + random() * (defense ? 0.6 : 0.9)), shots = Math.round(games * (1 + random() * 3));
        const hits = Math.round(games * (0.3 + random() * (defense ? 2.5 : 3.2))), blocked = Math.round(games * (defense ? 0.8 + random() * 2.2 : 0.1 + random() * 0.8));
        skaters.push({ player_id: nhlId, player_name: name, season: String(season), games_played: games, points_per_game: ppg, goals: Math.round(games * ppg * (defense ? 0.25 : 0.45)), shots,
          hits, blocked_shots: blocked, current_team_abbreviation: team, updated_at: statsUpdatedAt });
      }
    });
  });
  return { yahoo, map, skaters, goalies };
}

/**
 * Deterministic fictional last-five-games rows for the given players, shaped like
 * rolling_player_game_metrics (skaters) and wgo_goalie_stats (goalies). Every value is invented.
 */
export function fictionalPlayerRecent(players: { nhlId: number; group: "F" | "D" | "G" }[], season: number, today: string) {
  const day = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86400000).toISOString().slice(0, 10);
  const rolling: Record<string, unknown>[] = [], goalieGames: Record<string, unknown>[] = [];
  for (const player of players) {
    const seed = player.nhlId % 97;
    if (player.group === "G") {
      for (let game = 0; game < 5; game++) {
        const shots = 24 + ((seed + game * 7) % 12), goals = (seed + game) % 4;
        goalieGames.push({ goalie_id: player.nhlId, date: day(1 + game * 2), season_id: season, games_played: 1, wins: goals <= 2 ? 1 : 0, saves: shots - goals, shots_against: shots, goals_against: goals, quality_start: goals <= 2 ? 1 : 0, shutouts: goals === 0 ? 1 : 0 });
      }
    } else {
      const goals = seed % 4, assists = (seed * 3) % 5, points = goals + assists;
      // Six consecutive game rows (SS1-18 streaks): the L5 points spread over the five latest games, cumulative
      // season points on each row, and fictional TOI / PP TOI totals around the season averages.
      const perGame = [0, 0, 0, 0, 0];
      for (let point = 0; point < points; point++) perGame[(seed + point * 2) % 5]++;
      const toiL5 = player.group === "D" ? 1200 + seed * 4 : 900 + seed * 5, ppSeason = 40 + (seed % 5) * 30, ppL5 = Math.round(ppSeason * (0.5 + (seed % 8) * 0.17));
      const cumulative = 20 + seed % 7, split = (total: number) => ({ goals_total_all: Math.floor(total / 2), assists_total_all: total - Math.floor(total / 2) });
      for (let game = 5; game >= 1; game--) rolling.push({ player_id: player.nhlId, season, game_date: day(1 + game * 2), strength_state: "all", season_games_played: 10 - game,
        ...split(cumulative - perGame.slice(0, game).reduce((sum, value) => sum + value, 0)) });
      rolling.push({ player_id: player.nhlId, season, game_date: day(1), strength_state: "all", season_games_played: 10, goals_total_last5: goals, assists_total_last5: assists, points_total_last5: points,
        ...split(cumulative), toi_seconds_total_last5: toiL5 * 5, pp_toi_seconds_total_last5: ppL5 * 5, pp_toi_seconds_avg_season: ppSeason,
        shots_total_last5: 6 + (seed % 12), hits_avg_last5: Math.round((0.4 + (seed % 9) * 0.45) * 10) / 10, blocks_avg_last5: Math.round((0.2 + (seed % 7) * 0.35) * 10) / 10,
        toi_seconds_avg_last5: toiL5, pp_points_total_last5: seed % 3,
        // Fictional deployment (ticket 15): line or pair, PP unit (some none), season TOI near the L5 value.
        toi_seconds_avg_season: player.group === "D" ? 1180 + ((seed * 7) % 160) : 880 + ((seed * 11) % 260), line_combo_group: player.group === "D" ? "defense" : "forward",
        line_combo_slot: 1 + (seed % (player.group === "D" ? 3 : 4)), pp_unit: seed % 5 === 0 ? null : 1 + (seed % 2) });
    }
  }
  return { rolling, goalieGames };
}

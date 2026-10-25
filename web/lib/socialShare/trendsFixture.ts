import { teamsInfo, activeTeamAbbreviations } from "lib/teamsInfo";
import { PICKUP_YAHOO_TEAM_ALIASES, type PickupOwnershipRow } from "./pickupsFixture";
import type { SharePlayerNameRow, ShareRollingRow, ShareTrendSources } from "./trends";

const NHL_TO_YAHOO = Object.fromEntries(Object.entries(PICKUP_YAHOO_TEAM_ALIASES).map(([yahoo, nhl]) => [nhl, yahoo]));
const SKATERS = ["C", "C", "L", "L", "R", "R", "C", "L", "D", "D", "D", "D"] as const;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/**
 * Deterministic fictional Tuesday sources for every active team, shaped like the real read-only rows:
 * rolling_player_game_metrics (six game rows per skater, newest last), players (names) and
 * yahoo_players (seven-day ownership timelines). Names are "Fixture TEAM-Tn"; every value is invented.
 */
export function fictionalTrendSources(season: number, today: string, updatedAt: string, seed = 2718): ShareTrendSources {
  let state = seed >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 16), 2654435761) + 0x5bd1e995 >>> 0) / 4294967296);
  const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
  const rolling: ShareRollingRow[] = [], players: SharePlayerNameRow[] = [], ownership: PickupOwnershipRow[] = [];
  [...activeTeamAbbreviations].forEach((abbrev, teamIndex) => {
    const team = String(abbrev), teamId = teamsInfo[abbrev].id;
    SKATERS.forEach((position, index) => {
      const id = 8480000 + teamIndex * 20 + index, defense = position === "D", name = `Fixture ${team}-T${index + 1}`;
      players.push({ id, fullName: name, position });
      // A few invented edge cases: an inactive skater (last game 12 days ago) and a small sample.
      const inactive = (teamIndex + index) % 19 === 0, seasonGames = (teamIndex + index) % 23 === 0 ? 8 : 12;
      const ppg = round((defense ? 0.15 : 0.25) + random() * (defense ? 0.55 : 0.85)), toi = Math.round((defense ? 1150 : 900) + random() * 400);
      const pp = round(random() * 55, 1), sog = round(4 + random() * 8, 2), icf = round(sog * (1.6 + random() * 0.6), 2), ixg = round(0.3 + random() * 1.1, 3);
      const swing = () => 0.45 + random() * 1.3;
      const toiL5 = Math.max(600, Math.round(toi + (random() - 0.5) * 420));
      const lineNow = 1 + Math.floor(random() * (defense ? 3 : 4)), lineBefore = random() < 0.25 ? Math.min(defense ? 3 : 4, lineNow + 1) : lineNow;
      const unitNow = pp > 25 ? 1 : pp > 8 ? 2 : null, unitBefore = random() < 0.2 ? (unitNow === 1 ? 2 : 1) : unitNow;
      for (let game = 5; game >= 0; game--) {
        const latest = game === 0, date = shift(today, -(inactive ? 12 : 1) - game * 2);
        rolling.push({
          player_id: id, team_id: teamId, season, game_date: date, strength_state: "all", updated_at: updatedAt, season_games_played: seasonGames - game,
          points_avg_last5: round(ppg * swing()), points_avg_season: ppg, toi_seconds_avg_last5: toiL5, toi_seconds_avg_season: toi, toi_seconds_total_last5: toiL5 * 5,
          pp_share_pct_last5: round(Math.min(100, Math.max(0, pp + (random() - 0.5) * 30)), 1), pp_share_pct_season: pp,
          sog_per_60_last5: round(sog * swing()), sog_per_60_season: sog, shot_attempts_per_60_last5: round(icf * swing()), shot_attempts_per_60_season: icf,
          ixg_per_60_last5: round(ixg * swing(), 3), ixg_per_60_season: ixg,
          line_combo_slot: latest ? lineNow : lineBefore, line_combo_group: defense ? "defense" : "forward", pp_unit: latest ? unitNow : unitBefore,
        });
      }
      const start = Math.round(3 + random() * 60), change = Math.round((random() - 0.45) * 30);
      const timeline = Array.from({ length: 7 }, (_, day) => ({ date: shift(today, day - 6), value: Math.max(0, Math.min(100, Math.round(start + (change * day) / 6))) }));
      ownership.push({
        player_key: `465.p.${70000 + teamIndex * 20 + index}`, player_id: String(70000 + teamIndex * 20 + index), player_name: name,
        editorial_team_abbreviation: NHL_TO_YAHOO[team] ?? team, display_position: position === "L" ? "LW" : position === "R" ? "RW" : position,
        eligible_positions: [{ position: position === "L" ? "LW" : position === "R" ? "RW" : position }], position_type: "P",
        percent_ownership: timeline[6].value, ownership_timeline: timeline, status: null, season: Math.floor(season / 10000), last_updated: `${today}T09:00:00Z`,
      });
    });
  });
  return { rolling, players, ownership };
}

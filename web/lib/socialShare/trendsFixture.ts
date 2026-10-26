import { teamsInfo, activeTeamAbbreviations } from "lib/teamsInfo";
import type { ShareMapRow } from "./players";
import type { ShareEvRow, ShareOwnershipRow, SharePlayerNameRow, SharePpcRow, ShareRollingRow, ShareTrendSources } from "./trends";

const SKATERS = ["C", "C", "L", "L", "R", "R", "C", "L", "D", "D", "D", "D"] as const;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** Fixture game dates: every second day back from yesterday; the rolling window keeps the last seven days. */
const GAMES = 8;

/**
 * Deterministic fictional Tuesday sources for every active team, shaped exactly like the read-only rows the live
 * loader selects (trends.ts *_COLUMNS): strength-all and ev rolling_player_game_metrics rows, powerPlayCombinations,
 * yahoo_player_ownership_history, yahoo_nhl_player_map_read and players. Names are "Fixture TEAM-Tn"; every value is
 * invented. Built-in edge cases: a goalie with rolling rows, small samples, an inactive skater, a traded skater,
 * games with no PP rows (unknown), skaters off the PP (none), missing earlier ownership, and unmapped Yahoo keys.
 */
export function fictionalTrendSources(season: number, today: string, updatedAt: string, options: { seed?: number; ownershipThrough?: string } = {}): ShareTrendSources {
  let state = (options.seed ?? 2718) >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 16), 2654435761) + 0x5bd1e995 >>> 0) / 4294967296);
  const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
  const rolling: ShareRollingRow[] = [], ev: ShareEvRow[] = [], ppc: SharePpcRow[] = [], ownership: ShareOwnershipRow[] = [], map: ShareMapRow[] = [], players: SharePlayerNameRow[] = [];
  const ownedThrough = options.ownershipThrough ?? today;
  const teams = [...activeTeamAbbreviations].map(String);
  teams.forEach((team, teamIndex) => {
    const teamId = teamsInfo[team].id, gameId = (game: number) => season * 10000 % 1e10 + teamIndex * 100 + game;
    // Every fourth team's latest game has no PP rows at all: PP is unknown there, never "none".
    const unknownPpGame = teamIndex % 4 === 3 ? 0 : -1;
    const roster = [...SKATERS, "G" as const];
    roster.forEach((position, index) => {
      const id = 8480000 + teamIndex * 20 + index, n = teamIndex * 20 + index, defense = position === "D", goalie = position === "G";
      players.push({ id, fullName: `Fixture ${team}-T${index + 1}`, position });
      // gpNow 8 (every 23rd) is under Recent Form's 10 appearances; every 29th + 3 has season points that are not whole (unproven).
      const inactive = n % 19 === 0, gpNow = n % 23 === 0 ? 8 : 10 + Math.floor(random() * 8), traded = n % 31 === 5, unproven = n % 29 === 3;
      const ppg = round((defense ? 0.15 : 0.25) + random() * (defense ? 0.55 : 0.85)), toi = Math.round((defense ? 1150 : 900) + random() * 400);
      const sog = round(4 + random() * 8), icf = round(sog * (1.6 + random() * 0.6)), ixg = round(0.3 + random() * 1.1, 3);
      const swing = () => 0.45 + random() * 1.3, toiL5 = Math.max(600, Math.round(toi + (random() - 0.5) * 420));
      // Whole season points, with the last 10 appearances inside them (the writer's windows are last-N observations).
      const seasonPoints = Math.round(ppg * gpNow), points5 = Math.min(seasonPoints, Math.round(ppg * 5 * swing())), points10 = Math.min(seasonPoints, points5 + Math.round(ppg * 5 * swing()));
      const lineNow = 1 + Math.floor(random() * (defense ? 3 : 4)), lineBefore = random() < 0.3 ? Math.min(defense ? 3 : 4, lineNow + (random() < 0.5 ? 1 : -1)) || 1 : lineNow;
      const unitNow = !goalie && random() < 0.55 ? 1 + Math.floor(random() * 2) : null, unitBefore = random() < 0.2 ? (unitNow === 1 ? 2 : unitNow === 2 ? null : 1) : unitNow;
      for (let game = 0; game < GAMES; game++) {
        const latest = game === 0, date = shift(today, -(inactive ? 10 : 1) - game * 2), unit = latest ? unitNow : unitBefore;
        const row: ShareRollingRow = {
          player_id: id, team_id: traded && !latest ? teamsInfo[teams[(teamIndex + 1) % teams.length]].id : teamId, season, game_id: gameId(game), game_date: date, strength_state: "all",
          updated_at: updatedAt, season_games_played: gpNow - game, points_avg_season: Math.max(0, seasonPoints - game * ppg) / Math.max(1, gpNow - game) + (unproven ? 0.013 : 0),
          points_total_last5: points5, points_total_last10: points10,
          toi_seconds_avg_last5: toiL5, toi_seconds_avg_season: toi, toi_seconds_total_last5: toiL5 * 5,
          pp_toi_seconds_total_last5: unit ? Math.round((90 + random() * 120) * 5) : 0, pp_toi_seconds_avg_season: unitNow || unitBefore ? round(80 + random() * 100) : 4,
          sog_per_60_last5: round(sog * swing()), sog_per_60_season: sog, shot_attempts_per_60_last5: round(icf * swing()), shot_attempts_per_60_season: icf,
          ixg_per_60_last5: round(ixg * swing(), 3), ixg_per_60_season: ixg,
          line_combo_slot: goalie ? null : latest ? lineNow : lineBefore, line_combo_group: goalie ? null : defense ? "defense" : "forward",
          // The rolling unit is null whenever the game has no PP rows (so the loader cannot tell none from unknown).
          pp_unit: game === unknownPpGame ? null : unit,
        };
        rolling.push(row);
        ev.push({ player_id: id, season, game_date: date, strength_state: "ev", toi_seconds_avg_last5: Math.round(toiL5 * 0.8), toi_seconds_avg_season: Math.round(toi * 0.82) });
        if (game !== unknownPpGame && unit) ppc.push({ gameId: row.game_id!, playerId: id, unit });
      }
      // Ownership: daily observations ending on ownedThrough; every 17th player has none before the last 4 days.
      const start = Math.round(3 + random() * 60), change = Math.round((random() - 0.45) * 30 * 10) / 10, key = `465.p.${70000 + n}`;
      for (let day = 8; day >= 0; day--) {
        if (n % 17 === 0 && day >= 4) continue;
        const pct = Math.max(0, Math.min(100, round(start + (change * (8 - day)) / 8, 2)));
        ownership.push({ player_key: key, player_id: 70000 + n, ownership_date: shift(ownedThrough, -day), ownership_pct: n % 13 === 0 && day === 0 ? null : pct });
      }
      // The view keys some rows by player_key and some by bare player_id; every 29th key is unmapped.
      if (n % 29 !== 0) map.push({ yahoo_player_id: n % 2 ? String(70000 + n) : key, nhl_player_id: String(id) });
    });
    // Every PP-row game also lists a fictional other skater, so an absent skater is confirmed off the PP.
    for (let game = 0; game < GAMES; game++) if (game !== unknownPpGame) ppc.push({ gameId: gameId(game), playerId: 8499000 + teamIndex, unit: 2 });
  });
  return { rolling: { rows: rolling }, ev: { rows: ev }, ppc: { rows: ppc }, ownership: { rows: ownership }, map: { rows: map }, players: { rows: players } };
}

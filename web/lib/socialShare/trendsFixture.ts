import { teamsInfo, activeTeamAbbreviations } from "lib/teamsInfo";
import type { ShareMapRow } from "./players";
import type { ShareEvRow, ShareOwnershipRow, SharePlayerNameRow, SharePpcRow, ShareRollingRow, ShareSeriesRow, ShareTrendSources } from "./trends";

const SKATERS = ["C", "C", "L", "L", "R", "R", "C", "L", "D", "D", "D", "D"] as const;
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** Fixture game dates: every second day back from yesterday (the trend window keeps seven days, sparklines 35). */
const GAMES = 12;

/**
 * Deterministic fictional Tuesday sources for every active team, shaped exactly like the read-only rows the live
 * loader selects (trends.ts *_COLUMNS): strength-all and ev rolling_player_game_metrics rows, powerPlayCombinations,
 * yahoo_player_ownership_history, yahoo_nhl_player_map_read and players. Names are "Fixture TEAM-Tn"; every value is
 * invented. Every row is derived from per-game values (points, TOI, shots, attempts, ixG, PP TOI), so the L5/L10
 * windows, season averages and per-60 components agree the way the writer's do. Built-in edge cases: a goalie with rolling rows, small samples, an inactive skater, a traded skater,
 * games with no PP rows (unknown), skaters off the PP (none), missing earlier ownership, and unmapped Yahoo keys.
 */
export function fictionalTrendSources(season: number, today: string, updatedAt: string, options: { seed?: number; ownershipThrough?: string } = {}): ShareTrendSources {
  let state = (options.seed ?? 2718) >>> 0;
  const random = () => ((state = Math.imul(state ^ (state >>> 16), 2654435761) + 0x5bd1e995 >>> 0) / 4294967296);
  const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
  const rolling: (ShareRollingRow & ShareSeriesRow)[] = [], ev: ShareEvRow[] = [], ppc: SharePpcRow[] = [], ownership: ShareOwnershipRow[] = [], map: ShareMapRow[] = [], players: SharePlayerNameRow[] = [];
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
      const ppg = (defense ? 0.15 : 0.25) + random() * (defense ? 0.55 : 0.85), toi = (defense ? 1150 : 900) + random() * 400;
      const sog = 4 + random() * 8, icf = sog * (1.6 + random() * 0.6), ixg = 0.3 + random() * 1.1;
      // Per-game values for the generated games (index 0 = latest), with a per-player trend so recent games differ.
      const rows = Math.min(GAMES, gpNow), before = gpNow - rows, trend = (random() - 0.5) * 0.9, at = (g: number) => 1 + trend * (rows - g) / rows;
      const per = Array.from({ length: rows }, (_, g) => {
        const minutes = Math.max(480, Math.round(toi * at(g) * (0.85 + random() * 0.3)));
        return { toi: minutes, points: Math.max(0, Math.round(ppg * at(g) * (random() * 2.2))), shots: Math.max(0, Math.round(sog * minutes / 3600 * at(g) * (0.4 + random() * 1.2))),
          attempts: 0, ixg: round(ixg * minutes / 3600 * (0.3 + random() * 1.4), 3), pp: 0 };
      });
      for (const game of per) game.attempts = game.shots + Math.round(game.shots * (icf / sog - 1) * (0.5 + random()));
      const base = { points: Math.round(ppg * before), toi: Math.round(toi * before), shots: Math.round(sog * toi / 3600 * before), attempts: Math.round(icf * toi / 3600 * before), ixg: round(ixg * toi / 3600 * before, 3), pp: 0 };
      const lineNow = 1 + Math.floor(random() * (defense ? 3 : 4)), lineBefore = random() < 0.3 ? Math.min(defense ? 3 : 4, lineNow + (random() < 0.5 ? 1 : -1)) || 1 : lineNow;
      const unitNow = !goalie && random() < 0.55 ? 1 + Math.floor(random() * 2) : null, unitBefore = random() < 0.2 ? (unitNow === 1 ? 2 : unitNow === 2 ? null : 1) : unitNow;
      per.forEach((game, g) => { game.pp = (g === 0 ? unitNow : unitBefore) ? Math.round(90 + random() * 120) : 0; });
      base.pp = unitNow || unitBefore ? Math.round(120 * before) : 0;
      const sum = (key: keyof typeof per[number], from: number, count: number) => per.slice(from, from + count).reduce((total, game) => total + game[key], 0);
      const cum = (key: keyof typeof per[number], g: number) => base[key] + sum(key, g, rows - g);
      const rate = (num: number, seconds: number, places: number) => seconds > 0 ? round(num / seconds * 3600, places) : null;
      for (let game = 0; game < rows; game++) {
        const latest = game === 0, date = shift(today, -(inactive ? 10 : 1) - game * 2), unit = latest ? unitNow : unitBefore, sgp = gpNow - game, w5 = Math.min(5, rows - game);
        const seasonToi = cum("toi", game), seasonShots = cum("shots", game), seasonAttempts = cum("attempts", game), seasonIxg = round(cum("ixg", game), 3);
        const row: ShareRollingRow & ShareSeriesRow = {
          player_id: id, team_id: traded && !latest ? teamsInfo[teams[(teamIndex + 1) % teams.length]].id : teamId, season, game_id: gameId(game), game_date: date, strength_state: "all",
          updated_at: updatedAt, season_games_played: sgp, points_avg_season: cum("points", game) / sgp + (unproven ? 0.013 : 0),
          points_total_last5: sum("points", game, 5), points_total_last10: rows - game >= 10 ? sum("points", game, 10) : null,
          toi_seconds_avg_last5: round(sum("toi", game, 5) / w5, 2), toi_seconds_avg_season: round(seasonToi / sgp, 4), toi_seconds_total_last5: sum("toi", game, 5),
          pp_toi_seconds_total_last5: sum("pp", game, 5), pp_toi_seconds_avg_season: round(cum("pp", game) / sgp, 2),
          sog_per_60_last5: rate(sum("shots", game, 5), sum("toi", game, 5), 2), sog_per_60_season: rate(seasonShots, seasonToi, 2),
          shot_attempts_per_60_last5: rate(sum("attempts", game, 5), sum("toi", game, 5), 2), shot_attempts_per_60_season: rate(seasonAttempts, seasonToi, 2),
          ixg_per_60_last5: rate(sum("ixg", game, 5), sum("toi", game, 5), 3), ixg_per_60_season: rate(seasonIxg, seasonToi, 3),
          sog_per_60_shots_season: seasonShots, sog_per_60_toi_seconds_season: seasonToi, shot_attempts_per_60_shot_attempts_season: seasonAttempts,
          shot_attempts_per_60_toi_seconds_season: seasonToi, ixg_per_60_ixg_season: seasonIxg, ixg_per_60_toi_seconds_season: seasonToi,
          line_combo_slot: goalie ? null : latest ? lineNow : lineBefore, line_combo_group: goalie ? null : defense ? "defense" : "forward",
          // The rolling unit is null whenever the game has no PP rows (so the loader cannot tell none from unknown).
          pp_unit: game === unknownPpGame ? null : unit,
        };
        rolling.push(row);
        ev.push({ player_id: id, season, game_date: date, strength_state: "ev", toi_seconds_avg_last5: Math.round(row.toi_seconds_avg_last5! * 0.8), toi_seconds_avg_season: Math.round(row.toi_seconds_avg_season! * 0.82) });
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
  return { rolling: { rows: rolling }, ev: { rows: ev }, ppc: { rows: ppc }, ownership: { rows: ownership }, map: { rows: map }, players: { rows: players },
    series: { rows: rolling }, ownershipSeries: { rows: ownership }, rosterMap: { rows: map } };
}

/**
 * A small deterministic NHL world for offline FORGE parity: one target game, its two teams, their recent history
 * and every relation the writer reads. All values are synthetic. Scenario knobs drive the read-set branches
 * (lineup source, pool recovery, season bootstrap, reserves, goalie candidates, target-game PBP state).
 */
import type { Row, World } from "./store";

export type LeagueOptions = {
  /** Home team has no line combination at all, and its rolling history is thin: forces the pool-recovery path. */
  thinHomePool?: boolean;
  /** Current season has no games yet for the target teams' skaters (bootstrap path). */
  seasonOpening?: boolean;
  /** A stored pbp_games row for the target game, in its pregame state, with no plays. */
  targetPbpPregameRow?: boolean;
  /** A confirmed goalie override event for the away team. */
  awayGoalieOverride?: boolean;
  /** Three goalies with start projections for the home team (multiple candidates). */
  homeThreeGoalies?: boolean;
  /** Away team has no line combination and no rolling history: its lineup is unavailable (opponent-shots gate). */
  awayNoLineup?: boolean;
  /** Home played yesterday with its usual starter and near-even start priors: the model ranks the backup first. */
  homeBackToBack?: boolean;
  /** Accepted, confirmed lineup evidence for the home team (lines, PP, one scratch, a call-up dressed). */
  homeLineupEvidence?: boolean;
  /** One home top-six forward is out (INJURY_OUT), effective before the slate. */
  homeForwardOut?: boolean;
};

export const TARGET = {
  gameId: 2026020250, slateDate: "2026-11-14", startTime: "2026-11-15T00:00:00Z", seasonId: 20262027,
  homeTeamId: 10, awayTeamId: 6, homeAbbrev: "TOR", awayAbbrev: "BOS",
};
const OTHER_TEAMS = [{ id: 8, abbreviation: "MTL" }, { id: 9, abbreviation: "OTT" }, { id: 3, abbreviation: "NYR" }];
const TEAMS = [{ id: TARGET.homeTeamId, abbreviation: TARGET.homeAbbrev }, { id: TARGET.awayTeamId, abbreviation: TARGET.awayAbbrev }, ...OTHER_TEAMS];

/** Deterministic pseudo-random in [0, 1). */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

type Player = { id: number; teamId: number; position: "C" | "L" | "R" | "D" | "G"; tier: number };

function rosterFor(teamId: number, options: LeagueOptions): Player[] {
  const base = 8_470_000 + teamId * 100;
  const players: Player[] = [];
  const forwards: Array<"C" | "L" | "R"> = ["C", "L", "R"];
  for (let index = 0; index < 13; index += 1) players.push({ id: base + index + 1, teamId, position: forwards[index % 3], tier: index });
  for (let index = 0; index < 7; index += 1) players.push({ id: base + 20 + index + 1, teamId, position: "D", tier: index });
  const goalies = teamId === TARGET.homeTeamId && options.homeThreeGoalies ? 3 : 2;
  for (let index = 0; index < goalies; index += 1) players.push({ id: base + 30 + index + 1, teamId, position: "G", tier: index });
  return players;
}

export function buildLeague(options: LeagueOptions = {}): World {
  const random = rng(20261114);
  const tables: Record<string, Row[]> = {};
  const push = (table: string, ...rows: Row[]) => (tables[table] ??= []).push(...rows);

  push("seasons",
    { id: 20262027, startDate: "2026-10-07", regularSeasonEndDate: "2027-04-15", endDate: "2027-06-20", numberOfGames: 82 },
    { id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-16", endDate: "2026-06-20", numberOfGames: 82 },
    { id: 20242025, startDate: "2024-10-04", regularSeasonEndDate: "2025-04-17", endDate: "2025-06-20", numberOfGames: 82 });
  for (const team of TEAMS) push("teams", { id: team.id, abbreviation: team.abbreviation, name: team.abbreviation });

  // Schedule: target game plus history for both target teams. Season opening pushes history to last season.
  push("games", { id: TARGET.gameId, date: TARGET.slateDate, seasonId: TARGET.seasonId, startTime: TARGET.startTime,
    homeTeamId: TARGET.homeTeamId, awayTeamId: TARGET.awayTeamId, type: 2 });
  const history: Array<{ id: number; date: string; seasonId: number; home: number; away: number }> = [];
  const historyCount = 8;
  for (const [teamIndex, teamId] of [TARGET.homeTeamId, TARGET.awayTeamId].entries()) {
    for (let index = 0; index < historyCount; index += 1) {
      const shift = options.homeBackToBack && teamId === TARGET.homeTeamId ? 1 : 0;
      const date = options.seasonOpening ? addDays("2026-04-16", -2 * index - teamIndex) : addDays(TARGET.slateDate, -2 * (index + 1) - teamIndex + shift);
      const seasonId = options.seasonOpening ? 20252026 : TARGET.seasonId;
      const opponent = OTHER_TEAMS[index % OTHER_TEAMS.length].id;
      const id = (options.seasonOpening ? 2025021200 : 2026020100) + teamIndex * 50 + index;
      const home = index % 2 === 0 ? teamId : opponent;
      history.push({ id, date, seasonId, home, away: home === teamId ? opponent : teamId });
      push("games", { id, date, seasonId, startTime: `${date}T23:00:00Z`, homeTeamId: home, awayTeamId: home === teamId ? opponent : teamId, type: 2 });
    }
  }
  // A later game for the target teams (horizon reads look forward).
  push("games", { id: TARGET.gameId + 20, date: addDays(TARGET.slateDate, 2), seasonId: TARGET.seasonId,
    startTime: `${addDays(TARGET.slateDate, 2)}T23:00:00Z`, homeTeamId: TARGET.awayTeamId, awayTeamId: TARGET.homeTeamId, type: 2 });

  push("roster_optimizer_team_games", ...[TARGET.homeTeamId, TARGET.awayTeamId].map((teamId) => {
    const opponent = teamId === TARGET.homeTeamId ? TARGET.awayTeamId : TARGET.homeTeamId;
    return { game_key: `${TARGET.gameId}:${teamId}`, season: "2026", source_season_id: TARGET.seasonId, source_game_id: TARGET.gameId,
      team_id: teamId, opponent_team_id: opponent, team_abbreviation: teamId === TARGET.homeTeamId ? TARGET.homeAbbrev : TARGET.awayAbbrev,
      opponent_abbreviation: opponent === TARGET.homeTeamId ? TARGET.homeAbbrev : TARGET.awayAbbrev, start_time: TARGET.startTime,
      game_status: "FUT", schedule_status: "OK", source_updated_at: "2026-11-14T12:00:00Z", fetched_at: "2026-11-14T12:05:00Z" };
  }));

  const rosters = new Map<number, Player[]>();
  for (const teamId of [TARGET.homeTeamId, TARGET.awayTeamId]) {
    const roster = rosterFor(teamId, options);
    rosters.set(teamId, roster);
    for (const player of roster) {
      push("players", { id: player.id, team_id: teamId, position: player.position, fullName: `Player ${player.id}` });
      push("rosters", { playerId: player.id, teamId, seasonId: TARGET.seasonId, is_current: true, created_at: "2026-10-01T12:00:00Z" });
      push("fhfh_player_identities", { id: player.id - 8_000_000, nhl_player_id: player.id, current_nhl_team_id: teamId,
        updated_at: "2026-10-01T12:00:00Z", verification_status: "verified", lifecycle_status: "active_nhl", merged_into_id: null });
    }
  }

  // Line combinations: the twelve top forwards and six top defense, starter goalie; the 13th F and 7th D are extras.
  for (const game of history) {
    for (const teamId of [game.home, game.away]) {
      const roster = rosters.get(teamId);
      if (!roster) continue;
      if (options.thinHomePool && teamId === TARGET.homeTeamId) continue;
      if (options.awayNoLineup && teamId === TARGET.awayTeamId) continue;
      const forwards = roster.filter((p) => p.position !== "D" && p.position !== "G" && p.tier < 12).map((p) => p.id);
      const defense = roster.filter((p) => p.position === "D" && p.tier < 6).map((p) => p.id);
      const goalies = roster.filter((p) => p.position === "G");
      const starter = goalies[(game.id % 3 === 0 ? 1 : 0) % goalies.length].id;
      // Rotate two adjacent forwards every other game so role history has some churn.
      if (game.id % 2 === 1) [forwards[2], forwards[3]] = [forwards[3], forwards[2]];
      push("lineCombinations", { gameId: game.id, teamId, forwards, defensemen: defense, goalies: [starter] });
    }
  }

  // Rolling rows: the last three games per skater per strength. Thin home pool keeps only six skaters with history.
  const rollingRows: Row[] = [];
  for (const [teamId, roster] of rosters) {
    const teamGames = history.filter((game) => game.home === teamId || game.away === teamId).sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const player of roster) {
      if (player.position === "G") continue;
      if (options.thinHomePool && teamId === TARGET.homeTeamId && player.tier >= 4) continue;
      if (options.awayNoLineup && teamId === TARGET.awayTeamId) continue;
      if (player.tier >= 12 && player.position !== "D") continue; // extra forward: no NHL usage (reserve without metrics)
      const isD = player.position === "D";
      for (const [index, game] of teamGames.slice(0, 3).entries()) {
        for (const strength of ["ev", "pp", "pk", "all"] as const) {
          if (strength === "pp" && player.tier > (isD ? 3 : 8)) continue;
          if (strength === "pk" && player.tier > 6) continue;
          const base = strength === "ev" ? (isD ? 1200 : 900) : strength === "pp" ? 150 : strength === "pk" ? 110 : 1150;
          const toi = round(base * (1 - player.tier * 0.04) * (0.9 + random() * 0.2), 1);
          const games = 10 - index;
          rollingRows.push({
            player_id: player.id, game_id: game.id, season: game.seasonId, strength_state: strength, game_date: game.date,
            team_id: teamId, toi_seconds_avg_last5: toi, toi_seconds_avg_all: round(toi * 0.97, 1), toi_seconds_total_all: round(toi * games, 1),
            sog_per_60_last5: round((isD ? 4 : 8) * (0.8 + random() * 0.4)), sog_per_60_avg_last5: null,
            sog_per_60_all: round((isD ? 4 : 8) * (0.85 + random() * 0.3)), sog_per_60_avg_all: null,
            goals_total_last5: Math.floor(random() * 3), shots_total_last5: 5 + Math.floor(random() * 10), assists_total_last5: Math.floor(random() * 4),
            goals_total_all: Math.floor(random() * 6) + 1, shots_total_all: 20 + Math.floor(random() * 30), assists_total_all: Math.floor(random() * 8) + 1,
            ipp_all: round(40 + random() * 30, 1),
            hits_per_60_last5: round(4 + random() * 6), hits_per_60_avg_last5: null, hits_per_60_all: round(4 + random() * 5), hits_per_60_avg_all: null,
            blocks_per_60_last5: round((isD ? 5 : 1.5) + random() * 2), blocks_per_60_avg_last5: null,
            blocks_per_60_all: round((isD ? 5 : 1.5) + random() * 2), blocks_per_60_avg_all: null,
            toi_seconds_total_last5: round(toi * 5, 1),
            hits_per_60_hits_3ya: 300, hits_per_60_toi_seconds_3ya: 300_000, blocks_per_60_blocks_3ya: isD ? 250 : 80, blocks_per_60_toi_seconds_3ya: 300_000,
            hits_per_60_hits_season: 20, hits_per_60_toi_seconds_season: 10 * toi, blocks_per_60_blocks_season: isD ? 15 : 5, blocks_per_60_toi_seconds_season: 10 * toi,
          });
        }
      }
    }
  }
  push("rolling_player_game_metrics", ...rollingRows);

  // Context relations: deployment, unified NST, trend bands, team strength, 5v5 and NST team xGA.
  for (const [teamId, roster] of rosters) {
    const abbrev = teamId === TARGET.homeTeamId ? TARGET.homeAbbrev : TARGET.awayAbbrev;
    const teamGames = history.filter((game) => game.home === teamId || game.away === teamId);
    for (const player of roster) {
      if (player.position === "G") continue;
      if (options.awayNoLineup && teamId === TARGET.awayTeamId) continue;
      if (player.tier >= 12 && player.position !== "D") continue;
      const isD = player.position === "D";
      for (const game of teamGames.slice(0, 4)) {
        const toi = round((isD ? 1300 : 1000) * (1 - player.tier * 0.03) * (0.9 + random() * 0.2), 1);
        const ppToi = player.tier < (isD ? 4 : 9) ? round(90 + random() * 80, 1) : 0;
        push("wgo_skater_stats", { player_id: player.id, game_id: game.id, date: game.date, team_abbrev: abbrev,
          toi_per_game: toi, es_toi_per_game: round(toi - ppToi, 1), pp_toi_per_game: ppToi, pp_toi: ppToi,
          pp_shots: ppToi > 0 ? Math.floor(random() * 2) : 0 });
      }
      const latest = teamGames.map((game) => game.date).sort().at(-1)!;
      push("player_stats_unified", { player_id: player.id, date: latest,
        nst_shots_per_60: round((isD ? 4 : 8) * (0.8 + random() * 0.4)), nst_ixg_per_60: round((isD ? 0.2 : 0.8) * (0.7 + random() * 0.6)),
        nst_rush_attempts_per_60: round(random() * 1.5), nst_rebounds_created_per_60: round(random()),
        nst_oi_xgf_per_60: round(2.2 + random()), nst_oi_xga_per_60: round(2.2 + random()), nst_oi_cf_pct_rates: round(45 + random() * 10, 2),
        nst_oi_cf_pct: null, possession_pct_safe: round(45 + random() * 10, 2) });
      if (player.tier % 3 === 0) {
        const value = round(6 + random() * 6);
        push("sustainability_trend_bands", { player_id: player.id, snapshot_date: addDays(TARGET.slateDate, -1 - (player.tier % 4)),
          metric_key: "shots_per_60", window_code: player.tier % 2 ? "l10" : "l5", value,
          ci_lower: round(value - (player.tier % 2 ? 3 : -0.5)), ci_upper: round(value + 1), n_eff: 4 + player.tier });
      }
    }
    for (const [index, date] of [addDays(TARGET.slateDate, -1), addDays(TARGET.slateDate, -8)].entries()) {
      push("nhl_team_data", { team_abbrev: abbrev, date, games_played: 16 - index * 3, xga: round(45 - index * 8), xga_per_game: round((45 - index * 8) / (16 - index * 3)),
        xgf: round(48 - index * 7), xgf_per_game: round((48 - index * 7) / (16 - index * 3)), goals_for_per_game: 3.1, goals_against_per_game: 2.8 });
      push("wgo_team_stats", { team_id: teamId, date, games_played: 16 - index * 3, save_pct_5v5: round(0.915 + random() * 0.01, 4),
        shooting_plus_save_pct_5v5: round(0.995 + random() * 0.02, 4) });
      push("nst_team_all", { team_abbreviation: abbrev, situation: "all", date, gp: 16 - index * 3, toi: (16 - index * 3) * 3700, xga: round(44 - index * 8) });
    }
  }

  // Goalie history.
  for (const game of history) {
    for (const teamId of [game.home, game.away]) {
      const roster = rosters.get(teamId);
      if (!roster) continue;
      const goalies = roster.filter((p) => p.position === "G");
      const starter = goalies[(game.id % 3 === 0 ? 1 : 0) % goalies.length];
      const shots = 25 + Math.floor(random() * 12);
      const goals = Math.floor(random() * 5);
      push("forge_goalie_game", { game_id: game.id, game_date: game.date, goalie_id: starter.id, team_id: teamId,
        shots_against: shots, goals_allowed: goals, saves: shots - goals });
      push("wgo_goalie_stats", { game_id: game.id, goalie_id: starter.id, date: game.date, games_started: 1,
        quality_start: goals <= 2 ? 1 : 0, quality_starts_pct: 0.55, team_abbreviation: teamId === TARGET.homeTeamId ? TARGET.homeAbbrev : TARGET.awayAbbrev });
      push("forge_team_game_strength", { game_id: game.id, game_date: game.date, team_id: teamId,
        toi_es_seconds: 3000, toi_pp_seconds: 300 + Math.floor(random() * 200), toi_pk_seconds: 280 + Math.floor(random() * 200),
        shots_es: 22 + Math.floor(random() * 8), shots_pp: 3 + Math.floor(random() * 4), shots_pk: Math.floor(random() * 2),
        goals_es: Math.floor(random() * 3), goals_pp: Math.floor(random() * 2) });
    }
  }

  // Goalie start projections for the target game.
  for (const teamId of [TARGET.homeTeamId, TARGET.awayTeamId]) {
    const goalies = rosters.get(teamId)!.filter((p) => p.position === "G");
    const probabilities = goalies.length === 3 ? [0.52, 0.33, 0.15]
      : options.homeBackToBack && teamId === TARGET.homeTeamId ? [0.55, 0.45] : [0.68, 0.32];
    goalies.forEach((goalie, index) => push("goalie_start_projections", {
      game_id: TARGET.gameId, game_date: TARGET.slateDate, team_id: teamId, player_id: goalie.id,
      start_probability: probabilities[index], confirmed_status: false, l10_start_pct: probabilities[index],
      season_start_pct: probabilities[index], games_played: 8 - index * 3, projected_gsaa_per_60: round(0.2 - index * 0.15),
      updated_at: "2026-11-14T15:00:00Z",
    }));
  }

  if (options.awayGoalieOverride) {
    const backup = rosters.get(TARGET.awayTeamId)!.filter((p) => p.position === "G")[1];
    push("forge_roster_events", { event_id: 501, team_id: TARGET.awayTeamId, player_id: backup.id, event_type: "GOALIE_START_CONFIRMED",
      confidence: 1, payload: { game_id: TARGET.gameId }, effective_from: "2026-11-14T16:00:00Z", effective_to: null,
      created_at: "2026-11-14T16:00:00Z" });
  }

  if (options.homeLineupEvidence) {
    const roster = rosters.get(TARGET.homeTeamId)!;
    const snapshot = { id: "fixture-lineup-1", game_id: TARGET.gameId, team_id: TARGET.homeTeamId, observed_at: "2026-11-14T17:30:00Z",
      available_at: "2026-11-14T17:31:00Z", created_at: "2026-11-14T17:31:00Z", expires_at: null, accepted: true,
      source_key: "fixture-line-source", source_account: "fixture-reporter", source_url: null, parser_version: "line-source-v2" };
    push("player_forecast_lineup_snapshots", snapshot);
    const forwards = roster.filter((p) => p.position !== "D" && p.position !== "G");
    const defense = roster.filter((p) => p.position === "D");
    // Tier 2 forward scratched; the extra (tier 12) forward dresses on the fourth line.
    const dressed = [...forwards.filter((p) => p.tier !== 2 && p.tier < 12), forwards.find((p) => p.tier === 12)!];
    let index = 0;
    const assign = (player: Player, unit_type: string, unit_number: number | null, assignment_status: string) =>
      push("player_forecast_lineup_assignments", { id: `fixture-assignment-${(index += 1)}`, snapshot_id: snapshot.id, player_id: player.id,
        unit_type, unit_number, assignment_status, created_at: snapshot.created_at });
    dressed.forEach((player, position) => assign(player, "forward_line", Math.floor(position / 3) + 1, "confirmed"));
    defense.slice(0, 6).forEach((player, position) => assign(player, "defense_pair", Math.floor(position / 2) + 1, "confirmed"));
    [...dressed.slice(0, 4), defense[0]].forEach((player) => assign(player, "power_play", 1, "confirmed"));
    assign(forwards.find((p) => p.tier === 2)!, "scratch", null, "ruled_out");
  }

  if (options.homeForwardOut) {
    const out = rosters.get(TARGET.homeTeamId)!.find((p) => p.tier === 1)!;
    push("forge_roster_events", { event_id: 502, team_id: TARGET.homeTeamId, player_id: out.id, event_type: "INJURY_OUT",
      confidence: 0.9, payload: {}, effective_from: "2026-11-13T18:00:00Z", effective_to: null, created_at: "2026-11-13T18:00:00Z" });
  }

  // Box-score history (season bootstrap reads it through games!inner).
  for (const game of history) {
    for (const teamId of [game.home, game.away]) {
      const roster = rosters.get(teamId);
      if (!roster) continue;
      for (const player of roster) {
        if (player.position === "G") {
          if (player.tier !== (game.id % 3 === 0 ? 1 : 0)) continue;
          const shots = 28 + (game.id % 7);
          push("goaliesGameStats", { playerId: player.id, gameId: game.id, saveShotsAgainst: `${shots - 2}/${shots}`, goalsAgainst: 2, toi: "60:00" });
          continue;
        }
        if (player.tier >= 12 && player.position !== "D") continue;
        push("skatersGameStats", { playerId: player.id, gameId: game.id, goals: game.id % 5 === player.tier % 5 ? 1 : 0,
          assists: game.id % 4 === player.tier % 4 ? 1 : 0, shots: 1 + ((game.id + player.tier) % 4), hits: (game.id + player.tier) % 3,
          blockedShots: player.position === "D" ? 2 : 0, pim: 0, powerPlayGoals: 0, powerPlayPoints: 0,
          toi: player.position === "D" ? "21:30" : "16:10", powerPlayToi: player.tier < 8 ? "02:05" : "00:00" });
      }
    }
  }

  if (options.targetPbpPregameRow) {
    push("pbp_games", { id: TARGET.gameId, date: TARGET.slateDate, hometeamid: TARGET.homeTeamId, awayteamid: TARGET.awayTeamId,
      type: 2, season: TARGET.seasonId, hometeamabbrev: TARGET.homeAbbrev, awayteamabbrev: TARGET.awayAbbrev,
      hometeamscore: null, awayteamscore: null, gamestate: "FUT" });
  }

  const latestRolling = (args: Record<string, any>) => {
    const ids: number[] = args.p_player_ids;
    const columns: string[] = Array.isArray(args.p_columns) ? args.p_columns : String(args.p_columns).split(",");
    return {
      data: ids.map((playerId) => {
        const latest = rollingRows.filter((row) => row.player_id === playerId && row.strength_state === args.p_strength && row.game_date < args.p_before)
          .sort((a, b) => (a.game_date < b.game_date ? 1 : a.game_date > b.game_date ? -1 : b.game_id - a.game_id))[0];
        return { player_id: playerId, rolling_row: latest ? Object.fromEntries(columns.map((column) => [column, latest[column] ?? null])) : null, support_row: null };
      }),
      error: null,
    };
  };
  // forge_latest_trend_bands: one row per requested key in byte order, the newest row on or before p_as_of, else nulls.
  const latestTrendBands = (args: Record<string, any>) => {
    const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const bands = tables.sustainability_trend_bands ?? [];
    const players = [...new Set<number>(args.p_player_ids)].sort((a, b) => a - b);
    const metrics = [...new Set<string>(args.p_metric_keys)].sort(byCodePoint);
    const windows = [...new Set<string>(args.p_window_codes)].sort(byCodePoint);
    return {
      data: players.flatMap((playerId) => metrics.flatMap((metricKey) => windows.map((windowCode) => {
        const latest = bands.filter((row) => row.player_id === playerId && row.metric_key === metricKey && row.window_code === windowCode
          && row.snapshot_date <= args.p_as_of).sort((a, b) => byCodePoint(b.snapshot_date, a.snapshot_date))[0];
        return { player_id: playerId, metric_key: metricKey, window_code: windowCode, snapshot_date: latest?.snapshot_date ?? null,
          value: latest?.value ?? null, ci_lower: latest?.ci_lower ?? null, ci_upper: latest?.ci_upper ?? null, n_eff: latest?.n_eff ?? null };
      }))),
      error: null,
    };
  };
  const physicalTotals = () => ({
    data: [
      { position_group: "F", scope: "to_date", hits: 4200, blocks: 1500, toi_seconds: 2_400_000 },
      { position_group: "F", scope: "prior2", hits: 52_000, blocks: 19_000, toi_seconds: 30_000_000 },
      { position_group: "D", scope: "to_date", hits: 2100, blocks: 2600, toi_seconds: 1_500_000 },
      { position_group: "D", scope: "prior2", hits: 27_000, blocks: 33_000, toi_seconds: 19_000_000 },
    ],
    error: null,
  });

  return {
    tables,
    joins: {
      "skatersGameStats.games": { relation: "games", local: "gameId", foreign: "id" },
      "goaliesGameStats.games": { relation: "games", local: "gameId", foreign: "id" },
    },
    rpc: {
      forge_latest_rolling_rows: latestRolling,
      forge_league_skater_physical_totals: physicalTotals,
      forge_latest_trend_bands: latestTrendBands,
      begin_forge_game_run: () => ({ data: "00000000-0000-4000-8000-0000000000aa", error: null }),
    },
  };
}

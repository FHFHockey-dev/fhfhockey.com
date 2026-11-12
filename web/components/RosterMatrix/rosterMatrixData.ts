import {
  formatHeight,
  getAge
} from "components/WiGO/playerBiography";

export interface PlayerData {
  id: number;
  nhl_player_name: string;
  mapped_position: string;
  eligible_positions?: string[] | string;
  age?: number;
  sweater_number?: number;
  height?: string;
  weight?: number;
  shoots_catches?: string;
  injury_status?: string;
  injury_note?: string;

  // Basic stats
  games_played?: number;
  goals?: number;
  assists?: number;
  points?: number;
  plus_minus?: number;
  pim?: number;
  shots?: number;
  shooting_percentage?: number;
  toi_per_game?: number;
  pp_toi_per_game?: number;

  // Advanced stats
  cf_pct?: number;
  xgf_pct?: number;
  hdcf_pct?: number;
  pdo?: number;
  total_points_per_60?: number;
  ixg_per_60?: number;
  goals_per_60?: number;
  total_assists_per_60?: number;
  shots_per_60?: number;

  // Goalie stats
  wins?: number;
  losses?: number;
  save_pct?: number;
  goals_against_avg?: number;
  shutouts?: number;

  // Advanced goalie stats
  gsaa?: number;
  hd_save_pct?: number;
  md_save_pct?: number;
  ld_save_pct?: number;
  xg_against?: number;
}

type Row = Record<string, any>;

const known = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Fallback goalie season line from `nst_gamelog_goalie_all_counts` (W2-2 D7).
 * Unit adapter (rule 17): NST `toi` is minutes, so GAA = GA × 60 ÷ minutes.
 * Each ratio pools its own made/attempted counts and is unknown when a game
 * lacks either or the denominator is zero. The table stores no low-danger
 * saves or goals, so LD SV% is unknown rather than rebuilt from HD saves.
 * GSAA is unknown here: summing per-game GSAA is wrong (decision 10) and this
 * reader has no league SV% for the matching season and window.
 */
export function aggregateNstGoalieGamelog(rows: Row[]): Map<number, Row> {
  const byGoalie = new Map<number, Row[]>();
  rows.forEach((row) => {
    const playerId = known(row.player_id);
    if (playerId === undefined) return;
    byGoalie.set(playerId, [...(byGoalie.get(playerId) ?? []), row]);
  });

  const total = (games: Row[], field: string) => {
    let sum = 0;
    for (const game of games) {
      const value = known(game[field]);
      if (value === undefined) return undefined;
      sum += value;
    }
    return sum;
  };
  const ratio = (made: number | undefined, attempts: number | undefined) =>
    made === undefined || attempts === undefined || attempts <= 0
      ? undefined
      : made / attempts;
  const percent = (value: number | undefined) =>
    value === undefined ? undefined : value * 100;

  const aggregated = new Map<number, Row>();
  byGoalie.forEach((games, playerId) => {
    const gamesPlayed = games.reduce((sum, game) => sum + (known(game.gp) ?? 0), 0);
    if (gamesPlayed <= 0) return;

    const saves = total(games, "saves");
    const shotsAgainst = total(games, "shots_against");
    const goalsAgainst = total(games, "goals_against");
    const toiMinutes = total(games, "toi");

    aggregated.set(playerId, {
      games_played: gamesPlayed,
      saves,
      goals_against: goalsAgainst,
      shots_against: shotsAgainst,
      save_pct: ratio(saves, shotsAgainst),
      goals_against_avg:
        goalsAgainst === undefined || toiMinutes === undefined || toiMinutes <= 0
          ? undefined
          : (goalsAgainst * 60) / toiMinutes,
      time_on_ice: toiMinutes,
      gsaa: undefined,
      xg_against: total(games, "xg_against"),
      hd_shots_against: total(games, "hd_shots_against"),
      hd_saves: total(games, "hd_saves"),
      hd_save_pct: percent(
        ratio(total(games, "hd_saves"), total(games, "hd_shots_against"))
      ),
      md_save_pct: percent(
        ratio(total(games, "md_saves"), total(games, "md_shots_against"))
      ),
      ld_save_pct: undefined
    });
  });
  return aggregated;
}

export interface RosterPlayerSources {
  skaterStat?: Row;
  advancedStat?: Row;
  onIceStat?: Row;
  ratesStat?: Row;
  goalieStat?: Row;
}

/**
 * One Roster Matrix row. Unknown values stay undefined and render as a dash
 * (NST season views return NULL for unknown or zero-denominator rates and
 * shares). Age and height reuse the WiGO biography helpers (W3-3 D4).
 */
export function buildRosterPlayer(
  player: Row,
  { skaterStat, advancedStat, onIceStat, ratesStat, goalieStat }: RosterPlayerSources,
  today: Date = new Date()
): PlayerData {
  const isGoalie = player.position === "G";
  const age = getAge(player.birthDate, today);
  const height = formatHeight(player.heightInCentimeters);
  const weightLbs = player.weightInKilograms
    ? Math.round(player.weightInKilograms * 2.20462)
    : undefined;
  const skaterOnly = (value: unknown) => (isGoalie ? undefined : known(value));
  const goalieOnly = (value: unknown) => (isGoalie ? known(value) : undefined);
  const shootingPct = known(skaterStat?.shooting_percentage);
  const savePct = known(goalieStat?.save_pct);

  return {
    id: player.id,
    nhl_player_name: player.fullName || "Unknown Player",
    mapped_position: player.position || "C",
    age: typeof age === "number" ? age : undefined,
    sweater_number: player.sweater_number || undefined,
    height: height === "—" ? undefined : height,
    weight: weightLbs,
    shoots_catches: skaterStat?.shoots_catches || goalieStat?.shoots_catches,

    // For goalies, use goalie-specific stats; for skaters, use skater stats
    games_played: isGoalie
      ? goalieStat?.games_played || 0
      : skaterStat?.games_played || advancedStat?.gp || 0,
    goals: isGoalie
      ? goalieStat?.goals || 0
      : skaterStat?.goals || advancedStat?.goals || 0,
    assists: isGoalie
      ? goalieStat?.assists || 0
      : skaterStat?.assists || advancedStat?.total_assists || 0,
    points: isGoalie
      ? (goalieStat?.goals || 0) + (goalieStat?.assists || 0)
      : skaterStat?.points || advancedStat?.total_points || 0,
    plus_minus: skaterStat?.plus_minus || 0,
    pim: skaterStat?.penalty_minutes || advancedStat?.pim || 0,
    shots: skaterStat?.shots || advancedStat?.shots || 0,
    shooting_percentage:
      shootingPct === undefined ? undefined : shootingPct * 100,
    toi_per_game: known(skaterStat?.toi_per_game),
    pp_toi_per_game: known(skaterStat?.pp_toi_per_game),

    // Advanced stats (already in percentage form) - only for skaters
    cf_pct: skaterOnly(onIceStat?.cf_pct),
    xgf_pct: skaterOnly(onIceStat?.xgf_pct),
    hdcf_pct: skaterOnly(onIceStat?.hdcf_pct),
    pdo: skaterOnly(onIceStat?.pdo),
    total_points_per_60: skaterOnly(ratesStat?.total_points_per_60),
    ixg_per_60: skaterOnly(ratesStat?.ixg_per_60),

    // Goalie stats (prefer season totals, fallback to aggregated gamelog data)
    wins: isGoalie ? goalieStat?.wins || 0 : 0,
    losses: isGoalie ? goalieStat?.losses || 0 : 0,
    save_pct: isGoalie && savePct !== undefined ? savePct * 100 : undefined,
    goals_against_avg: goalieOnly(goalieStat?.goals_against_avg),
    shutouts: isGoalie ? goalieStat?.shutouts || 0 : 0,

    // Advanced goalie stats
    gsaa: goalieOnly(goalieStat?.gsaa),
    hd_save_pct: goalieOnly(goalieStat?.hd_save_pct),
    md_save_pct: goalieOnly(goalieStat?.md_save_pct),
    ld_save_pct: goalieOnly(goalieStat?.ld_save_pct),
    xg_against: goalieOnly(goalieStat?.xg_against)
  };
}

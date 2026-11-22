import { ROLLING_WINDOW_COUNT_SUPPORT_VERSION, ROLLING_WINDOW_COUNT_CURRENT_SEASON_VERSION } from "lib/rollingPlayerWindowCountSupport";
import type { FakeDb } from "./fakeSupabase";

export function seedDailyRankingInput(db: FakeDb, season: number, id: number, date: string, goals: number, gameId: number) {
  const row = { player_id: id, game_date: date, season, strength_state: "5v5", team_id: id % 2 ? 22 : 10,
    game_id: gameId, updated_at: `${date}T06:00:00.000Z`, line_combo_group: "forward", line_combo_slot: 1,
    pp_unit: null, games_played: 20, season_games_played: 20, toi_seconds_avg_season: 900,
    season_participation_games: 20, points_avg_season: goals / 10,
    oi_gf_avg_season: 2, oi_ga_avg_season: 1, oi_xgf_avg_season: 1.6, oi_xga_avg_season: 1.3 };
  const counts = {
    goals: ["goals", goals], assists: ["assists", goals], primary_assists: ["primary_assists", goals],
    hits: ["hits", 2 * goals], blocks: ["blocks", goals], sog: ["shots", 5 * goals],
    shot_attempts: ["shot_attempts", 8 * goals], ixg: ["ixg", 0.8 * goals],
    penalties_taken: ["penalties_taken", goals],
  } as const;
  const ratios = (n: number) => ({
    ...Object.fromEntries(Object.entries(counts).map(([metric, [, count]]) =>
      [metric + "_per_60", [count * n / 20, 900 * n, n]])),
    expected_sh_pct: [0.8 * goals * n / 20, 6 * goals * n / 20, n],
  });
  for (const [metric, [field, count]] of Object.entries(counts)) {
    Object.assign(row, { [metric + "_per_60_" + field + "_season"]: count,
      [metric + "_per_60_toi_seconds_season"]: 18000 });
  }
  const windows = Object.fromEntries([5, 10, 20].map(n => {
    const suffix = "_total_last" + n;
    Object.assign(row, { ["toi_seconds" + suffix]: n * 900, ["points" + suffix]: goals * n / 10,
      ["oi_gf" + suffix]: n * 2, ["oi_ga" + suffix]: n, ["oi_xgf" + suffix]: n * 1.6, ["oi_xga" + suffix]: n * 1.3 });
    return ["last" + n, { appearances: n, ratio: ratios(n), secondary: {},
      gameIds: Array.from({ length: n }, (_, i) => gameId - n + i + 1),
      gameDates: Array.from({ length: n }, (_, i) => new Date(Date.parse(date) - (n - 1 - i) * 86400000).toISOString().slice(0, 10)) }];
  }));
  db.tables.rolling_player_game_metrics.push(row);
  db.tables.rolling_player_metric_support_payloads.push({
    ...row, windowCountSupport: { version: ROLLING_WINDOW_COUNT_SUPPORT_VERSION, windows,
      strengthState: "5v5", anchor: { season, gameDate: date, gameId },
      currentSeason: { version: ROLLING_WINDOW_COUNT_CURRENT_SEASON_VERSION, season, seasonTotals: { ratio: ratios(20) } } },
  });
  db.tables.wgo_skater_stats.push({ player_id: id, date, season_id: season, game_id: gameId, games_played: 1 });
}

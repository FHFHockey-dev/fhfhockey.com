import { describe, expect, it } from "vitest";
import { buildScheduleSnapshot, weekDates } from "./schedule";
import { fictionalLeagueWeek } from "./fixtures";
import { fictionalTrendSources } from "./trendsFixture";
import { buildTrendLayer, deploymentChanges, hotCold, MIN_RATE_TOI_SECONDS_LAST5, MIN_TREND_SEASON_GAMES, MOVER_WINDOW_DAYS, ownershipMovers, rateStandouts, TREND_MAX_GAME_AGE_DAYS } from "./trends";
import type { SocialShareSnapshot } from "./types";

const weekStart = "2026-10-26", now = "2026-10-27T13:00:00Z", season = 20262027;
function edition(sources: ReturnType<typeof fictionalTrendSources> | null = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z")): SocialShareSnapshot {
  const snapshot = buildScheduleSnapshot({ format: "tuesday-trends", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, trends: buildTrendLayer(sources, { season, teams: snapshot.teams, fetchedAt: now, generatedAt: now }) };
}

describe("trend layer", () => {
  it("keeps the latest strength-all row per current skater with five-games-earlier line and PP context", () => {
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z"), layer = edition(sources).trends!;
    expect(layer).toMatchObject({ state: "ready", moversState: "ready", metricsUpdatedAt: "2026-10-27T08:00:00.000Z", ownershipAsOf: "2026-10-27", moverWindowDays: MOVER_WINDOW_DAYS });
    expect(layer.reasons[0]).toMatch(/^Excluded 0 stale, 0 future-dated and \d+ inactive skaters\.$/);
    const oldest = new Date(Date.parse("2026-10-27T00:00:00Z") - TREND_MAX_GAME_AGE_DAYS * 86400000).toISOString().slice(0, 10);
    for (const player of layer.players) {
      expect(player.position).not.toBe("G");
      expect(player.seasonGames).toBeGreaterThanOrEqual(MIN_TREND_SEASON_GAMES);
      expect(player.lastGame >= oldest).toBe(true);
      const rows = sources.rolling.filter(row => row.player_id === player.nhlId).sort((a, b) => a.game_date.localeCompare(b.game_date));
      expect(player.pointsPerGame).toEqual({ last5: rows[5].points_avg_last5, season: rows[5].points_avg_season });
      expect(player.line).toEqual({ now: rows[5].line_combo_slot, before: rows[0].line_combo_slot, group: rows[5].line_combo_group });
      expect(player.ppUnit).toEqual({ now: rows[5].pp_unit, before: rows[0].pp_unit });
    }
    expect(layer.players.length).toBeLessThan(new Set(sources.rolling.map(row => row.player_id)).size);
    expect(JSON.stringify(layer)).not.toMatch(/465\.p\.|ownership_timeline|updated_at/);
  });

  it("gates freshness per skater and marks a mostly stale source stale", () => {
    const mixed = fictionalTrendSources(season, "2026-10-27", "2026-10-20T00:00:00Z");
    const fresh = mixed.rolling.find(row => row.player_id === 8480001)!.player_id;
    for (const row of mixed.rolling.filter(item => item.player_id === fresh)) row.updated_at = "2026-10-27T08:00:00Z";
    const layer = edition(mixed).trends!;
    expect(layer.state).toBe("stale");
    expect(layer.reasons[0]).toMatch(/^Most rolling metric rows are stale \(\d+ of \d+\)\.$/);
    expect(hotCold({ ...edition(), trends: layer }, true)).toEqual({ hot: [], cold: [] });
    expect(edition(null).trends).toMatchObject({ state: "missing", moversState: "missing", players: [], movers: [] });
  });

  it("computes movers with the ownership-trends rule and gates stale ownership separately", () => {
    const sources = fictionalTrendSources(season, "2026-10-27", "2026-10-27T08:00:00Z"), layer = edition(sources).trends!;
    for (const mover of layer.movers) {
      const timeline = sources.ownership.find(row => row.player_name === mover.name)!.ownership_timeline as { date: string; value: number }[];
      expect(mover.latestDate).toBe("2026-10-27");
      expect(mover.previousDate).toBe("2026-10-22");
      expect(mover.delta).toBeCloseTo(timeline[6].value - timeline[1].value, 10);
    }
    const old = fictionalTrendSources(season, "2026-10-24", "2026-10-27T08:00:00Z");
    const staleOwnership = edition({ ...sources, ownership: old.ownership }).trends!;
    expect(staleOwnership).toMatchObject({ state: "ready", moversState: "stale" });
    expect(ownershipMovers({ ...edition(), trends: staleOwnership }, true)).toEqual({ risers: [], fallers: [] });
    expect(hotCold({ ...edition(), trends: staleOwnership }, true).hot.length).toBeGreaterThan(0);
  });
});

describe("trend cards", () => {
  it("hot and cold rank last-5 minus season points per game, five each", () => {
    const { hot, cold } = hotCold(edition(), true);
    expect(hot).toHaveLength(5); expect(cold).toHaveLength(5);
    for (const pick of hot) expect(pick.delta).toBeCloseTo(pick.pointsPerGame.last5! - pick.pointsPerGame.season!, 12);
    for (let i = 1; i < 5; i++) { expect(hot[i - 1].delta).toBeGreaterThanOrEqual(hot[i].delta); expect(cold[i - 1].delta).toBeLessThanOrEqual(cold[i].delta); }
    expect(hot.every(pick => pick.delta > 0) && cold.every(pick => pick.delta < 0)).toBe(true);
    expect(hot.every(pick => pick.weekGames !== null)).toBe(true);
  });

  it("deployment ranks TOI per game change; rate standouts need 50 last-5 minutes", () => {
    const { up, down } = deploymentChanges(edition(), true);
    expect(up).toHaveLength(4); expect(down).toHaveLength(4);
    for (const pick of [...up, ...down]) expect(pick.delta).toBe(pick.toiSeconds.last5! - pick.toiSeconds.season!);
    const rates = rateStandouts(edition(), true);
    for (const [metric, list] of Object.entries(rates)) {
      expect(list).toHaveLength(3);
      for (const pick of list) { expect(pick.toiSecondsLast5).toBeGreaterThanOrEqual(MIN_RATE_TOI_SECONDS_LAST5); expect(pick.delta).toBeGreaterThan(0); expect(pick[metric as "sogPer60"].last5).toBe(pick.last5); }
    }
  });

  it("movers rank five-day rostered-% change and nothing ranks for an untrusted schedule", () => {
    const { risers, fallers } = ownershipMovers(edition(), true);
    expect(risers).toHaveLength(5); expect(fallers).toHaveLength(5);
    for (let i = 1; i < 5; i++) { expect(risers[i - 1].delta).toBeGreaterThanOrEqual(risers[i].delta); expect(fallers[i - 1].delta).toBeLessThanOrEqual(fallers[i].delta); }
    expect(hotCold(edition(), false)).toEqual({ hot: [], cold: [] });
    expect(ownershipMovers(edition(), false)).toEqual({ risers: [], fallers: [] });
    expect(weekDates(weekStart)).toHaveLength(7);
  });
});

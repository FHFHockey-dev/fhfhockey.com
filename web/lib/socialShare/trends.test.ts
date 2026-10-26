import { describe, expect, it } from "vitest";
import { teamsInfo } from "lib/teamsInfo";
import { buildScheduleSnapshot, weekDates } from "./schedule";
import { fictionalLeagueWeek } from "./fixtures";
import { fictionalTrendSources } from "./trendsFixture";
import { buildTrendLayer, deploymentChanges, DEPLOYMENT_LIST, hotCold, RECENT_FORM_GAMES, MIN_RATE_TOI_SECONDS_LAST5, ownershipMovers, RATE_LIST, rateStandouts, TREND_LIST, TREND_MAX_GAME_AGE_DAYS, trendSectionReady,
  type ShareRollingRow, type ShareTrendSources } from "./trends";
import type { SocialShareSnapshot } from "./types";

const weekStart = "2026-10-26", now = "2026-10-27T13:00:00Z", today = "2026-10-27", season = 20262027;
const context = { season, fetchedAt: now, generatedAt: now };
const fresh = "2026-10-27T08:00:00Z";
const fixture = (options?: Parameters<typeof fictionalTrendSources>[3]) => fictionalTrendSources(season, today, fresh, options);
function edition(sources: ShareTrendSources | null = fixture()): SocialShareSnapshot {
  const snapshot = buildScheduleSnapshot({ format: "tuesday-trends", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, trends: buildTrendLayer(sources, context) };
}
const rowsOf = <T,>(read: { rows: T[] } | { failed: string }) => "rows" in read ? read.rows : [];

// A hand-built skater: one strength-all row per game, newest first, all fresh and on TOR.
const TOR = teamsInfo.TOR.id, MTL = teamsInfo.MTL.id;
function skater(id: number, games: Partial<ShareRollingRow>[], base: Partial<ShareRollingRow> = {}): ShareRollingRow[] {
  return games.map((game, index) => ({
    player_id: id, team_id: TOR, season, game_id: 9000 + index, game_date: `2026-10-${26 - index * 2}`, strength_state: "all", updated_at: fresh, season_games_played: 20 - index,
    points_avg_season: 0.6, points_total_last5: 3, points_total_last10: 5, toi_seconds_avg_last5: 1100, toi_seconds_avg_season: 1100, toi_seconds_total_last5: 5500,
    pp_toi_seconds_total_last5: 600, pp_toi_seconds_avg_season: 120, sog_per_60_last5: 9, sog_per_60_season: 8, shot_attempts_per_60_last5: 16, shot_attempts_per_60_season: 15,
    ixg_per_60_last5: 0.9, ixg_per_60_season: 0.8, line_combo_slot: 2, line_combo_group: "forward", pp_unit: 1, ...base, ...game,
  }));
}
function sources(rolling: ShareRollingRow[], extra: Partial<ShareTrendSources> = {}): ShareTrendSources {
  const ids = [...new Set(rolling.map(row => row.player_id))];
  return { rolling: { rows: rolling }, ev: { rows: [] }, ppc: { rows: [] }, ownership: { rows: [] }, map: { rows: [] },
    players: { rows: ids.map(id => ({ id, fullName: `Skater ${id}`, position: "C" as const })) }, ...extra };
}

describe("Recent Form (recent-form-v1-early)", () => {
  it("compares P/GP over the last 5 appearances with the preceding 5, with no overlap", () => {
    // 20 GP, 12 season points; 6 in the last five and 8 in the last ten → last 5 1.20, preceding 0.40, change +0.80.
    const layer = buildTrendLayer(sources(skater(1, [{ points_total_last5: 6, points_total_last10: 8 }, {}])), context);
    expect(layer.sections.hot).toMatchObject({ rule: "recent-form-v1-early", qualifiers: 1, cold: [] });
    expect(layer.sections.hot.hot).toEqual([expect.objectContaining({ nhlId: 1, recent: 1.2, preceding: 0.4, delta: 0.8, team: "TOR", lastGame: "2026-10-26" })]);
  });

  it("needs all 10 appearances this season, proven whole season points and valid windows; missing is never zero", () => {
    expect(RECENT_FORM_GAMES).toBe(10); expect(TREND_MAX_GAME_AGE_DAYS).toBe(7);
    const ok = skater(2, [{ season_games_played: 10, points_avg_season: 0.8, points_total_last5: 6, points_total_last10: 8 }]);
    const nine = skater(3, [{ season_games_played: 9, points_avg_season: 1, points_total_last5: 6, points_total_last10: 8 }]);
    const noLast10 = skater(4, [{ points_total_last5: 6, points_total_last10: null }]);
    const unproven = skater(5, [{ points_avg_season: 0.613, points_total_last5: 6, points_total_last10: 8 }]);
    const overlap = skater(6, [{ points_total_last5: 6, points_total_last10: 5 }]);
    const pastSeason = skater(7, [{ points_total_last5: 6, points_total_last10: 13 }]);
    const old = skater(8, [{ game_date: "2026-10-19", points_total_last5: 6, points_total_last10: 8 }]);
    const layer = buildTrendLayer(sources([...ok, ...nine, ...noLast10, ...unproven, ...overlap, ...pastSeason, ...old]), context);
    expect(layer.sections.hot.hot.map(row => row.nhlId)).toEqual([2]);
    expect(layer.sections.hot.qualifiers).toBe(1);
  });

  it("an empty Recent Form is ready with zero qualifiers and does not block the other sections", () => {
    const layer = buildTrendLayer(sources(skater(9, [{ season_games_played: 6, toi_seconds_avg_last5: 1300, sog_per_60_last5: 12 }])), context);
    expect(layer.sections.hot).toMatchObject({ state: "ready", qualifiers: 0, hot: [], cold: [] });
    // Rates and deployment need 10 season games, so give them their own skater.
    const other = buildTrendLayer(sources([...skater(9, [{ season_games_played: 6 }]), ...skater(10, [{ toi_seconds_avg_last5: 1300, sog_per_60_last5: 12 }])]), context);
    expect(other.sections.deployment.up.map(row => row.nhlId)).toEqual([10]);
    expect(other.sections.rates.sogPer60.map(row => row.nhlId)).toEqual([10]);
  });

  it("ranks five each way from the fixture with consistent rounding", () => {
    const { hot, cold } = hotCold(edition(), true);
    expect(hot).toHaveLength(TREND_LIST); expect(cold).toHaveLength(TREND_LIST);
    for (const row of [...hot, ...cold]) { expect(row.delta).toBe(Number((row.recent - row.preceding).toFixed(2))); expect(row.position).not.toBe("G"); }
    for (let i = 1; i < TREND_LIST; i++) { expect(hot[i - 1].delta).toBeGreaterThanOrEqual(hot[i].delta); expect(cold[i - 1].delta).toBeLessThanOrEqual(cold[i].delta); }
    expect(hot.every(row => row.weekGames !== null)).toBe(true);
    expect(edition().trends!.sections.hot.qualifiers).toBeGreaterThan(2 * TREND_LIST);
  });
});

describe("deployment", () => {
  it("lists a line promotion even when TOI is flat, with EV and PP TOI", () => {
    const rows = skater(5, [{ line_combo_slot: 1 }, { line_combo_slot: 3 }]);
    const layer = buildTrendLayer(sources(rows, { ppc: { rows: [{ gameId: 9000, playerId: 5, unit: 1 }, { gameId: 9001, playerId: 5, unit: 1 }] },
      ev: { rows: [{ player_id: 5, season, game_date: "2026-10-26", strength_state: "ev", toi_seconds_avg_last5: 900, toi_seconds_avg_season: 880 }] } }), context);
    expect(layer.sections.deployment.up).toEqual([expect.objectContaining({ nhlId: 5, delta: 0, lineChange: 1, ppChange: 0, line: { now: "L1", before: "L3" }, ppUnit: { now: 1, before: 1 },
      toi: { l5: 1100, season: 1100 }, ev: { l5: 900, season: 880 }, pp: { l5: 120, season: 120 } })]);
  });

  it("tells PP unknown (no rows for the game) from none (rows without the player)", () => {
    // Player 6 dropped off PP1: the latest game has PP rows that do not list him. Player 7's latest game has no PP rows.
    const six = skater(6, [{ pp_unit: null }, { pp_unit: 1 }]), seven = skater(7, [{ pp_unit: null, game_id: 9100 }, { pp_unit: 1, game_id: 9101 }]);
    const layer = buildTrendLayer(sources([...six, ...seven], { ppc: { rows: [{ gameId: 9000, playerId: 99, unit: 1 }, { gameId: 9001, playerId: 6, unit: 1 }, { gameId: 9101, playerId: 7, unit: 1 }] } }), context);
    expect(layer.sections.deployment.down).toEqual([expect.objectContaining({ nhlId: 6, ppUnit: { now: "none", before: 1 }, ppChange: -1 })]);
    // Unknown never becomes a change: player 7 has no line/PP change and flat TOI, so he is not listed.
    expect([...layer.sections.deployment.up, ...layer.sections.deployment.down].map(row => row.nhlId)).not.toContain(7);
  });

  it("does not compare lines across a team change, and needs contiguous games", () => {
    const traded = skater(8, [{ line_combo_slot: 1 }, { line_combo_slot: 3, team_id: MTL }]);
    const gap = skater(9, [{ line_combo_slot: 1 }, { line_combo_slot: 3, season_games_played: 17 }]);
    const layer = buildTrendLayer(sources([...traded, ...gap]), context);
    expect([...layer.sections.deployment.up, ...layer.sections.deployment.down]).toEqual([]);
    const moved = buildTrendLayer(sources(skater(8, [{ line_combo_slot: 1, toi_seconds_avg_last5: 1300 }, { line_combo_slot: 3, team_id: MTL }])), context);
    expect(moved.sections.deployment.up).toEqual([expect.objectContaining({ nhlId: 8, team: "TOR", teamChange: true, lineChange: 0, line: { now: "L1", before: null }, ppUnit: { now: 1, before: null } })]);
  });

  it("a TOI change of 1:00 or more sets the column by its sign, whatever the role chips say (TT-3)", () => {
    // More ice but demoted (Carrier case) → up; less ice but promoted (Greene case) → down. Chips keep their arrows.
    const carrier = skater(30, [{ toi_seconds_avg_last5: 1204, line_combo_slot: 3, line_combo_group: "defense" }, { line_combo_slot: 1, line_combo_group: "defense" }]);
    const greene = skater(31, [{ toi_seconds_avg_last5: 976, line_combo_slot: 3 }, { line_combo_slot: 4 }]);
    const layer = buildTrendLayer(sources([...carrier, ...greene]), context), { up, down } = layer.sections.deployment;
    expect(up).toEqual([expect.objectContaining({ nhlId: 30, driver: "toi", delta: 104, lineChange: -1 })]);
    expect(down).toEqual([expect.objectContaining({ nhlId: 31, driver: "toi", delta: -124, lineChange: 1 })]);
  });

  it("role-only rows follow the role direction; mixed-direction role-only rows are left out", () => {
    const promoted = skater(32, [{ line_combo_slot: 1, toi_seconds_avg_last5: 1080 }, { line_combo_slot: 3 }]);
    const mixed = skater(33, [{ line_combo_slot: 1, pp_unit: 2 }, { line_combo_slot: 3, pp_unit: 1 }]);
    const layer = buildTrendLayer(sources([...promoted, ...mixed]), context);
    expect(layer.sections.deployment.up).toEqual([expect.objectContaining({ nhlId: 32, driver: "role", delta: -20 })]);
    expect(layer.sections.deployment.down).toEqual([]);
  });

  it("no listed row's hero contradicts its column", () => {
    for (const [column, rows] of Object.entries(deploymentChanges(edition(), true))) for (const row of rows) {
      if (row.driver === "toi") expect(Math.sign(row.delta)).toBe(column === "up" ? 1 : -1);
      else { expect(Math.abs(row.delta)).toBeLessThan(60); expect(Math.sign(row.lineChange + row.ppChange)).toBe(column === "up" ? 1 : -1); expect(row.lineChange * row.ppChange).toBeGreaterThanOrEqual(0); }
    }
  });

  it("fixture deployment lists four each way and needs EV, PP and rolling sources", () => {
    const { up, down } = deploymentChanges(edition(), true);
    expect(up).toHaveLength(DEPLOYMENT_LIST); expect(down).toHaveLength(DEPLOYMENT_LIST);
    const failed = edition({ ...fixture(), ev: { failed: "Even-strength rolling rows read failed (57014 timeout)" } });
    expect(failed.trends!.sections.deployment).toMatchObject({ state: "missing", up: [], down: [], reasons: ["Even-strength rolling rows unavailable: Even-strength rolling rows read failed (57014 timeout)"] });
    expect(trendSectionReady(failed, "hot")).toBe(true);
  });
});

describe("rate standouts", () => {
  it("shows the L5 rate and Δ/60 with a 50-minute L5 floor", () => {
    const thin = skater(10, [{ toi_seconds_total_last5: MIN_RATE_TOI_SECONDS_LAST5 - 1, sog_per_60_last5: 20 }]), ok = skater(11, [{ toi_seconds_total_last5: MIN_RATE_TOI_SECONDS_LAST5, sog_per_60_last5: 12.04 }]);
    const layer = buildTrendLayer(sources([...thin, ...ok]), context);
    expect(layer.sections.rates.sogPer60).toEqual([expect.objectContaining({ nhlId: 11, l5: 12, season: 8, delta: 4, l5Minutes: 50 })]);
    const rates = rateStandouts(edition(), true);
    for (const list of Object.values(rates)) { expect(list).toHaveLength(RATE_LIST); for (const row of list) { expect(row.l5Minutes).toBeGreaterThanOrEqual(50); expect(row.delta).toBeGreaterThan(0); } }
  });
});

describe("ownership movers", () => {
  it("compares the latest observation with the latest on or before five days earlier, in percentage points", () => {
    const layer = edition().trends!;
    expect(layer).toMatchObject({ ownershipLatestDate: "2026-10-27", ownershipPreviousDate: "2026-10-22" });
    const { risers, fallers } = ownershipMovers(edition(), true);
    expect(risers).toHaveLength(TREND_LIST); expect(fallers).toHaveLength(TREND_LIST);
    const rows = rowsOf(fixture().ownership), map = rowsOf(fixture().map);
    for (const mover of [...risers, ...fallers]) {
      const keys = map.filter(row => row.nhl_player_id === String(mover.nhlId)).map(row => row.yahoo_player_id);
      const obs = rows.filter(row => keys.includes(row.player_key) || keys.includes(String(row.player_id)));
      const at = (date: string) => Math.round(obs.find(row => row.ownership_date === date)!.ownership_pct! * 10) / 10;
      expect(mover.latest).toBe(at("2026-10-27")); expect(mover.previous).toBe(at("2026-10-22"));
      expect(mover.delta).toBe(Number((mover.latest - mover.previous).toFixed(1)));
      expect(mover.position).not.toBe("G");
    }
  });

  it("never treats a missing observation as 0%", () => {
    const base = sources(skater(12, [{}]), { map: { rows: [{ yahoo_player_id: "k12", nhl_player_id: "12" }, { yahoo_player_id: "k13", nhl_player_id: "12" }] } });
    const layer = buildTrendLayer({ ...base, ownership: { rows: [
      { player_key: "k12", player_id: null, ownership_date: "2026-10-27", ownership_pct: 40 },
      { player_key: "k99", player_id: null, ownership_date: "2026-10-22", ownership_pct: 10 },
    ] } }, context);
    expect(layer.sections.movers).toMatchObject({ state: "ready", risers: [], fallers: [] });
  });

  it("drops an ambiguous id mapping and gates stale ownership with its date", () => {
    const ambiguous = buildTrendLayer({ ...sources([...skater(12, [{}]), ...skater(14, [{}])]), map: { rows: [{ yahoo_player_id: "k12", nhl_player_id: "12" }, { yahoo_player_id: "k12", nhl_player_id: "14" }] }, ownership: { rows: [
      { player_key: "k12", player_id: null, ownership_date: "2026-10-27", ownership_pct: 40 }, { player_key: "k12", player_id: null, ownership_date: "2026-10-22", ownership_pct: 10 },
    ] } }, context);
    expect(ambiguous.sections.movers).toMatchObject({ state: "ready", risers: [] });
    const single = buildTrendLayer({ ...sources(skater(12, [{}])), map: { rows: [{ yahoo_player_id: "k12", nhl_player_id: "12" }] }, ownership: { rows: [
      { player_key: "k12", player_id: null, ownership_date: "2026-10-27", ownership_pct: 40.04 }, { player_key: "k12", player_id: null, ownership_date: "2026-10-22", ownership_pct: 10.06 },
    ] } }, context);
    expect(single.sections.movers.risers).toEqual([expect.objectContaining({ nhlId: 12, latest: 40, previous: 10.1, delta: 29.9 })]);
    const stale = edition({ ...fixture(), ownership: fixture({ ownershipThrough: "2026-10-24" }).ownership }).trends!;
    expect(stale.sections.movers).toMatchObject({ state: "stale", reasons: ["Yahoo ownership is stale: last observed Oct 24."], risers: [] });
    expect(stale.sections.hot.state).toBe("ready");
  });
});

describe("sources and freshness", () => {
  it("only listed skaters leave the layer, with team from the per-game team_id and no Yahoo keys", () => {
    const sources = fixture(), layer = edition(sources).trends!;
    const listed = Object.values(layer.sections).flatMap(section => Object.values(section).filter(Array.isArray).flat() as { nhlId?: number; team?: string }[]).filter(row => typeof row === "object" && row && "nhlId" in row);
    expect(listed.length).toBeLessThanOrEqual(2 * TREND_LIST + 2 * DEPLOYMENT_LIST + 3 * RATE_LIST + 2 * TREND_LIST);
    const latestTeam = (id: number) => { const rows = rowsOf(sources.rolling).filter(row => row.player_id === id).sort((a, b) => b.game_date.localeCompare(a.game_date)); return Object.entries(teamsInfo).find(([, info]) => info.id === rows[0].team_id)![0]; };
    for (const row of listed) expect(row.team).toBe(latestTeam(row.nhlId!));
    expect(JSON.stringify(layer)).not.toMatch(/465\.p\.|player_key|updated_at|Fixture [A-Z]{3}-T13/);
  });

  it("judges freshness by the writer's newest row, so a skater idle for four days stays current (TT-2 capture)", () => {
    // Player 20 last played Oct 22; the daily writer never rewrites that row, so its updated_at is 5 days old.
    const idle = skater(20, [{ game_date: "2026-10-22", updated_at: "2026-10-23T10:10:00Z", points_total_last5: 6, points_total_last10: 8 }]), busy = skater(21, [{ points_total_last5: 6, points_total_last10: 8 }]);
    const layer = buildTrendLayer(sources([...idle, ...busy]), context);
    expect(layer.sections.hot.hot.map(row => row.nhlId).sort()).toEqual([20, 21]);
    expect(layer).toMatchObject({ metricsUpdatedAt: "2026-10-27T08:00:00.000Z", metricsThrough: "2026-10-26" });
    expect(layer.sections.hot.reasons).toEqual([]);
  });

  it("stale rolling rows block metric sections with the as-of date; a failed read names the source", () => {
    const stale = edition(fictionalTrendSources(season, today, "2026-10-20T00:00:00Z")).trends!;
    expect(stale.sections.hot).toMatchObject({ state: "stale", hot: [] });
    expect(stale.sections.hot.reasons[0]).toBe("Rolling metrics are stale: last updated Oct 20 (newest row older than 72 h).");
    expect(stale.sections.movers.state).toBe("stale");
    const failed = edition({ ...fixture(), rolling: { failed: "Rolling game metrics read failed (PGRST000)" } }).trends!;
    for (const section of Object.values(failed.sections)) expect(section.state).toBe("missing");
    expect(failed.sections.rates.reasons).toEqual(["Rolling game metrics unavailable: Rolling game metrics read failed (PGRST000)"]);
    expect(edition(null).trends!.sections.hot).toMatchObject({ state: "missing", reasons: ["Rolling game metrics and ownership were not read."] });
  });

  it("nothing ranks for an untrusted schedule", () => {
    expect(hotCold(edition(), false)).toEqual({ hot: [], cold: [] });
    expect(ownershipMovers(edition(), false)).toEqual({ risers: [], fallers: [] });
    expect(weekDates(weekStart)).toHaveLength(7);
  });
});

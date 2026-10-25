import { describe, expect, it } from "vitest";
import { buildScheduleSnapshot, selectScheduleDates, weekDates } from "./schedule";
import { fictionalLeagueWeek } from "./fixtures";
import { fictionalPlayerSources } from "./pickupsFixture";
import { buildPlayerLayer, MIN_GOALIE_STARTS, MIN_SKATER_GAMES, PICKUP_BANDS, PLAYER_TEAM_RANK_MAX, pickupTiers, positionGroup, resolveOwnership, specialists, type RankedPlayer } from "./players";
import type { SocialShareSnapshot } from "./types";

const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", season = 20262027;
const teams = (snapshot: SocialShareSnapshot) => snapshot.teams.map(team => team.abbreviation);
function edition(observedOn = "2026-10-26", statsUpdatedAt = "2026-10-26T08:00:00Z", sources: ReturnType<typeof fictionalPlayerSources> | null = fictionalPlayerSources(season, observedOn, statsUpdatedAt)): SocialShareSnapshot {
  const snapshot = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, players: buildPlayerLayer(sources, { season, teams: teams(snapshot), fetchedAt: now, generatedAt: now }) };
}

describe("player layer", () => {
  it("joins ownership, NHL ids and season totals into public rows only", () => {
    const sources = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"), layer = edition().players!;
    expect(layer).toMatchObject({ state: "ready", reasons: [], ownershipAsOf: "2026-10-26", statsUpdatedAt: "2026-10-26T08:00:00.000Z" });
    expect(JSON.stringify(layer)).not.toMatch(/465\.p\.|ownership_timeline|player_key|editorial/);
    const excludedStatus = sources.yahoo.filter(row => row.status === "IR").map(row => Number(sources.map.find(item => item.yahoo_player_id === row.player_key)!.nhl_player_id));
    expect(excludedStatus.length).toBeGreaterThan(0);
    expect(layer.players.some(player => excludedStatus.includes(player.nhlId))).toBe(false);
    expect(sources.yahoo.some(row => row.status === "DTD")).toBe(true);
    for (const player of layer.players) {
      if (player.group === "G") expect(player.gamesStarted).toBeGreaterThanOrEqual(MIN_GOALIE_STARTS);
      else expect(player.gamesPlayed).toBeGreaterThanOrEqual(MIN_SKATER_GAMES);
    }
    expect(sources.goalies.some(row => row.games_started! < MIN_GOALIE_STARTS)).toBe(true);
  });

  it("drops unmapped players, other seasons, small samples and team mismatches", () => {
    const sources = fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z");
    const [unmapped, otherSeason, small, moved] = sources.skaters.slice(0, 4).map(row => row.player_id);
    sources.map = sources.map.filter(row => Number(row.nhl_player_id) !== unmapped);
    sources.skaters.find(row => row.player_id === otherSeason)!.season = String(season - 10001);
    sources.skaters.find(row => row.player_id === small)!.games_played = MIN_SKATER_GAMES - 1;
    sources.skaters.find(row => row.player_id === moved)!.current_team_abbreviation = "ZZZ";
    const ids = edition(undefined, undefined, sources).players!.players.map(player => player.nhlId);
    for (const id of [unmapped, otherSeason, small, moved]) expect(ids).not.toContain(id);
  });

  it("is stale or missing for old, future or absent sources", () => {
    expect(edition("2026-10-25").players!.state).toBe("ready");
    expect(edition("2026-10-24").players!.state).toBe("stale");
    expect(edition(undefined, "2026-10-23T03:00:00Z").players!.state).toBe("stale");
    expect(edition("2026-10-27").players!.state).toBe("missing");
    expect(edition(undefined, undefined, null).players).toMatchObject({ state: "missing", players: [] });
  });

  it("gates freshness per player: one fresh row never makes stale rows current (C7 SS1-4-F1)", () => {
    const fresh = "2026-10-26", old = "2026-10-01";
    const mixed = fictionalPlayerSources(season, old, "2026-10-26T08:00:00Z");
    const keep = mixed.yahoo.find(row => row.status === null && row.position_type === "P")!;
    keep.ownership_timeline = [{ date: fresh, value: keep.percent_ownership }];
    const stale = edition(undefined, undefined, mixed).players!;
    expect(stale.state).toBe("stale");
    expect(stale.reasons[0]).toMatch(/^Most player rows are stale \(\d+ of \d+\)/);
    expect(stale.players.map(player => player.nhlId)).toEqual([Number(mixed.map.find(item => item.yahoo_player_id === keep.player_key)!.nhl_player_id)]);
    expect(pickupTiers({ ...edition(), players: stale }, true)).toEqual([]);

    // A few stale rows are dropped individually; the card's as-of is the oldest included one.
    const few = fictionalPlayerSources(season, fresh, "2026-10-26T08:00:00Z");
    const oldOwnership = few.yahoo.slice(0, 5), oldTotals = few.skaters.slice(10, 13), yesterday = few.yahoo[40];
    for (const row of oldOwnership) row.ownership_timeline = [{ date: old, value: row.percent_ownership }];
    for (const row of oldTotals) row.updated_at = "2026-10-22T00:00:00Z";
    yesterday.ownership_timeline = [{ date: "2026-10-25", value: yesterday.percent_ownership }];
    const layer = edition(undefined, undefined, few).players!, ids = layer.players.map(player => player.nhlId);
    expect(layer.state).toBe("ready");
    for (const row of oldOwnership) expect(ids).not.toContain(Number(few.map.find(item => item.yahoo_player_id === row.player_key)!.nhl_player_id));
    for (const row of oldTotals) expect(ids).not.toContain(row.player_id);
    expect(ids).toContain(Number(few.map.find(item => item.yahoo_player_id === yesterday.player_key)!.nhl_player_id));
    expect(layer.ownershipAsOf).toBe("2026-10-25");
    expect(layer.reasons.some(reason => /^Excluded \d+ stale and 0 future-dated player rows\.$/.test(reason))).toBe(true);
  });

  it("places each skater in one group by primary position", () => {
    const row = (display: string, eligible: string[]) => ({ display_position: display, eligible_positions: eligible.map(position => ({ position })) });
    expect(positionGroup(row("C,D", ["C", "D"]))).toEqual({ group: "F", positions: "C,D" });
    expect(positionGroup(row("D,C", ["C", "D", "Util"]))).toEqual({ group: "D", positions: "C,D" });
    expect(positionGroup(row("", ["D", "LW"]))).toEqual({ group: "D", positions: "D,LW" });
    expect(positionGroup(row("LW,RW", ["LW", "RW"]))).toEqual({ group: "F", positions: "LW,RW" });
    expect(positionGroup(row("G", ["G"]))).toEqual({ group: "G", positions: "G" });
    expect(positionGroup(row("Util", ["Util", "BN"]))).toBeNull();
  });

  it("resolves ownership from the latest valid timeline point, else percent_ownership", () => {
    const [row] = fictionalPlayerSources(season, "2026-10-26", now).yahoo;
    expect(resolveOwnership({ ...row, ownership_timeline: [{ date: "2026-10-25", value: 40 }, { date: "2026-10-26", value: 12.5 }, { date: "2026-10-27x", value: 9 }] })).toEqual({ ownership: 12.5, asOf: "2026-10-26" });
    expect(resolveOwnership({ ...row, ownership_timeline: null, percent_ownership: 33, last_updated: "2026-10-24T09:00:00Z" })).toEqual({ ownership: 33, asOf: "2026-10-24" });
    expect(resolveOwnership({ ...row, ownership_timeline: [], percent_ownership: 120 })).toBeNull();
  });
});

const rate = (player: RankedPlayer) => player.group === "G" ? player.qualityStartPct! : player.pointsPerGame!;

describe("pickup tiers", () => {
  it("lists three F/D/G per band: top-10 Week Score teams by the existing rate, then wider-pool fill", () => {
    const tiers = pickupTiers(edition(), true);
    expect(tiers.map(tier => tier.max)).toEqual([50, 30, 20]);
    const seen = new Set<number>();
    for (const tier of tiers) for (const group of ["F", "D", "G"] as const) {
      const list = tier.groups[group];
      expect(list.length).toBeLessThanOrEqual(3);
      for (const player of list) {
        expect(player.group).toBe(group);
        expect(player.ownership).toBeLessThan(tier.max);
        expect(player.ownership).toBeGreaterThanOrEqual(tier.min);
        expect(player.widened).toBe(player.weekRank > PLAYER_TEAM_RANK_MAX);
        expect(seen.has(player.nhlId)).toBe(false); seen.add(player.nhlId);
      }
      // Top-10 players come first, by rate; any fill follows, best schedule first.
      const top = list.filter(player => !player.widened), wider = list.filter(player => player.widened);
      expect(list).toEqual([...top, ...wider]);
      for (let i = 1; i < top.length; i++) expect(rate(top[i - 1])).toBeGreaterThanOrEqual(rate(top[i]));
      for (let i = 1; i < wider.length; i++) expect(wider[i - 1].weekRank).toBeLessThanOrEqual(wider[i].weekRank);
      if (wider.length) expect(top.length).toBeLessThan(3);
    }
    expect(tiers.every(tier => Object.values(tier.groups).every(list => list.length === 3))).toBe(true);
    expect(tiers.some(tier => Object.values(tier.groups).some(list => list.some(player => player.widened)))).toBe(true);
  });

  it("uses separate 30–49%, 20–29% and under-20% bands, so each label is literally true", () => {
    expect(PICKUP_BANDS.map(band => [band.label, band.min, band.max])).toEqual([["30–49%", 30, 50], ["20–29%", 20, 30], ["Under 20%", 0, 20]]);
    const tiers = pickupTiers(edition(), true);
    // Within a band, the list is the band's top three: nobody better in the same band was skipped.
    const pool = tiers.flatMap(tier => Object.values(tier.groups).flat());
    for (const tier of tiers) for (const group of ["F", "D", "G"] as const) {
      const list = tier.groups[group];
      if (list.length === 3) for (const other of pool.filter(player => player.group === group && player.ownership >= tier.min && player.ownership < tier.max && !list.includes(player))) expect(rate(other)).toBeLessThanOrEqual(rate(list[2]));
    }
  });

  it("recomputes from the selected dates and publishes nothing when untrusted or unready", () => {
    const narrowed = selectScheduleDates(edition(), weekDates(weekStart).slice(4));
    for (const player of pickupTiers(narrowed, true).flatMap(tier => Object.values(tier.groups).flat())) expect(narrowed.rows.find(row => row.team.abbreviation === player.team)!.rank).toBe(player.weekRank);
    expect(pickupTiers(edition(), false)).toEqual([]);
    expect(pickupTiers(edition("2026-10-20"), true)).toEqual([]);
  });
});

describe("last five games", () => {
  it("attaches the latest rolling L5 for skaters and sums the five latest goalie games", async () => {
    const { attachRecent } = await import("./players");
    const layer = edition().players!, skater = layer.players.find(player => player.group !== "G")!, goalie = layer.players.find(player => player.group === "G")!;
    const rolling = [
      { player_id: skater.nhlId, season, game_date: "2026-10-20", strength_state: "all", season_games_played: 6, goals_total_last5: 1, assists_total_last5: 1, points_total_last5: 2, shots_total_last5: 9, hits_avg_last5: 1, blocks_avg_last5: 0.4, toi_seconds_avg_last5: 1000, pp_points_total_last5: 0, toi_seconds_avg_season: null, line_combo_slot: null, line_combo_group: null, pp_unit: null, goals_total_all: null, assists_total_all: null, toi_seconds_total_last5: null, pp_toi_seconds_total_last5: null, pp_toi_seconds_avg_season: null },
      { player_id: skater.nhlId, season, game_date: "2026-10-24", strength_state: "all", season_games_played: 7, goals_total_last5: 3, assists_total_last5: 2, points_total_last5: 5, shots_total_last5: 14, hits_avg_last5: 1.2, blocks_avg_last5: 0.6, toi_seconds_avg_last5: 1100, pp_points_total_last5: 2, toi_seconds_avg_season: null, line_combo_slot: null, line_combo_group: null, pp_unit: null, goals_total_all: null, assists_total_all: null, toi_seconds_total_last5: null, pp_toi_seconds_total_last5: null, pp_toi_seconds_avg_season: null },
      { player_id: skater.nhlId, season, game_date: "2026-10-25", strength_state: "pp", season_games_played: 8, goals_total_last5: 9, assists_total_last5: 9, points_total_last5: 9, shots_total_last5: 9, hits_avg_last5: 9, blocks_avg_last5: 9, toi_seconds_avg_last5: 9, pp_points_total_last5: 9, toi_seconds_avg_season: null, line_combo_slot: null, line_combo_group: null, pp_unit: null, goals_total_all: null, assists_total_all: null, toi_seconds_total_last5: null, pp_toi_seconds_total_last5: null, pp_toi_seconds_avg_season: null },
    ];
    const goalieGames = Array.from({ length: 7 }, (_, i) => ({ goalie_id: goalie.nhlId, date: `2026-10-${String(12 + i * 2).padStart(2, "0")}`, season_id: season, games_played: i === 6 ? 0 : 1, wins: i % 2, saves: 25 + i, shots_against: 28 + i, goals_against: 3, quality_start: i % 2, shutouts: 0 }));
    const withRecent = attachRecent(layer, { rolling, goalieGames }, now);
    expect(withRecent.players.find(player => player.nhlId === skater.nhlId)!.recent).toEqual({ kind: "skater", games: 5, through: "2026-10-24", goals: 3, assists: 2, points: 5, shots: 14, hitsPerGame: 1.2, blocksPerGame: 0.6, toiSeconds: 1100, ppPoints: 2, line: null, ppUnit: null, toiSeasonSeconds: null, pointGames: null, toiPreSeconds: null, ppToiSeconds: null, ppToiPreSeconds: null });
    // Seven dated rows: the 0-GP row is skipped, then the five latest games (Oct 22, 20, 18, 16, 14).
    expect(withRecent.players.find(player => player.nhlId === goalie.nhlId)!.recent).toEqual({ kind: "goalie", games: 5, through: "2026-10-22", wins: 3, saves: 26 + 27 + 28 + 29 + 30, shotsAgainst: 29 + 30 + 31 + 32 + 33, goalsAgainst: 15, qualityStarts: 3, shutouts: 0 });
    // A failed read is "unavailable"; an answered read is "ready" even when a player has no rows.
    expect(attachRecent(layer, null, now)).toMatchObject({ recentState: "unavailable" });
    expect(attachRecent(layer, null, now).players.every(player => player.recent === null)).toBe(true);
    expect(withRecent.recentState).toBe("ready");
    expect(attachRecent(layer, { rolling: [], goalieGames: [] }, now)).toMatchObject({ recentState: "ready" });
    // SS1-17: one failed source marks only its players; the other keeps its recent form.
    const partial = attachRecent(layer, { rolling, goalieGames: null }, now);
    expect(partial).toMatchObject({ recentState: "partial", recentUnavailable: ["goalies"] });
    expect(partial.players.find(player => player.nhlId === skater.nhlId)!.recent).toMatchObject({ kind: "skater", goals: 3 });
    expect(partial.players.find(player => player.nhlId === goalie.nhlId)!.recent).toBeNull();
    expect(attachRecent(layer, { rolling: null, goalieGames: null }, now)).toMatchObject({ recentState: "unavailable" });
    // SS1-24: a failed id chunk marks only its players; everyone else keeps recent form.
    const chunk = attachRecent(layer, { rolling, goalieGames, failedIds: [skater.nhlId, 999999] }, now);
    expect(chunk).toMatchObject({ recentState: "partial", recentUnavailable: [], recentUnavailableIds: [skater.nhlId] });
    expect(chunk.players.find(player => player.nhlId === skater.nhlId)!.recent).toBeNull();
    expect(chunk.players.find(player => player.nhlId === goalie.nhlId)!.recent).toMatchObject({ kind: "goalie" });
    const old = attachRecent(layer, { rolling: rolling.map(row => ({ ...row, game_date: "2026-10-01" })), goalieGames: [] }, now);
    expect(old.players.find(player => player.nhlId === skater.nhlId)!.recent).toBeNull();
  });
});

describe("streak inputs from per-game rows (SS1-18)", () => {
  it("counts L5 games with a point from consecutive cumulative rows, and builds pre-L5 baselines that exclude the L5 games", async () => {
    const { attachRecent } = await import("./players");
    const layer = edition().players!, skater = layer.players.find(player => player.group !== "G")!;
    // Six consecutive games (GP 5…10); per-game points 1, 0, 2, 1, 1 for the five latest -> 4 of 5 with a point.
    const cumulative = [10, 9, 9, 7, 6, 5];
    const row = (i: number, extra: Record<string, unknown> = {}) => ({ player_id: skater.nhlId, season, game_date: `2026-10-${String(24 - i * 2).padStart(2, "0")}`, strength_state: "all", season_games_played: 10 - i, goals_total_all: Math.floor(cumulative[i] / 2), assists_total_all: cumulative[i] - Math.floor(cumulative[i] / 2),
      goals_total_last5: 2, assists_total_last5: 3, points_total_last5: 5, shots_total_last5: 10, hits_avg_last5: 1, blocks_avg_last5: 1, toi_seconds_avg_last5: 1200, pp_points_total_last5: 1,
      toi_seconds_avg_season: 1000, line_combo_slot: 1, line_combo_group: "forward", pp_unit: 1, toi_seconds_total_last5: 6000, pp_toi_seconds_total_last5: 750, pp_toi_seconds_avg_season: 120, ...extra });
    const recentOf = (rows: Record<string, unknown>[]) => attachRecent(layer, { rolling: rows as never, goalieGames: [] }, now).players.find(player => player.nhlId === skater.nhlId)!.recent;
    // Season 1000 s × 10 GP − 6000 s in L5 = 4000 s over 5 earlier games = 800 s; PP (120 × 10 − 750) / 5 = 90 s.
    expect(recentOf([0, 1, 2, 3, 4, 5].map(i => row(i)))).toMatchObject({ pointGames: 4, toiPreSeconds: 800, ppToiSeconds: 150, ppToiPreSeconds: 90 });
    // A gap in the season GP sequence (a missing game row) leaves per-game points unknown, never guessed.
    expect(recentOf([0, 1, 2, 3, 4, 5].map(i => row(i, i === 5 ? { season_games_played: 3 } : {})))).toMatchObject({ pointGames: null });
    // Fewer than six rows: unknown too.
    expect(recentOf([0, 1, 2, 3, 4].map(i => row(i)))).toMatchObject({ pointGames: null, toiPreSeconds: 800 });
    // Too few games before the L5 window: no pre-L5 baseline.
    expect(recentOf([row(0, { season_games_played: 7 })])).toMatchObject({ toiPreSeconds: null, ppToiPreSeconds: null });
  });
});

describe("live trimming and day selection", () => {
  it("keeps only shown players for the prepared selection and needs a refresh for other days", async () => {
    const { trimPlayerLayer, playersReady } = await import("./players");
    const full = edition(), trimmed = { ...full, players: trimPlayerLayer(full, full.players!) };
    expect(trimmed.players.selectedDates).toEqual(full.selectedDates);
    expect(trimmed.players.players.length).toBeLessThanOrEqual(36);
    expect(pickupTiers(trimmed, true)).toEqual(pickupTiers(full, true));
    expect(specialists(trimmed, true)).toEqual(specialists(full, true));
    const toggled = selectScheduleDates(trimmed, weekDates(weekStart).slice(2));
    expect(playersReady(toggled)).toBe(false);
    expect(pickupTiers(toggled, true)).toEqual([]);
    expect(trimPlayerLayer(full, { ...full.players!, state: "stale" }).players).toEqual([]);
  });
});

describe("specialists", () => {
  it("ranks under-50% skaters on top-10 teams by season total per game played", () => {
    const board = specialists(edition(), true);
    for (const [category, list] of Object.entries(board) as [keyof typeof board, typeof board.hits][]) {
      expect(list).toHaveLength(3);
      for (const player of list) {
        expect(player.group).not.toBe("G");
        expect(player.ownership).toBeLessThan(50);
        expect(player.weekRank).toBeLessThanOrEqual(PLAYER_TEAM_RANK_MAX);
        expect(player.perGame).toBeCloseTo(player[category]! / player.gamesPlayed, 12);
      }
      for (let i = 1; i < list.length; i++) expect(list[i - 1].perGame).toBeGreaterThanOrEqual(list[i].perGame);
    }
    expect(specialists(edition(undefined, "2026-10-22T00:00:00Z"), true)).toEqual({ hits: [], shots: [], blocks: [] });
  });
});

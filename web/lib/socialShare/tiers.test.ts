import { describe, expect, it } from "vitest";
import { buildScheduleSnapshot } from "./schedule";
import { fictionalLeagueWeek } from "./fixtures";
import { fictionalPlayerRecent, fictionalPlayerSources } from "./pickupsFixture";
import { playerScore } from "./score";
import { attachRecent, buildPlayerLayer, pickupTiers, specialists, trimPlayerLayer, type ShareGoalieGameRow, type ShareRecentRollingRow } from "./players";
import { allocateRows, schedulePairs, streamingTiers, tierPairs, trimEditionPlayers, TIER_LIST_ROWS, TRIMMED_PLAYERS_MAX } from "./tiers";
import type { ShareTeamRow, SocialShareSnapshot } from "./types";

const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", season = 20262027;
function edition(): SocialShareSnapshot {
  const snapshot = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, players: buildPlayerLayer(fictionalPlayerSources(season, "2026-10-26", "2026-10-26T08:00:00Z"), { season, teams: snapshot.teams.map(team => team.abbreviation), fetchedAt: now, generatedAt: now }) };
}
// TJ's Oct 26 – Nov 1 example as synthetic rows, with Week Scores in Game Grid's order (4/1 above 3/2 by design).
const row = (abbreviation: string, rank: number, score: number, remainingGames: number, offNightGames: number) =>
  ({ team: { id: rank, abbreviation, name: abbreviation }, rank, score, remainingGames, offNightGames, weightedOffNights: 0, games: [] }) as ShareTeamRow;
const example = [row("CGY", 1, 20, 4, 3), row("EDM", 2, 19.5, 4, 3), row("WPG", 3, 15, 4, 2), row("LAK", 4, 12, 4, 1), row("OTT", 5, 11.8, 4, 1),
  row("TOR", 6, 10, 3, 2), row("NJD", 7, 9.9, 3, 2), row("PHI", 8, 9.8, 3, 2), row("WSH", 9, 9.5, 3, 2), row("BOS", 10, 7, 3, 1), row("SEA", 11, 0, 0, 0)];
const names = (tiers: { teams: ShareTeamRow[] }[][]) => tiers.map(tier => tier.flatMap(pair => pair.teams.map(team => team.team.abbreviation)));

describe("schedule pairs and tiers", () => {
  it("groups teams by exact (GP, off-nights), ties together, best Week Score first, teams by rank", () => {
    const pairs = schedulePairs({ rows: example });
    expect(pairs.map(pair => `${pair.gp}/${pair.off}`)).toEqual(["4/3", "4/2", "4/1", "3/2", "3/1"]);
    expect(pairs[0].teams.map(team => team.team.abbreviation)).toEqual(["CGY", "EDM"]);
    expect(pairs.flatMap(pair => pair.teams).some(team => team.remainingGames === 0)).toBe(false);
  });

  it("reproduces TJ's example week: strict T1 4/3, T2 4/2, T3 4/1; widen folds 4/1 into T2 and makes T3 = 3/2", () => {
    const pairs = schedulePairs({ rows: example });
    expect(names(tierPairs(pairs, "strict"))).toEqual([["CGY", "EDM"], ["WPG"], ["LAK", "OTT"]]);
    expect(names(tierPairs(pairs, "widened"))).toEqual([["CGY", "EDM"], ["WPG", "LAK", "OTT"], ["TOR", "NJD", "PHI", "WSH", "BOS"]]);
    expect(tierPairs(pairs.slice(0, 2), "strict")).toHaveLength(2);
    expect(tierPairs([], "widened")).toEqual([]);
  });

  it("allocates the row budget fairly, leftovers to earlier tiers, one note row for an empty tier", () => {
    expect(allocateRows([10, 10, 10])).toEqual([5, 5, 5]);
    expect(allocateRows([2, 10, 10])).toEqual([2, 8, 5]);
    expect(allocateRows([0, 10, 10])).toEqual([0, 7, 7]);
    expect(allocateRows([3, 2, 1])).toEqual([3, 2, 1]);
    expect(allocateRows([40, 40, 40]).reduce((sum, value) => sum + value, 0)).toBe(TIER_LIST_ROWS);
  });
});

describe("streaming tier players", () => {
  it("lists only under-50% players from tier teams, tier order before rate, within budget with +N more", () => {
    const snapshot = edition();
    for (const mode of ["strict", "widened"] as const) {
      const tiers = streamingTiers(snapshot, true, mode);
      expect(tiers.length).toBe(3);
      for (const tier of tiers) {
        const teams = new Set(tier.teams.map(team => team.abbreviation));
        for (const player of tier.players) { expect(teams.has(player.team)).toBe(true); expect(player.ownership).toBeLessThan(50); }
        const skaters = tier.players.filter(player => player.group !== "G"), goalies = tier.players.filter(player => player.group === "G");
        expect(tier.players).toEqual([...skaters, ...goalies]);
        for (let i = 1; i < skaters.length; i++) expect(skaters[i - 1].pointsPerGame!).toBeGreaterThanOrEqual(skaters[i].pointsPerGame!);
        expect(tier.shown).toEqual(tier.players.slice(0, tier.shown.length));
        expect(tier.more).toBe(tier.players.length - tier.shown.length);
      }
      expect(tiers.reduce((sum, tier) => sum + tier.shown.length, 0)).toBeLessThanOrEqual(TIER_LIST_ROWS);
      // No team appears in two tiers, so tier order always takes precedence over rate.
      const all = tiers.flatMap(tier => tier.teams.map(team => team.abbreviation));
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("keeps an empty tier, and lists nothing when untrusted or when a live layer was trimmed", () => {
    const snapshot = edition(), [first] = streamingTiers(snapshot, true, "strict");
    const emptied = { ...snapshot, players: { ...snapshot.players!, players: snapshot.players!.players.filter(player => !first.teams.some(team => team.abbreviation === player.team)) } };
    const tiers = streamingTiers(emptied, true, "strict");
    expect(tiers[0]).toMatchObject({ players: [], shown: [], more: 0 });
    expect(tiers[1].shown.length).toBeGreaterThan(0);
    expect(streamingTiers(snapshot, false, "strict")).toEqual([]);
    const trimmed = { ...snapshot, players: trimPlayerLayer(snapshot, snapshot.players!) };
    expect(streamingTiers(trimmed, true, "strict").every(tier => tier.players.length === 0)).toBe(true);
  });
});

describe("live trim keeps the tier list (SS1-14)", () => {
  const view = (tiers: ReturnType<typeof streamingTiers>) => tiers.map(tier => ({ teams: tier.teams.map(team => team.abbreviation), shown: tier.shown.map(player => player.nhlId), more: tier.more }));
  const live = (snapshot: SocialShareSnapshot) => ({ ...snapshot, players: trimEditionPlayers(snapshot, snapshot.players!) });

  it("serves the same strict and widened tiers as the full layer, with only shown players and the documented cap", () => {
    const full = edition(), trimmed = live(full);
    expect(trimmed.players.selectedDates).toEqual(full.selectedDates);
    for (const mode of ["strict", "widened"] as const) {
      expect(view(streamingTiers(trimmed, true, mode))).toEqual(view(streamingTiers(full, true, mode)));
      expect(trimmed.players.tierCounts![mode]).toEqual(streamingTiers(full, true, mode).map(tier => tier.players.length));
    }
    expect(pickupTiers(trimmed, true)).toEqual(pickupTiers(full, true));
    expect(specialists(trimmed, true)).toEqual(specialists(full, true));
    // No hidden player leaks: every kept player is on some card, and the layer stays within the cap.
    const onCards = new Set([...pickupTiers(full, true).flatMap(tier => Object.values(tier.groups).flat()), ...Object.values(specialists(full, true)).flat(),
      ...(["strict", "widened"] as const).flatMap(mode => streamingTiers(full, true, mode).flatMap(tier => tier.shown))].map(player => player.nhlId));
    expect(new Set(trimmed.players.players.map(player => player.nhlId))).toEqual(onCards);
    expect(trimmed.players.players.length).toBeLessThan(full.players!.players.length);
    expect(trimmed.players.players.length).toBeLessThanOrEqual(TRIMMED_PLAYERS_MAX);
    expect(streamingTiers(trimmed, true, "strict").some(tier => tier.more > 0)).toBe(true);
  });

  it("keeps an empty tier empty, keeps nobody from a stale layer, and needs counts on a trimmed layer", () => {
    const full = edition(), [first] = streamingTiers(full, true, "strict");
    const emptied = { ...full, players: { ...full.players!, players: full.players!.players.filter(player => !first.teams.some(team => team.abbreviation === player.team)) } };
    const trimmed = live(emptied);
    expect(trimmed.players.tierCounts!.strict[0]).toBe(0);
    expect(view(streamingTiers(trimmed, true, "strict"))).toEqual(view(streamingTiers(emptied, true, "strict")));
    expect(streamingTiers(trimmed, true, "strict")[0]).toMatchObject({ shown: [], more: 0 });

    const stale = trimEditionPlayers(full, { ...full.players!, state: "stale" });
    expect(stale).toMatchObject({ state: "stale", players: [] });
    expect(stale.tierCounts).toBeUndefined();
    expect(streamingTiers({ ...full, players: stale }, true, "widened").every(tier => tier.shown.length === 0)).toBe(true);

    // A layer trimmed without tier counts (an edition cached before SS1-14) lists nobody rather than a partial set.
    const counts = live(full), legacy = { ...counts, players: { ...counts.players, tierCounts: undefined } };
    expect(streamingTiers(legacy, true, "strict").every(tier => tier.shown.length === 0)).toBe(true);
    // Counts that no longer match the tiers (wrong length) also list nobody.
    const mismatched = { ...counts, players: { ...counts.players, tierCounts: { strict: [1], widened: [1] } } };
    expect(streamingTiers(mismatched, true, "strict").every(tier => tier.shown.length === 0)).toBe(true);
  });
});

describe("tier list ranks by L5 score (ticket 15)", () => {
  it("orders each tier's skaters by L5 fantasy score × opportunity, scored players before unscored", () => {
    const snapshot = edition(), recent = fictionalPlayerRecent(snapshot.players!.players, season, "2026-10-26");
    const scored = { ...snapshot, players: attachRecent(snapshot.players!, { rolling: recent.rolling as ShareRecentRollingRow[], goalieGames: recent.goalieGames as ShareGoalieGameRow[] }, now) };
    for (const tier of streamingTiers(scored, true, "widened")) {
      const skaters = tier.players.filter(player => player.group !== "G").map(player => playerScore(player));
      const known = skaters.filter((score): score is number => score !== null);
      expect(skaters.slice(0, known.length)).toEqual(known);
      for (let i = 1; i < known.length; i++) expect(known[i - 1]).toBeGreaterThanOrEqual(known[i]);
    }
  });
});

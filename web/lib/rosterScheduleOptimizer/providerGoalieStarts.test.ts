import { describe, expect, it } from "vitest";
import { applyProviderGoalieStarts, providerStartNote } from "./providerGoalieStarts";
import type { GameForecast, PlanningGame, PlanningPlayer, ProviderStartingStatus } from "./planningTypes";

// Synthetic FORGE bridge rows for one team-game (TOR, game 1 tonight) and a later game; no league data.
const now = Date.parse("2026-10-19T21:30:00Z");
const goalie = (id: string, startingStatus?: ProviderStartingStatus | null): PlanningPlayer => ({ id, nhlId: Number(id.slice(1)) + 200,
  nhlTeamId: 10, name: `Goalie ${id}`, teamAbbreviation: "TOR", eligiblePositions: ["G"], playerClass: "goalie", availability: "rostered",
  ownership: null, canDrop: true, holdValue: null, reserveEligibility: [], ...(startingStatus !== undefined ? { startingStatus } : {}) });
const mark = (isStarting: boolean, date = "2026-10-19"): ProviderStartingStatus => ({ source: "yahoo", date, isStarting, observedAt: "2026-10-19T21:30:01.000Z" });
const games: PlanningGame[] = [
  { id: "1", date: "2026-10-19", startsAt: "2026-10-19T23:00:00Z", teamAbbreviation: "TOR", opponent: "MTL", home: true, status: "scheduled" },
  { id: "2", date: "2026-10-21", startsAt: "2026-10-21T23:00:00Z", teamAbbreviation: "TOR", opponent: "OTT", home: false, status: "scheduled" }];
const line = { SAVES_GOALIE: 25, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: null };
const row = (playerId: string, gameId: string, p: number, extra: Partial<GameForecast> = {}): GameForecast => ({ playerId, gameId,
  stats: { SAVES_GOALIE: 25 * p, WINS_GOALIE: 0.5 * p, SHUTOUTS_GOALIE: null }, conditionalStats: line, conditioning: "unconditional",
  startProbability: p, confirmedStart: false, revisionId: "bridge:r1", issuedAt: "2026-10-19T12:00:00Z", modelVersion: "bridge:abc",
  limitations: ["Interim FORGE projection."], ...extra });
const catalog = [goalie("g1"), goalie("g2"), goalie("g3")];
const apply = (forecasts: GameForecast[], marked: PlanningPlayer[], at = now) =>
  applyProviderGoalieStarts(forecasts, { marked, catalog, games, bridgeRevisionIds: new Set(["bridge:r1"]), now: at });
const find = (rows: GameForecast[], playerId: string, gameId = "1") => rows.find(item => item.playerId === playerId && item.gameId === gameId)!;

describe("Yahoo goalie starting status", () => {
  const forecasts = [row("g1", "1", 0.3), row("g2", "1", 0.6), row("g3", "1", 0.1), row("g1", "2", 0.3)];

  it("makes a Starting goalie a confirmed start and his teammates 0, for that game only", () => {
    const result = apply(forecasts, [goalie("g1", mark(true))]);
    expect(find(result, "g1")).toMatchObject({ startProbability: 1, confirmedStart: true, stats: { SAVES_GOALIE: 25, WINS_GOALIE: 0.5, SHUTOUTS_GOALIE: null } });
    expect(find(result, "g1").conditionalStats).toEqual(line);
    expect(find(result, "g1").limitations).toContain(providerStartNote("Goalie g1", mark(true)));
    expect(find(result, "g2")).toMatchObject({ startProbability: 0, confirmedStart: false, stats: { SAVES_GOALIE: 0, WINS_GOALIE: 0 } });
    expect(find(result, "g3").startProbability).toBe(0);
    expect(find(result, "g1", "2")).toBe(forecasts[3]);
  });

  it("gives a Not Starting goalie 0 and rescales his teammates to a full start", () => {
    const result = apply(forecasts, [goalie("g2", mark(false))]);
    expect(find(result, "g2")).toMatchObject({ startProbability: 0, confirmedStart: false, stats: { SAVES_GOALIE: 0 } });
    expect(find(result, "g1").startProbability).toBeCloseTo(0.75);
    expect(find(result, "g3").startProbability).toBeCloseTo(0.25);
    expect(find(result, "g1").stats.SAVES_GOALIE).toBeCloseTo(18.75);
    const total = ["g1", "g2", "g3"].reduce((sum, id) => sum + find(result, id).startProbability!, 0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it("agrees with a news-confirmed starter but never overrides one it contradicts", () => {
    const confirmed = [row("g1", "1", 1, { confirmedStart: true }), row("g2", "1", 0), row("g3", "1", 0)];
    expect(find(apply(confirmed, [goalie("g2", mark(false))]), "g1")).toMatchObject({ startProbability: 1, confirmedStart: true });
    expect(apply(confirmed, [goalie("g2", mark(true))])).toBe(confirmed);
    expect(apply(confirmed, [goalie("g1", mark(false))])).toBe(confirmed);
    expect(apply(forecasts, [goalie("g1", mark(true)), goalie("g2", mark(true))])).toBe(forecasts);
  });

  it("leaves rows as issued for another date, a started game, an unmarked goalie, native rows or a missing per-start line", () => {
    expect(apply(forecasts, [goalie("g1", mark(true, "2026-10-20"))])).toBe(forecasts);
    expect(apply(forecasts, [goalie("g1", mark(true))], Date.parse("2026-10-19T23:00:00Z"))).toBe(forecasts);
    expect(apply(forecasts, [goalie("g1", null), goalie("g2")])).toBe(forecasts);
    const native = forecasts.map(item => ({ ...item, revisionId: "native:1" }));
    expect(apply(native, [goalie("g1", mark(true))])).toBe(native);
    const bound = forecasts.map(item => ({ ...item, rsoTargetBindings: {} }));
    expect(apply(bound, [goalie("g1", mark(true))])).toBe(bound);
    const lineless = forecasts.map(item => ({ ...item, conditionalStats: undefined }));
    expect(apply(lineless, [goalie("g1", mark(true))])).toBe(lineless);
  });
});

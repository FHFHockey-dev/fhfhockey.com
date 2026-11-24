import { describe, expect, it } from "vitest";
import { canonicalJson } from "./identity";
import { buildH10Model, buildH10Training, H10RateState, H10_RECIPE } from "./h10Features";
import { H10_SEASON, syntheticLeague } from "./h10Fixtures";
import { instant } from "./contracts";

describe("H10 training and features (synthetic fixture)", () => {
  const anchor = Date.UTC(2026, 10, 23, 15), asOf = new Date(anchor - 5 * 60000).toISOString();
  const league = syntheticLeague({ anchor, teams: 6, pastDays: 12 });

  it("builds every example from rows received by its own cutoff (no leakage), matching issuance-time features", () => {
    const { training, available, skipped } = buildH10Training(league.logs, H10_SEASON, asOf, 100000);
    expect(training.length).toBe(available);
    const received = league.logs.filter(row => instant(row.source.firstReceivedAt) <= instant(asOf)).length;
    expect(available + skipped.noPriorReceipt).toBe(received);
    expect(skipped.noPriorReceipt).toBeLessThan(received / 10);
    for (const example of training.filter((_, i) => i % 97 === 0)) {
      expect(example.sources.every(source => instant(source.firstReceivedAt) <= instant(example.inputCutoffAt))).toBe(true);
      const log = league.logs.find(row => row.playerId === example.playerId && row.gameId === example.gameId)!;
      const rebuilt = H10RateState.from(league.logs, H10_SEASON, example.inputCutoffAt).features(log.playerId, log.opponentId, log.home);
      expect(canonicalJson(example.features)).toBe(canonicalJson(rebuilt));
    }
  });

  it("caps training to the most recent examples and makes the model available exactly at the cutoff", () => {
    const { training } = buildH10Training(league.logs, H10_SEASON, asOf, 300);
    expect(training).toHaveLength(300);
    const model = buildH10Model(training, asOf)!;
    expect(model).toMatchObject({ recipe: H10_RECIPE, fittedAt: asOf, availableAt: asOf, evidence: "development_only" });
    expect(instant(model.dependencyAvailableAt)).toBeLessThanOrEqual(instant(asOf));
    expect(buildH10Model(training.slice(0, H10_RECIPE.minimumSupport - 1), asOf)).toBeNull();
  });

  it("gives one player different features against different opponents and venues", () => {
    const state = H10RateState.from(league.logs, H10_SEASON, asOf), player = league.roster[0].playerId;
    const a = state.features(player, league.teams[2], true), b = state.features(player, league.teams[3], false);
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
    expect(a.player_points_rate).toEqual(b.player_points_rate);
  });
});

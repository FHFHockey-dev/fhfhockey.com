import { describe, expect, it } from "vitest";
import { buildTeamSkaterCoverage, recordTeamSkaterCoverage, skaterAvailabilityForGame } from "./skaterCoverage";

const ev = (event_type: string, extra: Record<string, unknown> = {}) => ({ event_id: 9, event_type, confidence: 0.75, payload: {}, ...extra });

describe("skater availability beside the if-plays line (decision 132.3)", () => {
  it("maps a ruled-out event to 0.0 expected for the game, never touching participation probability", () => {
    expect(skaterAvailabilityForGame({ gameId: 5, event: ev("INJURY_OUT"), inLineup: false })).toMatchObject({
      state: "confirmed_out", expected_for_game: 0, participation_probability: null, line_conditioning: "if_plays", event_id: 9 });
  });

  it("scopes a scratch to its own game id (decision 31)", () => {
    expect(skaterAvailabilityForGame({ gameId: 5, event: ev("SCRATCH", { payload: { game_id: 5 } }), inLineup: false }))
      .toMatchObject({ state: "confirmed_out", label: "scratched / not expected to dress" });
    expect(skaterAvailabilityForGame({ gameId: 6, event: ev("SCRATCH", { payload: { game_id: 5 } }), inLineup: false }))
      .toMatchObject({ state: "unknown", expected_for_game: null, event_type: null });
  });

  it("labels day-to-day as uncertain with no qualified probability, and missing evidence as unknown, never 0", () => {
    expect(skaterAvailabilityForGame({ gameId: 5, event: ev("DTD"), inLineup: true })).toMatchObject({
      state: "uncertain", expected_for_game: null, participation_probability: null, participation_qualified: false });
    expect(skaterAvailabilityForGame({ gameId: 5, event: null, inLineup: false })).toMatchObject({ state: "unknown", expected_for_game: null });
    expect(skaterAvailabilityForGame({ gameId: 5, event: ev("RETURN"), inLineup: false }).label).toMatch(/return reported/);
    expect(skaterAvailabilityForGame({ gameId: 5, event: null, inLineup: true })).toMatchObject({ state: "projected_lineup" });
  });
});

describe("team skater coverage (decision 132.4)", () => {
  it("puts each eligible skater in exactly one bucket and adds the totals to the run metrics", () => {
    const coverage = buildTeamSkaterCoverage({ gameId: 5, teamId: 1, eligibleIds: [4, 1, 2, 3, 3, 5], lineupIds: [1, 2],
      reserveIds: [3, 2], unknownReasonById: new Map([[5, "roster_team_conflict"]]), defaultUnknownReason: "no_nhl_usage_in_window" });
    expect(coverage).toMatchObject({ eligible: 5, lineup: 2, reserve: 1, unknown: 2, complete: false,
      unknown_by_reason: { no_nhl_usage_in_window: [4], roster_team_conflict: [5] } });
    expect(coverage.lineup + coverage.reserve + coverage.unknown).toBe(coverage.eligible);
    const metrics: Record<string, any> = { data_quality: {} };
    recordTeamSkaterCoverage(metrics, coverage);
    recordTeamSkaterCoverage(metrics, coverage);
    expect(metrics.data_quality).toEqual({ skater_coverage_eligible: 10, skater_coverage_lineup: 4,
      skater_coverage_reserve: 2, skater_coverage_unknown: 4 });
    expect(metrics.skater_coverage).toHaveLength(2);
  });
});

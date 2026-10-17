import {describe,expect,it} from "vitest";
import {resolveContribution,type ContributionGame,type ContributionSource} from "../../../web/lib/player-forecasts/contributions";
const game: ContributionGame = {
  seasonId: 20262027, gameId: 30, teamId: 1, playerId: 7, nhlPlayerId: 77,
  scheduledAt: "2026-10-08T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a",
};
const source: ContributionSource = {
  kind: "detailed", sourceId: "revision-1", policyVersion: "model-v1", released: true,
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
  playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
  targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 2,
  participationIntegrated: false, cutoffAt: "2026-09-28T00:00:00Z",
  issuedAt: "2026-09-28T01:00:00Z", expiresAt: "2026-10-09T00:00:00Z",
  sourceWatermark: "watermark-a", scheduleRevision: "schedule-a", rosterRevision: "roster-a",
};

describe("captured owner catalog expiry compatibility",()=>{
  it("retains original source clocks while enforcing earlier catalog validity", () => {
    const candidate = { ...source, catalogExpiresAt: "2026-10-01T00:00:00.000002Z" };
    const original = JSON.stringify(candidate);
    const live = resolveContribution({ game, targetKey: "GOALS", now: "2026-10-01T00:00:00.000001Z", detailed: candidate });
    expect(live.sourceIds).toEqual([source.sourceId]);
    expect(live.conditionalMean).toBe(2);
    const expired = resolveContribution({ game, targetKey: "GOALS", now: candidate.catalogExpiresAt, detailed: candidate });
    expect(expired.sourceIds).toEqual([]);
    expect(expired.exclusionReasons).toContain("stale_source");
    expect(JSON.stringify(candidate)).toBe(original);
  });

  it.each([null, "", "not-a-clock", "2026-02-30T00:00:00Z", "2026-10-10T00:00:00Z",
    "2026-10-01T00:00:00Z", "2026-09-28T01:00:00Z"])("withholds invalid or elapsed catalog validity %j", catalogExpiresAt => {
    const resolved = resolveContribution({ game, targetKey: "GOALS", now: "2026-10-01T00:00:00Z",
      detailed: { ...source, catalogExpiresAt: catalogExpiresAt as unknown as string } });
    expect(resolved.sourceIds).toEqual([]);
    expect(resolved.conditionalMean).toBeNull();
    expect(resolved.exclusionReasons).toContain("stale_source");
  });

});

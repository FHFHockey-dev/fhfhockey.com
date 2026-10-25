// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildGoalieWorkloadEvidence } from "./workloadEvidence";
import { rollingParticipationWindow, type RollingWindowGoalieStartInput } from "../../player-forecasts/rollingWindowParticipation";
import { ROSTER_CONTINUATION_ASSUMPTION } from "../../player-forecasts/targetRosterObservation";

const cutoffAt = "2026-10-25T11:00:00Z";
const issuance = { issuedAt: "2026-10-25T12:00:00Z", expiresAt: "2026-10-25T18:00:00Z" };
const evidence = (id: string, clock: string) => ({ id,
  hash: createHash("sha256").update(id).digest("hex"), availableAt: clock, capturedAt: clock });
function fixture(): RollingWindowGoalieStartInput {
  const window = rollingParticipationWindow(cutoffAt);
  const roster = evidence("synthetic-roster", "2026-10-25T10:00:00Z");
  const games = [12, 16, 22].map((date, index) => {
    const scheduledAt = `2026-10-${date}T23:00:00Z`;
    const box = evidence(`synthetic-box-${date}`, `2026-10-${date + 1}T03:00:00Z`);
    return { gameId: 100 + index, teamId: 1, scheduledAt, occurred: true,
      eligibility: { playerId: 7, nhlPlayerId: 77, teamId: 1, eligible: true,
        effectiveFrom: scheduledAt, effectiveUntil: `2026-10-${date + 1}T04:00:00Z`, evidence: box },
      positiveMinutes: index !== 1, resolution: index === 1 ? "explicit_zero_toi" as const : "positive_toi" as const,
      outcomeEvidence: box, officialStarter: index === 0, starterEvidence: box };
  });
  return { version: "goalie-rolling-14d-start-input-v1", playerClass: "goalie", cutoffAt,
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 999,
      scheduledAt: "2026-10-27T23:00:00Z", scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster" },
    scheduleEvidence: roster, rosterEvidence: roster,
    targetRosterObservation: { playerId: 7, nhlPlayerId: 77, teamId: 1, seasonId: 20262027,
      listed: true, sourceKind: "official_season_roster", knownConflict: null,
      continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION, evidence: roster },
    history: { complete: true, windowStartAt: window.startAt, windowEndAt: window.endAt,
      scheduleEvidence: roster, games } };
}

describe("FORGE descriptive workload evidence seam", () => {
  it("keeps official starts, relief appearances and future predictions distinct", () => {
    const result = buildGoalieWorkloadEvidence(fixture(), issuance);
    expect(result).toMatchObject({ status: "descriptive_only", denominator: "eligible_team_games",
      starts: { event: "official_starter", observedCount: 1, eligibleTeamGames: 3, observedShare: 1 / 3 },
      appearances: { event: "positive_minutes", observedCount: 2, eligibleTeamGames: 3, observedShare: 2 / 3 },
      forecast: { startProbability: null, appearanceProbability: null, confirmation: "unconfirmed", activation: "dormant" } });
    expect(result.starts.selectedGameIds).toEqual(result.appearances.selectedGameIds);
    expect(result.starts.methodVersion).toBe("goalie-rolling-14d-start-frequency-v1");
    expect(result.starts.evidenceHashes).toContain(fixture().history.games[0].starterEvidence!.hash);
  });

  it("withholds unknown starter history while retaining supported appearance history", () => {
    const input = fixture(); input.history.games[0].officialStarter = null;
    const result = buildGoalieWorkloadEvidence(input, issuance);
    expect(result.starts.observedShare).toBeNull();
    expect(result.starts.observedCount).toBeNull();
    expect(result.starts.reasons).toContain("unresolved_official_starter_label");
    expect(result.appearances.observedShare).toBe(2 / 3);
  });

  it("keeps missing appearance labels unknown rather than making them nonstarts", () => {
    const input = fixture(); input.history.games[1].positiveMinutes = null; input.history.games[1].resolution = null;
    const result = buildGoalieWorkloadEvidence(input, issuance);
    expect(result.starts.observedShare).toBeNull();
    expect(result.appearances.observedShare).toBeNull();
    expect(result.appearances.reasons).toContain("unresolved_participation_label");
  });

  it.each([0, 1])("retains historical endpoint %s without confirming a future start", endpoint => {
    const input = fixture();
    input.history.games = [input.history.games[0]];
    input.history.games[0].officialStarter = endpoint === 1;
    const result = buildGoalieWorkloadEvidence(input, issuance);
    expect(result.starts.observedShare).toBe(endpoint);
    expect(result.starts.eligibleTeamGames).toBe(1);
    expect(result.forecast.startProbability).toBeNull();
    expect(result.forecast.confirmation).toBe("unconfirmed");
  });

  it("withholds incomplete team opportunities and known availability conflicts", () => {
    const incomplete = fixture(); incomplete.history.complete = false;
    expect(buildGoalieWorkloadEvidence(incomplete, issuance).starts.observedShare).toBeNull();
    const injury = fixture(); injury.targetRosterObservation!.knownConflict = true;
    expect(buildGoalieWorkloadEvidence(injury, issuance).appearances.observedShare).toBeNull();
  });

  it("uses eligible team opportunities without silently claiming all team games", () => {
    const input = fixture(); input.history.games[1].eligibility!.eligible = false;
    const result = buildGoalieWorkloadEvidence(input, issuance);
    expect(result.starts.eligibleTeamGames).toBe(2);
    expect(result.starts.observedShare).toBe(0.5);
    expect(result.denominator).toBe("eligible_team_games");
  });

  it.each(["team", "season", "late evidence", "future game", "duplicate game"])("rejects %s identity or leakage", kind => {
    const input = fixture();
    if (kind === "team") input.history.games[0].teamId = 2;
    if (kind === "season") input.scope.seasonId = 20252026;
    if (kind === "late evidence") input.history.games[0].starterEvidence = evidence("late-label", "2026-10-25T11:00:00.000001Z");
    if (kind === "future game") input.history.games[0].scheduledAt = "2026-10-25T23:00:00Z";
    if (kind === "duplicate game") input.history.games.push(input.history.games[0]);
    expect(() => buildGoalieWorkloadEvidence(input, issuance)).toThrow();
  });
});

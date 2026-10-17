// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSkaterParticipationReceipt, type SkaterParticipationInput } from "./modeledSkaterParticipation";

const cutoff = "2026-10-15T10:00:00Z";
const issuance = { issuedAt: "2026-10-15T11:00:00Z", expiresAt: "2026-10-15T18:00:00Z" };
function fixture(): SkaterParticipationInput {
  const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
  return { version: "skater-participation-input-v1", cutoffAt: cutoff,
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30,
      scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a" },
    scheduleEvidence: evidence, rosterEvidence: evidence,
    history: { complete: true, windowStartAt: new Date(Date.parse(cutoff) - 60 * 86400000).toISOString(),
      scheduleEvidence: evidence, games: [10, 12, 14].map((day, index) => ({ gameId: 10 + index, teamId: 1,
        scheduledAt: `2026-10-${day}T00:00:00Z`, occurred: true, eligible: true,
        positiveMinutes: index !== 1, resolution: index === 1 ? "complete_official_nonappearance" : "positive_toi",
        eligibilityEvidence: evidence, outcomeEvidence: evidence })) } };
}

describe("finite modeled skater participation", () => {
  it("uses eligible opportunities including explicit nonappearances; endpoint frequency is still a model", () => {
    const input = fixture(), row = buildSkaterParticipationReceipt(input, issuance);
    expect(row).toMatchObject({ probability: 2 / 3, numerator: 2, denominator: 3,
      probabilityStatus: "uncalibrated_model", calibration: "unavailable", event: "positive_minutes", reasons: [] });
    input.history.games[1].positiveMinutes = true; input.history.games[1].resolution = "positive_toi";
    expect(buildSkaterParticipationReceipt(input, issuance)).toMatchObject({ probability: 1, probabilityStatus: "uncalibrated_model" });
    input.history.games.forEach(game => { game.positiveMinutes = false; game.resolution = "explicit_zero_toi"; });
    expect(buildSkaterParticipationReceipt(input, issuance).probability).toBe(0);
  });
  it.each(["frame", "eligibility", "occurrence", "label", "resolution", "source", "empty", "stale"])("retains unknown for %s missingness", kind => {
    const input = fixture(), game = input.history.games[2];
    if (kind === "frame") input.history.complete = false;
    if (kind === "eligibility") game.eligible = null;
    if (kind === "occurrence") game.occurred = null;
    if (kind === "label") game.positiveMinutes = null;
    if (kind === "resolution") game.resolution = null;
    if (kind === "source") game.outcomeEvidence = null;
    if (kind === "empty") input.history.games = [];
    if (kind === "stale") input.rosterEvidence = { ...input.rosterEvidence, capturedAt: "2026-10-01T00:00:00Z" };
    const row = buildSkaterParticipationReceipt(input, issuance);
    expect(row.probability).toBeNull(); expect(row.reasons.length).toBeGreaterThan(0);
  });
  it("excludes known ineligible/cancelled games but never converts their unknown labels to zeros", () => {
    const input = fixture(); input.history.games[1].eligible = false;
    input.history.games[1].positiveMinutes = null; input.history.games[1].outcomeEvidence = null;
    expect(buildSkaterParticipationReceipt(input, issuance)).toMatchObject({ probability: 1, denominator: 2 });
    input.history.games[1].occurred = false; input.history.games[1].eligible = null;
    expect(buildSkaterParticipationReceipt(input, issuance).probability).toBe(1);
  });
  it("uses the last20 eligible games in event order and reports cold/stale history as unknown", () => {
    const input = fixture(), template = input.history.games[0];
    input.history.games = Array.from({ length: 24 }, (_, index) => ({ ...template, gameId: 100 + index,
      scheduledAt: new Date(Date.parse(cutoff) - (index + 1) * 86400000).toISOString(),
      positiveMinutes: index > 0, resolution: index > 0 ? "positive_toi" : "explicit_zero_toi" }));
    const row = buildSkaterParticipationReceipt(input, issuance);
    expect(row.probability).toBe(19 / 20); expect(row.selectedGameIds).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
    input.history.games = input.history.games.slice(15);
    expect(buildSkaterParticipationReceipt(input, issuance).reasons).toContain("stale_eligible_history");
  });
  it.each(["duplicate", "future", "wrong_team", "target_game", "future_source", "hash", "window"])("rejects %s history rather than silently changing the frame", kind => {
    const input = fixture(), game = input.history.games[0];
    if (kind === "duplicate") input.history.games.push({ ...game });
    if (kind === "future") game.scheduledAt = cutoff;
    if (kind === "wrong_team") game.teamId = 2;
    if (kind === "target_game") game.gameId = 30;
    if (kind === "future_source") input.scheduleEvidence = { ...input.scheduleEvidence, availableAt: issuance.issuedAt };
    if (kind === "hash") input.rosterEvidence = { ...input.rosterEvidence, hash: "not-a-hash" };
    if (kind === "window") input.history.windowStartAt = cutoff;
    expect(() => buildSkaterParticipationReceipt(input, issuance)).toThrow();
  });
  it.each(["after_start", "late_expiry", "long_expiry", "old_cutoff"])("rejects %s issuance", kind => {
    const input = fixture(), clocks = { ...issuance };
    if (kind === "after_start") clocks.issuedAt = input.scope.scheduledAt;
    if (kind === "late_expiry") clocks.expiresAt = "2026-10-16T00:00:00Z";
    if (kind === "long_expiry") { input.scope.scheduledAt = "2026-10-20T23:00:00Z"; clocks.expiresAt = "2026-10-17T00:00:00Z"; }
    if (kind === "old_cutoff") clocks.issuedAt = "2026-10-16T11:00:00Z";
    expect(() => buildSkaterParticipationReceipt(input, clocks)).toThrow();
  });
  it("binds each next-N game separately without mutating input or transferring confirmation", () => {
    const first = fixture(), before = structuredClone(first), second = structuredClone(first);
    second.scope.gameId = 31; second.scope.scheduledAt = "2026-10-17T23:00:00Z"; second.scope.scheduleRevision = "schedule-b";
    const a = buildSkaterParticipationReceipt(first, issuance), b = buildSkaterParticipationReceipt(second, issuance);
    expect(first).toEqual(before); expect(a.probability).toBe(b.probability);
    expect(a.inputHash).not.toBe(b.inputHash); expect(b.scope.gameId).toBe(31);
  });
});

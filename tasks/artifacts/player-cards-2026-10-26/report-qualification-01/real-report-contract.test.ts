import { expect, it } from "vitest";
import report from "./REPORT-VALIDATION.json";
import { completionBounds, selectWindow, type Appearance, type AppearanceFrame } from "../../../../web/lib/player-cards/windows";
import type { CardSettings } from "../../../../web/lib/player-cards/contracts";

const settings: CardSettings = { season: 20262027, gameType: "regular", strength: "all", cutoff: report.cutoff, period: { mode: "appearances", count: 10 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
const appearances: Appearance[] = report.reports.map(row => ({
  playerId: row.playerId, gameId: row.gameId, season: row.season, gameType: "regular", date: row.date, sourceDate: row.sourceDate, played: true,
  completion: { status: "verified-final", reference: `CANDIDATE-NOT-ADMITTED:${row.reportSha256}`, completedDuring: { ...row.candidateEndMinute, clockBasis: "schedule-bound-12h" } },
}));
// Positive controls deliberately assume history completeness. These are not actual admissions.
const frame = (assumeCompleteForControl = false): AppearanceFrame => ({ playerId: 8476453, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: assumeCompleteForControl, historyThrough: "2026-10-26T15:23:43Z", historyReference: "ARTIFACT-ONLY-CONTROL-NOT-ADMITTED", appearances });

it("validates the bounded capture and preserves its unadmitted status", () => {
  expect(report.capturedBatchRequests).toBe(9); expect(report.capturedBatchBytes).toBe(324904);
  expect(report.matchedReports).toBe(10); expect(report.wholeEndMinutesBeforeCutoff).toBe(9);
  expect(report.reports.every(row => row.identityDateTeamsFinalMatch && !row.exactEndSecondVerified && !row.admissionChanged)).toBe(true);
  expect(report.observedCoverage.identicalCompletedGameIdSets).toBe(true);
  expect(report.observedCoverage.historyCompletenessAdmitted).toBe(false);
  expect(report.admissionsChanged || report.liveActivation || report.premiumActivation).toBe(false);
});
it("accepts the ten real report minute ranges as bounded candidates without inventing exact seconds", () => {
  for (const game of appearances) {
    const bounds = completionBounds(game.completion)!;
    expect(bounds.exact).toBe(false); expect(bounds.safeAfter - bounds.earliest).toBe(60000);
    expect(game.completion.status === "verified-final" && game.completion.completedAt).toBeUndefined();
  }
  const later = appearances.find(game => game.gameId === 2026020167)!;
  expect(completionBounds(later.completion)!.earliest).toBeGreaterThan(Date.parse(settings.cutoff));
});
it("does not promote matching report clocks to verified appearance-history completeness", () => {
  const selected = selectWindow(frame(), settings);
  expect(selected.state).toBe("missing"); expect(selected.reason).toContain("Complete appearance history");
  expect(selected.games).toEqual([]);
});
it("binds contiguous official team-game ordinals and positive player TOI without silently admitting completeness", () => {
  expect(report.observedCoverage.reportTeamOrdinalsBeforeCutoff).toEqual([1,2,3,4,5,6,7,8,9]);
  expect(report.observedCoverage.nextTeamOrdinalAfterCutoff).toBe(10);
  expect(report.observedCoverage.observedPositivePlayerToiInAllNine).toBe(true);
  expect(report.observedCoverage.historyCompletenessAdmitted).toBe(false);
});
it("selects only the nine pre-cutoff games under an explicit diagnostic history assumption", () => {
  const ten = selectWindow(frame(true), settings);
  expect(ten.state).toBe("ready"); expect(ten.knownShort).toBe(true); expect(ten.actualGp).toBe(9);
  expect(ten.games.map(game => game.gameId)).toEqual([2026020151,2026020123,2026020111,2026020095,2026020081,2026020060,2026020040,2026020024,2026020010]);
  const five = selectWindow(frame(true), { ...settings, period: { mode: "appearances", count: 5 } });
  expect(five.games.map(game => game.gameId)).toEqual([2026020151,2026020123,2026020111,2026020095,2026020081]);
});
it("retains game151 provider October20 separately from UTC calendar October21", () => {
  const calendar = (date: string) => selectWindow(frame(true), { ...settings, period: { mode: "calendar", start: date, end: date, timezone: "UTC" } });
  expect(calendar("2026-10-20").state).toBe("undefined");
  const utc = calendar("2026-10-21");
  expect(utc.games.map(game => game.gameId)).toEqual([2026020151]);
  expect(utc.games[0].sourceDate).toBe("2026-10-20"); expect(utc.games[0].date).toBe("2026-10-21");
});
it("keeps a cutoff inside the reported end minute unknown, admitting only its conservative upper bound", () => {
  const overlap = selectWindow(frame(true), { ...settings, cutoff: "2026-10-21T05:19:30Z" });
  expect(overlap.state).toBe("missing"); expect(overlap.reason).toContain("overlaps the cutoff");
  expect(selectWindow(frame(true), { ...settings, cutoff: "2026-10-21T05:20:00Z" }).state).toBe("ready");
  const game = appearances.find(row => row.gameId === 2026020151)!;
  if (game.completion.status !== "verified-final") throw new Error("Invalid control");
  expect(completionBounds({ ...game.completion, completedDuring: { ...game.completion.completedDuring!, clockBasis: "unresolved" } })).toBeNull();
});

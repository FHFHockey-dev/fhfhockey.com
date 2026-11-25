import { describe, expect, it } from "vitest";
import { officialPenalties, officialPeriodAnchors, officialPowerPlayEvents, officialPowerPlayEvidence, opportunitySpans } from "./officialPowerPlay";
import { curtisFive, game0356, html0356, pbp0356, url0356 } from "./testPpFixtures";

describe("official PP evidence for ANA–COL 2026020356", () => {
  it("exposes penalties from the play-by-play", () => {
    expect(officialPenalties(pbp0356)).toContainEqual({ eventId: 320, order: 214, period: 1, elapsed: "14:26", committedByPlayerId: 8481754, drawnByPlayerId: 8484258, infraction: "high-sticking", penalizedTeamId: 24 });
  });
  it("parses official period anchors without a scheduled start", () => {
    const { periods, gameEndedAt } = officialPeriodAnchors(html0356, game0356.date, null);
    expect(periods).toEqual([
      { period: 1, startedAt: "2026-11-20T02:09:00Z", endedAt: "2026-11-20T02:45:00Z", precisionSeconds: 60 },
      { period: 2, startedAt: "2026-11-20T03:04:00Z", endedAt: "2026-11-20T03:42:00Z", precisionSeconds: 60 },
      { period: 3, startedAt: "2026-11-20T04:01:00Z", endedAt: "2026-11-20T04:34:00Z", precisionSeconds: 60 },
    ]);
    expect(gameEndedAt).toBe("2026-11-20T04:34:00Z");
  });
  it("chooses the half-day nearest a stored actual start and rejects unknown zones", () => {
    const morning = "<table><tr id=\"PL-1\"><td>1</td><td>1</td><td></td><td>0:00</td><td>PSTR</td><td>Period Start- Local time: 11:05 EST</td><td></td><td></td></tr></table>";
    expect(officialPeriodAnchors(morning, "2026-11-26", "2026-11-26T16:00:00Z").periods[0]!.startedAt).toBe("2026-11-26T16:05:00Z");
    expect(officialPeriodAnchors(morning.replace("EST", "XYZ"), "2026-11-26", null).periods).toEqual([]);
  });
  it("spans penalty 320's opportunity from play-by-play strength", () => {
    const span = opportunitySpans(pbp0356).find((item) => item.penaltyEventId === 320)!;
    expect(span).toMatchObject({ beneficiaryTeamId: 21, fromOrder: 214, endedBy: "expiry" });
    expect(span.toOrder).toBeGreaterThan(219);
  });
  it("reports Colorado's five on ice at the PP faceoff (report event 84)", () => {
    const observations = officialPowerPlayEvents(game0356, pbp0356, html0356, url0356)!;
    const faceoff = observations.find((item) => item.reportEvent === 84)!;
    expect(faceoff).toMatchObject({ teamId: 21, eventId: 315, order: 219 });
    expect(faceoff.players.map((player) => player.playerId).sort()).toEqual([...curtisFive].sort());
  });
  it("keeps the on-ice observations when a penalty play lacks its period descriptor", () => {
    const broken = { ...pbp0356, plays: pbp0356.plays.map((play) => play.eventId === 869 ? { ...play, periodDescriptor: undefined as never } : play) };
    const evidence = officialPowerPlayEvidence(game0356, broken, html0356, url0356)!;
    expect(evidence.observations.some((item) => item.reportEvent === 84)).toBe(true);
  });
  it("bundles the evidence with faceoff IDs and both rosters", () => {
    const evidence = officialPowerPlayEvidence(game0356, pbp0356, html0356, url0356)!;
    expect(evidence.faceoffEventIds).toContain(315);
    expect(evidence.roster).toContainEqual({ playerId: 8481754, name: "Nikita Nesterenko", teamId: 24 });
  });
});

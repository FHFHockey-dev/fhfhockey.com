import { describe, expect, it } from "vitest";
import type { DisplayProfile } from "../buyLowSellHigh/displayProfile";
import { captureFixture } from "./analysisFixtures";
import { buildAnalysisSnapshot } from "./analysisSnapshot";
import { cardBlshEvidence, cardMarketReference, cardTradeContext, illustrativeTradeIdeas, preseasonAnchorLabel, type EvidenceReceipt, type TradeObservation } from "./analysisEvidence";
const snapshot = () => buildAnalysisSnapshot(captureFixture(), { period: { mode: "appearances", count: 5 }, baseline: "previous", basis: "per-game", visual: "bars" });
function blsh() {
  const s = snapshot();
  // Only the owner's display fields consumed by this boundary; no model execution.
  const p = { playerId: s.capture.player.id, team: s.capture.player.team, displayName: "Fixture skater", score: { version: "support-conditioned-production-gap-v1", gapSign: "buy_low_evidence", statusLabel: "Exploratory", gapSignLabel: "Support above recorded production", calibratedProbability: null }, tracks: ["FP", "G+A", "Game Score"].map(label => ({ label, observed: 2, supportConditioned: 3, gap: 1 })), evidence: { window: { games: 5, sourceIds: [101, 102, 103, 104, 105], fresh: true }, tierNote: "Provisional", reference: { ageText: "Development reference is stale" }, calibratedProbabilityText: "Unavailable" }, coverage: { context: { current: { verified: true } }, notes: [] }, context: { opportunity: [{ label: "PP TOI", current: 1, units: "min/GP", reasonText: null }] }, claims: { forecast: false, marketValue: false, trusted: false } } as unknown as DisplayProfile;
  const receipt: EvidenceReceipt = { status: "fixture", reference: "synthetic-test", snapshotSHA256: "a".repeat(64), methodVersion: p.score.version, season: s.capture.season, observedAt: s.capture.observedAt, strength: "all", gameIds: s.recent.gameIds, sourceRows: s.recent.gameIds.map((gameId, i) => ({ sourceId: 101 + i, gameId })) };
  return { s, p, receipt };
}
const trade = (): TradeObservation => ({ id: "synthetic-transaction", sample: "synthetic", source: "Yahoo Trade Market", sourceUrl: "https://hockey.fantasysports.yahoo.com/", attribution: "Yahoo Trade Market · synthetic fixture", observedAt: "2026-10-30T12:00:00Z", tradedAt: null, give: [{ kind: "player", playerId: 8476453, name: "Fixture skater" }, { kind: "pick", season: "2027", round: 2, description: "Round 2 pick" }], receive: [{ kind: "player", playerId: 8479318, name: "Fixture counterpart" }], context: { scoring: null, roster: null, leagueSize: null } });
const options = { fixture: true, ownerReceipt: null, asOf: "2026-10-31T12:00:00Z" };
describe("card evidence consumers", () => {
  it.each([["buy_low_evidence", "positive"], ["sell_high_evidence", "negative"], ["balanced", "level"], [null, "unknown"]] as const)("preserves owner-supplied %s direction without upgrading research", (sign, direction) => {
    const { s, p, receipt } = blsh(); p.score.gapSign = sign;
    const r = cardBlshEvidence(s, p, receipt); expect(r.status).toBe("exploratory"); expect(r.direction).toBe(direction); expect(r.lines.join(" ")).toContain("recorded 2.00"); expect(r.lines.join(" ")).toContain("not a qualified forecast"); expect(r.market).toBe("Market reference unavailable");
  });
  it("rejects wrong player, stale/incomplete support, method drift and mismatched windows", () => {
    for (const change of [(x: ReturnType<typeof blsh>) => { x.p.playerId++; }, (x: ReturnType<typeof blsh>) => { x.receipt.methodVersion = "wrong"; }, (x: ReturnType<typeof blsh>) => { x.p.evidence.window.fresh = false; }, (x: ReturnType<typeof blsh>) => { x.p.coverage.context.current.verified = false; }, (x: ReturnType<typeof blsh>) => { x.receipt.gameIds = [1]; }, (x: ReturnType<typeof blsh>) => { x.s.capture.source = "observed"; }]) { const x = blsh(); change(x); expect(cardBlshEvidence(x.s, x.p, x.receipt).status).toBe("unavailable"); }
  });
  it("requires explicit linkage between source row IDs and NHL game IDs", () => {
    const x = blsh(); expect(cardBlshEvidence(x.s, x.p, x.receipt).status).toBe("exploratory");
    x.receipt.sourceRows = []; expect(cardBlshEvidence(x.s, x.p, x.receipt).status).toBe("unavailable");
    x.receipt.sourceRows = x.s.recent.gameIds.map(gameId => ({ sourceId: gameId, gameId }));
    expect(cardBlshEvidence(x.s, x.p, x.receipt).status).toBe("unavailable");
  });
  it("does not turn support or ownership into market value", () => {
    const expected = { value: 3, unit: "count" as const, scoringBasis: "category:POINTS", horizonGames: 5 }, reference = { value: 2, source: "Manager scenario", kind: "manager_entered" as const, capturedAt: "2026-10-30T12:00:00Z", unit: "count" as const, scoringBasis: "category:POINTS", horizonGames: 5 };
    expect(cardMarketReference(null, reference, options.asOf, 48).status).toBe("unavailable");
    expect(cardMarketReference(expected, { ...reference, horizonGames: 10 }, options.asOf, 48).status).toBe("unavailable");
    expect(cardMarketReference(expected, reference, options.asOf, 48).status).toBe("comparable");
    expect(cardMarketReference(expected, reference, options.asOf, null).status).toBe("unavailable");
  });
  it("preserves full bundles/picks and unknown context while deduplicating repeated observations", () => {
    const t = trade(), r = cardTradeContext(8476453, [t, { ...t, observedAt: "2026-10-31T00:00:00Z" }], options);
    expect(r.status).toBe("synthetic"); expect(r.records).toHaveLength(1); expect(r.records[0].give).toHaveLength(2); expect(r.records[0].tradedAt).toBeNull();
    expect(illustrativeTradeIdeas(r)[0].caveat).toContain("scoring unknown"); expect(r.lines.join(" ")).toContain("No guarantee");
    expect(cardTradeContext(999, [t], options).status).toBe("unavailable");
  });
  it("withholds conflicting transactions, invented observed records, future dates and ambiguous identities", () => {
    const t = trade();
    expect(cardTradeContext(8476453, [t, { ...t, give: [t.give[0]] }], options).status).toBe("unavailable");
    expect(cardTradeContext(8476453, [t], { ...options, fixture: false }).status).toBe("unavailable");
    expect(cardTradeContext(8476453, [{ ...t, observedAt: "2027-01-01" }], options).status).toBe("unavailable");
    expect(cardTradeContext(8476453, [{ ...t, give: [{ kind: "player", playerId: NaN, name: "Same name" }] }], options).status).toBe("unavailable");
  });
  it("keeps dated preseason anchors separate from current performance and pick value", () => {
    expect(preseasonAnchorLabel({ playerId: 8476453, season: 20262027, publishedAt: "2026-09-01", source: "Fixture anchor", value: 80, unit: "points" }, 8476453, 20262027)).toContain("not current performance, market price or pick value");
    expect(preseasonAnchorLabel(null, 8476453, 20262027)).toContain("unavailable");
  });
});

import { describe, expect, it } from "vitest";
import { claimsFromReport } from "./sourceClaims";
import { fixtureDecisionEvidence, fixtureGame, fixtureUnit } from "./testFixtures";
import type { LineEvidenceContext } from "./sourceClaims";
import type { ProjectionReport } from "lib/sources/projectedLineups";

const report: ProjectionReport = { key: "fixture-report", teamId: 14, teamAbbreviation: "TBL", gameId: fixtureGame.id, session: null, date: fixtureGame.date,
  publishedAt: "2026-10-01T22:35:00Z", originalPublishedAt: "2026-10-01T22:34:00Z", receivedAt: "2026-10-01T22:36:00Z", interpretedAt: "2026-10-01T22:37:00Z", originalUrl: "https://x.com/fixture/status/123", text: "Warmup lines: Mikheyev-Point-Kucherv",
  interpretation: { version: "fixture", units: [fixtureUnit()], unresolved: [], context: "game", certainty: "confirmed" } };
const publication = { originalPublishedAt: report.originalPublishedAt!, relayPublishedAt: report.publishedAt, originalIdentity: report.originalUrl!, originalAuthor: "fixture", evidence: ["fixture:primary-original-provider-clock"] };
const context: LineEvidenceContext = { publication, gameId: fixtureGame.id, phase: "pregame", kind: "entry", identityStatus: "resolved_at_event", identityEvidence: ["roster"], decisionEvidence: fixtureDecisionEvidence(report.text) };
describe("capture interpretation boundary", () => {
  it("does not trust the legacy game assignment, current roster or blanket certainty", () => {
    const claim = claimsFromReport(report, [fixtureGame])[0]!;
    expect(claim.binding.status).toBe("unresolved"); expect(claim.identityStatus).toBe("unresolved");
    expect(claim.confirmationEvidence).toHaveLength(0); expect(claim.text).toContain("Kucherv");
  });
  it("stores source, relay, ingestion, interpretation and effective clocks independently", () => {
    const claim = claimsFromReport(report, [fixtureGame], { ...context, effectiveAt: "2026-10-01T22:30:00Z" })[0]!;
    expect(claim.time.originalPublishedAt).not.toBe(claim.time.relayPublishedAt);
    expect(claim.time.effectiveAt).toBe("2026-10-01T22:30:00Z"); expect(claim.reviewReasons).toHaveLength(0);
  });
  it("a displayed screenshot time never becomes an offset-aware instant", () => {
    const claim = claimsFromReport({ ...report, originalPublishedAt: null, publishedAt: null }, [fixtureGame], { rawDisplay: "6:34 PM Oct 1 2026", gameId: fixtureGame.id })[0]!;
    expect(claim.time.precision).toBe("display"); expect(claim.time.originalPublishedAt).toBeNull(); expect(claim.binding.status).toBe("unresolved");
  });
  it("preserves only the explicit relationship and does not reconstruct other trios", () => {
    const claim = claimsFromReport({ ...report, text: "Kucherov with Hagel/Cirelli. Holmberg/Point/Guentzel together.", interpretation: { ...report.interpretation, units: [], relationships: [{ kind: "continuity", playerIds: [3, 4, 5], situation: null, number: null, certainty: "reported", evidence: { start: 0, end: 26, text: "Kucherov with Hagel/Cirelli" }, reviewReason: "unresolved_reference" }] } }, [fixtureGame], { gameId: fixtureGame.id, phase: "in_game" })[0]!;
    expect(claim.kind).toBe("iga"); expect(claim.unit).toBeNull(); expect(claim.relationship?.playerIds).toEqual([3, 4, 5]);
    expect(claim.text).not.toContain("Mikheyev");
  });
  it("classifies mixed posts per claim, without a missing ES player hiding valid PP evidence", () => {
    const mixed = { ...report, interpretation: { ...report.interpretation, units: [fixtureUnit(), fixtureUnit(["A", "B", "C", "D", "E"], "pp", 1)], unresolved: [{ start: 0, end: 7, text: "Kucherv", situation: "es_forward" as const, number: 1, reason: "missing_player" as const }] } };
    const claims = claimsFromReport(mixed, [fixtureGame], { publication, identityStatus: "resolved_at_event", claimEvidence: {
      "es_forward:1:main": { gameId: fixtureGame.id, phase: "pregame", kind: "entry", decisionEvidence: fixtureDecisionEvidence(mixed.text) },
      "pp:1:main": { gameId: fixtureGame.id, phase: "in_game", kind: "pp", decisionEvidence: fixtureDecisionEvidence(mixed.text) },
    } });
    expect(claims[0]!.phase).toBe("pregame"); expect(claims[0]!.reviewReasons).toContain("extraction:missing_player:Kucherv");
    expect(claims[1]!.phase).toBe("in_game"); expect(claims[1]!.reviewReasons).toHaveLength(0);
  });
  it("does not promote missing mixed-post keys through common phase, binding or confirmation", () => {
    const mixed = { ...report, interpretation: { ...report.interpretation, units: [fixtureUnit(), fixtureUnit(["A", "B", "C", "D", "E"], "pp", 1)] } };
    const claims = claimsFromReport(mixed, [fixtureGame], { ...context, certainty: "confirmed", confirmationEvidence: ["whole-post assertion"], claimEvidence: { "es_forward:1:main": { ...context } } });
    expect(claims[0]!.phase).toBe("pregame");
    expect(claims[1]!.phase).toBe("unknown"); expect(claims[1]!.binding.status).toBe("unresolved");
    expect(claims[1]!.confirmationEvidence).toHaveLength(0); expect(claims[1]!.reviewReasons).toContain("claim_phase_unresolved");
  });
  it("requires auditable decisions, a verified primary-original clock and claim-specific confirmation", () => {
    const missingAudit = claimsFromReport(report, [fixtureGame], { ...context, decisionEvidence: undefined })[0]!;
    expect(missingAudit.explicit).toBe(false); expect(missingAudit.reviewReasons).toContain("binding_decision_unverified");
    const wrongOriginal = claimsFromReport(report, [fixtureGame], { ...context, publication: { ...publication, originalIdentity: "a-different-original" } })[0]!;
    expect(wrongOriginal.time.originalPublishedAt).toBeNull(); expect(wrongOriginal.reviewReasons).toContain("original_provenance_unverified");
    const unsupported = claimsFromReport(report, [fixtureGame], { ...context, certainty: "confirmed", confirmationEvidence: [] })[0]!;
    expect(unsupported.reviewReasons).toContain("claim_confirmation_unresolved");
  });
});

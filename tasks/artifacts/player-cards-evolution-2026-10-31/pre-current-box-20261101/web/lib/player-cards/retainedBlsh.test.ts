import { describe, expect, it } from "vitest";
import { RETAINED_BLSH_SHA256, RETAINED_BLSH_SIDECAR_SHA256, RETAINED_BLSH_PROVENANCE_REVIEW_SHA256, retainedBlshEvidence, type RetainedBlshInput } from "./retainedBlsh";
const player = { id: 8476453, team: "TBL" };
const fixture = (): RetainedBlshInput => ({ snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract; actual bytes verified separately by owner reader", metadata: { schemaVersion: "fhfh.blsh.current-research-snapshot.v2", scoreVersion: "support-conditioned-production-gap-v1", seasonId: 20262027, provisional: true, exploratory: true, productionAdopted: false, trusted: false, confidenceProbability: null, issuedAtUTC: null, asOfUTC: "2026-10-29T18:41:12Z", eventThroughDate: "2026-10-28", limits: ["Synthetic test; stale development reference"] }, profile: { playerId: player.id, team: player.team, score: { version: "support-conditioned-production-gap-v1", gapSign: "buy_low_evidence", statusLabel: "Direction agrees", calibratedProbability: null }, evidence: { window: { games: 1, dates: ["2026-10-24"], sourceIds: [123], minutes: 20 }, reference: { personalGames: 50, ageDays: 900 }, tierNote: "Coverage is not confidence" }, tracks: ["FP", "G+A", "Game Score"].map(label => ({ label, observed: 2, supportConditioned: 3, gap: 1 })), coverage: { notes: [{ text: "Source revision unverified" }] }, context: { opportunity: [{ label: "TOI", current: 1200, units: "seconds/appearance" }] }, claims: { forecast: false, marketValue: false, trusted: false } } } as unknown as RetainedBlshInput);
describe("retained BLSH card evidence", () => {
  const withProvenance = () => {
    const f = fixture();
    f.provenance = { version: "fhfh.blsh.player-card-research-provenance.v1", sidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, snapshotSHA256: RETAINED_BLSH_SHA256, independentReviewPending: true, generatedAtUTC: "2026-11-01T16:32:16.987Z", asOfUTC: f.metadata.asOfUTC, eventThroughDate: f.metadata.eventThroughDate, maxCaptureAgeHours: 24, playerId: player.id, team: player.team, season: 20262027, rows: [{ sourceId: 123, gameId: 2026020177, playerId: player.id, season: 20262027, date: "2026-10-24", team: "TBL", regularSeasonCalendarMatched: true, finalityEstablished: false }], limitations: ["No NST model revision receipt"] };
    return f;
  };
  it("attaches pending source lineage without admitting stale research as current input", () => {
    const f = withProvenance(), r = retainedBlshEvidence(player, 20262027, f);
    expect(r.retained?.provenance).toMatchObject({ state: "pending-review", captureStale: true, currentBinding: false });
    expect(r.retained?.provenance?.message).toContain("Finality evidence for 0/1 rows");
    expect(r.retained?.provenance?.message).toContain("Independent sidecar review pending");
    expect(r.lines[0]).toContain("recorded game rows");
    expect(r.receipt).toBeNull();
    f.provenance!.rows[0].gameId = 1;
    expect(r.retained?.provenance?.sourceMap?.rows[0].gameId).toBe(2026020177);
  });
  it("binds the independent review only to its exact stale-research scope", () => {
    const f = withProvenance();
    f.provenance!.review = { reference: "tasks/artifacts/rso-blsh-independent-review-2026-11-01/PROVENANCE-REVIEW.md", sha256: RETAINED_BLSH_PROVENANCE_REVIEW_SHA256, sidecarSHA256: RETAINED_BLSH_SIDECAR_SHA256, scope: "dated-stale-research-only" };
    const r = retainedBlshEvidence(player, 20262027, f);
    expect(r.retained?.provenance).toMatchObject({ state: "reviewed-retained-only", currentBinding: false, captureStale: true });
    expect(r.retained?.provenance?.sourceMap?.independentReviewPending).toBe(true);
    expect(r.retained?.provenance?.message).toContain("Independently reviewed for dated stale research only");
    expect(r.receipt).toBeNull();
    f.provenance!.review.sha256 = "a".repeat(64);
    expect(retainedBlshEvidence(player, 20262027, f).retained?.provenance?.state).toBe("unavailable");
    f.provenance!.review.sha256 = RETAINED_BLSH_PROVENANCE_REVIEW_SHA256;
    f.provenance!.review.scope = "current" as "dated-stale-research-only";
    expect(retainedBlshEvidence(player, 20262027, f).retained?.provenance?.state).toBe("unavailable");
  });
  it("withholds invalid lineage but preserves independently qualified retained values", () => {
    for (const change of [
      (f: RetainedBlshInput) => { f.provenance!.sidecarSHA256 = "a".repeat(64); },
      (f: RetainedBlshInput) => { f.provenance!.rows[0].sourceId = 999; },
      (f: RetainedBlshInput) => { f.provenance!.rows[0].date = "2026-10-23"; },
      (f: RetainedBlshInput) => { f.provenance!.playerId = 1; },
      (f: RetainedBlshInput) => { f.provenance!.asOfUTC = "2026-10-30T00:00:00Z"; },
      (f: RetainedBlshInput) => { f.provenance!.rows.push(f.provenance!.rows[0]); },
      (f: RetainedBlshInput) => { f.provenance!.independentReviewPending = false as true; },
    ]) {
      const f = withProvenance(); change(f);
      const r = retainedBlshEvidence(player, 20262027, f);
      expect(r.status).toBe("exploratory");
      expect(r.lines.join(" ")).toContain("recorded 2.00; support-conditioned 3.00");
      expect(r.retained?.provenance).toMatchObject({ state: "unavailable", currentBinding: false, sourceMap: null });
      expect(r.receipt).toBeNull();
    }
  });
  it("displays actual supplied values on a separately dated window and preserves full evidence", () => {
    const f = fixture(), r = retainedBlshEvidence(player, 20262027, f);
    expect(r.status).toBe("exploratory"); expect(r.lines.join(" ")).toContain("recorded 2.00; support-conditioned 3.00");
    expect(r.lines.join(" ")).toContain("NHL controls do not change this evidence window");
    expect(r.lines.join(" ")).toContain("stale development history");
    expect(r.receipt).toBeNull(); expect(r.retained?.profile).toEqual(f.profile);
    f.profile.tracks[0].observed = 100; expect(r.retained?.profile.tracks[0].observed).toBe(2);
  });
  it("rejects unreviewed bytes, changed identity and promoted research claims", () => {
    for (const change of [(f: RetainedBlshInput) => { f.snapshotSHA256 = "a".repeat(64); }, (f: RetainedBlshInput) => { f.profile.playerId = 1; }, (f: RetainedBlshInput) => { f.profile.team = "TOR"; }, (f: RetainedBlshInput) => { (f.metadata as any).productionAdopted = true; }, (f: RetainedBlshInput) => { (f.profile.claims as any).forecast = true; }]) {
      const f = fixture(); change(f); expect(retainedBlshEvidence(player, 20262027, f).status).toBe("unavailable");
    }
  });
  it("rejects incomplete saved windows and unavailable support instead of manufacturing neutrality", () => {
    const f = fixture(); f.profile.evidence.window.sourceIds = [];
    expect(retainedBlshEvidence(player, 20262027, f).status).toBe("unavailable");
    const other = fixture(); other.profile.tracks[1].gap = NaN;
    expect(retainedBlshEvidence(player, 20262027, other).status).toBe("unavailable");
  });
});

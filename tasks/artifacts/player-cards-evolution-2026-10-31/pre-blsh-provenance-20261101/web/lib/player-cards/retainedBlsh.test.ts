import { describe, expect, it } from "vitest";
import { RETAINED_BLSH_SHA256, retainedBlshEvidence, type RetainedBlshInput } from "./retainedBlsh";
const player = { id: 8476453, team: "TBL" };
const fixture = (): RetainedBlshInput => ({ snapshotSHA256: RETAINED_BLSH_SHA256, reviewReference: "Synthetic unit contract; actual bytes verified separately by owner reader", metadata: { schemaVersion: "fhfh.blsh.current-research-snapshot.v2", scoreVersion: "support-conditioned-production-gap-v1", seasonId: 20262027, provisional: true, exploratory: true, productionAdopted: false, trusted: false, confidenceProbability: null, issuedAtUTC: null, asOfUTC: "2026-10-29T18:41:12Z", eventThroughDate: "2026-10-28", limits: ["Synthetic test; stale development reference"] }, profile: { playerId: player.id, team: player.team, score: { version: "support-conditioned-production-gap-v1", gapSign: "buy_low_evidence", statusLabel: "Direction agrees", calibratedProbability: null }, evidence: { window: { games: 1, dates: ["2026-10-24"], sourceIds: [123], minutes: 20 }, reference: { personalGames: 50, ageDays: 900 }, tierNote: "Coverage is not confidence" }, tracks: ["FP", "G+A", "Game Score"].map(label => ({ label, observed: 2, supportConditioned: 3, gap: 1 })), coverage: { notes: [{ text: "Source revision unverified" }] }, context: { opportunity: [{ label: "TOI", current: 1200, units: "seconds/appearance" }] }, claims: { forecast: false, marketValue: false, trusted: false } } } as unknown as RetainedBlshInput);
describe("retained BLSH card evidence", () => {
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

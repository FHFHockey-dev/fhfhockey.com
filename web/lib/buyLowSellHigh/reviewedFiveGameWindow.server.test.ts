import { describe, expect, it } from "vitest";
import { currentSlot } from "./currentWindows";
import { createReviewedFiveGameFixture } from "./reviewedFiveGameWindow.testHelper";
import { decodeReviewedEvidenceJSON, reviewedEvidenceTime, verifyReviewedFiveGameWindow } from "./reviewedFiveGameWindow.server";

type Fixture = ReturnType<typeof createReviewedFiveGameFixture>;
const verify = (f: Fixture, read = f.evaluatedAtUTC) => verifyReviewedFiveGameWindow(f.input, read, f.policy);
// Only tests can create replacement approvals. Change the actual dependent bytes
// and every outer digest so adversarial cases reach the semantic checks.
function reseal(f: Fixture) {
  f.census.gameLogSHA256 = f.save(f.log);
  f.census.landingSHA256 = f.save(f.landing);
  f.manifest.censusSHA256 = f.revision.censusSHA256 = f.save(f.census);
  f.manifest.revisionSHA256 = f.save(f.revision);
  const sha = f.save(f.manifest);
  f.input.manifestBytes = f.input.artifacts.get(sha)!;
  Object.assign(f.policy.windows[0], { manifestSHA256: sha, censusSHA256: f.manifest.censusSHA256, revisionSHA256: f.manifest.revisionSHA256 });
}
function updateQualification(f: Fixture, overrides: Record<string, unknown> = {}) {
  const member = f.manifest.members[0], revision = f.revision.members[0];
  const receipt = decodeReviewedEvidenceJSON<Record<string, unknown>>(f.input.artifacts.get(member.qualificationReceiptSHA256)!);
  Object.assign(receipt, { requestSHA256: member.requestSHA256, bundleSHA256: member.bundleSHA256, productionReviewSHA256: member.productionReviewSHA256 }, overrides);
  f.policy.originalQualifications[0].evaluatedAtUTC = revision.originalEvaluationUTC = String(receipt.evaluatedAtUTC);
  f.policy.originalQualifications[0].receiptSHA256 = revision.qualificationReceiptSHA256 = member.qualificationReceiptSHA256 = f.save(receipt);
}
describe("reviewed five-game window with isolated synthetic approvals", () => {
  it("qualifies five original v1 acquisitions over nine calendar dates and preserves raw observations for the actual window reader", () => {
    const f = createReviewedFiveGameFixture(), out = verify(f);
    expect(out.qualified).toBe(true);
    if (!out.qualified) throw new Error(out.reasons.join(","));
    expect(out.members.map(m => m.sourceId)).toEqual([101, 102, 103, 104, 105]);
    expect(out.members[0].acquisitionAtUTC).toBe("2026-10-29T23:00:00.000Z");
    expect(out.current[0].research.individual).toMatchObject({ provenance: { availableAtUTC: "2026-10-29T23:15:00.000Z" } });
    expect(out.members[0].originalEvaluationUTC).toBe("2026-10-29T23:30:00.000Z");
    expect(out.current[0].raw.individual.qualified).toBe(false);
    expect(out.current[0].research.individual.qualified).toBe(true);
    expect(out.current.map(record => currentSlot(record))).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 101, goals: 0, shots: 2, ixG: 0.2, onIceXGF: 1, onIceXGA: 0.4 }),
    ]));
    expect(out.priorAppearances).toEqual([]);
    expect(verifyReviewedFiveGameWindow(f.input, f.evaluatedAtUTC)).toMatchObject({ qualified: false, current: [], score: null, reasons: ["no_unique_active_window_for_target"] });
  });

  it("refuses an old or wrong player's vintage after active policy replacement or revocation", () => {
    const f = createReviewedFiveGameFixture(), old = f.input.manifestBytes;
    f.manifest.builtAtUTC = "2026-11-07T11:01:00.000Z";
    reseal(f);
    expect(verify(f).qualified).toBe(true);
    f.input.manifestBytes = old;
    expect(verify(f).reasons).toEqual(["window_snapshot_changed_or_superseded"]);
    f.input.target.playerId++;
    expect(verify(f).qualified).toBe(false);
    f.input.target.playerId--;
    f.policy.windows.push({ ...f.policy.windows[0] });
    expect(verify(f).reasons).toEqual(["no_unique_active_window_for_target"]);
  });

  it("keeps exact UTC microseconds across read, cutoff and checked clocks", () => {
    const f = createReviewedFiveGameFixture();
    expect(verify(f, "2026-11-08T11:00:00.000000Z").qualified).toBe(true);
    expect(verify(f, "2026-11-08T11:00:00.000001Z").reasons).toEqual(["snapshot_or_recheck_stale_or_future"]);
    f.revision.checkedAtUTC = "2026-11-07T10:59:59.999999Z"; reseal(f);
    expect(verify(f).reasons).toEqual(["snapshot_or_recheck_stale_or_future"]);
    expect(reviewedEvidenceTime("2026-11-07T13:00:00.000001+02:00") - reviewedEvidenceTime("2026-11-07T11:00:00.000000Z")).toBe(1);
  });

  it("withholds a stale newest event even with a fresh corroborating snapshot", () => {
    const f = createReviewedFiveGameFixture();
    const now = "2026-11-14T11:00:00.000000Z";
    f.manifest.builtAtUTC = f.manifest.asOfUTC = f.census.throughUTC = f.census.observedAtUTC = f.revision.throughUTC = f.revision.checkedAtUTC = now;
    reseal(f);
    expect(verify(f, now).reasons).toEqual(["latest_official_appearance_stale"]);
  });

  it.each([
    ["missing season appearance", (f: Fixture) => { f.landing.seasonTotals[0].gamesPlayed++; }, "official_census_incomplete"],
    ["ambiguous official duplicate", (f: Fixture) => { f.log.gameLog[0] = f.log.gameLog[1]; }, "official_appearance_or_cutoff_changed"],
    ["newly confirmed appearance", (f: Fixture) => { f.log.gameLog.push({ ...f.log.gameLog[0], gameDate: "2026-11-05", gameId: 2026020199 });
      f.landing.seasonTotals[0].gamesPlayed++; }, "latest_five_membership_changed"],
    ["newer than cutoff", (f: Fixture) => { f.log.gameLog[0].gameDate = "2026-11-07"; }, "official_appearance_or_cutoff_changed"],
    ["wrong retained official team", (f: Fixture) => { f.log.gameLog[0].teamAbbrev = "OTH"; }, "official_box_appearance_mismatch"],
    ["inconsistent official TOI", (f: Fixture) => { f.log.gameLog[0].toi = "14:59"; }, "official_box_appearance_mismatch"],
    ["source row revision", (f: Fixture) => { f.revision.members[2].wgoRowSHA256 = "f".repeat(64); }, "selected_source_revision_or_review_changed"],
    ["native correction", (f: Fixture) => { f.revision.members[1].process[0].nativeBodySHA256 = "a".repeat(64); }, "selected_source_revision_or_review_changed"],
    ["reference correction", (f: Fixture) => { f.revision.referencePacketSHA256 = "a".repeat(64); }, "revision_or_reference_changed"],
    ["missing accepted review", (f: Fixture) => { f.policy.process.acceptances.splice(1, 1); }, "original_game_evidence_unqualified"],
    ["unknown selected revision", (f: Fixture) => { f.revision.members.splice(1, 1); }, "revision_or_reference_changed"],
  ] as const)("holds %s even after all enclosing snapshot digests are regenerated", (_label, mutate, reason) => {
    const f = createReviewedFiveGameFixture();
    mutate(f); reseal(f);
    expect(verify(f)).toMatchObject({ qualified: false, current: [], score: null, reasons: [reason] });
  });

  it("requires actual raw WGO, original box, original native body and reviewed reference bytes", () => {
    for (const kind of ["WGO", "official", "native", "reference"] as const) {
      const f = createReviewedFiveGameFixture(), member = f.manifest.members[0];
      const request = decodeReviewedEvidenceJSON<{ wgo: { capture: { sha256: string } } }>(f.input.artifacts.get(member.requestSHA256)!);
      const keys = { WGO: request.wgo.capture.sha256, official: member.officialBoxSHA256, native: f.revision.members[0].process[0].nativeBodySHA256,
        reference: f.manifest.referencePacketSHA256 };
      f.input.artifacts.delete(keys[kind]);
      expect(verify(f).qualified).toBe(false);
    }
  });

  it("rejects a formerly ineligible game at its original acquisition despite an independently resealed later window", () => {
    const f = createReviewedFiveGameFixture(), member = f.manifest.members[0], acceptance = f.policy.process.acceptances[0];
    const request = decodeReviewedEvidenceJSON<Record<string, unknown>>(f.input.artifacts.get(member.requestSHA256)!);
    request.asOfUTC = "2026-11-06T23:00:00.000Z";
    const bundle = decodeReviewedEvidenceJSON<Record<string, unknown>>(f.input.artifacts.get(member.bundleSHA256)!);
    bundle.sourceRequestSHA256 = member.requestSHA256 = acceptance.requestSHA256 = f.save(request);
    member.bundleSHA256 = acceptance.bundleSHA256 = f.save(bundle);
    updateQualification(f, { evaluatedAtUTC: request.asOfUTC }); reseal(f);
    expect(verify(f).reasons).toEqual(["original_game_evidence_unqualified"]);
  });

  it("qualifies observed PPP for a skater with an assist using original NHL summary bytes", () => {
    const f = createReviewedFiveGameFixture(undefined, undefined, undefined, "summary");
    const r = verify(f);
    expect(r.reasons).toEqual([]);
    expect(r.current.map(row => currentSlot(row).ppPoints)).toEqual([1, 1, 1, 1, 1]);
    f.policy.productionReviews.shift();
    expect(verify(f).reasons).toEqual(["no_independent_production_review"]);
  });

  it.each(["changed_box", "missing_box_stat", "unmatched_field", "unknown_ppp", "summary_ppp_changed", "summary_before_final", "review_before_box", "wgo_revision_unknown", "later_log_changed"])(
    "holds %s even after independently resealing the altered source and all row/window hashes", kind => {
      const f = createReviewedFiveGameFixture(undefined, undefined, undefined, "summary");
      const m = f.manifest.members[0], r = f.revision.members[0], approval = f.policy.process.acceptances[0];
      const load = <T,>(sha: string) => decodeReviewedEvidenceJSON<T>(f.input.artifacts.get(sha)!);
      const proof = load<{ fields: Record<string, { state: string }>; officialBoxSHA256: string; reviewedAtUTC: string; wgoRevision: string;
        summary: { bodySHA256: string; observedAtUTC: string } }>(m.productionReviewSHA256);
      if (kind === "changed_box" || kind === "missing_box_stat") {
        const box = load<{ playerByGameStats: { homeTeam: { forwards: { sog?: number }[] } } }>(m.officialBoxSHA256);
        if (kind === "changed_box") box.playerByGameStats.homeTeam.forwards[0].sog = 5;
        else delete box.playerByGameStats.homeTeam.forwards[0].sog;
        proof.officialBoxSHA256 = r.officialBoxSHA256 = m.officialBoxSHA256 = f.save(box);
        const frame = load<{ provenance: { boxscoreSHA256: string } }>(r.officialFrameSHA256);
        frame.provenance.boxscoreSHA256 = m.officialBoxSHA256;
        const oldFrame = r.officialFrameSHA256;
        r.officialFrameSHA256 = f.save(frame);
        approval.requiredArtifactSHA256 = approval.requiredArtifactSHA256.map(h => h === oldFrame ? r.officialFrameSHA256 : h);
        const bundle = load<{ witnesses: { officialFrameSHA256: string }[] }>(m.bundleSHA256);
        bundle.witnesses.forEach(w => { w.officialFrameSHA256 = r.officialFrameSHA256; });
        approval.bundleSHA256 = r.bundleSHA256 = m.bundleSHA256 = f.save(bundle);
      } else if (kind === "unmatched_field") proof.fields.hits.state = "different";
      else if (kind === "unknown_ppp") proof.fields.pp_points.state = "unknown";
      else if (kind === "summary_ppp_changed") {
        const summary = load<{ data: { ppPoints: number }[] }>(proof.summary.bodySHA256);
        summary.data[0].ppPoints = 0;
        proof.summary.bodySHA256 = f.save(summary);
      } else if (kind === "summary_before_final") proof.summary.observedAtUTC = "2026-10-29T21:59:59.999999Z";
      else if (kind === "review_before_box") proof.reviewedAtUTC = "2026-10-29T23:14:59.999999Z";
      else if (kind === "wgo_revision_unknown") proof.wgoRevision = "unknown";
      else Object.assign(f.log.gameLog.at(-1)!, { shots: 9 });
      f.policy.productionReviews[0].reviewSHA256 = r.productionReviewSHA256 = m.productionReviewSHA256 = f.save(proof);
      updateQualification(f); reseal(f);
      const expected = { changed_box: "official_production_operand_mismatch", missing_box_stat: "official_production_operand_mismatch",
        unmatched_field: "official_production_operand_mismatch", unknown_ppp: "official_ppp_unqualified", summary_ppp_changed: "official_summary_operand_mismatch",
        summary_before_final: "official_summary_scope_or_clock", review_before_box: "production_review_identity_or_clock", wgo_revision_unknown: "wgo_game_score_revision_or_definition_unknown",
        later_log_changed: "current_official_log_production_changed" };
      expect(verify(f).reasons).toEqual([expected[kind as keyof typeof expected]]);
    });

  it.each([
    ["missing active original receipt", null, "original_qualification_not_independently_recorded"],
    ["reconstructed execution", { evidenceClass: "historical_replay" }, "original_qualification_scope_or_identity"],
    ["future original evaluation", { evaluatedAtUTC: "2026-11-08T12:00:00.000Z" }, "original_qualification_clock"],
    ["past original 24h deadline", { evaluatedAtUTC: "2026-10-30T23:00:00.000001Z" }, "original_qualification_clock"],
    ["frame after original evaluation", { evaluatedAtUTC: "2026-10-29T23:10:00.000Z" }, "original_game_evidence_unqualified"],
    ["changed process review identity", { processReviewSHA256: "e".repeat(64) }, "original_qualification_review_changed"],
  ] as const)("rejects %s at the original authority boundary", (_label, change, code) => {
    const f = createReviewedFiveGameFixture();
    if (change) { updateQualification(f, change); reseal(f); } else f.policy.originalQualifications.shift();
    expect(verify(f).reasons).toEqual([code]);
  });

  it("requires WGO primary and secondary assists to reconcile to the positively matched official total", () => {
    // Build all WGO, raw capture, review, original qualification, revision and inventory
    // bytes from the contradictory primitives, so a hash mismatch cannot explain the hold.
    const f = createReviewedFiveGameFixture(undefined, undefined, undefined, "zero_assist", 2);
    expect(verify(f).reasons).toEqual(["production_assist_or_points_partition"]);
  });

  it.each([
    ["missing authoritative material", (f: Fixture) => { f.input.artifacts.delete(f.revision.inventorySHA256); }, "window_artifact_missing_or_changed"],
    ["no independent authority", (f: Fixture) => { f.policy.inventories = []; }, "current_revision_inventory_not_independently_accepted"],
    ["two active inventories", (f: Fixture) => { f.policy.inventories.push({ ...f.policy.inventories[0] }); }, "current_revision_inventory_not_independently_accepted"],
  ] as const)("holds for %s even with an accepted revision wrapper", (_label, change, reason) => {
    const f = createReviewedFiveGameFixture(); change(f);
    expect(verify(f).reasons).toEqual([reason]);
  });

  it.each([
    ["unknown publisher coverage", (f: Fixture) => { f.inventory.coverage.individual.state = "unavailable"; }, "current_revision_source_coverage_unknown"],
    ["missing reference source watermark", (f: Fixture) => { delete f.inventory.coverage.reference; }, "current_revision_source_coverage_unknown"],
    ["stale source watermark", (f: Fixture) => { f.inventory.coverage.wgo.throughUTC = "2026-11-07T10:59:59.999999Z"; }, "current_revision_source_coverage_unknown"],
    ["observation after review", (f: Fixture) => { f.inventory.coverage.wgo.observedAtUTC = "2026-11-07T11:00:00.000001Z"; }, "current_revision_source_coverage_unknown"],
    ["corrected raw WGO field", (f: Fixture) => { f.inventory.games[2].wgo.counts.shots++; }, "current_wgo_revision_changed"],
    ["official exposure revision", (f: Fixture) => { f.inventory.games[0].official.seconds++; }, "current_official_revision_changed"],
    ["native replacement", (f: Fixture) => { f.inventory.games[1].native[1].nativeBodySHA256 = "e".repeat(64); }, "current_native_revision_changed"],
    ["superseded production review", (f: Fixture) => { f.inventory.games[2].reviews.productionReviewSHA256 = "a".repeat(64); }, "current_review_superseded_or_unknown"],
    ["superseded process review", (f: Fixture) => { f.inventory.games[1].reviews.processReviewSHA256 = "a".repeat(64); }, "current_review_superseded_or_unknown"],
    ["withdrawn original qualification", (f: Fixture) => { f.inventory.games[3].reviews.qualificationReceiptSHA256 = ""; }, "current_review_superseded_or_unknown"],
    ["current reference revision", (f: Fixture) => { f.inventory.referencePacketSHA256 = "c".repeat(64); }, "current_reference_revision_changed"],
  ] as const)("detects %s in actual current material while every outer game/reference claim stays unchanged", (_label, change, reason) => {
    const f = createReviewedFiveGameFixture();
    const before = JSON.stringify([f.revision.members, f.revision.referencePacketSHA256]);
    change(f);
    f.policy.inventories[0].inventorySHA256 = f.revision.inventorySHA256 = f.save(f.inventory);
    reseal(f);
    expect(JSON.stringify([f.revision.members, f.revision.referencePacketSHA256])).toBe(before);
    expect(verify(f)).toMatchObject({ qualified: false, score: null, current: [], reasons: [reason] });
  });

  it("does not treat duplicate JSON identities or clocks as trusted artifacts", () => {
    expect(() => decodeReviewedEvidenceJSON(new TextEncoder().encode('{"playerId":1,"player\\u0049d":2}'))).toThrow("ambiguous_json_member");
    expect(() => reviewedEvidenceTime("2026-02-30T12:00:00Z")).toThrow();
  });
});

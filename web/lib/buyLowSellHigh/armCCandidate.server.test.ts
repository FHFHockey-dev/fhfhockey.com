// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createArmCCandidateReader, type ArmCReferencePacket } from "./armCCandidate.server";
import { createArmCCandidateFixture } from "./armCCandidate.testHelper";
import type { CurrentInputRequest } from "./currentInput";
import { createReviewedFiveGameFixture } from "./reviewedFiveGameWindow.testHelper";

describe("reviewed one-player arm-C candidate", () => {
  it("assembles a weighted baseline and support gap from original reviewed rows, with zero and no cohort rank", async () => {
    const f = createArmCCandidateFixture(), read = createArmCCandidateReader(f.windowPolicy, f.referencePolicy);
    const result = await read(f.input, f.evaluatedAtUTC);
    expect(result.reasons).toEqual([]);
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("fixture should score");
    const p = result.profile, h = p.score.headline!;
    expect(h.observed).toBe(2); // Five games x two shots x 0.2 FHFH, zero G/A.
    expect(p.tracks[1].observed).toBe(0);
    expect(h.expected - h.observed).toBeCloseTo(h.gap, 12);
    expect(p.score.value).toBeCloseTo(100 * p.score.normalizedGap! / (1 + Math.abs(p.score.normalizedGap!)), 12);
    expect(p.score).toMatchObject({ list: null, rank: null, positionRank: null, trusted: false, calibratedProbability: null });
    expect(p.evidence.window.sourceIds).toEqual([101, 102, 103, 104, 105]);
    expect(p.evidence.reference.sourceIds).toEqual(f.referencePacket.history.filter(r => r.player_id === f.input.target.playerId).map(r => r.id));
    expect(result.package.productionDonorPlayerIds).toEqual([701, 702]); // Another 50-game player contributes training blocks only.
    expect(p.evidence.donorPlayers).toBe(3);
    expect(result.package.missingSeasons).toContain(20252026);
    expect(p.claims).toEqual({ luckIdentified: false, marketValue: false, forecast: false, trusted: false });
    const bytes = new TextEncoder().encode(JSON.stringify(result.package));
    expect(await read(f.input, f.evaluatedAtUTC, bytes)).toEqual(result);
    const altered = structuredClone(result.package);
    altered.profile.score.value = 98;
    expect(await read(f.input, f.evaluatedAtUTC, new TextEncoder().encode(JSON.stringify(altered)))).toMatchObject({
      status: "withheld", profile: null, reasons: ["saved_package_differs_from_verified_rebuild"] });
    expect((await read(f.input, "2026-11-09T12:00:00Z", bytes)).status).toBe("withheld");
  });
  it("rejects both unreviewed source and unreviewed reference policies, including forged caller results", async () => {
    const f = createArmCCandidateFixture();
    const forged = { ...f.input, qualified: true, current: [], profile: { score: 100 } };
    expect((await createArmCCandidateReader()(forged, f.evaluatedAtUTC)).status).toBe("withheld");
    expect((await createArmCCandidateReader(f.windowPolicy)(forged, f.evaluatedAtUTC)).reasons).toEqual(["reference_not_independently_accepted"]);
    f.input.artifacts.delete(f.referencePolicy.acceptances[0].independentReviewSHA256);
    expect((await createArmCCandidateReader(f.windowPolicy, f.referencePolicy)(forged, f.evaluatedAtUTC)).reasons).toEqual(["reference_review_missing_or_changed"]);
  });
  it("invalidates old packages when their reviewed reference is corrected or superseded", async () => {
    const old = createArmCCandidateFixture(), original = await createArmCCandidateReader(old.windowPolicy, old.referencePolicy)(old.input, old.evaluatedAtUTC);
    expect(original.status).toBe("available");
    const saved = new TextEncoder().encode(JSON.stringify(original.package));
    const corrected = createArmCCandidateFixture(ref => { ref.history[0].shots = 5; });
    const read = createArmCCandidateReader(corrected.windowPolicy, corrected.referencePolicy);
    expect((await read(old.input, old.evaluatedAtUTC, saved)).status).toBe("withheld");
    expect((await read(corrected.input, corrected.evaluatedAtUTC, saved)).reasons).toEqual(["saved_package_differs_from_verified_rebuild"]);
    expect((await read(corrected.input, corrected.evaluatedAtUTC)).status).toBe("available");
  });
  it.each<[string, (ref: ArmCReferencePacket) => void, string]>([
    ["wrong player", p => { p.playerId++; }, "reference_policy_identity_or_cutoff_mismatch"],
    ["false pre-window start", p => { p.before = "2026-10-30"; }, "reference_policy_identity_or_cutoff_mismatch"],
    ["post-cutoff history", p => { p.history[0].date = p.before; }, "reference_season_or_cutoff_invalid"],
    ["protected season", p => { p.history[0].season_id = 20252026; }, "reference_season_or_cutoff_invalid"],
    ["protected coverage claim", p => { p.coveredSeasons.push(20252026); }, "reference_season_coverage_invalid"],
    ["unresolved goal revision", p => { p.history[0]._research_correction_status = "unknown"; }, "reference_goal_revision_unresolved"],
    ["duplicate historical source", p => { p.history[1].id = p.history[0].id; }, "reference_game_identity_duplicate_or_invalid"],
    ["current source recycled", p => { p.history[0].id = 101; }, "reference_game_identity_duplicate_or_invalid"],
    ["reused training source", p => { p.trainingBlocks[1] = p.trainingBlocks[0]; }, "training_block_identity_or_season_invalid"],
    ["target in training", p => { p.trainingBlocks[0].source_ids[0] = p.history[0].id; }, "training_block_identity_or_season_invalid"],
    ["unmatched original training operands", p => { p.trainingBlocks[0].X![0] += 0.25; }, "training_block_operands_changed"],
    ["misassigned final-50 donor", p => { p.productionDonors[0].sourceIds[0] = p.productionDonors[1].sourceIds[0]; }, "production_donor_membership_invalid"],
    ["silently omitted personal row", p => { p.personalSourceIds.pop(); }, "personal_history_membership_invalid"],
    ["contradictory saved training team", p => { p.trainingBlocks[0].teams = Array(5).fill("ALT"); }, "training_block_operands_changed"],
    ["missing native training value", p => { p.history[50].nst_individual[0].nst_ixg = null; }, "training_observation_unavailable"],
  ])("withholds %s even when all input bytes are pinned", async (_label, edit, reason) => {
    const f = createArmCCandidateFixture(edit);
    expect((await createArmCCandidateReader(f.windowPolicy, f.referencePolicy)(f.input, f.evaluatedAtUTC)).reasons).toEqual([reason]);
  });
  it.each(["complete", "missing", "duplicate", "future"] as const)("checks the full official current-season prefix (%s)", async condition => {
    const gameDate = "2026-10-27", gameId = 2026020099;
    const f = createArmCCandidateFixture((ref, saveArtifact) => {
      if (condition === "missing") return;
      const seed = createReviewedFiveGameFixture();
      const pre: CurrentInputRequest = JSON.parse(new TextDecoder().decode(seed.input.artifacts.get(seed.manifest.members[0].requestSHA256)));
      Object.assign(pre.wgo!.rows[0], { date: gameDate, id: 99, game_id: gameId });
      Object.assign(pre.calendar!.rows[0], { date: gameDate, id: gameId });
      for (const key of ["individual", "onIce"] as const) pre[key]!.rows[0].date_scraped = gameDate;
      pre.eventThroughDate = gameDate;
      if (condition === "duplicate") pre.wgo!.rows.push({ ...pre.wgo!.rows[0], id: 98 });
      if (condition === "future") pre.asOfUTC = "2026-11-07T11:00:00.000001Z";
      ref.preWindowCurrentRequestSHA256 = saveArtifact(pre);
    });
    const w = f.windowFixture;
    w.log.gameLog.push({ gameId, gameDate, teamAbbrev: "TST", toi: "15:00" });
    w.landing.seasonTotals[0].gamesPlayed++;
    w.census.gameLogSHA256 = w.save(w.log);
    w.census.landingSHA256 = w.save(w.landing);
    w.manifest.censusSHA256 = w.revision.censusSHA256 = w.save(w.census);
    w.manifest.revisionSHA256 = w.save(w.revision);
    Object.assign(w.policy.windows[0], { manifestSHA256: w.save(w.manifest), censusSHA256: w.manifest.censusSHA256, revisionSHA256: w.manifest.revisionSHA256 });
    w.input.manifestBytes = new TextEncoder().encode(JSON.stringify(w.manifest));
    const r = await createArmCCandidateReader(f.windowPolicy, f.referencePolicy)(f.input, f.evaluatedAtUTC);
    if (condition === "complete") {
      expect(r.reasons).toEqual([]);
      expect(r.profile?.evidence.reference.sourceIds.at(-1)).toBe(99);
      expect(r.profile?.evidence.window.sourceIds).not.toContain(99);
    } else {
      expect(r.profile).toBeNull();
      expect(r.reasons).toEqual([condition === "future" ? "prewindow_capture_chronology_invalid"
        : condition === "duplicate" ? "prewindow_game_identity_or_cutoff_invalid" : "prewindow_appearance_census_mismatch"]);
    }
  });
  it("requires the same scorer and mapper versions as the reviewed window", async () => {
    const f = createReviewedFiveGameFixture(undefined, "another-scorer");
    expect((await createArmCCandidateReader(f.policy)(f.input, f.evaluatedAtUTC)).reasons).toEqual(["unsupported_candidate_method_version"]);
  });
});

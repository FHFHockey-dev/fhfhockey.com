/** All player games, source observations, reviews and policies here are synthetic and in memory. */
import { createHash } from "node:crypto";
import { ARM_C_REFERENCE_VERSION, type ArmCReferencePacket } from "./armCCandidate.server";
import { devSlot, type DevRow } from "./currentWindows";
import { createReviewedFiveGameFixture } from "./reviewedFiveGameWindow.testHelper";

export function createArmCCandidateFixture(edit?: (packet: ArmCReferencePacket, saveArtifact: (value: unknown) => string) => void) {
  const playerId = 8470001, seasonId = 20262027, policyId = "synthetic-arm-c-review", before = "2026-10-29";
  const history: DevRow[] = [], trainingBlockSourceIds: number[][] = [];
  for (const [index, pid] of [playerId, 701, 702, 703].entries()) {
    for (let i = 0; i < 50; i++) {
      const id = (index + 1) * 1000 + i, toi = 900 + (i % 7) * 11, g = (i + index) % 3 === 0 ? 1 : 0, a = (i * (index + 1)) % 4 === 0 ? 1 : 0;
      history.push({ id, player_id: pid, season_id: 20232024, date: new Date(Date.UTC(2023, 9, 1 + i)).toISOString().slice(0, 10),
        position_code: "C", team_abbrev: "TST", games_played: 1, toi_per_game: toi, es_toi_per_game: toi - 100, pp_toi_per_game: 100,
        _research_correction_status: "wgo_db_raw", goals: g, assists: a, points: g + a, pp_points: 0, shots: 2 + i % 3, hits: i % 3,
        blocked_shots: i % 2, total_primary_assists: a, total_secondary_assists: 0, penalties_drawn: 0, penalties: i % 2, total_fow: 0, total_fol: 0,
        sat_for: 11 + i % 3, sat_against: 9 + index % 2, es_goals_for: g + a, es_goals_against: i % 3 === 0 ? 1 : 0,
        pp_goals_for: 0, sh_goals_for: 0, pp_goals_against: 0, sh_goals_against: 0,
        nst_individual: [{ nst_gp: 1, nst_toi: toi, nst_ixg: 0.1 + (i % 4) * 0.05 }],
        nst_onice: [{ gp: 1, toi, xgf: 0.4 + ((i + index) % 6) * 0.08, xga: 0.3 + (i % 7) * 0.05 }] });
      if (index && i % 5 === 4) trainingBlockSourceIds.push([id - 4, id - 3, id - 2, id - 1, id]);
    }
  }
  const examples = new Map(history.map(r => [r.id, devSlot(r)]));
  const trainingBlocks = trainingBlockSourceIds.map(source_ids => {
    const slots = source_ids.map(id => examples.get(id)!), first = slots[0], seconds = slots.reduce((sum, s) => sum + s.seconds!, 0);
    const rate = (v: (s: typeof first) => number) => slots.reduce((sum, slot) => sum + v(slot), 0) * 3600 / seconds;
    return { source_ids, player_id: first.playerId, season_id: first.season, position: "F", dates: slots.map(s => s.date), seconds,
      qualified_process_exposure: true, X: [rate(s => s.ixG!), rate(s => s.onIceXGF!), rate(s => s.onIceXGA!)],
      Y: [0, 1, 2].map(i => rate(s => s.tracks[i]!)) };
  });
  const referencePacket: ArmCReferencePacket = { version: ARM_C_REFERENCE_VERSION, arm: "C_weighted_personal_baseline", playerId, seasonId,
    before, policyId, coveredSeasons: [20232024], history, trainingBlocks, preWindowCurrentRequestSHA256: null,
    personalSourceIds: history.filter(r => r.player_id === playerId).map(r => r.id),
    productionDonors: [701, 702].map(playerId => ({ playerId, sourceIds: history.filter(r => r.player_id === playerId).map(r => r.id) })) };
  const extra = new Map<string, Uint8Array>();
  edit?.(referencePacket, value => {
    const bytes = new TextEncoder().encode(JSON.stringify(value)), digest = createHash("sha256").update(bytes).digest("hex");
    extra.set(digest, bytes);
    return digest;
  });
  const bytes = new TextEncoder().encode(JSON.stringify(referencePacket));
  const referencePacketSHA256 = createHash("sha256").update(bytes).digest("hex");
  const f = createReviewedFiveGameFixture(bytes);
  for (const [digest, artifact] of extra) f.input.artifacts.set(digest, artifact);
  const review = { version: "fhfh.blsh.arm-c-reference-review.v1", policyId, playerId, seasonId, before, eventThroughDate: f.input.target.eventThroughDate,
    referencePacketSHA256, scope: "personal_prefix_donor_training_native_semantics_coverage_and_revisions", reviewedAtUTC: f.manifest.asOfUTC };
  const independentReviewSHA256 = f.save(review);
  return { windowFixture: f, input: f.input, evaluatedAtUTC: f.evaluatedAtUTC, windowPolicy: f.policy, referencePacket,
    referencePolicy: { policyId, acceptances: [{ ...f.input.target, referencePacketSHA256, independentReviewSHA256 }] } };
}

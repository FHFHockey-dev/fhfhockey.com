/** One local retrospective candidate. Server-held reviews bind exact input bytes. Reading a
 * saved package repeats source verification and scoring, including revision and time checks.
 * No file, network, clock, ranking, policy installation or retained arm-A loader here.
 */
import { createHash } from "node:crypto";
import { qualifyCurrentResearchInputs, type CurrentInputRequest } from "./currentInput";
import { assembleProfiles, CURRENT_WINDOWS_VERSION, devSlot, type DevRow } from "./currentWindows";
import { DISPLAY_MAPPER_VERSION, toDisplayProfile, type DisplayProfile } from "./displayProfile";
import { BASELINE_VERSION, PRODUCTION_REFERENCE_VERSION } from "./productionReference";
import { decodeReviewedEvidenceJSON, reviewedEvidenceTime, verifyReviewedFiveGameWindow, type ReviewedFiveGameWindowInput, type ReviewedFiveGameWindowPolicy } from "./reviewedFiveGameWindow.server";
import { SEASONS, SUPPORT_GAP_EXPLANATION_VERSION, SUPPORT_GAP_VERSION, type TrainingBlock } from "./supportGap";

export const ARM_C_PACKAGE_VERSION = "fhfh.blsh.arm-c-single-player.v1";
export const ARM_C_REFERENCE_VERSION = "fhfh.blsh.arm-c-reference-inputs.v1";
const ARM = "C_weighted_personal_baseline" as const;
const MAX_BYTES = 8 * 1024 * 1024;
const historySeasons = [20222023, 20232024, 20242025]; // The 2025–26 reserve is sealed.
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const hex = (s: unknown) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);

export type ArmCReferencePolicy = { policyId: string; acceptances: readonly {
  playerId: number; eventThroughDate: string; referencePacketSHA256: string;
  independentReviewSHA256: string;
}[] };
const closed: ArmCReferencePolicy = { policyId: "closed", acceptances: [] };

/** History and training use original game slots. The review covers season coverage,
 * native semantics, corrected row revisions, completeness and the frozen block membership.
 * The packet contains reviewed block rates that are checked against the original five rows.
 */
export type ArmCReferencePacket = {
  version: typeof ARM_C_REFERENCE_VERSION; arm: typeof ARM; policyId: string; playerId: number; seasonId: number;
  before: string; coveredSeasons: number[]; history: DevRow[]; personalSourceIds: number[]; productionDonors: { playerId: number; sourceIds: number[] }[]; trainingBlocks: TrainingBlock[];
  preWindowCurrentRequestSHA256: string | null;
};
export type ArmCCandidatePackage = {
  version: typeof ARM_C_PACKAGE_VERSION; arm: typeof ARM; reviewedPolicyId: string; windowContractVersion: string;
  playerId: number; seasonId: number; eventThroughDate: string; asOfUTC: string; builtAtUTC: string;
  manifestSHA256: string; censusSHA256: string; revisionSHA256: string; referencePacketSHA256: string; independentReferenceReviewSHA256: string;
  scorerVersion: string; mapperVersion: string; assemblerVersion: string; baselineVersion: string;
  productionReferenceVersion: string; explanationVersion: string; coveredSeasons: number[]; missingSeasons: number[]; productionDonorPlayerIds: number[]; trainingBlockCount: number; trainingBlocksWithUnknownTeam: number;
  prefixCapture: ReturnType<typeof selectArmCCurrentPrefix>["capture"];
  members: Extract<ReturnType<typeof verifyReviewedFiveGameWindow>, { qualified: true }>["members"];
  profile: DisplayProfile;
};
export type ArmCCandidateReadback =
  | { status: "available"; profile: DisplayProfile; package: ArmCCandidatePackage; packageSHA256: string; reasons: [] }
  | { status: "withheld"; profile: null; package: null; packageSHA256: null; reasons: string[] };

class Withheld extends Error {}
function need(test: unknown, code: string): asserts test { if (!test) throw new Withheld(code); }
const refuse = (reasons: string[]): ArmCCandidateReadback => ({ status: "withheld", profile: null, package: null, packageSHA256: null, reasons });
const id = (value: number) => Number.isSafeInteger(value) && value > 0;
const isDay = (value: string) => typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const inSeason = (value: string, season: number) => value >= Math.floor(season / 10000) + "-07-01" && value < season % 10000 + "-07-01";

export function assembleArmCReferenceInputs(packet: ArmCReferencePacket, currentIds: Set<number>, targetPosition: string) {
  const original = new Map<number, ReturnType<typeof devSlot>>(), playerDates = new Set<string>();
  for (const row of packet.history) {
    const dateKey = row.player_id + "/" + row.date;
    need(id(row.id) && id(row.player_id) && !original.has(row.id) && !currentIds.has(row.id) && !playerDates.has(dateKey),
      "reference_game_identity_duplicate_or_invalid");
    need(historySeasons.includes(row.season_id) && isDay(row.date) && inSeason(row.date, row.season_id) && row.date < packet.before,
      "reference_season_or_cutoff_invalid");
    const slot = devSlot(row);
    need(slot.onIceGoalsRevision === "wgo_raw" || slot.onIceGoalsRevision === "official_evidence_corrected", "reference_goal_revision_unresolved");
    original.set(row.id, slot);
    playerDates.add(dateKey);
  }
  // Training-only games must never add a donor or displace one of its reviewed final 50.
  const byPlayer = new Map<number, DevRow[]>();
  for (const row of packet.history) {
    const rows = byPlayer.get(row.player_id) ?? [];
    rows.push(row); byPlayer.set(row.player_id, rows);
  }
  const personal = byPlayer.get(packet.playerId) ?? [];
  need(personal.length === packet.personalSourceIds.length && new Set(packet.personalSourceIds).size === personal.length
    && packet.personalSourceIds.every(i => original.get(i)?.playerId === packet.playerId), "personal_history_membership_invalid");
  const donorPlayers = new Set<number>();
  for (const donor of packet.productionDonors) {
    const final = [...(byPlayer.get(donor.playerId) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).slice(-50);
    need(donor.playerId !== packet.playerId && !donorPlayers.has(donor.playerId) && final.length === 50 && donor.sourceIds.length === 50
      && final.every((r, i) => r.id === donor.sourceIds[i] && original.get(r.id)?.position === targetPosition
        && original.get(r.id)?.gamesPlayed === 1 && original.get(r.id)!.tracks.every(v => v !== null)), "production_donor_membership_invalid");
    donorPlayers.add(donor.playerId);
  }
  const used = new Set<number>();
  const blocks = packet.trainingBlocks.map(block => {
    const ids = block.source_ids;
    need(Array.isArray(ids) && ids.length === 5, "training_block_membership_invalid");
    const slots = ids.map(sourceId => {
      const slot = original.get(sourceId);
      need(slot && !used.has(sourceId) && slot.playerId !== packet.playerId && slot.position === targetPosition
        && (SEASONS as readonly number[]).includes(slot.season), "training_block_identity_or_season_invalid");
      used.add(sourceId);
      need(slot.gamesPlayed === 1 && slot.seconds !== null && slot.seconds > 0 && slot.tracks.every(v => v !== null)
        && slot.ixG !== null && slot.onIceXGF !== null && slot.onIceXGA !== null, "training_observation_unavailable");
      return slot;
    });
    const first = slots[0];
    need(new Set(slots.map(s => s.team).filter(team => team !== null)).size <= 1 && slots.every((s, i) => s.playerId === first.playerId && s.season === first.season
      && (!i || s.date > slots[i - 1].date)), "training_block_membership_invalid");
    const seconds = slots.reduce((s, r) => s + r.seconds!, 0);
    const per60 = (pick: (s: typeof first) => number) => slots.reduce((s, r) => s + pick(r), 0) * 3600 / seconds;
    const X = [per60(s => s.ixG!), per60(s => s.onIceXGF!), per60(s => s.onIceXGA!)], Y = [0, 1, 2].map(j => per60(s => s.tracks[j]!));
    // The frozen catalog summed decimal primitives; preserve its reviewed rounding after checking the native totals.
    const sameRates = (saved: number[] | null | undefined, actual: number[]) => saved?.length === 3 && actual.every((v, j) =>
      Number.isFinite(saved[j]) && Math.abs(saved[j] - v) <= 16 * Number.EPSILON * Math.max(1, Math.abs(v)));
    need(block.player_id === first.playerId && block.season_id === first.season && block.position === first.position
      && block.qualified_process_exposure === true && block.seconds === seconds && block.dates.length === 5
      && slots.every((s, i) => s.date === block.dates[i])
      && (block.teams === undefined || block.teams.length === 5 && slots.every((s, i) => block.teams![i] === s.team))
      && (block.positions === undefined || block.positions.length === 5 && slots.every((s, i) => block.positions![i] === s.position)) && sameRates(block.X, X) && sameRates(block.Y, Y), "training_block_operands_changed");
    return { ...block, teams: slots.map(s => s.team), positions: slots.map(s => s.position) };
  });
  // Preserve the original production donor order, independent of where its training rows appeared.
  const allRows = new Map(packet.history.map(r => [r.id, r]));
  const roleIds = [...packet.personalSourceIds, ...packet.productionDonors.flatMap(d => d.sourceIds)];
  need(new Set([...roleIds, ...used]).size === original.size, "reference_contains_unassigned_rows");
  return { history: roleIds.map(i => allRows.get(i)!), blocks };
}

/** Derive the historical prefix from unchanged original acquisition bytes; never move its clock or event cutoff. */
export function selectArmCCurrentPrefix(sha: string | null, artifacts: ReadonlyMap<string, Uint8Array>, window: {
  playerId: number; seasonId: number; before: string; eventThroughDate: string; asOfUTC: string;
}) {
  if (sha === null) return { records: [], capture: null };
  const bytes = artifacts.get(sha);
  need(hex(sha) && bytes && bytes.byteLength > 0 && bytes.byteLength <= 32 * 1024 * 1024 && hash(bytes) === sha,
    "prewindow_capture_missing_or_changed");
  const pre = decodeReviewedEvidenceJSON<CurrentInputRequest>(bytes);
  need(pre.seasonId === window.seasonId && isDay(pre.eventThroughDate) && pre.eventThroughDate <= window.eventThroughDate
    && reviewedEvidenceTime(pre.asOfUTC) <= reviewedEvidenceTime(window.asOfUTC), "prewindow_capture_chronology_invalid");
  need(pre.wgo && pre.wgo.rows.every(r => r.season_id === window.seasonId), "prewindow_capture_season_invalid");
  const records = qualifyCurrentResearchInputs(pre, null).records.filter(({ raw }) =>
    raw.record.player_id === window.playerId && raw.record.date < window.before);
  return { records, capture: { sha256: sha, asOfUTC: pre.asOfUTC, eventThroughDate: pre.eventThroughDate,
    capturedWgoRows: pre.wgo.rows.length, selectedSourceIds: records.map(r => r.raw.record.id) } };
}

export function createArmCCandidateReader(windowPolicy?: ReviewedFiveGameWindowPolicy, referencePolicy: ArmCReferencePolicy = closed) {
  const policy = structuredClone(referencePolicy);
  const windowRules = windowPolicy && structuredClone(windowPolicy);
  return async (input: ReviewedFiveGameWindowInput, evaluatedAtUTC: string, savedPackageBytes?: Uint8Array): Promise<ArmCCandidateReadback> => {
    try {
      const w = verifyReviewedFiveGameWindow(input, evaluatedAtUTC, windowRules);
      if (!w.qualified) return refuse(w.reasons);
      need(w.scorerVersion === SUPPORT_GAP_VERSION && w.mapperVersion === DISPLAY_MAPPER_VERSION, "unsupported_candidate_method_version");
      const approvals = policy.acceptances.filter(a => a.playerId === w.playerId && a.eventThroughDate === w.eventThroughDate);
      need(policy.policyId.trim() && approvals.length === 1 && approvals[0].referencePacketSHA256 === w.referencePacketSHA256
        && hex(approvals[0].independentReviewSHA256), "reference_not_independently_accepted");
      const supplied = input.artifacts.get(w.referencePacketSHA256);
      need(supplied && supplied.byteLength > 0 && supplied.byteLength <= 64 * 1024 * 1024 && hash(supplied) === w.referencePacketSHA256,
        "reference_packet_missing_or_changed");
      const ref = decodeReviewedEvidenceJSON<ArmCReferencePacket>(supplied);
      const before = w.current[0].research.record.date;
      need(ref.version === ARM_C_REFERENCE_VERSION && ref.arm === ARM && ref.policyId === policy.policyId && ref.playerId === w.playerId
        && ref.seasonId === w.seasonId && ref.before === before, "reference_policy_identity_or_cutoff_mismatch");
      const reviewBytes = input.artifacts.get(approvals[0].independentReviewSHA256);
      need(reviewBytes && reviewBytes.byteLength > 0 && reviewBytes.byteLength <= 64 * 1024 && hash(reviewBytes) === approvals[0].independentReviewSHA256,
        "reference_review_missing_or_changed");
      const review = decodeReviewedEvidenceJSON<{ version: string; policyId: string; playerId: number; seasonId: number; before: string;
        eventThroughDate: string; referencePacketSHA256: string; scope: string; reviewedAtUTC: string }>(reviewBytes);
      need(review.version === "fhfh.blsh.arm-c-reference-review.v1" && review.policyId === policy.policyId
        && review.playerId === w.playerId && review.seasonId === w.seasonId && review.before === before && review.eventThroughDate === w.eventThroughDate
        && review.referencePacketSHA256 === w.referencePacketSHA256 && review.scope === "personal_prefix_donor_training_native_semantics_coverage_and_revisions"
        && reviewedEvidenceTime(review.reviewedAtUTC) <= reviewedEvidenceTime(w.builtAtUTC), "reference_review_scope_or_chronology_invalid");
      need(Array.isArray(ref.coveredSeasons) && ref.coveredSeasons.every(s => historySeasons.includes(s))
        && new Set(ref.coveredSeasons).size === ref.coveredSeasons.length, "reference_season_coverage_invalid");
      need(Array.isArray(ref.history) && Array.isArray(ref.personalSourceIds) && Array.isArray(ref.productionDonors) && Array.isArray(ref.trainingBlocks), "reference_inputs_invalid");
      const ids = w.current.map(r => r.research.record.id);
      const usedIds = new Set(ids);
      const { records: prefix, capture: prefixCapture } = selectArmCCurrentPrefix(ref.preWindowCurrentRequestSHA256, input.artifacts, { ...w, before });
      for (const { research: row } of prefix) {
        need(id(row.record.id) && row.identityAndExposure.qualified && !usedIds.has(row.record.id), "prewindow_game_identity_or_cutoff_invalid");
        usedIds.add(row.record.id);
      }
      need(prefix.length === w.priorAppearances.length && prefix.every(({ research: { record } }, i) => {
        const a = w.priorAppearances[i], [minutes, seconds] = a.toi.split(":").map(Number);
        return record.game_id === a.gameId && record.date === a.gameDate && record.team_abbrev === a.teamAbbrev && record.toi_per_game === minutes * 60 + seconds;
      }), "prewindow_appearance_census_mismatch");
      const latest = w.current[w.current.length - 1].research.record;
      const position = latest.position_code === "D" ? "D" : ["F", "C", "L", "R", "LW", "RW"].includes(latest.position_code ?? "") ? "F" : null;
      need(position, "window_position_unknown");
      const { blocks, history } = assembleArmCReferenceInputs(ref, usedIds, position);
      let savedHash: string | null = null;
      if (savedPackageBytes !== undefined) {
        need(savedPackageBytes.byteLength > 0 && savedPackageBytes.byteLength <= MAX_BYTES, "saved_package_invalid_size");
        savedHash = hash(savedPackageBytes);
      }
      const [profile] = await assembleProfiles({ current: [...prefix, ...w.current], history, blocks, arm: ARM,
        coveredSeasons: ref.coveredSeasons, eventThroughDate: w.eventThroughDate, names: new Map([[w.playerId, latest.player_name ?? ""]]) });
      need(profile && profile.playerId === w.playerId && profile.window.appearances === 5
        && ids.every((n, i) => profile.window.sourceIds[i] === n), "scored_window_identity_mismatch");
      need(profile.result.value !== null, profile.result.reason ?? "support_score_unavailable");
      need(profile.reference.historyStatus === "personal", "personal_reference_unavailable");
      need(profile.production.cohort_donors === ref.productionDonors.length, "reviewed_production_donor_omitted");
      const display = toDisplayProfile(profile, null, w.eventThroughDate, "single_player");
      const candidate: ArmCCandidatePackage = { version: ARM_C_PACKAGE_VERSION, arm: ARM, reviewedPolicyId: policy.policyId,
        windowContractVersion: w.version, playerId: w.playerId, seasonId: w.seasonId, eventThroughDate: w.eventThroughDate,
        asOfUTC: w.asOfUTC, builtAtUTC: w.builtAtUTC, manifestSHA256: w.manifestSHA256, censusSHA256: w.censusSHA256, revisionSHA256: w.revisionSHA256,
        referencePacketSHA256: w.referencePacketSHA256, independentReferenceReviewSHA256: approvals[0].independentReviewSHA256,
        scorerVersion: SUPPORT_GAP_VERSION, mapperVersion: DISPLAY_MAPPER_VERSION, assemblerVersion: CURRENT_WINDOWS_VERSION,
        baselineVersion: BASELINE_VERSION, productionReferenceVersion: PRODUCTION_REFERENCE_VERSION, explanationVersion: SUPPORT_GAP_EXPLANATION_VERSION,
        coveredSeasons: ref.coveredSeasons, missingSeasons: profile.reference.missingSeasons, productionDonorPlayerIds: ref.productionDonors.map(d => d.playerId),
        trainingBlockCount: blocks.length, trainingBlocksWithUnknownTeam: blocks.filter(b => b.teams.some(t => t === null)).length, members: w.members, prefixCapture, profile: display };
      const packageSHA256 = hash(new TextEncoder().encode(JSON.stringify(candidate)));
      need(savedHash === null || savedHash === packageSHA256, "saved_package_differs_from_verified_rebuild");
      return { status: "available", profile: display, package: candidate, packageSHA256, reasons: [] };
    } catch (error) {
      return refuse([error instanceof Withheld ? error.message : "invalid_candidate_inputs"]);
    }
  };
}

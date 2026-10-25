import { randomUUID } from "node:crypto";
import { buildBaselineContributionBundle, buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { buildGoalieContributionBundle, buildNativeGoalieShutoutRates, buildNativeGoalieSummaryWinRates,
  buildNativeGoalieVolumeRates, buildNativeGoalieWinRates } from "./goalieBaselineRates";
import { PRIOR_APPEARANCE_POLICY_VERSION } from "./baselineRates";
import { verifyBaselineHistoricalSources } from "./baselineSourceLineage";
import { buildRosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt,
  buildRollingWindowSkaterParticipationReceipt } from "./rollingWindowParticipation";
import { contributionBundleCandidateInputHash, contributionBundleChecksum, persistContributionBundle } from "./contributionStore";
import { SKATER_PARTICIPATION_RELEASE_LIMITS } from "./modeledSkaterParticipationStore";
import { nativeCadenceClosureScope, nativeCadenceInputManifest, nativeCadenceSourceManifests, publishObservedNativeBaselineCadence } from "./nativeBaselineCadence";
import type { NativeBaselinePublicationPlan } from "./nativeBaselinePublication";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

/** Offline issuance of later same-method outputs from one closed materialization.
 * It reproduces the reviewed plan's means, identities, expiries and nulls exactly;
 * only issuance changes. Reviews come back pending, and the catalog head stays null.
 * With `daily`, the frozen native means are issued anew under one explicit new expiry
 * (cutoffs and means unchanged, so the approved candidate hashes still hold) and
 * participation bundles are built from the proof's fresh participation inputs.
 * With `daily.freshMeans` (v2), the native inputs are fresh means at one input cutoff: each policy gets a new
 * bundle, a new policy row under the standing approval scoped to that day's candidate input hash, and a pending
 * review. The reviewed plan then supplies only each policy's terms (public uses and evidence reference).
 * A daily proof may leave out means-only players (no participation target). Their sources are then dropped;
 * a policy whose bundle shrank gets a new policy row under `standingApprovalRef`, scoped to that day's
 * candidate input hash, and a policy left with no sources is not issued.
 * A split daily day (A-14) adds `goalieMaterialization`: `materialization` is then the skater closure, the proof is
 * `{ skater, goalie }`, and both closures feed one plan, one cadence slot and one catalog head. */
type MaterializationRef = { runId: string; sourceKey: string; date: string; closureScopeHash: string };
export type NativeOutputPreparationCommand = {
  version: "native-output-preparation-v1";
  slotKey: string; dueAt: string;
  materialization: MaterializationRef;
  goalieMaterialization?: MaterializationRef;
  games: Array<{ gameId: number; startsAt: string }>;
  requiredAcquisitionScopes: Record<string, { scopeHash: string; cutoffAt: string }>;
  /** Previously reviewed plan over the same inputs: policies, reviews, bundles and selected participation bundles. */
  reviewedPlan: NativeBaselinePublicationPlan;
  daily?: { expiresAt: string; participationOwnerApprovalRef: string; standingApprovalRef?: string;
    freshMeans?: { standingApprovalRef: string; scheduleRevision: string } };
};
type ClosedProof = { status: string; rows: PlannedSourceObservation[]; report: PlannedSourceObservation;
  closure: PlannedSourceObservation; manifest: ReturnType<typeof nativeCadenceInputManifest> };
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const goalieBuilders: Record<string, (input: any) => any> = {
  "native-goalie-appearance-win-rates-v1": buildNativeGoalieWinRates,
  "native-goalie-appearance-volume-rates-v1": buildNativeGoalieVolumeRates,
  "native-goalie-appearance-shutout-rates-v1": buildNativeGoalieShutoutRates,
  "native-goalie-appearance-summary-win-rates-v1": buildNativeGoalieSummaryWinRates };
const participationBuilders: Record<string, (input: any, clocks: { issuedAt: string; expiresAt: string }) => any> = {
  "skater-roster-observation-participation-bundle-v1": buildRosterObservationSkaterParticipationReceipt,
  "goalie-roster-observation-participation-bundle-v1": buildRosterObservationGoalieParticipationReceipt,
  "goalie-roster-observation-start-bundle-v1": buildRosterObservationGoalieStartReceipt,
  "skater-rolling-14d-participation-bundle-v1": buildRollingWindowSkaterParticipationReceipt,
  "goalie-rolling-14d-participation-bundle-v1": buildRollingWindowGoalieParticipationReceipt,
  "goalie-rolling-14d-start-bundle-v1": buildRollingWindowGoalieStartReceipt };
// Leaves headroom under the 8 MiB publication row bound for the envelope and metadata;
// bundles also stay within the participation stores' per-bundle entry cap.
const DAILY_PARTICIPATION_BUNDLE_BYTES = 7 * 1024 * 1024;
const withoutIssuance = ({ issuedAt: _issued, released: _released, ...rest }: any) => rest;
const withoutIssuedAt = ({ issuedAt: _issued, ...rest }: any) => rest;

export async function prepareNativeCadenceOutputs(command: NativeOutputPreparationCommand, proofs: ClosedProof | { skater: ClosedProof; goalie: ClosedProof },
  now: Date, newId: () => string = randomUUID) {
  const { materialization: request, goalieMaterialization: goalieRequest, reviewedPlan } = command;
  if (command?.version !== "native-output-preparation-v1" || reviewedPlan?.version !== "native-baseline-publication-plan-v1") fail("preparation_command_required");
  const split = goalieRequest !== undefined, issuedAt = now.toISOString(), seasonId = reviewedPlan.seasonId;
  if (split !== ("skater" in (proofs ?? {}))) fail("closed_materialization_proof_required");
  if (split && (!command.daily || goalieRequest!.date !== request.date || goalieRequest!.closureScopeHash !== request.closureScopeHash
    || goalieRequest!.runId === request.runId || goalieRequest!.sourceKey === request.sourceKey)) fail("split_materialization_mismatch");
  const parts = split ? [{ request, proof: (proofs as { skater: ClosedProof }).skater }, { request: goalieRequest!, proof: (proofs as { goalie: ClosedProof }).goalie }]
    : [{ request, proof: proofs as ClosedProof }];
  for (const { request, proof } of parts) {
    const closure = proof?.closure?.payload as any;
    if (proof?.status !== "closed" || !closure || closure.runId !== request.runId || closure.scopeHash !== request.closureScopeHash
      || closure.materializationHash !== proof.report.payload_hash || hash(proof.report.payload) !== proof.report.payload_hash
      || hash(closure) !== proof.closure.payload_hash) fail("closed_materialization_proof_required");
    // The top-level manifest is a convenience copy; bind it to the hashed report and closure.
    if (!proof.manifest || hash(proof.manifest) !== hash((proof.report.payload as any).manifest) || closure.inputRevision !== proof.manifest.revision
      || closure.expectedItems !== proof.manifest.expectedItems) fail("materialization_manifest_unbound");
    const required = command.requiredAcquisitionScopes?.[request.sourceKey];
    if (!required || required.scopeHash !== closure.acquisitionScopeHash || required.cutoffAt !== closure.inputCutoffAt) fail("acquisition_scope_mismatch");
    if (micros(issuedAt) < micros(command.dueAt)) fail("slot_not_due");
    if (micros(issuedAt) < micros(closure.closedAt)) fail("outputs_must_be_issued_after_closed_inputs");
    const reported = new Map(((proof.report.payload as any).rows ?? []).map((row: any) => [row.id, row]));
    if (new Set(proof.rows.map(row => row.id)).size !== proof.rows.length || reported.size !== proof.rows.length
      || proof.rows.some(row => hash(row.payload) !== row.payload_hash || (reported.get(row.id) as any)?.hash !== row.payload_hash
      || (reported.get(row.id) as any)?.dataset !== row.dataset_key)) fail("materialized_row_mismatch");
  }
  // The day's last closure; split parts are disjoint by class, so their player and participation rows simply join.
  const closure = parts.map(part => part.proof.closure.payload as any).sort((a, b) => Number(micros(b.closedAt) - micros(a.closedAt)))[0];
  const proof = { rows: parts.flatMap(part => part.proof.rows), manifest: parts[0].proof.manifest };
  const daily = command.daily;
  if (daily && (micros(daily.expiresAt) <= micros(issuedAt) || micros(daily.expiresAt) > micros(issuedAt) + BigInt(12 * 3600 * 1000000)
    || !daily.participationOwnerApprovalRef?.trim()
    || reviewedPlan.rows.some(row => row.entity_kind === "participation_bundle"))) fail("invalid_daily_issuance");
  const freshMeans = daily?.freshMeans;
  if (freshMeans && (!freshMeans.standingApprovalRef?.trim() || !freshMeans.scheduleRevision?.trim())) fail("invalid_fresh_means_issuance");
  // Daily runs replace participation, so only the native inputs must match the reviewed plan (checked per source below).
  if (!daily && hash(nativeCadenceInputManifest(reviewedPlan)) !== hash(proof.manifest)) fail("reviewed_plan_input_manifest_mismatch");
  const byId = new Map(reviewedPlan.rows.map(row => [row.id, row]));
  const oldBundles = reviewedPlan.rows.filter(row => row.entity_kind === "seasonal_rate_bundle");
  const oldSources = oldBundles.flatMap(row => (row.payload as any).sources);
  const inputs = proof.rows.filter(row => row.entity_kind === "player"), fresh = new Map<string, any>();
  const nativeSnapshot = (row: PlannedSourceObservation) => {
    const payload = row.payload as any, calculation = { ...payload, seasonId, cutoffAt: payload.capturedAt, sourceWatermark: row.payload_hash };
    let snapshot: any;
    if (row.dataset_key === "baseline-inputs-v1") {
      if (payload.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION) verifyBaselineHistoricalSources(payload.historicalSources, payload.appearances,
        payload.nhlPlayerId, seasonId, payload.capturedAt, payload.limitations ?? []);
      snapshot = buildNativeSkaterBaselineSnapshot(calculation);
    } else snapshot = (goalieBuilders[payload.policyVersion] ?? fail("unsupported_native_policy"))(calculation);
    if (snapshot.definitionHash !== payload.definitionHash) fail("definition_hash_changed");
    return snapshot;
  };
  for (const row of freshMeans ? [] : inputs) {
    const payload = row.payload as any, prior = oldSources.filter((source: any) => source.sourceWatermark === row.payload_hash);
    if (!prior.length) fail("reviewed_sources_missing_for_input");
    const { scheduleRevision } = prior[0], expiresAt = daily?.expiresAt ?? prior[0].expiresAt;
    if (prior.some((source: any) => (!daily && source.expiresAt !== expiresAt) || source.scheduleRevision !== scheduleRevision)) fail("reviewed_source_clock_conflict");
    // Reissuing never renews an original expiry. A daily run is a new issuance with its own stated
    // expiry (at most twelve hours), new row identities, and unchanged cutoffs and means.
    if (micros(expiresAt) <= micros(issuedAt)) fail("original_source_expired");
    const snapshot = nativeSnapshot(row);
    const parameters = { seasonId, cutoffAt: payload.capturedAt, issuedAt, expiresAt, scheduleRevision,
      snapshots: [{ snapshot, teamId: payload.teamId, rosterRevision: payload.rosterRevision }] };
    const generated = row.dataset_key === "baseline-inputs-v1" ? buildBaselineContributionBundle(parameters) : buildGoalieContributionBundle(parameters);
    if (generated.sources.length !== prior.length) fail("reproduced_source_count_changed");
    for (const source of generated.sources) {
      const old = prior.find((value: any) => value.sourceId === source.sourceId);
      const comparable = (value: any) => daily ? withoutIssuance({ ...value, expiresAt: null }) : withoutIssuance(value);
      if (!old || hash(comparable(source)) !== hash(comparable(old))) fail("reproduced_source_changed");
      if (fresh.has(source.sourceId)) fail("duplicate_source_identity");
      fresh.set(source.sourceId, { ...source, released: true });
    }
  }
  const targetKey = (value: any) => [value.playerId, value.nhlPlayerId, value.teamId, value.rosterRevision].join(":");
  const targets = new Set(proof.rows.filter(row => row.dataset_key === "native-participation-input-v1")
    .flatMap(row => (row.payload as any).inputs.map((input: any) => targetKey(input.scope))));
  // Only a daily issuance under the standing approval may leave out sources, and only those of means-only players.
  const meansOnly = freshMeans ? [] : oldSources.filter((source: any) => !fresh.has(source.sourceId));
  if (meansOnly.length && (!daily?.standingApprovalRef?.trim() || meansOnly.some((source: any) => targets.has(targetKey(source))))) {
    fail("reviewed_source_without_input");
  }
  const envelope = (dataset: string, kind: string, payload: any, observedAt: string, revision: string | null, metadata: Record<string, unknown>,
    id = newId()): PlannedSourceObservation => ({ id, provider: "fhfh", dataset_key: dataset, entity_kind: kind, entity_key: String(seasonId),
    source_url: null, source_revision_key: revision, observed_at: observedAt, available_at: issuedAt, payload_hash: hash(payload), payload, metadata });
  const rows: PlannedSourceObservation[] = [...inputs], reviews: Array<Record<string, string>> = [], policies = new Set<string>();
  for (const original of freshMeans ? [] : oldBundles) {
    const old = original.payload as any, policy = byId.get(old.manifest.evaluationPolicyId), previousReview = byId.get(old.manifest.reviewId);
    if (!policy || !previousReview) fail("reviewed_policy_or_review_missing");
    if (!daily && micros(old.manifest.expiresAt) <= micros(issuedAt)) fail("original_bundle_expired");
    const sources = old.sources.filter((source: any) => fresh.has(source.sourceId)).map((source: any) => fresh.get(source.sourceId));
    if (!sources.length) continue;
    const subset = sources.length !== old.sources.length, reviewId = newId(), policyId = subset ? newId() : policy!.id;
    const unique = (values: string[]) => [...new Set(values)].sort();
    const { checksum: _checksum, ...unsigned } = { ...old.manifest, issuedAt, reviewId, ...(daily ? { expiresAt: daily.expiresAt } : {}),
      ...(subset ? { evaluationPolicyId: policyId, sourceCount: sources.length, sourceWatermarks: unique(sources.map((source: any) => source.sourceWatermark)),
        rosterRevisions: unique(sources.map((source: any) => source.rosterRevision)) } : {}) };
    const bundle = { manifest: { ...unsigned, checksum: contributionBundleChecksum({ manifest: unsigned as any, sources }) }, sources };
    const candidateInputHash = contributionBundleCandidateInputHash(bundle as any);
    if (!subset && (candidateInputHash !== contributionBundleCandidateInputHash(old) || candidateInputHash !== (policy!.payload as any).candidateInputHash)) fail("candidate_input_changed");
    // Same policy version, terms and reproduced means; only the candidate narrows, so the standing approval covers it.
    const policyRow = subset ? envelope("baseline-evaluation-policy-v1", "baseline_evaluation_policy", { ...(policy!.payload as any), candidateInputHash,
      ownerApprovalRef: daily!.standingApprovalRef, approvedAt: issuedAt }, issuedAt, candidateInputHash, { standingApprovalRef: daily!.standingApprovalRef,
      scientificQualification: false, subsetOfPolicy: policy!.id, meansOnlyPlayerIds: [...new Set<number>(old.sources
        .filter((source: any) => !fresh.has(source.sourceId)).map((source: any) => source.playerId))].sort((a, b) => a - b) }, policyId) : policy!;
    const review = { ...(previousReview!.payload as any), ...(subset ? { candidateInputHash, policyHash: policyRow.payload_hash } : {}),
      bundleChecksum: bundle.manifest.checksum, status: "pending_independent_review", eligible: false, ownerApprovalRef: "", reviewedAt: null };
    const bundleRow = envelope("contribution-bundle-v1", "seasonal_rate_bundle", bundle, bundle.manifest.inputCutoff, bundle.manifest.checksum,
      { policyVersion: bundle.manifest.policyVersion, released: true });
    if (!policies.has(policyRow.id)) { policies.add(policyRow.id); rows.push(policyRow); }
    // Daily issuance states what it re-issues; consumers and reviewers see the original clocks and cutoff.
    const disclosure = daily ? { dailyReissueOf: original.id, originalIssuedAt: old.manifest.issuedAt, originalExpiresAt: old.manifest.expiresAt,
      nativeInputCutoff: old.manifest.inputCutoff,
      disclosure: "Frozen means re-issued unchanged under a new stated expiry; their history excludes every game after the native input cutoff." } : {};
    rows.push(envelope("baseline-validation-review-v1", "baseline_validation_review", review, issuedAt, candidateInputHash,
      { pendingIndependentReview: true, ...disclosure }, reviewId), bundleRow);
    // Dry validation only; any database access fails.
    await persistContributionBundle({ from() { throw new Error("No database permitted"); } } as any, { ...bundle, dryRun: true, snapshotId: bundleRow.id } as any);
    reviews.push({ policyVersion: bundle.manifest.policyVersion, reviewId, bundleId: bundleRow.id, originalBundleId: original.id, candidateInputHash });
  }
  if (freshMeans) {
    const byPolicy = new Map<string, PlannedSourceObservation[]>();
    for (const row of inputs) byPolicy.set((row.payload as any).policyVersion, [...(byPolicy.get((row.payload as any).policyVersion) ?? []), row]);
    for (const [policyVersion, group] of [...byPolicy].sort(([a], [b]) => a.localeCompare(b))) {
      const cutoffs = [...new Set(group.map(row => (row.payload as any).capturedAt))];
      if (cutoffs.length !== 1) fail("fresh_means_cutoff_conflict");
      const template = reviewedPlan.rows.find(row => row.entity_kind === "baseline_evaluation_policy" && (row.payload as any).policyVersion === policyVersion);
      const templateReview = reviewedPlan.rows.find(row => row.entity_kind === "baseline_validation_review" && (row.payload as any).policyVersion === policyVersion);
      if (!template || !templateReview) fail("fresh_means_policy_template_missing");
      const parameters = { seasonId, cutoffAt: cutoffs[0], issuedAt, expiresAt: daily!.expiresAt, scheduleRevision: freshMeans.scheduleRevision,
        snapshots: group.map(row => ({ snapshot: nativeSnapshot(row), teamId: (row.payload as any).teamId, rosterRevision: (row.payload as any).rosterRevision })) };
      const generated = group[0].dataset_key === "baseline-inputs-v1" ? buildBaselineContributionBundle(parameters) : buildGoalieContributionBundle(parameters);
      const sources = generated.sources.map((source: any) => ({ ...source, released: true }));
      for (const source of sources) { if (fresh.has(source.sourceId)) fail("duplicate_source_identity"); fresh.set(source.sourceId, source); }
      const policyId = newId(), reviewId = newId(), { checksum: _checksum, ...generatedManifest } = generated.manifest;
      const unsigned = { ...generatedManifest, evaluationPolicyId: policyId, reviewId, released: true };
      const bundle = { manifest: { ...unsigned, checksum: contributionBundleChecksum({ manifest: unsigned as any, sources }) }, sources };
      const candidateInputHash = contributionBundleCandidateInputHash(bundle as any), terms = template!.payload as any;
      const evidenceRef = String(terms.prospectiveEvidenceRef).replace(/candidate:[a-f0-9]{64}/, `candidate:${candidateInputHash}`);
      const policy = { ...terms, candidateInputHash, status: "owner_approved", prospectiveEvidenceRef: evidenceRef,
        ownerApprovalRef: freshMeans.standingApprovalRef, approvedAt: issuedAt };
      const review = { ...(templateReview!.payload as any), candidateInputHash, policyHash: hash(policy), bundleChecksum: bundle.manifest.checksum,
        status: "pending_independent_review", eligible: false, prospectiveEvidenceRef: evidenceRef, ownerApprovalRef: "", reviewedAt: null };
      const bundleRow = envelope("contribution-bundle-v1", "seasonal_rate_bundle", bundle, bundle.manifest.inputCutoff, bundle.manifest.checksum,
        { policyVersion, released: true });
      rows.push(envelope("baseline-evaluation-policy-v1", "baseline_evaluation_policy", policy, issuedAt, candidateInputHash,
        { standingApprovalRef: freshMeans.standingApprovalRef, scientificQualification: false }, policyId),
      envelope("baseline-validation-review-v1", "baseline_validation_review", review, issuedAt, candidateInputHash,
        { pendingIndependentReview: true, freshNativeMeans: true, nativeInputCutoff: bundle.manifest.inputCutoff }, reviewId), bundleRow);
      await persistContributionBundle({ from() { throw new Error("No database permitted"); } } as any, { ...bundle, dryRun: true, snapshotId: bundleRow.id } as any);
      reviews.push({ policyVersion, reviewId, bundleId: bundleRow.id, policyId, candidateInputHash });
    }
  }
  let participationEntries = 0, nullParticipation = 0;
  if (daily) {
    const groups = new Map<string, any[]>();
    for (const row of proof.rows.filter(value => value.dataset_key === "native-participation-input-v1")) {
      const payload = row.payload as any; groups.set(payload.dataset, [...(groups.get(payload.dataset) ?? []), ...payload.inputs]);
    }
    for (const [dataset, inputs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const build = participationBuilders[dataset] ?? fail("unsupported_participation_method");
      const entries = inputs.map((input: any) => {
        const receipt = build(input, { issuedAt, expiresAt: daily.expiresAt });
        participationEntries++; if (receipt.probability === null) nullParticipation++;
        return { input, receipt };
      });
      // Partition entries into bundles under the per-row byte bound; no player/game appears twice.
      const groupsOfEntries: any[][] = [[]]; let bytes = 0;
      for (const entry of entries) {
        const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
        if ((bytes + size > DAILY_PARTICIPATION_BUNDLE_BYTES || groupsOfEntries.at(-1)!.length >= SKATER_PARTICIPATION_RELEASE_LIMITS.bundleEntries)
          && groupsOfEntries.at(-1)!.length) { groupsOfEntries.push([]); bytes = 0; }
        groupsOfEntries.at(-1)!.push(entry); bytes += size;
      }
      for (const group of groupsOfEntries) {
        const payload = { version: dataset, seasonId, issuedAt, expiresAt: daily.expiresAt, released: true,
          allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
          ownerApprovalRef: daily.participationOwnerApprovalRef, reviewRef: "", entries: group };
        rows.push({ ...envelope(dataset, "participation_bundle", payload, issuedAt, null, { pendingIndependentReview: true }),
          source_revision_key: hash(payload) });
      }
    }
  }
  for (const original of daily ? [] : reviewedPlan.rows.filter(row => row.entity_kind === "participation_bundle")) {
    const old = original.payload as any, build = participationBuilders[old.version] ?? fail("unsupported_participation_method");
    if (micros(old.expiresAt) <= micros(issuedAt)) fail("original_participation_expired");
    const entries = old.entries.map((entry: any) => {
      const receipt = build(entry.input, { issuedAt, expiresAt: old.expiresAt });
      if (hash(withoutIssuedAt(receipt)) !== hash(withoutIssuedAt(entry.receipt))) fail("participation_estimate_changed");
      participationEntries++; if (receipt.probability === null) nullParticipation++;
      return { input: entry.input, receipt };
    });
    rows.push(envelope(original.dataset_key, "participation_bundle", { ...old, issuedAt, reviewRef: "", entries }, original.observed_at, null,
      { ...original.metadata, pendingIndependentReview: true }));
  }
  const plan: NativeBaselinePublicationPlan = { version: "native-baseline-publication-plan-v1", seasonId, rows };
  const inputSources = split ? { skater: request.sourceKey, goalie: goalieRequest!.sourceKey } : undefined;
  const manifests = nativeCadenceSourceManifests({ publicationPlan: plan, inputSourceKey: request.sourceKey, inputSources });
  if (parts.some(part => hash(manifests[part.request.sourceKey]) !== hash(part.proof.manifest))) fail("prepared_plan_input_manifest_mismatch");
  const cadenceInput: Parameters<typeof publishObservedNativeBaselineCadence>[0] = { slotKey: command.slotKey, inputSourceKey: request.sourceKey,
    ...(inputSources ? { inputSources } : {}), publicationPlan: plan, requiredAcquisitionScopes: command.requiredAcquisitionScopes,
    cadence: { now, date: request.date, requiredSources: parts.map(part => part.request.sourceKey), games: command.games, previous: [],
      sources: parts.map(part => ({ key: part.request.sourceKey, date: request.date, status: "complete" as const, revision: part.proof.manifest.revision,
        completedAt: (part.proof.closure.payload as any).closedAt, expectedItems: part.proof.manifest.expectedItems, completedItems: part.proof.manifest.expectedItems })) } };
  if (nativeCadenceClosureScope(cadenceInput) !== request.closureScopeHash) fail("cadence_closure_scope_mismatch");
  return { plan, cadenceCommand: { version: "native-cadence-command-v1" as const, cadenceInput,
    producerReceiptIds: Object.fromEntries(parts.map(part => [part.request.sourceKey, part.proof.closure.id])), catalogHead: null },
  receipt: { status: "outputs_built_pending_independent_review_and_catalog_head", issuedAt, dueAt: command.dueAt, closedAt: closure.closedAt,
    nativeInputs: inputs.length, nativeSources: fresh.size, participationEntries, nullParticipation, rows: rows.length, reviews,
    ...(daily ? { dailyExpiresAt: daily.expiresAt, [freshMeans ? "nativeInputCutoffs" : "nativeMeansFrozenAtCutoff"]: [...new Set(inputs.map(row => (row.payload as any).capturedAt))].sort(),
      meansOnlyExcluded: { sources: meansOnly.length, playerIds: [...new Set(meansOnly.map((source: any) => source.playerId as number))].sort((a, b) => a - b) } } : {}),
    planHash: hash(plan), networkRequests: 0, databaseWrites: 0, publicationExecuted: false, headSelection: false } };
}

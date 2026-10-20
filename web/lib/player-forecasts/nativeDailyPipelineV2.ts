/** FORGE v2 daily composition (tasks/prd-forge-daily-pipeline.md, v2 decisions): the Yahoo universe, fresh native
 * means and participation (frozen-window method through its last accepted cutoff, then the rolling 14-day method)
 * bound into one materialization request. Pure: no fetching, writing or model change. Everything still awaiting TJ
 * sits behind `NativeDailyV2Flags`, all off by default. */
import { timestampMicros } from "../projections/evidenceTime";
import { buildDailyMaterializationRequest, type HttpReceipt, type dailyScheduleBindings } from "./nativeDailyPipeline";
import { bindNativeCadenceMaterialization } from "./nativeBaselineCadence";
import { mergeNativeMaterializationParents, type NativeDailyMeans, type NativeMeansUniverseRow } from "./nativeDailyMeansCapture";
import type { NativeMaterializationParent, NativeMaterializationRequest } from "./nativeInputMaterialization";
import { targetRosterObservationFromReceipt } from "./targetRosterObservation";
import type { buildRollingParticipationHistories } from "./rollingParticipationFrame";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt, buildRollingWindowSkaterParticipationReceipt,
  type RollingWindowGoalieParticipationInput, type RollingWindowGoalieStartInput, type RollingWindowSkaterParticipationInput } from "./rollingWindowParticipation";
import { proposeYahooKnownConflicts, type buildYahooUniverse } from "./yahooUniverse";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";

/** Default off: each flag stays off until TJ approves the thing it enables. */
export const NATIVE_DAILY_V2_FLAGS = Object.freeze({
  /** Apply the proposed Yahoo status → knownConflict policy (needs the approved policy hash). */
  injuryPolicy: false,
  /** Count only participation nulls not caused by `known_current_roster_conflict` against the null gate. */
  nullGateNonConflictOnly: false,
  /** Enforce universe thresholds U4 (≤5 unresolved candidates) and U5 (≤10 added members); off reports them only. */
  universeThresholds: false,
  /** Issue the rolling 14-day participation methods once the frozen method's cutoff limit has passed. */
  rollingFirstIssuance: false,
});
export type NativeDailyV2Flags = { -readonly [K in keyof typeof NATIVE_DAILY_V2_FLAGS]: boolean };
/** The frozen-window participation methods accept cutoffs only through this instant. */
export const FROZEN_PARTICIPATION_LAST_CUTOFF = "2026-10-27T04:00:00.000Z";
/** Methods under the standing approval (TJ 2026-10-17, ref tj-standing-approval-2026-10-17:forge-daily): the policy
 * versions and definition hashes approved on 2026-10-16 for season 20262027, and the participation datasets. Any other
 * version or hash goes to TJ. The rolling datasets count only once their first issuance is approved (flag). */
export const NATIVE_DAILY_APPROVED_METHODS = Object.freeze({ seasonId: 20262027,
  policies: Object.freeze({
    "current-appearance-skater-rates-v1": "96bce3cfd0e2265feede26648139e24f5209df6f1ae98263139cc58bd7cd28ba",
    "native-prior-appearance-skater-rates-v1": "879b96c79124584f7f53ea97084b26a837648a6dd118dd82568d6224b5e66f23",
    "native-goalie-appearance-win-rates-v1": "e60cd76fe4d8210ccdc7374c40eecf7b0ff1a28cb4b280f30faf3f7b64e9ad84",
    "native-goalie-appearance-volume-rates-v1": "112fe51ef56842cf62edc4be5fceb8cb2148d5c1948d0140b58a85097b698f7c",
    "native-goalie-appearance-shutout-rates-v1": "fc6c68494cb85d2f2a1604c580743f6d425665e47887cb80e45eebcc5ce80148",
    "native-goalie-appearance-summary-win-rates-v1": "e715b40bb1da52461539c67c4211208a12663d72487db914fcc67a040f9575ca" } as Record<string, string>),
  participationDatasets: Object.freeze(["skater-roster-observation-participation-bundle-v1", "goalie-roster-observation-participation-bundle-v1",
    "goalie-roster-observation-start-bundle-v1"]),
  rollingParticipationDatasets: Object.freeze(["skater-rolling-14d-participation-bundle-v1", "goalie-rolling-14d-participation-bundle-v1",
    "goalie-rolling-14d-start-bundle-v1"]) });
export const NATIVE_DAILY_UNIVERSE_THRESHOLDS = Object.freeze({ unresolvedCandidates: 5, addedMembers: 10 });
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
type Universe = ReturnType<typeof buildYahooUniverse>;
type RollingInput = RollingWindowSkaterParticipationInput | RollingWindowGoalieParticipationInput | RollingWindowGoalieStartInput;
type ParticipationInput = NonNullable<NativeMaterializationRequest["participationInputs"]>[number] | RollingInput;

export function nativeDailyV2Flags(value: unknown): NativeDailyV2Flags {
  const flags = { ...NATIVE_DAILY_V2_FLAGS } as NativeDailyV2Flags;
  if (value === undefined) return flags;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_v2_flags");
  for (const [key, setting] of Object.entries(value as Record<string, unknown>)) {
    if (!(key in flags) || typeof setting !== "boolean") fail(`invalid_v2_flag:${key}`);
    flags[key as keyof NativeDailyV2Flags] = setting as boolean;
  }
  return flags;
}

/** The frozen-window method through its last accepted cutoff; after that, rolling only once its first issuance is approved. */
export function nativeDailyParticipationMethod(cutoffAt: string, flags: NativeDailyV2Flags) {
  if (micros(cutoffAt) <= micros(FROZEN_PARTICIPATION_LAST_CUTOFF)) return "frozen_window" as const;
  return flags.rollingFirstIssuance ? "rolling_14d" as const : fail("rolling_first_issuance_not_approved");
}

/** Universe rows for the means stage plus the universe gates. U3 (every owned player resolved) always gates. */
export function nativeDailyUniverse(universe: Universe, flags: NativeDailyV2Flags) {
  if (universe?.version !== "forge-daily-yahoo-universe-v1" || !Array.isArray(universe.players) || !universe.players.length) fail("universe_required");
  if (!universe.ownedComplete) fail("universe_owned_incomplete");
  const unresolved = universe.unmapped.length + universe.ambiguous.length + universe.membershipUnresolved.length + universe.excluded.length;
  const added = universe.change?.added?.length ?? 0;
  const exceeds = unresolved > NATIVE_DAILY_UNIVERSE_THRESHOLDS.unresolvedCandidates || added > NATIVE_DAILY_UNIVERSE_THRESHOLDS.addedMembers;
  if (flags.universeThresholds && exceeds) fail("universe_threshold_exceeded");
  const rows: NativeMeansUniverseRow[] = universe.players.map(player => ({ playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
    teamId: player.teamId, playerClass: player.class, rosterRevision: player.rosterRevision, yahooPlayerKey: player.yahooPlayerKey }));
  return { rows, gate: { date: universe.date, status: universe.status, owned: universe.counts.owned, players: rows.length, unresolved, added,
    thresholds: NATIVE_DAILY_UNIVERSE_THRESHOLDS, thresholdsApplied: flags.universeThresholds, thresholdsExceeded: exceeds } };
}

/** Fresh known conflicts only under the approved policy hash; otherwise none are passed and the v1 carry rule applies. */
export function nativeDailyKnownConflicts(universe: Universe, cutoffAt: string, flags: NativeDailyV2Flags, approvedPolicyHash?: string) {
  if (!flags.injuryPolicy) return undefined;
  const proposal = proposeYahooKnownConflicts(universe.injury.evidence, universe.players, universe.seasonId, cutoffAt);
  if (!approvedPolicyHash || proposal.policyHash !== approvedPolicyHash) fail("injury_policy_not_approved");
  return proposal.proposedKnownConflicts;
}

/** Method gate before anything is minted under the standing approval: every native input's definition hash, every
 * policy and bundle version, and every participation dataset must be pinned above. */
export function assertStandingApprovalMethods(plan: { seasonId: number; rows: PlannedSourceObservation[] }, flags: NativeDailyV2Flags) {
  const approved = NATIVE_DAILY_APPROVED_METHODS, datasets = [...approved.participationDatasets, ...(flags.rollingFirstIssuance ? approved.rollingParticipationDatasets : [])];
  if (plan.seasonId !== approved.seasonId) fail("method_not_in_standing_approval:season");
  for (const row of plan.rows) {
    const payload = row.payload as any;
    if (row.entity_kind === "player" && approved.policies[payload.policyVersion] !== payload.definitionHash) fail(`method_not_in_standing_approval:${payload.policyVersion}`);
    if (row.entity_kind === "baseline_evaluation_policy" && !approved.policies[payload.policyVersion]) fail(`method_not_in_standing_approval:${payload.policyVersion}`);
    if (row.entity_kind === "seasonal_rate_bundle" && !approved.policies[payload.manifest.policyVersion]) fail(`method_not_in_standing_approval:${payload.manifest.policyVersion}`);
    if (row.entity_kind === "participation_bundle" && !datasets.includes(row.dataset_key)) fail(`method_not_in_standing_approval:${row.dataset_key}`);
  }
  return { policies: Object.keys(approved.policies).length, participationDatasets: datasets.length };
}

/** v1's participation coverage gate: any covered player with a reason or no bound game stops the run, and so does any
 * universe member whose retained frozen template was dropped for an identity or roster-revision change. */
export function assertParticipationCoverage(coverage: Array<{ playerId: number; games: number; reasons: string[] }>, lostTemplates: number[] = []) {
  if (lostTemplates.length) fail(`participation_template_lost:${lostTemplates.length}`);
  if (coverage.some(row => row.reasons.length || !row.games)) fail("participation_coverage_incomplete");
}

/** Participation nulls against the gate; with the flag, conflict-withheld nulls are reported but not counted. */
export function nativeDailyNullParticipation(plan: { rows: PlannedSourceObservation[] }, flags: NativeDailyV2Flags) {
  let total = 0, conflict = 0;
  for (const row of plan.rows) if (row.entity_kind === "participation_bundle") for (const entry of (row.payload as any).entries) {
    if (entry.receipt.probability !== null) continue;
    total++;
    if (entry.receipt.reasons.includes("known_current_roster_conflict")) conflict++;
  }
  return { total, conflictWithheld: conflict, gated: flags.nullGateNonConflictOnly ? total - conflict : total };
}

const evidence = (receipt: HttpReceipt) => ({ id: `http:${receipt.bodySha256}`, hash: receipt.bodySha256, availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt });
const original = (receipt: HttpReceipt): NativeMaterializationParent => ({ ...evidence(receipt),
  original: { url: receipt.url, rawBody: receipt.rawBody, bodySha256: receipt.bodySha256 } });

/** Rolling 14-day inputs: one per player and upcoming club game (goalies also a start input), from the frame's
 * histories and fresh official club rosters. A missing roster or history leaves the player uncovered, never zero. */
export function buildRollingDailyParticipationInputs(args: { players: NativeMeansUniverseRow[]; rosterReceipts: HttpReceipt[];
  bindings: ReturnType<typeof dailyScheduleBindings>; frame: ReturnType<typeof buildRollingParticipationHistories>; cutoffAt: string;
  seasonId: number; knownConflicts?: Record<number, boolean | null>; horizon?: number }) {
  const horizon = args.horizon ?? 20, rosters = new Map<string, HttpReceipt>();
  for (const receipt of args.rosterReceipts) {
    const abbreviation = new RegExp(`^https://api-web\\.nhle\\.com/v1/roster/([A-Z]{2,4})/${args.seasonId}$`).exec(receipt.url)?.[1] ?? fail("invalid_roster_receipt");
    if (rosters.has(abbreviation)) fail("duplicate_club_roster");
    rosters.set(abbreviation, receipt);
  }
  const inputs: RollingInput[] = [], coverage: any[] = [], temporary = { issuedAt: args.cutoffAt, expiresAt: new Date(Date.parse(args.cutoffAt) + 1).toISOString() };
  for (const player of [...args.players].sort((a, b) => a.playerId - b.playerId)) {
    const abbreviation = args.bindings.teams.get(player.teamId), roster = abbreviation ? rosters.get(abbreviation) : undefined;
    const games = abbreviation ? (args.bindings.byTeam.get(abbreviation) ?? []).slice(0, horizon) : [], history = args.frame.histories.get(player.playerId);
    const row = { playerId: player.playerId, playerClass: player.playerClass, teamId: player.teamId, games: games.length, missingGames: horizon - games.length,
      listed: null as boolean | null, knownConflict: null as boolean | null, reasons: [] as string[] };
    coverage.push(row);
    if (!roster) { row.reasons.push("missing_official_club_roster"); continue; }
    if (!history) { row.reasons.push("missing_rolling_history"); continue; }
    const knownConflict = Object.prototype.hasOwnProperty.call(args.knownConflicts ?? {}, player.playerId) ? args.knownConflicts![player.playerId] : null;
    const observation = targetRosterObservationFromReceipt({ playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, teamId: player.teamId,
      seasonId: args.seasonId, teamAbbreviation: abbreviation!, knownConflict, cutoffAt: args.cutoffAt, receipt: roster });
    row.listed = observation.listed; row.knownConflict = observation.knownConflict;
    for (const game of games) {
      const source = args.bindings.sourceByGame.get(`${game.id}:${game.teamAbbreviation}`) ?? fail("missing_schedule_source");
      const base = { playerClass: player.playerClass, cutoffAt: args.cutoffAt, scheduleEvidence: evidence(source), rosterEvidence: observation.evidence,
        targetRosterObservation: observation, history, scope: { playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId: args.seasonId,
          teamId: player.teamId, gameId: Number(game.id), scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision, rosterRevision: player.rosterRevision } };
      if (player.playerClass === "skater") {
        const input = { ...base, playerClass: "skater", version: "skater-rolling-14d-participation-input-v1" } as RollingWindowSkaterParticipationInput;
        buildRollingWindowSkaterParticipationReceipt(input, temporary); inputs.push(input);
      } else {
        const appearance = { ...base, playerClass: "goalie", version: "goalie-rolling-14d-participation-input-v1" } as RollingWindowGoalieParticipationInput;
        const start = { ...base, playerClass: "goalie", version: "goalie-rolling-14d-start-input-v1" } as RollingWindowGoalieStartInput;
        buildRollingWindowGoalieParticipationReceipt(appearance, temporary); buildRollingWindowGoalieStartReceipt(start, temporary);
        inputs.push(start, appearance);
      }
    }
  }
  return { inputs, coverage };
}

/** Frozen-window participation parents: the v1 builder over a native-free copy of the retained request keeps exactly
 * the retained parents the history evidence reaches, adds the fresh roster/schedule originals and the re-observed
 * history manifest, and supplies the retained acquisition. */
export function frozenWindowParticipationParents(args: Omit<Parameters<typeof buildDailyMaterializationRequest>[0], "retained"> & {
  retained: NativeMaterializationRequest }) {
  const nativeFree = { ...args.retained, nativeSelection: [], additionalNativeObservations: [], existingInputs: [] };
  const bound = buildDailyMaterializationRequest({ ...args, retained: nativeFree });
  return { parents: bound.request.parents ?? [], acquisition: bound.request.acquisition, droppedParents: bound.droppedParents };
}

/** One bound materialization request: fresh native means as additional observations, participation inputs, and the
 * merged parent set (participation first, so its evidence ids win). The acquisition roster is the universe. */
export function buildDailyMaterializationRequestV2(args: { acquisition: NativeMaterializationRequest["acquisition"]; universe: NativeMeansUniverseRow[];
  means: Pick<NativeDailyMeans, "nativeSelection" | "additionalNativeObservations" | "parents" | "cutoffAt">;
  participationInputs: ParticipationInput[]; participationParents: NativeMaterializationParent[]; cutoffAt: string;
  runId: string; date: string; sourceKey: string; seasonId: number; games: Array<{ gameId: number; startsAt: string }> }) {
  if (micros(args.means.cutoffAt) > micros(args.cutoffAt)) fail("means_cutoff_after_inputs_cutoff");
  const merged = mergeNativeMaterializationParents(args.participationParents, args.means.parents);
  const request: NativeMaterializationRequest = { runId: args.runId, sourceKey: args.sourceKey, date: args.date, closureScopeHash: "",
    acquisition: { ...args.acquisition, roster: args.universe, cutoffAt: args.cutoffAt },
    nativeSelection: args.means.nativeSelection, additionalNativeObservations: args.means.additionalNativeObservations,
    participationInputs: args.participationInputs as NativeMaterializationRequest["participationInputs"], ...merged };
  return { ...bindNativeCadenceMaterialization(request, { runId: args.runId, sourceKey: args.sourceKey, date: args.date, seasonId: args.seasonId,
    games: args.games }), requestBytes: Buffer.byteLength(JSON.stringify(request)) };
}

/** Bundle-level schedule revision for fresh baseline sources: the fresh schedule originals this issuance saw. */
export const nativeDailyScheduleRevision = (receipts: HttpReceipt[]) =>
  `daily-schedule:${hash(receipts.filter(receipt => /\/v1\/schedule\//.test(receipt.url)).map(receipt => receipt.bodySha256).sort())}`;
export { original as nativeDailyOriginalParent };

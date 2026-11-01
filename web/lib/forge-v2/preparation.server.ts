import { CATEGORIES, CategoryMeans, EvidenceClass, HistoryEvent, HorizonEpisode, LockEpoch, Opportunity, OutcomeRevision, PublishedVintage, ScoringProfile, Target, assertId, assertTarget, instant, unavailable } from "./contracts";
import { PreparedPlayerContext, projectRevision } from "./api.server";
import { FileArtifactStore } from "./artifacts.server";
import { PostgresHistoryStore, RecordKind } from "./history.server";
import { contentHash } from "./hash.server";
import { DEFAULT_SCORING, scoreMeans, scoringProfile, targetKey } from "./identity";
import { EvaluationRevision, MatchedBaseline, Selection, SelectionRevision, appendOutcomeRevision, appendSelectionRevision, buildAccountability, publicationEligibility, selectLockedFinal, selectPrimaryCheckpoints, settleEvaluation } from "./evaluation";
import { CalibrationPayload, JointDistribution, evaluatePinnedIntervals } from "./uncertainty";

type PreparationStore = Pick<PostgresHistoryStore, "records" | "history" | "appendRecord">;
type ScientificRecord = Awaited<ReturnType<PreparationStore["records"]>>[number];
type StoredEvaluation = { type: "selection"; value: SelectionRevision } | { type: "grade"; value: EvaluationRevision; selectionRevision: SelectionRevision };
export interface PreparedBaseline {
  vintageId: string;
  inputCutoffAt: string;
  target: Target;
  lastFive: CategoryMeans;
  seasonRate: CategoryMeans;
}
export interface ReadPreparationInput {
  store: PreparationStore;
  artifacts: FileArtifactStore;
  player: PreparedPlayerContext["player"];
  /** Explicit bounded target inventory, independent of forecast success. */
  targets: Target[];
  asOf: string;
  evidenceClass: EvidenceClass;
  profiles: ScoringProfile[];
  qualifications: PreparedPlayerContext["qualifications"];
  excluded: PreparedPlayerContext["excluded"];
  baselines?: PreparedBaseline[];
  previous: PreparedPlayerContext | null;
  maximumRecordsPerKind: number;
  maximumPublicationsPerGame: number;
  /** Fixture access is local only. Real contexts stay private until a separate release. */
  visibility: "private" | "local_fixture";
  /** Internal registered evaluation protocol. Its bands remain unqualified diagnostics. */
  intervalProtocolId?: string;
}

async function records(store: PreparationStore, scope: string, kind: RecordKind, maximum: number): Promise<ScientificRecord[]> {
  const result: ScientificRecord[] = [];
  let ordinal = 0;
  for (;;) {
    const page = await store.records(scope, kind, ordinal, Math.min(200, maximum - result.length + 1));
    if (!page.length) return result;
    if (page.some(row => row.ordinal <= ordinal) || new Set(page.map(row => row.ordinal)).size !== page.length) throw new Error("preparation_record_cursor_did_not_advance");
    result.push(...page);
    if (result.length > maximum) throw new Error("preparation_record_bound_exceeded");
    ordinal = page.at(-1)!.ordinal;
  }
}
async function publications(input: ReadPreparationInput, target: Target): Promise<PublishedVintage[]> {
  const result: PublishedVintage[] = [];
  let cursor: string | undefined;
  do {
    const page = await input.store.history(target.playerId, target.gameId, Math.min(200, input.maximumPublicationsPerGame - result.length + 1), cursor);
    result.push(...page.revisions);
    if (result.length > input.maximumPublicationsPerGame) throw new Error("preparation_publication_bound_exceeded");
    if (page.nextCursor && page.nextCursor === cursor) throw new Error("preparation_history_cursor_did_not_advance");
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return result.filter(row => row.vintage.evidenceClass === input.evidenceClass && instant(row.receipt.confirmedAt) <= instant(input.asOf));
}
function selectionKey(value: Selection): string { return [targetKey(value), value.series, value.horizon, value.evidenceClass].join("|"); }
function selectionState(value: Selection): string { return contentHash({ ...value, selectedAt: "same-observation" }); }

/** Offline bounded materialization: reads retained issuance/ledger evidence, appends selections
 * and grades, then publishes one immutable context. Never invoked by a public GET request. */
export async function preparePlayerReadContext(input: ReadPreparationInput): Promise<PreparedPlayerContext> {
  assertId(input.player.id); instant(input.asOf);
  if (!input.player.name.trim() || input.player.name.length > 200 || input.targets.length > 10 || new Set(input.targets.map(targetKey)).size !== input.targets.length
    || input.targets.some(target => target.playerId !== input.player.id) || !input.profiles.length || input.profiles.length > 20
    || !input.profiles.some(profile => profile.id === DEFAULT_SCORING.id) || new Set(input.profiles.map(profile => profile.id)).size !== input.profiles.length
    || input.profiles.some(profile => contentHash(profile) !== contentHash(scoringProfile(profile.weights)))
    || !Number.isSafeInteger(input.maximumRecordsPerKind) || input.maximumRecordsPerKind < 1 || !Number.isSafeInteger(input.maximumPublicationsPerGame) || input.maximumPublicationsPerGame < 1
    || input.visibility === "local_fixture" && input.evidenceClass !== "fixture"
    || input.previous && input.previous.player.id !== input.player.id) throw new Error("invalid_read_preparation_scope");
  const preparationFingerprint = contentHash({ targets: input.targets, profiles: input.profiles, qualifications: input.qualifications, excluded: input.excluded, baselines: input.baselines ?? [], evidenceClass: input.evidenceClass, visibility: input.visibility, intervalProtocolId: input.intervalProtocolId ?? null });
  const priorContexts = (await records(input.store, `player:${input.player.id}`, "read_context", input.maximumRecordsPerKind)).map(row => row.payload as PreparedPlayerContext);
  const latestContext = priorContexts.at(-1);
  if (latestContext && instant(latestContext.asOf) >= instant(input.asOf)) {
    const replay = priorContexts.find(row => row.asOf === input.asOf && row.preparationFingerprint === preparationFingerprint);
    if (!replay) throw new Error("historical_context_replay_mismatch");
    return structuredClone(replay);
  }
  if ((latestContext?.id ?? null) !== (input.previous?.id ?? null)) throw new Error("prepared_context_predecessor_mismatch");
  const context: PreparedPlayerContext = {
    id: "pending", player: { ...input.player }, publicApproved: input.visibility === "local_fixture", asOf: input.asOf, games: [], excluded: structuredClone(input.excluded), qualifications: structuredClone(input.qualifications),
    accountability: buildAccountability({ evaluations: [], publications: [], profile: DEFAULT_SCORING, evidenceClass: input.evidenceClass }), accountabilityByProfile: {}, preparationFingerprint,
  };
  const allPublications: PublishedVintage[] = [], allGrades: EvaluationRevision[] = [], matched: MatchedBaseline[] = [];
  for (const target of input.targets) {
    assertTarget(target);
    const scope = targetKey(target), captured = await records(input.store, scope, "opportunity", input.maximumRecordsPerKind);
    const opportunity = captured.map(row => row.payload as Opportunity).filter(value => targetKey(value) === scope && instant(value.observedAt) <= instant(input.asOf)).at(-1);
    if (!opportunity) throw new Error("prepared_opportunity_not_captured");
    const epochs = (await records(input.store, String(target.gameId), "lock_epoch", input.maximumRecordsPerKind)).map(row => row.payload as LockEpoch).filter(row => instant(row.adoptedAt) <= instant(input.asOf));
    const episodeRows = (await records(input.store, scope, "horizon_episode", input.maximumRecordsPerKind)).map(row => row.payload as HorizonEpisode).filter(row => instant(row.enteredAt) <= instant(input.asOf));
    const episodes = [...new Map(episodeRows.map(row => [row.id, row.exitedAt && instant(row.exitedAt) > instant(input.asOf) ? { ...row, exitedAt: null } : row])).values()];
    const events = (await records(input.store, scope, "history_event", input.maximumRecordsPerKind)).map(row => row.payload as HistoryEvent).filter(row => instant(row.at) <= instant(input.asOf));
    const outcomeRows = (await records(input.store, scope, "outcome", input.maximumRecordsPerKind)).map(row => row.payload as OutcomeRevision).filter(row => instant(row.recordedAt) <= instant(input.asOf));
    let outcomes: OutcomeRevision[] = [];
    for (const outcome of outcomeRows) outcomes = appendOutcomeRevision(outcomes, outcome);
    const outcome = outcomes.at(-1) ?? null;
    const rows = await publications(input, target); allPublications.push(...rows);
    const retained = (await records(input.store, scope, "evaluation", input.maximumRecordsPerKind)).map(row => row.payload as StoredEvaluation);
    const selectionHistory = retained.flatMap(row => row.type === "selection" && instant(row.value.recordedAt) <= instant(input.asOf) ? [row.value] : []);
    const priorSelections = [...new Map(selectionHistory.map(row => [selectionKey(row.selection), row])).values()];
    const selections = [...selectPrimaryCheckpoints({ target, episodes, publications: rows, epochs, evidenceClass: input.evidenceClass, asOf: input.asOf, prior: priorSelections.map(row => row.selection) }),
      selectLockedFinal({ target, publications: rows, epochs, evidenceClass: input.evidenceClass, asOf: input.asOf })];
    const latest = rows.filter(row => publicationEligibility(row, epochs, input.asOf) === null).at(-1) ?? null;
    const final = selections.at(-1)!;
    const lastGap = events.filter(row => ["failed_attempt", "unavailable", "missing_refresh"].includes(row.kind)).at(-1);
    const stale = lastGap && (!latest || instant(lastGap.at) >= instant(latest.receipt.confirmedAt));
    const game: PreparedPlayerContext["games"][number] = { opportunity, epochs, latestVintageId: latest?.vintage.id ?? null, finalVintageId: final.state === "selected" ? final.vintageId : null, outcome, events,
      freshness: { state: !latest ? "unavailable" : stale ? "stale" : "fresh", asOf: input.asOf, reason: stale ? lastGap.reason : !latest ? "no_eligible_publication" : null } };
    context.games.push(game);
    for (let selection of selections) {
      const priorSelection = priorSelections.find(row => selectionKey(row.selection) === selectionKey(selection));
      let selected: SelectionRevision;
      if (priorSelection && selectionState(priorSelection.selection) === selectionState(selection)) { selected = priorSelection; selection = priorSelection.selection; }
      else {
        const body = { predecessorId: priorSelection?.id ?? null, recordedAt: input.asOf, selection, reason: priorSelection ? "retained_evidence_updated" : null };
        selected = { id: `selection:${contentHash(body)}`, ...body };
        appendSelectionRevision(priorSelection ? [priorSelection] : [], selected);
        await input.store.appendRecord(selected.id, "evaluation", scope, { type: "selection", value: selected }, selected.predecessorId);
      }
      const publication = rows.find(row => row.vintage.id === selection.vintageId) ?? null;
      let pinned: { joint: { reference: import("./contracts").ArtifactReference; payload: JointDistribution }; calibration: { reference: import("./contracts").ArtifactReference; payload: CalibrationPayload } } | null = null;
      let artifactFailure: string | null = null;
      if (input.intervalProtocolId && publication?.vintage.distribution.state === "available" && publication.vintage.calibration.state === "available") {
        const [joint, calibration] = await Promise.all([input.artifacts.read(publication.vintage.distribution.value), input.artifacts.read(publication.vintage.calibration.value)]);
        if (joint.state === "available" && calibration.state === "available") pinned = { joint: { reference: joint.reference, payload: JSON.parse(joint.bytes) as JointDistribution }, calibration: { reference: calibration.reference, payload: JSON.parse(calibration.bytes) as CalibrationPayload } };
        for (const result of [joint, calibration]) if (result.state === "unavailable") {
          artifactFailure ??= result.reason;
          const incident = { ...result.incident, vintageId: publication.vintage.id, at: input.asOf };
          await input.store.appendRecord(`integrity:${contentHash(incident)}`, "integrity_incident", scope, incident);
        }
      }
      for (const profile of input.profiles) {
        const projected = publication ? await projectRevision(publication, context, game, profile, input.artifacts) : null;
        for (const valueKind of [...CATEGORIES, "FP"] as const) {
          const previous = retained.flatMap(row => row.type === "grade" && instant(row.value.recordedAt) <= instant(input.asOf) && selectionKey(row.value.selection) === selectionKey(selection) && row.value.profile.id === profile.id && row.value.valueKind === valueKind ? [row] : []).at(-1);
          const intervalProfile = valueKind === "FP" ? profile : scoringProfile(Object.fromEntries(CATEGORIES.map(c => [c, Number(c === valueKind)])) as ScoringProfile["weights"]);
          const interval = artifactFailure ? unavailable(artifactFailure) : pinned && publication && input.intervalProtocolId ? evaluatePinnedIntervals(publication.vintage, intervalProfile, pinned.joint, pinned.calibration, input.intervalProtocolId)
            : valueKind === "FP" ? projected?.intervals ?? unavailable("interval_unavailable") : projected?.categoryIntervals?.[valueKind] ?? unavailable("category_interval_unavailable");
          let grade: EvaluationRevision;
          if (previous && previous.selectionRevision.id === selected.id && previous.value.outcomeId === (outcome?.id ?? null) && contentHash(previous.value.interval) === contentHash(interval)) grade = previous.value;
          else {
            const id = `grade:${contentHash({ selection: selected.id, outcome: outcome?.id ?? null, profile: profile.id, valueKind, interval, predecessorId: previous?.value.id ?? null })}`;
            grade = settleEvaluation({ id, selection, publication, outcome, profile, valueKind, recordedAt: input.asOf, period: opportunity.sourceGameDate.slice(0, 7), rescheduled: epochs.length > 1,
              intervals: interval, prior: previous?.value, selectionRevision: selected, priorSelectionRevision: previous?.selectionRevision,
              correctionReason: previous ? "retained_evidence_updated" : undefined, label: publication && publication.vintage.scoring.id !== profile.id ? "historical_rescore" : "original_scoring" });
            await input.store.appendRecord(grade.id, "evaluation", scope, { type: "grade", value: grade, selectionRevision: selected }, grade.predecessorId);
          }
          allGrades.push(grade);
          const baseline = input.baselines?.find(row => row.vintageId === selection.vintageId);
          if (baseline && publication && outcome) {
            if (targetKey(baseline.target) !== scope || baseline.inputCutoffAt !== publication.vintage.inputCutoffAt) throw new Error("prepared_baseline_scope_mismatch");
            for (const [name, values] of [["last_five", baseline.lastFive], ["season_rate", baseline.seasonRate]] as const) matched.push({ evaluationId: grade.id, valueKind, evidenceClass: input.evidenceClass, name, selectedVintageId: publication.vintage.id, inputCutoffAt: baseline.inputCutoffAt, target, profileId: profile.id, outcomeId: outcome.id, value: valueKind === "FP" ? scoreMeans(values, profile) : values[valueKind] });
          }
        }
      }
    }
  }
  for (const profile of input.profiles) context.accountabilityByProfile![profile.id] = buildAccountability({ evaluations: allGrades, publications: allPublications, baselines: matched, profile, evidenceClass: input.evidenceClass });
  context.accountability = context.accountabilityByProfile![DEFAULT_SCORING.id];
  context.id = `context:${contentHash({ ...context, id: null })}`;
  if (Buffer.byteLength(JSON.stringify(context)) > 2 * 1024 * 1024) throw new Error("prepared_context_capacity_exceeded");
  // The store atomically rechecks this predecessor and strictly increasing asOf at publication.
  // A losing worker must reload/reprepare; it must not retry by merely changing its predecessor.
  if (context.id !== input.previous?.id) await input.store.appendRecord(context.id, "read_context", `player:${input.player.id}`, context, input.previous?.id ?? null);
  return context;
}

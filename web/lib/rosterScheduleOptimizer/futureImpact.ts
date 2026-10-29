import { validForecastCalendarPolicy, type ForecastCalendarPolicy } from "../player-forecasts/contributions";
import { evaluateScenarioPlan, LATER_IMPACT_USE, scheduleAdmissionProblem } from "./planning";
import { localDate } from "./planningDates";
import { buildTimeline } from "./planningTimeline";
import { providerListsOut } from "./retention";
import type { GameForecast, PlanEvaluation, PlanIntent, PlanStep, PlanningGame, PlanningSnapshot, RosterEntry, StatLine } from "./planningTypes";

/** VORP S2: later-period impact ΔF under `S3-SCENARIO-CONTRACT.md` v2. Pure and offline: every input is supplied by the
 * caller, nothing is loaded, and no clock is read. Informational only; it never feeds weekly gain, ranking or pruning. */
export const LATER_IMPACT_CONTRACT = { name: "rso-later-impact-rate-scenario", version: "v2", accepted: false } as const;
export const LATER_IMPACT_RATE_POLICY = "last-available-line-per-game";
/** Provisional offline ceiling on issue and input age (§3); inclusive, on UTC instants. */
export const MAX_SOURCE_AGE_MS = 8 * 24 * 3600000;
export const ASSUMED_PERIOD_LABEL = "assumed period, not league-confirmed";

export type LaterImpactState = "complete" | "complete_with_assumptions" | "conditional" | "unknown"
  | "outside_scenario_horizon" | "temporal_provenance_unavailable" | "stale" | "scenario_contract_not_accepted";
/** Weakest last. The delta takes the weaker state of its two arms. */
const STRENGTH: LaterImpactState[] = ["complete", "complete_with_assumptions", "conditional", "unknown", "stale",
  "temporal_provenance_unavailable", "outside_scenario_horizon", "scenario_contract_not_accepted"];
export const weakerState = <S extends LaterImpactState>(a: S, b: S): S => STRENGTH.indexOf(a) >= STRENGTH.indexOf(b) ? a : b;
const numeric = (state: LaterImpactState) => state === "complete" || state === "complete_with_assumptions";
const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);
const DAY_MS = 86400000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date;
const datesBetween = (start: string, end: string) => { const out: string[] = []; for (let date = start; date <= end; date = addDays(date, 1)) out.push(date); return out; };

// ---------------------------------------------------------------- §2 the later period F and its horizon bound
export type LeaguePeriod = { id: string; leagueKey: string; seasonId: number; startDate: string; endDate: string };
export type LaterPeriodInput = {
  window: { startDate: string; endDate: string };
  decisionAsOf: string;
  /** League time zone and date convention. */
  timeZone: string;
  /** The workspace's league; every actual period must carry this exact identity. */
  leagueKey: string;
  season: { id: number; startDate: string; endDate: string };
  /** Captured at decision time and saved with the scenario. */
  calendarPolicy: ForecastCalendarPolicy;
  /** Actual league/provider matchup periods; null or empty when none is available. */
  periods: LeaguePeriod[] | null;
};
export type LaterPeriod = { state: "ok" | "unknown" | "outside_scenario_horizon"; reason: string | null;
  kind: "actual" | "assumed" | null; periodId: string | null; label: string | null; dates: string[];
  bound: { first: string; last: string } | null; calendarPolicy: ForecastCalendarPolicy };

export function resolveLaterPeriod(input: LaterPeriodInput): LaterPeriod {
  const result = (state: LaterPeriod["state"], reason: string | null, rest: Partial<LaterPeriod> = {}): LaterPeriod =>
    ({ state, reason, kind: null, periodId: null, label: null, dates: [], bound: null, calendarPolicy: input.calendarPolicy, ...rest });
  if (!validForecastCalendarPolicy(input.calendarPolicy)) return result("unknown", "invalid_calendar_policy");
  const decision = Date.parse(input.decisionAsOf);
  if (!Number.isFinite(decision)) return result("unknown", "invalid_decision_clock");
  const { startDate, endDate } = input.window;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return result("unknown", "invalid_window");
  let chosen: Pick<LaterPeriod, "kind" | "periodId" | "label" | "dates">;
  const periods = input.periods ?? [];
  if (periods.some(period => period.leagueKey !== input.leagueKey)) return result("unknown", "league_identity_mismatch");
  const later = periods.filter(period => period.startDate > endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (later.length) {
    const first = later[0];
    if (later.some(period => period !== first && period.startDate === first.startDate)) return result("unknown", "ambiguous_period");
    if (!validDate(first.startDate) || !validDate(first.endDate) || first.startDate > first.endDate) return result("unknown", "invalid_period");
    chosen = { kind: "actual", periodId: first.id, label: null, dates: datesBetween(first.startDate, first.endDate) };
    if (first.seasonId !== input.season.id) return result("outside_scenario_horizon", "season_boundary", chosen);
  } else chosen = { kind: "assumed", periodId: null, label: ASSUMED_PERIOD_LABEL, dates: datesBetween(addDays(endDate, 1), addDays(endDate, 7)) };
  if (chosen.dates[0] <= endDate && chosen.dates[chosen.dates.length - 1] >= startDate) return result("unknown", "overlaps_window", chosen);
  // Where the league-local and UTC decision dates differ, the stricter reading applies to each end of the bound.
  const utc = new Date(decision).toISOString().slice(0, 10), local = localDate(input.decisionAsOf, input.timeZone);
  const bound = { first: utc > local ? utc : local, last: addDays(utc < local ? utc : local, input.calendarPolicy.calendarDays - 1) };
  // Actual dates are kept as they are: no clipping, no relabelled slice and no fallback in their place.
  if (chosen.dates.some(date => date < bound.first || date > bound.last)) return result("outside_scenario_horizon", "beyond_calendar_policy", { ...chosen, bound });
  if (chosen.dates.some(date => date < input.season.startDate || date > input.season.endDate)) return result("outside_scenario_horizon", "season_boundary", { ...chosen, bound });
  return result("ok", null, { ...chosen, bound });
}

// ---------------------------------------------------------------- §3 source admission, timing and age
export type ScenarioSourceRow = {
  playerId: string; runId: string; slateDate: string; basisGameId: string; teamAbbreviation: string; seasonId: number;
  /** Checksum of the exact selected row bytes; it must equal the capture receipt's entry for the same identity. */
  checksum: string; modelVersion: string; bridgeVersion: string;
  admission: { succeeded: boolean; public: boolean; released: boolean; horizonGames: number; exclusionProof: boolean };
  timing: { inputCutoff: string | null; issuedAt: string | null; reconstruction: boolean };
  /** Exact-output availability witness (contract v2 §3). Only `observed_capture` is implementable; a run finish time,
   * `updated_at` or run status never proves the selected bytes existed at a past time. */
  witness: { kind: "observed_capture"; receiptId: string } | { kind: "immutable_publication"; version: string | null }
    | { kind: "finished_at" | "updated_at" | "run_status"; at: string | null } | null;
  /** Established positively from the source's conditioning field; a missing tag is unknown, never unconditional. */
  conditioning?: "unconditional" | "conditional" | null;
  /** Native per-game components in native units; null is missing, never zero. */
  components: StatLine;
  units: Record<string, string>;
  /** A reserve conservative zero: a labelled assumption, never evidence of absence. Its conditional line stays beside it. */
  reserveZero?: { conditionalLine: StatLine };
};
/** A trusted server-side read of the exact admitted output rows, completed before the decision (v2 `observed_capture`).
 * The set checksum is carried and saved; its hashing scheme belongs to the S3 capture, so it is not recomputed here. */
export type CaptureReceipt = { id: string; kind: "observed_capture"; trustedSource: string | null; startedAt: string; completedAt: string;
  rows: Array<{ runId: string; slateDate: string; basisGameId: string; playerId: string; horizonGames: number; components: string[]; checksum: string }>;
  setChecksum: string | null;
  bindings: { runSucceeded: boolean; admission: boolean; identity: boolean; conditioning: boolean; proof: boolean } };
export type TimingCheck = { state: "ok" | "unknown" | "temporal_provenance_unavailable" | "stale";
  /** Every applicable reason code; the state is the weakest of them (§5). */
  reasons: string[]; availableAt: string | null; receipt: CaptureReceipt | null; issueAgeMs: number | null; inputAgeMs: number | null };
const TPU = "temporal_provenance_unavailable";
/** "ok" is weaker than nothing; any other pair takes the weaker state. */
const weakerTiming = (a: TimingCheck["state"], b: TimingCheck["state"]): TimingCheck["state"] => a === "ok" ? b : b === "ok" ? a : weakerState(a, b);

export function sourceTiming(row: ScenarioSourceRow, decisionAsOf: string, captures: CaptureReceipt[]): TimingCheck {
  const found: Array<[TimingCheck["state"], string]> = [];
  const add = (state: TimingCheck["state"], reason: string) => found.push([state, reason]);
  if (row.timing.reconstruction) add("unknown", "historical_reconstruction_excluded");
  const parse = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
  const cutoff = parse(row.timing.inputCutoff), issued = parse(row.timing.issuedAt), decision = Date.parse(decisionAsOf);
  let available = NaN, receipt: CaptureReceipt | null = null;
  const witness = row.witness;
  if (!witness) add(TPU, "missing_witness");
  else if (witness.kind === "immutable_publication") add(TPU, "immutable_publication_unavailable");
  else if (witness.kind !== "observed_capture") add(TPU, "no_exact_output_witness");
  else if (!(receipt = captures.find(item => item.id === witness.receiptId) ?? null)) add(TPU, "missing_receipt");
  else {
    const started = parse(receipt.startedAt), completed = parse(receipt.completedAt);
    if (receipt.kind !== "observed_capture" || !receipt.trustedSource) add(TPU, "untrusted_capture");
    if (!Number.isFinite(started) || !Number.isFinite(completed) || started > completed) add(TPU, "capture_time_invalid");
    // A capture completed after the decision is never backdated; a later recapture never makes it eligible.
    else if ((available = completed) > decision) add(TPU, "capture_after_decision");
    const components = Object.keys(row.components).sort().join("|");
    const listed = receipt.rows.find(item => item.runId === row.runId && item.slateDate === row.slateDate && item.basisGameId === row.basisGameId
      && item.playerId === row.playerId && item.horizonGames === row.admission.horizonGames && [...item.components].sort().join("|") === components);
    if (!listed) add(TPU, "row_not_in_capture");
    else if (listed.checksum !== row.checksum) add(TPU, "checksum_mismatch");
    if (!receipt.setChecksum) add(TPU, "missing_set_checksum");
    if (!Object.values(receipt.bindings).every(Boolean)) add(TPU, "unbound_witness");
  }
  let issueAgeMs: number | null = null, inputAgeMs: number | null = null;
  if (![cutoff, issued, decision].every(Number.isFinite)) add(TPU, "missing_timestamp");
  else {
    if (cutoff > issued || Number.isFinite(available) && issued > available) add(TPU, "timestamps_out_of_order");
    issueAgeMs = decision - issued; inputAgeMs = decision - cutoff;
    if (issueAgeMs > MAX_SOURCE_AGE_MS) add("stale", "issue_age_exceeded");
    if (inputAgeMs > MAX_SOURCE_AGE_MS) add("stale", "input_age_exceeded");
  }
  const state = found.reduce<TimingCheck["state"]>((worst, [next]) => weakerTiming(worst, next), "ok");
  return { state, reasons: found.map(([, reason]) => reason), availableAt: Number.isFinite(available) ? new Date(available).toISOString() : null,
    receipt, issueAgeMs, inputAgeMs };
}
const admitted = (row: ScenarioSourceRow) => row.admission.succeeded && row.admission.public && row.admission.released
  && row.admission.horizonGames === 1 && row.admission.exclusionProof;

/** Among admitted rows with a valid exact-output witness, the greatest `availableAt` at or before the decision; ties by
 * (`issuedAt`, `runId`, basis game). Never by slate order. Age ceilings then apply to the selected row. */
export function selectSourceRow(rows: ScenarioSourceRow[], decisionAsOf: string, captures: CaptureReceipt[]): { row: ScenarioSourceRow | null; timing: TimingCheck } {
  const none = (state: TimingCheck["state"], reasons: string[]) => ({ row: null, timing: { state, reasons, availableAt: null, receipt: null, issueAgeMs: null, inputAgeMs: null } });
  const candidates = rows.filter(admitted);
  if (!candidates.length) return none("unknown", [rows.length ? "source_not_admitted" : "no_source_row"]);
  const checked = candidates.map(row => ({ row, timing: sourceTiming(row, decisionAsOf, captures) }));
  const valid = checked.filter(item => item.timing.state === "ok" || item.timing.state === "stale");
  if (!valid.length) return none(checked.reduce<TimingCheck["state"]>((worst, item) => weakerTiming(worst, item.timing.state), "unknown"),
    [...new Set(checked.flatMap(item => item.timing.reasons))].sort());
  const key = (item: (typeof valid)[number]) => [Date.parse(item.timing.availableAt!), Date.parse(item.row.timing.issuedAt!)] as const;
  valid.sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]
    || b.row.runId.localeCompare(a.row.runId) || b.row.basisGameId.localeCompare(a.row.basisGameId));
  return valid[0];
}

// ---------------------------------------------------------------- §6 boundary rosters
const FAR_FUTURE = "9999-12-31T23:59:59Z";
/** The roster after plan P (its legal steps applied, a chain ending on its last held streamer) and after no move N. Both frozen. */
export function boundaryRosters(snapshot: PlanningSnapshot, intent: PlanIntent, steps: PlanStep[]) {
  const toRoster = (members: ReturnType<ReturnType<typeof buildTimeline>["at"]>): RosterEntry[] =>
    [...members.values()].map(({ playerId, position }) => ({ playerId, position })).sort((a, b) => a.playerId.localeCompare(b.playerId));
  const plan = buildTimeline(snapshot, intent, steps), noMove = buildTimeline(snapshot, intent, []);
  const planRoster = toRoster(plan.at(FAR_FUTURE)), noMoveRoster = toRoster(noMove.at(FAR_FUTURE));
  return { plan: planRoster, noMove: noMoveRoster, legal: plan.legal && noMove.legal, limitations: [...new Set([...plan.limitations, ...noMove.limitations])] };
}

// ---------------------------------------------------------------- §4–§5 arms, coverage and aggregation
export type LaterSchedule = { startDate: string; endDate: string; completeness: "complete" | "partial" | "unknown";
  /** Verified off-day evidence for the same full F. */
  offDaysVerified: boolean; asOf: string | null; revision: string; games: PlanningGame[] };
export type TeamMembership = { teamAbbreviation: string | null; verified: boolean; asOf: string };
export type LaterImpactInput = {
  snapshot: PlanningSnapshot; intent: PlanIntent; steps: PlanStep[];
  period: Omit<LaterPeriodInput, "decisionAsOf" | "timeZone" | "leagueKey"> & { decisionAsOf: string };
  schedule: LaterSchedule;
  membership: Record<string, TeamMembership>;
  sourceRows: ScenarioSourceRow[];
  captures: CaptureReceipt[];
};
export type CategoryLine = { numerator: number | null; denominator: number | null; value: number | null };
type Missing = { playerId: string; gameId: string | null; key: string | null; reason: string };
export type LaterImpactArm = {
  state: LaterImpactState; reasons: string[]; assumptions: string[]; roster: RosterEntry[];
  /** Whole-roster F points; null unless the arm is complete or complete with assumptions. */
  points: number | null;
  /** Native component totals (categories: numerators and denominators), same rule as `points`. */
  components: StatLine | null;
  categories: Array<{ key: string } & CategoryLine> | null;
  coverage: { requiredOpportunities: number; knownOpportunities: number; noGamePlayers: string[]; notInLineup: string[]; missing: Missing[] };
  conditionalLines: Record<string, StatLine>;
  lineup: Array<{ date: string; playerId: string; slotId: string }>;
  limitations: string[];
};
export type LaterImpactResult = {
  contract: { name: string; version: string }; use: typeof LATER_IMPACT_USE; ratePolicy: typeof LATER_IMPACT_RATE_POLICY;
  state: LaterImpactState; reasons: string[]; assumptions: string[]; decisionAsOf: string | null; period: LaterPeriod | null;
  /** ΔF = value(P, F) − value(N, F). Categories give native component deltas and pooled ratios, never a scalar. */
  delta: { points: number | null; components: StatLine | null; categories: Array<{ key: string; plan: CategoryLine; noMove: CategoryLine; delta: CategoryLine }> | null } | null;
  arms: { plan: LaterImpactArm; noMove: LaterImpactArm } | null;
  provenance: Array<{ playerId: string; runId: string; slateDate: string; basisGameId: string; teamAbbreviation: string; seasonId: number;
    checksum: string; issuedAt: string | null; inputCutoff: string | null; reconstruction: boolean;
    witness: { kind: "observed_capture"; label: "observed available by"; availableAt: string; receiptId: string; trustedSource: string;
      captureStartedAt: string; captureCompletedAt: string; setChecksum: string; bindings: CaptureReceipt["bindings"] };
    modelVersion: string; bridgeVersion: string; conditioning: string | null; units: Record<string, string> }>;
  /** §2.6: (a) within the bound and (b) scenario inputs complete are claimed separately; (c) native F forecasts never are. */
  claims: { withinBound: boolean; scenarioInputsComplete: boolean; nativeForecasts: false; basis: "rate_scenario"; label: string };
  context: { schedule: { revision: string; asOf: string | null } | null; calendarPolicy: ForecastCalendarPolicy | null; limitations: string[] };
};
/** In-memory scenario row: keeps its real conditioning and is permitted only inside the scenario entry point. */
type ScenarioForecast = Omit<GameForecast, "conditioning"> & { conditioning: "unconditional" | "conditional"; scenarioUse: typeof LATER_IMPACT_USE };
const RATE_SCENARIO_LABEL = "Rate scenario: eligible decision-time basis rates applied to F under fixed rosters and stationary rates; not native F forecasts.";
const LIMITATIONS = ["Fixed boundary rosters: no transactions in the later period.",
  "Informational only: never added to weekly gain, ranking, sorting or pruning; no calibration or accuracy claim."];

function blocked(state: LaterImpactState, reasons: string[], period: LaterPeriod | null, decisionAsOf: string | null): LaterImpactResult {
  return { contract: { name: LATER_IMPACT_CONTRACT.name, version: LATER_IMPACT_CONTRACT.version }, use: LATER_IMPACT_USE, ratePolicy: LATER_IMPACT_RATE_POLICY,
    state, reasons, assumptions: [], decisionAsOf, period, delta: null, arms: null, provenance: [],
    claims: { withinBound: period?.state === "ok", scenarioInputsComplete: false, nativeForecasts: false, basis: "rate_scenario", label: RATE_SCENARIO_LABEL },
    context: { schedule: null, calendarPolicy: period?.calendarPolicy ?? null, limitations: LIMITATIONS } };
}

/** App path. Until the forecast lead accepts the contract this is always `scenario_contract_not_accepted`, before any input is read. */
export function laterImpactForApp(): LaterImpactResult {
  return blocked("scenario_contract_not_accepted", ["scenario_contract_not_accepted"], null, null);
}

/** `offlineFixture` lets S2's synthetic tests exercise the engine; it is no acceptance and the app never passes it. */
export function evaluateLaterImpact(input: LaterImpactInput, options: { offlineFixture?: true } = {}): LaterImpactResult {
  if (!LATER_IMPACT_CONTRACT.accepted && options.offlineFixture !== true) return laterImpactForApp();
  const { snapshot, intent } = input, decisionAsOf = input.period.decisionAsOf;
  const period = resolveLaterPeriod({ ...input.period, timeZone: snapshot.context.timeZone, leagueKey: snapshot.context.leagueId });
  if (period.state !== "ok") return blocked(period.state, [period.reason!], period, decisionAsOf);
  const assumptions = period.kind === "assumed" ? ["assumed_period_not_league_confirmed"] : [];
  const reasons: string[] = [];
  const schedule = input.schedule;
  // §2.5: complete, fresh schedule with verified off days for the same full F.
  if (schedule.completeness !== "complete" || !schedule.offDaysVerified) reasons.push("schedule_incomplete");
  if (schedule.startDate !== period.dates[0] || schedule.endDate !== period.dates[period.dates.length - 1]) reasons.push("schedule_range_mismatch");
  const rosters = boundaryRosters(snapshot, intent, input.steps);
  if (!rosters.legal) reasons.push("plan_illegal");
  const sources = new Map<string, ReturnType<typeof selectSourceRow>>();
  const source = (playerId: string) => {
    if (!sources.has(playerId)) sources.set(playerId, selectSourceRow(input.sourceRows.filter(row => row.playerId === playerId), decisionAsOf, input.captures));
    return sources.get(playerId)!;
  };
  const base = { ...blocked("unknown", [], period, decisionAsOf), context: { schedule: { revision: schedule.revision, asOf: schedule.asOf },
    calendarPolicy: period.calendarPolicy, limitations: [...LIMITATIONS, ...rosters.limitations] } };
  if (reasons.length) return { ...base, reasons, assumptions };
  const arm = (roster: RosterEntry[]) => evaluateArm(input, period, roster, source, assumptions);
  let plan = arm(rosters.plan), noMove = arm(rosters.noMove);
  // A coherent set of rows is claimed only when one capture receipt covers every selected row.
  if (new Set([...sources.values()].flatMap(({ row, timing }) => row && timing.receipt ? [timing.receipt.id] : [])).size > 1) {
    const incoherent = (side: LaterImpactArm): LaterImpactArm => ({ ...side, state: weakerState(side.state, TPU),
      reasons: [...side.reasons, "capture_not_coherent"].sort(), points: null, components: null, categories: null });
    plan = incoherent(plan); noMove = incoherent(noMove);
  }
  const state = weakerState(plan.state, noMove.state);
  const provenance = [...sources.values()].flatMap(({ row, timing }) => row && timing.receipt ? [{ playerId: row.playerId, runId: row.runId,
    slateDate: row.slateDate, basisGameId: row.basisGameId, teamAbbreviation: row.teamAbbreviation, seasonId: row.seasonId, checksum: row.checksum,
    issuedAt: row.timing.issuedAt, inputCutoff: row.timing.inputCutoff, reconstruction: row.timing.reconstruction,
    witness: { kind: "observed_capture" as const, label: "observed available by" as const, availableAt: timing.availableAt!, receiptId: timing.receipt.id,
      trustedSource: timing.receipt.trustedSource!, captureStartedAt: timing.receipt.startedAt, captureCompletedAt: timing.receipt.completedAt,
      setChecksum: timing.receipt.setChecksum!, bindings: { ...timing.receipt.bindings } },
    modelVersion: row.modelVersion, bridgeVersion: row.bridgeVersion, conditioning: row.conditioning ?? null, units: { ...row.units } }] : [])
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
  const merged = [...new Set([...plan.assumptions, ...noMove.assumptions])].sort();
  const result: LaterImpactResult = { ...base, state, assumptions: numeric(state) ? merged : [],
    reasons: [...plan.reasons.map(reason => `plan:${reason}`), ...noMove.reasons.map(reason => `no_move:${reason}`)],
    delta: null, arms: { plan, noMove }, provenance, claims: { ...base.claims, scenarioInputsComplete: numeric(state) } };
  if (!numeric(state)) return result;
  // Both arms are numeric here, so every required total is known; there are no partial totals.
  const diff = (a: number | null, b: number | null) => finite(a) && finite(b) ? a - b : null;
  const components = Object.fromEntries(Object.keys({ ...plan.components, ...noMove.components }).sort()
    .map(key => [key, diff(plan.components![key] ?? null, noMove.components![key] ?? null)]));
  const categories = plan.categories && noMove.categories ? plan.categories.map(({ key, ...left }) => {
    const right = noMove.categories!.find(row => row.key === key)!;
    return { key, plan: left, noMove: { numerator: right.numerator, denominator: right.denominator, value: right.value },
      delta: { numerator: diff(left.numerator, right.numerator), denominator: diff(left.denominator, right.denominator), value: diff(left.value, right.value) } };
  }) : null;
  return { ...result, delta: { points: snapshot.rules.scoring.mode === "points" ? diff(plan.points, noMove.points) : null, components, categories } };
}

/** The private scenario adapter: an in-memory derived snapshot (context = F) and marked rows, scored by the existing evaluator. */
function evaluateArm(input: LaterImpactInput, period: LaterPeriod, roster: RosterEntry[],
  source: (playerId: string) => ReturnType<typeof selectSourceRow>, periodAssumptions: string[]): LaterImpactArm {
  const { snapshot, schedule } = input, decisionAsOf = input.period.decisionAsOf;
  const reasons = new Set<string>(), assumptions = new Set(periodAssumptions), missing: Missing[] = [];
  const conditionalLines: Record<string, StatLine> = {}, noGamePlayers: string[] = [], notInLineup: string[] = [];
  let state: LaterImpactState = "complete";
  const weaken = (next: LaterImpactState, reason: string, item?: Missing) => { state = weakerState(state, next); reasons.add(reason); if (item) missing.push(item); };
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const first = period.dates[0], last = period.dates[period.dates.length - 1];
  const scoring = snapshot.rules.scoring;
  const leagueKeys = scoring.mode === "points" ? Object.entries(scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key)
    : [...new Set(scoring.categories.flatMap(category => [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]))];
  const forecasts: ScenarioForecast[] = [];
  for (const entry of roster) {
    const player = players.get(entry.playerId);
    if (!player) { weaken("unknown", `unknown_player:${entry.playerId}`, { playerId: entry.playerId, gameId: null, key: null, reason: "unknown_player" }); continue; }
    // §2.5: current verified membership for every boundary-roster player; never rebuilt from a later roster.
    const member = input.membership[player.id];
    if (!member?.verified || !member.teamAbbreviation) { weaken("unknown", `membership_unverified:${player.id}`); continue; }
    if (!(Date.parse(member.asOf) <= Date.parse(decisionAsOf))) { weaken("unknown", `membership_after_decision:${player.id}`); continue; }
    if (member.teamAbbreviation !== player.teamAbbreviation) { weaken("unknown", `team_mismatch:${player.id}`); continue; }
    if (["IR", "IR+", "NA"].includes(entry.position) || providerListsOut(player)) { notInLineup.push(player.id); continue; }
    const games = schedule.games.filter(game => game.teamAbbreviation === member.teamAbbreviation && game.status === "scheduled" && game.date >= first && game.date <= last);
    // A verified no-game opportunity (complete schedule, off days verified) is not missing data.
    if (!games.length) { noGamePlayers.push(player.id); continue; }
    const { row, timing } = source(player.id);
    // Every reason code is kept; the arm's state is the weakest of them.
    if (!row) {
      // No row with an "ok" timing is an invariant breach (selection never returns it); it is unknown, never complete.
      if (timing.state === "ok") { weaken("unknown", `selection_invariant_breach:${player.id}`, { playerId: player.id, gameId: null, key: null, reason: "selection_invariant_breach" }); continue; }
      for (const reason of timing.reasons) weaken(timing.state, `${reason}:${player.id}`, { playerId: player.id, gameId: null, key: null, reason });
      continue;
    }
    if (timing.state !== "ok") { for (const reason of timing.reasons) weaken(timing.state, `${reason}:${player.id}`); continue; }
    if (row.teamAbbreviation !== member.teamAbbreviation || row.seasonId !== input.period.season.id) { weaken("unknown", `team_mismatch:${player.id}`); continue; }
    if (row.conditioning !== "unconditional" && row.conditioning !== "conditional") { weaken("unknown", `conditioning_unknown:${player.id}`); continue; }
    // Goalies are conditional or unknown: no extrapolated starter probability, no one start per game, no zero fill.
    const conditioning = player.playerClass === "goalie" ? "conditional" : row.conditioning;
    if (conditioning === "conditional") weaken("conditional", `conditional_line:${player.id}`);
    let stats = { ...row.components };
    if (row.reserveZero) {
      assumptions.add(`reserve_conservative_zero:${player.id}`);
      conditionalLines[player.id] = { ...row.reserveZero.conditionalLine };
      stats = Object.fromEntries([...new Set([...Object.keys(row.components), ...Object.keys(row.reserveZero.conditionalLine), ...leagueKeys])].map(key => [key, 0]));
    }
    for (const game of games) forecasts.push({ playerId: player.id, gameId: game.id, stats: { ...stats }, conditioning,
      scenarioUse: LATER_IMPACT_USE, allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false },
      startProbability: null, confirmedStart: false, revisionId: row.runId, issuedAt: row.timing.issuedAt!, modelVersion: row.modelVersion, limitations: [] });
  }
  const keys = leagueKeys;
  const minimum = snapshot.rules.goalieMinimum;
  const derived: PlanningSnapshot = { ...snapshot, id: `${snapshot.id}:later-impact`, roster,
    context: { ...snapshot.context, startDate: first, endDate: last, asOf: decisionAsOf },
    games: schedule.games, forecasts: forecasts as unknown as GameForecast[], lockedAssignments: [], pastLineups: undefined,
    baselineSources: undefined, participationSources: undefined, forecastManifest: undefined, forecastInputExclusions: undefined,
    // F starts from nothing banked, its own goalie-minimum period and no opponent.
    realized: Object.fromEntries(keys.map(key => [key, 0])), opponent: null,
    rules: { ...snapshot.rules, goalieMinimum: { ...minimum, credited: minimum.required === null ? null : 0, periodStart: first, periodEnd: addDays(last, 1) } },
    evidence: { ...snapshot.evidence, schedule: { source: `later-impact schedule ${schedule.revision}`, asOf: schedule.asOf,
      seasonId: input.period.season.id, completeness: schedule.completeness, limitations: [] } } };
  const scheduleProblem = scheduleAdmissionProblem(derived);
  if (scheduleProblem) weaken("unknown", "schedule_stale");
  const evaluation: PlanEvaluation = evaluateScenarioPlan(derived, input.intent, "outcome", LATER_IMPACT_USE);
  if (!evaluation.legal) weaken("unknown", "evaluator_illegal");
  const coverage = evaluation.recommendation?.coverage;
  // The evaluator's own coverage names every required component per opportunity. A conditional line with the component
  // present stays conditional; anything else is missing. Identical gaps in P and N never cancel: each arm is weakened.
  for (const row of coverage?.exclusions ?? []) {
    const line = forecasts.find(item => item.playerId === row.playerId && item.gameId === row.gameId);
    if (line?.conditioning === "conditional" && finite(line.stats[row.targetKey])) weaken("conditional", `conditional_line:${row.playerId}`);
    else weaken("unknown", `missing_component:${row.playerId}:${row.targetKey}`, { playerId: row.playerId, gameId: row.gameId, key: row.targetKey, reason: row.reasons.join("+") });
  }
  if (scoring.mode === "categories") assumptions.add("category_lineup_schedule_capacity");
  const categories = scoring.mode === "categories" ? scoring.categories.map(category => ({ key: category.key,
    numerator: evaluation.projectedStats[category.numerator ?? category.key] ?? null,
    denominator: category.denominator ? evaluation.projectedStats[category.denominator] ?? null : null,
    value: evaluation.categoryResults.find(row => row.key === category.key)?.own ?? null })) : null;
  const totalsKnown = scoring.mode === "points" ? finite(evaluation.projectedValue)
    : keys.every(key => finite(evaluation.projectedStats[key])) && categories!.every(row => finite(row.value));
  if (state === "complete" && !totalsKnown) weaken("unknown", "evaluator_total_unavailable");
  if (numeric(state) && assumptions.size) state = "complete_with_assumptions";
  const show = numeric(state);
  return { state, reasons: [...reasons].sort(), assumptions: [...assumptions].sort(), roster,
    points: show && scoring.mode === "points" ? evaluation.projectedValue : null,
    components: show ? Object.fromEntries(keys.map(key => [key, evaluation.projectedStats[key] ?? null])) : null,
    categories: show ? categories : null,
    coverage: { requiredOpportunities: coverage?.requiredCount ?? 0, knownOpportunities: coverage?.comparisonEligibleCount ?? 0,
      noGamePlayers: noGamePlayers.sort(), notInLineup: notInLineup.sort(), missing },
    conditionalLines, lineup: evaluation.assignments.map(({ date, playerId, slotId }) => ({ date, playerId, slotId })),
    limitations: [...new Set([...(scheduleProblem ? [scheduleProblem] : []), ...evaluation.limitations])] };
}

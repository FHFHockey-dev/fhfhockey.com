import type { SupabaseClient } from "@supabase/supabase-js";

import { BASELINE_CANDIDATE_POLICY as POLICY, baselineDefinitionHash,
  baselineProjectionSchemas, validBaselineSeasonId } from "./baselinePolicy";
import { contributionBundleChecksum, persistContributionBundle,
  type ContributionBundleManifest } from "./contributionStore";
import type { ContributionSource } from "./contributions";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { persistCapturedGoalieBaselineInputs, type CapturedGoalieInput } from "./goalieBaselineInputCapture";
import { deriveNativeGoalieOutcomes, deriveNativeGoalieShutoutCredit, deriveNativeGoalieSummaryWinCredit, type NativeGoalieWinSummary, type NativeGoalieShutoutSummary } from "./nativeGoalieOutcomes";
import { verifyBaselineBoxscoreReceipt } from "./baselineSourceLineage";

export const GOALIE_BASELINE_POLICY_VERSION = "goalie-baseline-rates-v1";
export const NATIVE_GOALIE_WIN_POLICY_VERSION = "native-goalie-appearance-win-rates-v1";
export const NATIVE_GOALIE_WIN_POLICY = Object.freeze({ version: NATIVE_GOALIE_WIN_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes", maximumAppearances: 20,
  target: "WINS_GOALIE", basis: "per_appearance", weighting: "equal",
  missingness: "any_missing_selected_outcome_withholds_rate", prior: "none",
  participation: "not_supplied", populationCoverage: "unverified", shutouts: "unavailable_without_credited_outcome_receipt" });
export const nativeGoalieWinDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_WIN_POLICY, seasonId });
export const NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION = "native-goalie-appearance-summary-win-rates-v1";
export const NATIVE_GOALIE_SUMMARY_WIN_POLICY = Object.freeze({ version: NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes", maximumAppearances: 20,
  target: "WINS_GOALIE", basis: "per_appearance", weighting: "equal",
  source: "official_per_game_summary_credited_wins_crosschecked_final_boxscore",
  missingness: "any_missing_or_conflicting_selected_credit_withholds_rate", prior: "none",
  participation: "not_supplied", populationCoverage: "unverified" });
export const nativeGoalieSummaryWinDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_SUMMARY_WIN_POLICY, seasonId });
export const NATIVE_GOALIE_VOLUME_POLICY_VERSION = "native-goalie-appearance-volume-rates-v1";
export const NATIVE_GOALIE_VOLUME_POLICY = Object.freeze({ version: NATIVE_GOALIE_VOLUME_POLICY_VERSION,
  population: "verified_current_regular_season_positive_minutes", maximumAppearances: 20,
  targets: ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"],
  basis: "per_appearance", weighting: "equal", missingness: "all_four_components_required_on_every_selected_appearance",
  maximumMinutes: 65, prior: "none", participation: "not_supplied", populationCoverage: "unverified" });
export const nativeGoalieVolumeDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_VOLUME_POLICY, seasonId });
export const NATIVE_GOALIE_SHUTOUT_POLICY_VERSION = "native-goalie-appearance-shutout-rates-v1";
export const NATIVE_GOALIE_SHUTOUT_POLICY = Object.freeze({ version: NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
  maximumAppearances: 20, target: "SHUTOUTS_GOALIE", basis: "per_appearance", weighting: "equal",
  source: "official_per_game_summary_credited_shutouts", missingness: "any_missing_or_ambiguous_selected_credit_withholds_rate",
  summaryMaximumDays: 60, summaryMaximumGames: 60, participation: "not_supplied", prior: "none" });
export const nativeGoalieShutoutDefinitionHash = (seasonId: number) => playerForecastSourcePayloadHash({ policy: NATIVE_GOALIE_SHUTOUT_POLICY, seasonId });
const APPEARANCE_TARGETS = POLICY.goalieVolumeTargets;
const START_TARGETS = POLICY.goalieStartTargets;
const validCount = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value >= 0;
const validTime = (value: string) => Number.isFinite(Date.parse(value));

export type GoalieProjectionInput = {
  sourceId: string; sourceRowId: string; seasonId: number; availableAt: string;
  sourceTable?: string;
  sourceContentHash?: string; sourcePayload?: Record<string, any>;
  projectedAppearances: number; projectedStarts: number | null;
  totals: Record<string, number | null | undefined>;
};
export type GoalieAppearanceInput = {
  gameId: number; seasonId: number; gameDate: string; availableAt: string;
  teamId: number; regularSeason: boolean;
  finalBoxscore?: { payloadHash: string; fetchedAt: string };
  saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null;
  toiMinutes: number | null;
};
export type GoalieTargetRate = {
  targetKey: string; basis: "per_appearance" | "per_start"; rate: number;
  consensusRate: number | null; previousSeasonRate: number | null;
  sourceRows: Array<{ sourceId: string; rowId: string; availableAt: string }>;
  previousGameIds: number[]; recentGameIds: number[];
  missingSourceIds: string[];
};
export type GoalieBaselineRateSnapshot = {
  policyVersion: typeof GOALIE_BASELINE_POLICY_VERSION | typeof NATIVE_GOALIE_WIN_POLICY_VERSION | typeof NATIVE_GOALIE_VOLUME_POLICY_VERSION | typeof NATIVE_GOALIE_SHUTOUT_POLICY_VERSION | typeof NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION; validation: "unvalidated";
  definitionHash: string;
  playerId: number; nhlPlayerId: number; seasonId: number; cutoffAt: string;
  sourceWatermark: string; targets: GoalieTargetRate[]; limitations: string[];
  missingSourceIds: string[]; missingTargetKeys: string[];
};

/** Volume rates use appearances; outcome counts use starts only when projected starts are explicit. */
export function buildGoalieBaselineRates(input: {
  playerId: number; nhlPlayerId: number; seasonId: number; cutoffAt: string;
  sourceWatermark: string; projections: GoalieProjectionInput[]; appearances: GoalieAppearanceInput[];
  limitations?: string[];
}): GoalieBaselineRateSnapshot {
  if (!Number.isSafeInteger(input.playerId) || input.playerId <= 0
    || !Number.isSafeInteger(input.nhlPlayerId) || input.nhlPlayerId <= 0
    || !validBaselineSeasonId(input.seasonId)
    || !Number.isFinite(Date.parse(input.cutoffAt)) || !input.sourceWatermark) {
    throw new Error("Goalie baseline identity and cutoff are required.");
  }
  const schemas = new Map(baselineProjectionSchemas("goalie", input.seasonId).map(row => [row.id, row]));
  const projections = input.projections.filter((row) => row.seasonId === input.seasonId
    && !!schemas.get(row.sourceId)?.tableName
    && (row.sourceTable == null || row.sourceTable === schemas.get(row.sourceId)?.tableName)
    && Number.isFinite(Date.parse(row.availableAt))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && Number.isFinite(row.projectedAppearances) && row.projectedAppearances > 0
    && row.projectedAppearances <= POLICY.maximumGoalieProjectedAppearances);
  if (new Set(projections.map((row) => row.sourceId)).size !== projections.length) {
    throw new Error("Goalie baseline requires one row per approved source.");
  }
  const appearances = input.appearances.filter((row) => row.regularSeason
    && [input.seasonId, input.seasonId - 10001].includes(row.seasonId)
    && Number.isFinite(Date.parse(row.availableAt))
    && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && (row.gameDate < input.cutoffAt.slice(0, 10)
      || row.gameDate === input.cutoffAt.slice(0, 10)
        && !!row.finalBoxscore && /^[a-f0-9]{64}$/i.test(row.finalBoxscore.payloadHash)
        && validTime(row.finalBoxscore.fetchedAt)
        && Date.parse(row.finalBoxscore.fetchedAt) <= Date.parse(input.cutoffAt)))
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  if (new Set(appearances.map((row) => row.gameId)).size !== appearances.length) {
    throw new Error("Goalie baseline appearances must have unique games.");
  }
  const previous = appearances.filter((row) => row.seasonId === input.seasonId - 10001)
    .slice(0, POLICY.previousAppearanceWindow);
  const recent = appearances.filter((row) => row.seasonId === input.seasonId)
    .slice(0, POLICY.recentAppearanceWindow);
  const targets: GoalieTargetRate[] = [];
  for (const targetKey of [...APPEARANCE_TARGETS, ...START_TARGETS]) {
    const basis = (START_TARGETS as readonly string[]).includes(targetKey) ? "per_start" : "per_appearance";
    const rows = projections.filter((row) => schemas.get(row.sourceId)!.statMappings
      .some(mapping => mapping.key === targetKey) && validCount(row.totals[targetKey])
      && (basis === "per_appearance" || !!schemas.get(row.sourceId)!.startColumn && row.projectedStarts != null
        && Number.isFinite(row.projectedStarts) && row.projectedStarts > 0
        && row.projectedStarts <= row.projectedAppearances));
    const rates = rows.map((row) => ({ row, rate: row.totals[targetKey]!
      / (basis === "per_start" ? row.projectedStarts! : row.projectedAppearances) }))
      .filter((item) => basis !== "per_start" || item.rate <= 1);
    const sourceRates = rates.map((item) => item.rate);
    const consensusRate = sourceRates.length
      ? sourceRates.reduce((sum, value) => sum + value, 0) / sourceRates.length : null;
    const value = (row: GoalieAppearanceInput) => targetKey === "SAVES_GOALIE" ? row.saves
      : targetKey === "GOALS_AGAINST_GOALIE" ? row.goalsAgainst
        : targetKey === "GOALIE_MINUTES" ? row.toiMinutes : row.shotsAgainst;
    const previousRows = basis === "per_appearance" ? previous.filter((row) => validCount(value(row))) : [];
    const previousSeasonRate = previousRows.length
      ? previousRows.reduce((sum, row) => sum + value(row)!, 0) / previousRows.length : null;
    if (consensusRate == null && previousSeasonRate == null) continue;
    const prior = consensusRate != null && previousSeasonRate != null
      ? POLICY.projectionPriorWeight * consensusRate + POLICY.historyPriorWeight * previousSeasonRate
      : consensusRate ?? previousSeasonRate!;
    let recentWeighted = 0;
    let recentWeight = 0;
    const recentGameIds: number[] = [];
    if (basis === "per_appearance") for (const [index, row] of recent.entries()) {
      const observation = value(row);
      if (!validCount(observation)) continue;
      const weight = POLICY.recentDecay ** index;
      recentWeighted += weight * observation;
      recentWeight += weight;
      recentGameIds.push(row.gameId);
    }
    targets.push({ targetKey, basis,
      rate: (POLICY.priorAppearanceWeight * prior + recentWeighted)
        / (POLICY.priorAppearanceWeight + recentWeight),
      consensusRate, previousSeasonRate,
      sourceRows: rates.map(({ row }) => ({ sourceId: row.sourceId,
        rowId: row.sourceRowId, availableAt: row.availableAt })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      previousGameIds: previousRows.map((row) => row.gameId), recentGameIds,
      missingSourceIds: POLICY.sourceIds.goalie.filter(id => !rates.some(item => item.row.sourceId === id)) });
  }
  return { policyVersion: GOALIE_BASELINE_POLICY_VERSION, validation: "unvalidated",
    definitionHash: baselineDefinitionHash("goalie", input.seasonId),
    playerId: input.playerId, nhlPlayerId: input.nhlPlayerId, seasonId: input.seasonId,
    cutoffAt: input.cutoffAt, sourceWatermark: input.sourceWatermark, targets,
    missingSourceIds: POLICY.sourceIds.goalie.filter(id => !projections.some(row => row.sourceId === id)),
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS]
      .filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Goalie rates are unvalidated. Starts and appearances have separate denominators.",
      "Historical game logs do not establish starts, wins or shutouts; those start rates use public projection totals only.",
      "Save percentage and GAA require aggregate saves/shots and goals-against/TOI components; they are not direct baseline targets.",
      "Missing projection sources are renormalized per target; missing ability priors leave targets unavailable.",
      `Candidate definition: ${baselineDefinitionHash("goalie", input.seasonId)}.`, ...(input.limitations ?? [])] };
}

function currentGoalieAppearanceWindow(input: Parameters<typeof buildGoalieBaselineRates>[0], maximum: number) {
  return input.appearances.filter(row => row.regularSeason && row.seasonId === input.seasonId
    && validTime(row.availableAt) && Date.parse(row.availableAt) <= Date.parse(input.cutoffAt)
    && /^\d{4}-\d{2}-\d{2}$/.test(row.gameDate) && row.gameDate <= input.cutoffAt.slice(0, 10))
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId)
    .slice(0, maximum);
}

/** Explicit native mean of observed win credits, including relief appearances. Never a start probability. */
export function buildNativeGoalieWinRates(input: Parameters<typeof buildGoalieBaselineRates>[0]): GoalieBaselineRateSnapshot {
  if (input.projections.length || input.appearances.length > 200) {
    throw new Error("Native goalie win rates require bounded original appearances without projections.");
  }
  const base = buildGoalieBaselineRates(input);
  const selected = currentGoalieAppearanceWindow(input, NATIVE_GOALIE_WIN_POLICY.maximumAppearances);
  let wins = 0;
  const missingGameIds: number[] = [];
  for (const appearance of selected) {
    // Identity, payload content, positive minutes and capture clocks must remain fatal.
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    try {
      const receipt = deriveNativeGoalieOutcomes({ appearance, nhlPlayerId: input.nhlPlayerId, cutoffAt: input.cutoffAt });
      if (receipt.winCredit === null) missingGameIds.push(appearance.gameId);
      else wins += receipt.winCredit;
    } catch (error) {
      if (!(error instanceof Error) || ![
        "Native goalie outcomes require matching final boxscore and explicit starter/decision evidence.",
        "Incomplete or conflicting boxscore goalie components",
      ].includes(error.message)) throw error;
      missingGameIds.push(appearance.gameId);
    }
  }
  const targets: GoalieTargetRate[] = selected.length && !missingGameIds.length ? [{
    targetKey: "WINS_GOALIE", basis: "per_appearance", rate: wins / selected.length,
    consensusRate: null, previousSeasonRate: null, sourceRows: [], previousGameIds: [],
    recentGameIds: selected.map(row => row.gameId), missingSourceIds: [],
  }] : [];
  return { ...base, policyVersion: NATIVE_GOALIE_WIN_POLICY_VERSION,
    definitionHash: nativeGoalieWinDefinitionHash(input.seasonId), targets, missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Unvalidated current-season observed win credits per positive-minute appearance, including relief; no start or appearance probability is inferred.",
      `Equal-weight mean over ${selected.length} selected captured appearances; historical population coverage is unverified.`,
      "Any missing selected win decision withholds the entire rate; missing decisions are never zero or omitted from the denominator.",
      "Credited shutouts remain unavailable without an explicit credited-outcome source; zero goals against does not establish shutout credit.",
      ...(missingGameIds.length ? [`Win evidence is unavailable for selected games: ${missingGameIds.join(", ")}.`] : []),
      ...(input.limitations ?? [])] };
}

/** Joint appearance population preserves SA=SV+GA and minutes without requiring a prior or any future probability. */
export function buildNativeGoalieVolumeRates(input: Parameters<typeof buildGoalieBaselineRates>[0]): GoalieBaselineRateSnapshot {
  if (input.projections.length || input.appearances.length > 200) {
    throw new Error("Native goalie volume rates require bounded original appearances without projections.");
  }
  const base = buildGoalieBaselineRates(input);
  const selected = currentGoalieAppearanceWindow(input, NATIVE_GOALIE_VOLUME_POLICY.maximumAppearances);
  const totals = { SAVES_GOALIE: 0, GOALS_AGAINST_GOALIE: 0, SHOTS_AGAINST_GOALIE: 0, GOALIE_MINUTES: 0 };
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    const { saves, goalsAgainst, shotsAgainst, toiMinutes } = appearance;
    if (!validCount(saves) || !validCount(goalsAgainst) || !validCount(shotsAgainst)
      || saves + goalsAgainst !== shotsAgainst || !validCount(toiMinutes)
      || toiMinutes <= 0 || toiMinutes > NATIVE_GOALIE_VOLUME_POLICY.maximumMinutes) {
      throw new Error("Native goalie appearance volume requires coherent counts and positive minutes at most 65.");
    }
    totals.SAVES_GOALIE += saves;
    totals.GOALS_AGAINST_GOALIE += goalsAgainst;
    totals.SHOTS_AGAINST_GOALIE += shotsAgainst;
    totals.GOALIE_MINUTES += toiMinutes;
  }
  const targets: GoalieTargetRate[] = selected.length ? Object.entries(totals).map(([targetKey, total]) => ({
    targetKey, basis: "per_appearance", rate: total / selected.length, consensusRate: null,
    previousSeasonRate: null, sourceRows: [], previousGameIds: [], recentGameIds: selected.map(row => row.gameId), missingSourceIds: [],
  })) : [];
  return { ...base, policyVersion: NATIVE_GOALIE_VOLUME_POLICY_VERSION,
    definitionHash: nativeGoalieVolumeDefinitionHash(input.seasonId), targets, missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Unvalidated joint current-season volume means per positive-minute appearance, including relief; no start or appearance probability is inferred.",
      `Equal-weight means over the same ${selected.length} selected captured appearances; historical population coverage is unverified.`,
      "Saves, goals against, shots against and positive TOI minutes require original final-boxscore support on every selected appearance.",
      "Wins and credited shutouts are not volume observations; neither is inferred from goals against or TOI.",
      ...(input.limitations ?? [])] };
}

/** Separate provenance policy; a missing boxscore decision is never interpreted as zero. */
export function buildNativeGoalieSummaryWinRates(input: Parameters<typeof buildGoalieBaselineRates>[0] & {
  winSummary?: NativeGoalieWinSummary;
}): GoalieBaselineRateSnapshot {
  if (input.projections.length || input.appearances.length > 200) throw new Error("Native summary W rates require bounded original appearances without projections.");
  const base = buildGoalieBaselineRates(input), selected = currentGoalieAppearanceWindow(input, 20);
  let wins = 0;
  const missingGameIds: number[] = [];
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    const credit = input.winSummary ? deriveNativeGoalieSummaryWinCredit({ appearance, nhlPlayerId: input.nhlPlayerId,
      cutoffAt: input.cutoffAt, summary: input.winSummary }).winCredit : null;
    if (credit === null) missingGameIds.push(appearance.gameId); else wins += credit;
  }
  const targets: GoalieTargetRate[] = selected.length && !missingGameIds.length ? [{
    targetKey: "WINS_GOALIE", basis: "per_appearance", rate: wins / selected.length,
    consensusRate: null, previousSeasonRate: null, sourceRows: [], previousGameIds: [],
    recentGameIds: selected.map(row => row.gameId), missingSourceIds: [],
  }] : [];
  return { ...base, policyVersion: NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION,
    definitionHash: nativeGoalieSummaryWinDefinitionHash(input.seasonId), targets, missingSourceIds: [],
    missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Unvalidated explicit official-summary W credits per positive-minute appearance, including relief; no participation or start probability inferred.",
      "Every selected appearance requires exact original final-boxscore volume and summary identity/date/TOI/stat agreement; conflicting known decisions withhold the rate.",
      ...(missingGameIds.length ? [`Missing or conflicting selected summary W credits: ${missingGameIds.join(", ")}.`] : []),
      ...(input.limitations ?? [])] };
}

/** Credited SO means over the same positive-minute appearance population, including relief. */
export function buildNativeGoalieShutoutRates(input: Parameters<typeof buildGoalieBaselineRates>[0] & {
  shutoutSummary?: NativeGoalieShutoutSummary;
}): GoalieBaselineRateSnapshot {
  if (input.projections.length || input.appearances.length > 200) throw new Error("Native SO rates require bounded original appearances without projections.");
  const base = buildGoalieBaselineRates(input), selected = currentGoalieAppearanceWindow(input, 20);
  let credits = 0;
  const missingGameIds: number[] = [];
  for (const appearance of selected) {
    verifyBaselineBoxscoreReceipt(appearance, input.nhlPlayerId, input.cutoffAt, "goalie");
    const credit = input.shutoutSummary ? deriveNativeGoalieShutoutCredit({ appearance, nhlPlayerId: input.nhlPlayerId,
      cutoffAt: input.cutoffAt, summary: input.shutoutSummary }).shutoutCredit : null;
    if (credit === null) missingGameIds.push(appearance.gameId); else credits += credit;
  }
  const targets: GoalieTargetRate[] = selected.length && !missingGameIds.length ? [{ targetKey: "SHUTOUTS_GOALIE", basis: "per_appearance",
    rate: credits / selected.length, consensusRate: null, previousSeasonRate: null, sourceRows: [], previousGameIds: [],
    recentGameIds: selected.map(row => row.gameId), missingSourceIds: [] }] : [];
  return { ...base, policyVersion: NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, definitionHash: nativeGoalieShutoutDefinitionHash(input.seasonId),
    targets, missingSourceIds: [], missingTargetKeys: [...APPEARANCE_TARGETS, ...START_TARGETS].filter(key => !targets.some(row => row.targetKey === key)).sort(),
    limitations: ["Unvalidated explicit official credited shutouts per selected positive-minute appearance; no GA=0 inference or participation probability.",
      "The original full summary page is exposed; only approved game IDs bound to original boxscore appearances enter this mean.",
      ...(missingGameIds.length ? [`Missing or ambiguous credited SO for selected games: ${missingGameIds.join(",")}.`] : []), ...(input.limitations ?? [])] };
}

export function buildGoalieContributionBundle(input: {
  seasonId: number; cutoffAt: string; issuedAt: string; expiresAt: string; scheduleRevision: string;
  snapshots: Array<{ snapshot: GoalieBaselineRateSnapshot; teamId: number; rosterRevision: string }>;
}): { manifest: ContributionBundleManifest; sources: ContributionSource[] } {
  if (!validBaselineSeasonId(input.seasonId) || !Number.isFinite(Date.parse(input.cutoffAt))
    || !Number.isFinite(Date.parse(input.issuedAt)) || !Number.isFinite(Date.parse(input.expiresAt))
    || Date.parse(input.cutoffAt) > Date.parse(input.issuedAt)
    || Date.parse(input.issuedAt) >= Date.parse(input.expiresAt)
    || !input.scheduleRevision || !input.snapshots.length || input.snapshots.length > 20) {
    throw new Error("Goalie bundle requires bounded snapshots and valid times.");
  }
  const sources: ContributionSource[] = [];
  const players = new Set<number>();
  const policyVersion = input.snapshots[0].snapshot.policyVersion;
  const nativeSummaryWins = policyVersion === NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION;
  const nativeWins = policyVersion === NATIVE_GOALIE_WIN_POLICY_VERSION || nativeSummaryWins;
  const nativeVolumes = policyVersion === NATIVE_GOALIE_VOLUME_POLICY_VERSION;
  const nativeShutouts = policyVersion === NATIVE_GOALIE_SHUTOUT_POLICY_VERSION;
  for (const { snapshot, teamId, rosterRevision } of input.snapshots) {
    if (players.has(snapshot.playerId) || ![GOALIE_BASELINE_POLICY_VERSION, NATIVE_GOALIE_WIN_POLICY_VERSION, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, NATIVE_GOALIE_VOLUME_POLICY_VERSION, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION].includes(snapshot.policyVersion)
      || snapshot.policyVersion !== policyVersion
      || snapshot.validation !== "unvalidated"
      || snapshot.definitionHash !== (nativeSummaryWins ? nativeGoalieSummaryWinDefinitionHash(input.seasonId) : nativeWins ? nativeGoalieWinDefinitionHash(input.seasonId)
        : nativeVolumes ? nativeGoalieVolumeDefinitionHash(input.seasonId) : nativeShutouts ? nativeGoalieShutoutDefinitionHash(input.seasonId) : baselineDefinitionHash("goalie", input.seasonId))
      || snapshot.seasonId !== input.seasonId || snapshot.cutoffAt !== input.cutoffAt
      || !Number.isSafeInteger(snapshot.playerId) || snapshot.playerId <= 0
      || !Number.isSafeInteger(snapshot.nhlPlayerId) || snapshot.nhlPlayerId <= 0
      || !snapshot.sourceWatermark || !Number.isSafeInteger(teamId) || teamId <= 0
      || !rosterRevision) throw new Error("Goalie bundle snapshot identity is inconsistent.");
    players.add(snapshot.playerId);
    const targetKeys = new Set<string>();
    for (const target of snapshot.targets) {
      const expectedBasis = nativeShutouts ? target.targetKey === "SHUTOUTS_GOALIE" ? "per_appearance" : null : nativeWins ? target.targetKey === "WINS_GOALIE" ? "per_appearance" : null
        : nativeVolumes ? (APPEARANCE_TARGETS as readonly string[]).includes(target.targetKey) ? "per_appearance" : null
        : (START_TARGETS as readonly string[]).includes(target.targetKey) ? "per_start"
        : (APPEARANCE_TARGETS as readonly string[]).includes(target.targetKey) ? "per_appearance" : null;
      if (!expectedBasis || target.basis !== expectedBasis || targetKeys.has(target.targetKey)
        || !Number.isFinite(target.rate) || target.rate < 0
        || (target.basis === "per_start" || nativeWins || nativeShutouts) && target.rate > 1
        || target.sourceRows.some((row) => !validTime(row.availableAt)
          || Date.parse(row.availableAt) > Date.parse(input.cutoffAt))) {
        throw new Error("Goalie bundle target is invalid or after cutoff.");
      }
      targetKeys.add(target.targetKey);
      sources.push({ kind: "baseline",
        sourceId: `baseline:${playerForecastSourcePayloadHash({ snapshot, teamId, rosterRevision, targetKey: target.targetKey })}`,
        policyVersion, released: false,
        playerId: snapshot.playerId, nhlPlayerId: snapshot.nhlPlayerId,
        seasonId: snapshot.seasonId, teamId, targetKey: target.targetKey,
        unit: target.targetKey === "GOALIE_MINUTES" ? "minutes" : "count",
        basis: target.basis, mean: target.rate, participationIntegrated: false,
        cutoffAt: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
        sourceWatermark: snapshot.sourceWatermark, scheduleRevision: input.scheduleRevision,
        rosterRevision, limitations: snapshot.limitations });
    }
  }
  if (!sources.length) throw new Error("Goalie bundle contains no supported rates.");
  sources.sort((a, b) => a.playerId - b.playerId || a.targetKey.localeCompare(b.targetKey));
  const unsigned = { seasonId: input.seasonId, policyVersion,
    inputCutoff: input.cutoffAt, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    sourceCount: sources.length,
    sourceWatermarks: [...new Set(sources.map((source) => source.sourceWatermark))].sort(),
    rosterRevisions: [...new Set(sources.map((source) => source.rosterRevision))].sort(),
    evaluationPolicyId: null, reviewId: null, released: false };
  return { sources, manifest: { ...unsigned,
    checksum: contributionBundleChecksum({ manifest: unsigned, sources }) } };
}

export async function dryRunGoalieContributionBundle(db: SupabaseClient<any>,
  input: Parameters<typeof buildGoalieContributionBundle>[0]) {
  const bundle = buildGoalieContributionBundle(input);
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

export async function dryRunCapturedGoalieBundle(db: SupabaseClient<any>, input: {
  capture: { basis: "captured_current"; capturedAt: string; cutoffAt: string;
    players: CapturedGoalieInput[] };
  seasonId: number; issuedAt: string; expiresAt: string; scheduleRevision: string;
}) {
  if (input.capture.cutoffAt !== input.capture.capturedAt) {
    throw new Error("Goalie capture cutoff must equal its current receipt.");
  }
  await persistCapturedGoalieBaselineInputs({ db, seasonId: input.seasonId,
    capture: input.capture, dryRun: true });
  const bundle = buildGoalieContributionBundle({
    seasonId: input.seasonId, cutoffAt: input.capture.cutoffAt,
    issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    scheduleRevision: input.scheduleRevision,
    snapshots: input.capture.players.map((player) => ({ teamId: player.teamId,
      rosterRevision: player.rosterRevision, snapshot: buildGoalieBaselineRates({
        playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId: input.seasonId,
        cutoffAt: input.capture.cutoffAt, sourceWatermark: player.sourceWatermark,
        limitations: player.limitations,
        projections: player.projections, appearances: player.appearances,
      }) })),
  });
  const receipt = await persistContributionBundle(db, { ...bundle, dryRun: true });
  return { ...bundle, receipt };
}

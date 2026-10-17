export const CONTRIBUTION_RESOLVER_POLICY_VERSION = "contribution-resolver-v1";

/** Calendar coverage/overlap policy; independent of next-N-team-games ordinals. */
export type ForecastCalendarPolicy = { version: "forecast-calendar-v1"; calendarDays: number;
  overlapDays: 7; timeZone: "UTC" };
export function forecastCalendarPolicy(calendarDays = 14): ForecastCalendarPolicy {
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 21) {
    throw new RangeError("Calendar horizon must be 1–21 days.");
  }
  return { version: "forecast-calendar-v1", calendarDays, overlapDays: 7, timeZone: "UTC" };
}
export function validForecastCalendarPolicy(policy: ForecastCalendarPolicy): boolean {
  return policy?.version === "forecast-calendar-v1" && policy.timeZone === "UTC" && policy.overlapDays === 7
    && Number.isInteger(policy.calendarDays) && policy.calendarDays >= 1 && policy.calendarDays <= 21;
}
export function calendarLeadDay(scheduledAt: string, now: string): number {
  return (utcDay(scheduledAt) - utcDay(now)) / DAY_MS;
}

export type ContributionSourceKind = "detailed" | "baseline";
export type ContributionBasis = "per_appearance" | "per_start" | "per_team_game" | "unconditional_game";
export type ContributionExclusion = "serving_disabled" | "no_issued_revision" | "unreleased_source"
  | "identity_conflict" | "missing_target" | "stale_source" | "future_input"
  | "unsupported_conditioning" | "missing_participation" | "incompatible_overlap"
  | "incompatible_component_basis" | "outside_horizon" | "use_not_approved";

export type ContributionAllowedUses = {
  assignment: boolean;
  totals: boolean;
  comparison: boolean;
  conditionalTieBreak: boolean;
};

export type ContributionGame = {
  seasonId: number;
  gameId: number;
  teamId: number;
  scheduledAt: string;
  scheduleRevision: string;
  rosterRevision: string;
  playerId: number;
  nhlPlayerId: number;
};

export type ContributionSource = {
  kind: ContributionSourceKind;
  sourceId: string;
  policyVersion: string;
  released: boolean;
  /** Absent permissions are never inferred from release state. */
  allowedUses?: ContributionAllowedUses;
  playerId: number;
  nhlPlayerId: number;
  seasonId: number;
  teamId: number;
  gameId?: number;
  scheduledAt?: string;
  targetKey: string;
  unit: "count" | "minutes";
  basis: ContributionBasis;
  mean: number;
  participationIntegrated: boolean;
  cutoffAt: string;
  issuedAt: string;
  expiresAt: string;
  sourceWatermark: string;
  scheduleRevision: string;
  rosterRevision: string;
  legacyAvailabilityAdjustment?: boolean;
  limitations?: string[];
};

export type ContributionParticipation = {
  playerId: number;
  nhlPlayerId: number;
  seasonId: number;
  gameId: number;
  teamId: number;
  scheduledAt?: string;
  basis: "appearance" | "start";
  probability: number;
  revisionId: string;
  released: boolean;
  allowedUses?: ContributionAllowedUses;
  scheduleRevision: string;
  rosterRevision: string;
  issuedAt: string;
  cutoffAt: string;
  expiresAt: string;
  competitionId?: string;
};

export type ResolvedContribution = {
  /** Sanitized inputs permit revalidation without treating a stored mean as new evidence. */
  inputs?: { detailed?: ContributionSource; baseline?: ContributionSource;
    participation?: ContributionParticipation; horizonDays: number; calendarPolicy?: ForecastCalendarPolicy; servingEnabled: boolean };
  resolverVersion: typeof CONTRIBUTION_RESOLVER_POLICY_VERSION;
  game: ContributionGame;
  targetKey: string;
  sourceKind: ContributionSourceKind | "blended" | null;
  conditionalMean: number | null;
  unconditionalMean: number | null;
  unit: "count" | "minutes" | null;
  basis?: ContributionBasis | null;
  allowedUses: ContributionAllowedUses;
  sourceIds: string[];
  participationRevisionId: string | null;
  blendWeight: number | null;
  exclusionReasons: ContributionExclusion[];
  limitations: string[];
};

const validTime = (value: string) => Number.isFinite(Date.parse(value));
const milliseconds = (value: string) => Date.parse(value);
const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (value: string) => {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

function assessSource(source: ContributionSource | undefined, game: ContributionGame, targetKey: string,
  now: string): ContributionExclusion[] {
  if (!source) return ["no_issued_revision"];
  const reasons: ContributionExclusion[] = [];
  if (!source.released) reasons.push("unreleased_source");
  if (source.playerId !== game.playerId || source.nhlPlayerId !== game.nhlPlayerId
    || source.seasonId !== game.seasonId || source.teamId !== game.teamId
    || (source.kind === "detailed" && source.gameId !== game.gameId)
    || ((source.kind === "detailed" || source.participationIntegrated)
      && source.scheduleRevision !== game.scheduleRevision)
    || source.rosterRevision !== game.rosterRevision) reasons.push("identity_conflict");
  if (source.targetKey !== targetKey || !Number.isFinite(source.mean)
    || (targetKey !== "PLUS_MINUS" && source.mean < 0)) reasons.push("missing_target");
  if (!validTime(source.cutoffAt) || !validTime(source.issuedAt)
    || milliseconds(source.cutoffAt) > milliseconds(source.issuedAt)
    || milliseconds(source.cutoffAt) > milliseconds(game.scheduledAt)
    || milliseconds(source.issuedAt) > milliseconds(now)) reasons.push("future_input");
  if (!validTime(source.expiresAt) || milliseconds(source.expiresAt) <= milliseconds(now)) reasons.push("stale_source");
  if (source.legacyAvailabilityAdjustment
    || (["unconditional_game", "per_team_game"].includes(source.basis) !== source.participationIntegrated)) {
    reasons.push("unsupported_conditioning");
  }
  return reasons;
}

function participationFor(source: ContributionSource, participation: ContributionParticipation | undefined,
  now: string, game: ContributionGame): number | null {
  if (source.participationIntegrated) return 1;
  const basis = source.basis === "per_start" ? "start" : "appearance";
  if (!participation || !participation.released || !participation.revisionId.trim()
    || participation.playerId !== game.playerId || participation.nhlPlayerId !== game.nhlPlayerId
    || participation.seasonId !== game.seasonId || participation.gameId !== game.gameId
    || participation.teamId !== game.teamId || participation.basis !== basis
    || participation.scheduleRevision !== game.scheduleRevision || participation.rosterRevision !== game.rosterRevision
    || !Number.isFinite(participation.probability)
    || participation.probability < 0 || participation.probability > 1
    || !validTime(participation.cutoffAt)
    || !validTime(participation.issuedAt) || milliseconds(participation.cutoffAt) > milliseconds(participation.issuedAt)
    || milliseconds(participation.issuedAt) > milliseconds(now)
    || milliseconds(participation.cutoffAt) > milliseconds(game.scheduledAt)
    || milliseconds(participation.cutoffAt) > milliseconds(now)
    || !validTime(participation.expiresAt)
    || milliseconds(participation.expiresAt) <= milliseconds(now)) return null;
  return participation.probability;
}

/** Resolve one player/game/target. Source records must already be sanitized and release checked by the loader. */
export function resolveContribution(input: {
  game: ContributionGame;
  targetKey: string;
  now: string;
  detailed?: ContributionSource;
  baseline?: ContributionSource;
  participation?: ContributionParticipation;
  horizonDays?: number;
  calendarPolicy?: ForecastCalendarPolicy;
  servingEnabled?: boolean;
}): ResolvedContribution {
  const { game, targetKey, now } = input;
  const exclusions = new Set<ContributionExclusion>();
  const detailedReasons = assessSource(input.detailed, game, targetKey, now);
  const baselineReasons = assessSource(input.baseline, game, targetKey, now);
  const horizonDays = input.calendarPolicy?.calendarDays ?? input.horizonDays ?? 14;
  const policyValid = input.calendarPolicy ? validForecastCalendarPolicy(input.calendarPolicy)
    && (input.horizonDays === undefined || input.horizonDays === horizonDays)
    : Number.isInteger(horizonDays) && horizonDays >= 1 && horizonDays <= 21;
  const calendarPolicy = input.calendarPolicy ?? (policyValid ? forecastCalendarPolicy(horizonDays) : undefined);
  if (!policyValid) {
    detailedReasons.push("identity_conflict");
    baselineReasons.push("identity_conflict");
  }
  const lead = calendarLeadDay(game.scheduledAt, now);
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || !Number.isFinite(lead) || lead >= horizonDays) {
    detailedReasons.push("outside_horizon");
  }
  const servingEnabled = input.servingEnabled ?? true;
  if (!servingEnabled) exclusions.add("serving_disabled");
  const detailed = servingEnabled && !detailedReasons.length ? input.detailed : undefined;
  const baseline = servingEnabled && !baselineReasons.length ? input.baseline : undefined;
  for (const reason of detailedReasons) exclusions.add(reason);
  if (!detailed) for (const reason of baselineReasons) exclusions.add(reason);
  let selected = detailed ?? baseline;
  let mean = selected?.mean ?? null;
  let sourceKind: ResolvedContribution["sourceKind"] = selected?.kind ?? null;
  let sourceIds = selected ? [selected.sourceId] : [];
  let blendWeight: number | null = null;
  if (detailed && baseline && horizonDays > 0) {
    const weight = Math.min(1, Math.max(0, (horizonDays - lead) / calendarPolicy!.overlapDays));
    if (weight < 1) {
      if (detailed.unit === baseline.unit && detailed.basis === baseline.basis
        && detailed.participationIntegrated === baseline.participationIntegrated) {
        mean = weight * detailed.mean + (1 - weight) * baseline.mean;
        selected = detailed;
        sourceKind = "blended";
        sourceIds = [detailed.sourceId, baseline.sourceId];
        blendWeight = weight;
      } else exclusions.add("incompatible_overlap");
    }
  }
  let probability = selected ? participationFor(selected, input.participation, now, game) : null;
  if (probability == null && baseline && selected !== baseline) {
    const fallbackProbability = participationFor(baseline, input.participation, now, game);
    if (fallbackProbability != null) {
      selected = baseline;
      mean = baseline.mean;
      sourceKind = "baseline";
      sourceIds = [baseline.sourceId];
      blendWeight = null;
      probability = fallbackProbability;
    }
  }
  if (selected && probability == null) exclusions.add("missing_participation");
  const unconditionalMean = mean != null && probability != null ? mean * probability : null;
  const permissionSources = sourceKind === "blended" ? [detailed, baseline] : [selected];
  const approved = (use: keyof ContributionAllowedUses) => permissionSources.length > 0 &&
    permissionSources.every((source) => source?.allowedUses?.[use] === true)
    && (use === "conditionalTieBreak" || selected?.participationIntegrated
      || input.participation?.allowedUses?.[use] === true);
  if (selected && (!approved("assignment") || !approved("totals") || !approved("comparison"))) {
    exclusions.add("use_not_approved");
  }
  return {
    inputs: { detailed: input.detailed, baseline: input.baseline, participation: input.participation,
      horizonDays, calendarPolicy, servingEnabled },
    resolverVersion: CONTRIBUTION_RESOLVER_POLICY_VERSION,
    game, targetKey, sourceKind,
    conditionalMean: selected && !selected.participationIntegrated ? mean : null,
    unconditionalMean,
    unit: selected?.unit ?? null,
    basis: selected?.basis ?? null,
    allowedUses: {
      assignment: unconditionalMean != null && approved("assignment"),
      totals: unconditionalMean != null && approved("totals"),
      comparison: unconditionalMean != null && approved("comparison"),
      conditionalTieBreak: selected != null && !selected.participationIntegrated && approved("conditionalTieBreak"),
    },
    sourceIds,
    participationRevisionId: selected && !selected.participationIntegrated && probability != null
      ? input.participation?.revisionId ?? null : null,
    blendWeight,
    exclusionReasons: [...exclusions].sort(),
    limitations: [...new Set([
      ...(sourceKind === "blended" ? [...(detailed?.limitations ?? []), ...(baseline?.limitations ?? [])]
        : selected?.limitations ?? []),
      ...(unconditionalMean == null && mean != null ? ["Conditional ability only; participation unavailable."] : []),
    ])],
  };
}

export type ContributionRequirement = { game: ContributionGame; targetKey: string };
export type ContributionCoverage = {
  requiredCount: number;
  assignmentEligibleCount: number;
  totalsEligibleCount: number;
  comparisonEligibleCount: number;
  exclusions: Array<{ gameId: number; playerId: number; targetKey: string;
    reasons: ContributionExclusion[] }>;
  snapshotManifest: {
    resolverVersion: typeof CONTRIBUTION_RESOLVER_POLICY_VERSION;
    entries: Array<{ seasonId: number; gameId: number; playerId: number; targetKey: string;
      scheduleRevision: string; rosterRevision: string; sourceIds: string[];
      participationRevisionId: string | null }>;
  };
};

/** The caller supplies every required opportunity, including competing bench players. */
export function summarizeContributionCoverage(requirements: ContributionRequirement[],
  resolved: ResolvedContribution[]): ContributionCoverage {
  const key = (game: ContributionGame, targetKey: string) =>
    [game.seasonId, game.gameId, game.playerId, targetKey].join(":");
  const requiredKeys = requirements.map((item) => key(item.game, item.targetKey));
  if (new Set(requiredKeys).size !== requiredKeys.length) {
    throw new Error("Contribution requirements must have unique player/game/target keys.");
  }
  const resolvedByKey = new Map(resolved.map((item) => [key(item.game, item.targetKey), item]));
  if (resolvedByKey.size !== resolved.length) throw new Error("Duplicate resolved player/game/target contributions.");
  const ordered = [...requirements].sort((a, b) => key(a.game, a.targetKey).localeCompare(key(b.game, b.targetKey)));
  const found = ordered.map((item) => resolvedByKey.get(key(item.game, item.targetKey)));
  return {
    requiredCount: ordered.length,
    assignmentEligibleCount: found.filter((item) => item?.allowedUses.assignment).length,
    totalsEligibleCount: found.filter((item) => item?.allowedUses.totals).length,
    comparisonEligibleCount: found.filter((item) => item?.allowedUses.comparison).length,
    exclusions: ordered.flatMap((item, index) => found[index]?.allowedUses.comparison ? [] : [{
      gameId: item.game.gameId, playerId: item.game.playerId, targetKey: item.targetKey,
      reasons: found[index]?.exclusionReasons.length ? found[index]!.exclusionReasons : ["no_issued_revision" as const],
    }]),
    snapshotManifest: {
      resolverVersion: CONTRIBUTION_RESOLVER_POLICY_VERSION,
      entries: ordered.map((item, index) => ({
        seasonId: item.game.seasonId, gameId: item.game.gameId, playerId: item.game.playerId,
        targetKey: item.targetKey, scheduleRevision: item.game.scheduleRevision,
        rosterRevision: item.game.rosterRevision,
        sourceIds: found[index]?.sourceIds ?? [],
        participationRevisionId: found[index]?.participationRevisionId ?? null,
      })),
    },
  };
}

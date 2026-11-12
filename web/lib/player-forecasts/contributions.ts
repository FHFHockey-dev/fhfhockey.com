import { timestampMicros } from "../projections/evidenceTime";

export const CONTRIBUTION_RESOLVER_POLICY_VERSION = "contribution-resolver-v1";
export const CURRENT_SEASON_SOG_CONTRIBUTION_VERSION = "current-season-sog-appearance-mean-v1";

/** Calendar coverage/overlap policy; independent of next-N-team-games ordinals.
 * v1 (issued history, replay only): UTC calendar days of the scheduled start and of `now`.
 * v2 (decision 127, Q35): NHL schedule dates — a game's date is the schedule's own date (`games.date`, passed as
 * `scheduleDate`), else the America/New_York date of its start; the as-of date is the America/New_York date of `now`.
 * Each issued artifact keeps the version it recorded (rule 21); the default flips to v2 in the release that switches every
 * consumer (issuance, replay, bridge, coverage, planning, evaluation) at once. Contract: side note L10-calendar-v2-contract. */
export const FORECAST_CALENDAR_VERSIONS = ["forecast-calendar-v1", "forecast-calendar-v2"] as const;
export type ForecastCalendarVersion = typeof FORECAST_CALENDAR_VERSIONS[number];
export const DEFAULT_FORECAST_CALENDAR_VERSION: ForecastCalendarVersion = "forecast-calendar-v1";
export const NHL_SCHEDULE_TIME_ZONE = "America/New_York";
export type ForecastCalendarPolicyV1 = { version: "forecast-calendar-v1"; calendarDays: number; overlapDays: 7; timeZone: "UTC" };
export type ForecastCalendarPolicyV2 = { version: "forecast-calendar-v2"; calendarDays: number; overlapDays: 7;
  timeZone: typeof NHL_SCHEDULE_TIME_ZONE; dateBasis: "nhl_schedule_date" };
/** Every policy version this module can measure. */
export type AnyForecastCalendarPolicy = ForecastCalendarPolicyV1 | ForecastCalendarPolicyV2;
/** The policy consumers store and serve today. It widens to AnyForecastCalendarPolicy in the flip release, together with
 * the persisted shapes that pin v1 (`in-season/workspaceSchema.ts`, the later-impact scenario). */
export type ForecastCalendarPolicy = ForecastCalendarPolicyV1;
export function forecastCalendarPolicy(calendarDays?: number): ForecastCalendarPolicyV1;
export function forecastCalendarPolicy(calendarDays: number, version: "forecast-calendar-v2"): ForecastCalendarPolicyV2;
export function forecastCalendarPolicy(calendarDays: number, version: ForecastCalendarVersion): AnyForecastCalendarPolicy;
export function forecastCalendarPolicy(calendarDays = 14, version: ForecastCalendarVersion = DEFAULT_FORECAST_CALENDAR_VERSION): AnyForecastCalendarPolicy {
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 21) {
    throw new RangeError("Calendar horizon must be 1–21 days.");
  }
  if (version === "forecast-calendar-v2") {
    return { version, calendarDays, overlapDays: 7, timeZone: NHL_SCHEDULE_TIME_ZONE, dateBasis: "nhl_schedule_date" };
  }
  if (version !== "forecast-calendar-v1") throw new RangeError("Unknown calendar policy version.");
  return { version, calendarDays, overlapDays: 7, timeZone: "UTC" };
}
export function validForecastCalendarPolicy(policy: AnyForecastCalendarPolicy): boolean {
  const days = Number.isInteger(policy?.calendarDays) && policy.calendarDays >= 1 && policy.calendarDays <= 21 && policy.overlapDays === 7;
  if (policy?.version === "forecast-calendar-v1") return days && policy.timeZone === "UTC";
  return days && policy?.version === "forecast-calendar-v2" && policy.timeZone === NHL_SCHEDULE_TIME_ZONE && policy.dateBasis === "nhl_schedule_date";
}
const ET_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: NHL_SCHEDULE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
/** The policy's calendar date of an instant (v1 UTC, v2 America/New_York); null for an invalid instant. */
export function forecastCalendarDate(instant: string | Date, policy: AnyForecastCalendarPolicy = forecastCalendarPolicy()): string | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  return policy.version === "forecast-calendar-v2" ? ET_DATE.format(date) : date.toISOString().slice(0, 10);
}
/** Whole calendar days from the as-of date to the game's date under the policy. v2 uses the schedule's own date when
 * given. NaN when either date is unknown (callers treat NaN as outside the horizon). */
export function calendarLeadDay(scheduledAt: string, now: string, policy: AnyForecastCalendarPolicy = forecastCalendarPolicy(),
  scheduleDate?: string | null): number {
  const gameDate = policy.version === "forecast-calendar-v2" && isDate(scheduleDate) ? scheduleDate : forecastCalendarDate(scheduledAt, policy);
  const asOf = forecastCalendarDate(now, policy);
  if (!gameDate || !asOf) return NaN;
  return Math.round((Date.parse(`${gameDate}T12:00:00Z`) - Date.parse(`${asOf}T12:00:00Z`)) / DAY_MS);
}
/** First and last calendar dates of a policy window starting at `now`. */
export function forecastCalendarWindow(now: Date, policy: AnyForecastCalendarPolicy): { startDate: string; endDate: string } {
  const startDate = forecastCalendarDate(now, policy)!;
  return { startDate, endDate: new Date(Date.parse(`${startDate}T12:00:00Z`) + (policy.calendarDays - 1) * DAY_MS).toISOString().slice(0, 10) };
}

/** W2-8 D2: a team-game's start probabilities may sum above 1 only by rounding. Exact (unrounded) vectors get the
 * 1e-6 float allowance; a vector proven rounded to 4 dp (every value a multiple of 0.0001) gets n × 0.00005, the most
 * that rounding a coherent vector can add. Anything larger is incoherent and the group is rejected. */
export function startMassExceedsOne(probabilities: readonly number[]): boolean {
  const sum = probabilities.reduce((total, value) => total + value, 0);
  const rounded4dp = probabilities.length > 0 && probabilities.every(value => Math.abs(value * 1e4 - Math.round(value * 1e4)) < 1e-7);
  return sum > 1 + (rounded4dp ? probabilities.length * 0.00005 : 0) + 1e-6;
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
  /** The schedule's own NHL date (`games.date`); used by calendar policy v2. */
  scheduleDate?: string | null;
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
  /** Admitted catalog validity; original producer expiry remains unchanged. */
  catalogExpiresAt?: string;
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
  model?: {
    version: "skater-participation-frequency-v1" | "goalie-appearance-frequency-v1"
      | "skater-frozen-window-appearance-frequency-v1" | "goalie-frozen-window-appearance-frequency-v1"
      | "goalie-frozen-window-start-frequency-v1"
      | "skater-roster-observation-appearance-frequency-v1" | "goalie-roster-observation-appearance-frequency-v1"
      | "goalie-roster-observation-start-frequency-v1"
      | "skater-rolling-14d-appearance-frequency-v1" | "goalie-rolling-14d-appearance-frequency-v1"
      | "goalie-rolling-14d-start-frequency-v1"; event: "positive_minutes" | "official_starter";
    probabilityStatus: "uncalibrated_model"; calibration: "unavailable";
    inputHash: string; evidenceHashes: string[]; numerator: number; denominator: number;
    selectedGameIds: number[]; limitations: string[];
  };
};

/** Explicit empty catalogs revoke old modeled receipts. Conflicting player-game
 * entries are withheld instead of selecting a convenient probability. */
export function catalogParticipation(sources: ContributionParticipation[] | undefined,
  game: ContributionGame, basis: ContributionParticipation["basis"] = "appearance"): ContributionParticipation | undefined {
  const matches = sources?.filter(row => row.playerId === game.playerId && row.gameId === game.gameId && row.basis === basis);
  return matches?.length === 1 ? matches[0] : undefined;
}

export type ResolvedContribution = {
  /** Sanitized inputs permit revalidation without treating a stored mean as new evidence. */
  inputs?: { detailed?: ContributionSource; baseline?: ContributionSource;
    participation?: ContributionParticipation; horizonDays: number; calendarPolicy?: AnyForecastCalendarPolicy; servingEnabled: boolean };
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

function assessSource(source: ContributionSource | undefined, game: ContributionGame, targetKey: string,
  now: string): ContributionExclusion[] {
  if (!source) return ["no_issued_revision"];
  const reasons: ContributionExclusion[] = [];
  const scopedSog = source.policyVersion === CURRENT_SEASON_SOG_CONTRIBUTION_VERSION;
  const time = (value: string) => scopedSog
    ? timestampMicros(value) === null ? NaN : Number(timestampMicros(value)) : milliseconds(value);
  if (!source.released) reasons.push("unreleased_source");
  if (source.playerId !== game.playerId || source.nhlPlayerId !== game.nhlPlayerId
    || source.seasonId !== game.seasonId || source.teamId !== game.teamId
    || ((source.kind === "detailed" || scopedSog) && source.gameId !== game.gameId)
    || ((source.kind === "detailed" || source.participationIntegrated || scopedSog)
      && source.scheduleRevision !== game.scheduleRevision)
    || source.rosterRevision !== game.rosterRevision
    || scopedSog && (source.kind !== "baseline" || source.targetKey !== "SHOTS_ON_GOAL" || source.unit !== "count"
      || source.basis !== "per_appearance" || source.participationIntegrated
      || !Number.isFinite(time(source.scheduledAt ?? "")) || time(source.scheduledAt!) !== time(game.scheduledAt)
      || !Number.isFinite(time(source.expiresAt)) || time(source.expiresAt) > time(game.scheduledAt)
      || time(source.expiresAt) <= time(source.issuedAt))) reasons.push("identity_conflict");
  if (source.targetKey !== targetKey || !Number.isFinite(source.mean)
    || (targetKey !== "PLUS_MINUS" && source.mean < 0)) reasons.push("missing_target");
  if (!Number.isFinite(time(now)) || !validTime(source.cutoffAt) || !validTime(source.issuedAt)
    || !Number.isFinite(time(source.cutoffAt)) || !Number.isFinite(time(source.issuedAt))
    || time(source.cutoffAt) > time(source.issuedAt)
    || time(source.cutoffAt) > time(game.scheduledAt)
    || time(source.issuedAt) > time(now)) reasons.push("future_input");
  if (!validTime(source.expiresAt) || !Number.isFinite(time(source.expiresAt)) || time(source.expiresAt) <= time(now)) reasons.push("stale_source");
  if (source.catalogExpiresAt !== undefined) {
    const catalogExpiry = timestampMicros(source.catalogExpiresAt), sourceExpiry = timestampMicros(source.expiresAt),
      issued = timestampMicros(source.issuedAt), readAt = timestampMicros(now);
    if (catalogExpiry === null || sourceExpiry === null || issued === null || readAt === null
      || catalogExpiry <= readAt || catalogExpiry > sourceExpiry || catalogExpiry <= issued) reasons.push("stale_source");
  }
  if (source.legacyAvailabilityAdjustment
    || (["unconditional_game", "per_team_game"].includes(source.basis) !== source.participationIntegrated)) {
    reasons.push("unsupported_conditioning");
  }
  return reasons;
}

function participationProbability(participation: ContributionParticipation | undefined,
  now: string, game: ContributionGame, basis: ContributionParticipation["basis"]): number | null {
  const model = participation?.model;
  // Preserve the original legacy clock contract; the versioned modeled branch
  // uses the same microsecond identity/order checks as its receipt builder.
  const clock = model ? (value: string) => {
    const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed);
  } : milliseconds;
  const validClock = (value: string) => Number.isFinite(clock(value));
  if (!participation || !participation.released || !participation.revisionId.trim()
    || participation.playerId !== game.playerId || participation.nhlPlayerId !== game.nhlPlayerId
    || participation.seasonId !== game.seasonId || participation.gameId !== game.gameId
    || participation.teamId !== game.teamId || participation.basis !== basis
    || participation.scheduleRevision !== game.scheduleRevision || participation.rosterRevision !== game.rosterRevision
    || !Number.isFinite(participation.probability)
    || participation.probability < 0 || participation.probability > 1
    || !validClock(participation.cutoffAt) || !validClock(now) || !validClock(game.scheduledAt)
    || !validClock(participation.issuedAt) || clock(participation.cutoffAt) > clock(participation.issuedAt)
    || clock(participation.issuedAt) > clock(now)
    || clock(participation.cutoffAt) > clock(game.scheduledAt)
    || clock(participation.cutoffAt) > clock(now)
    || !validClock(participation.expiresAt)
    || clock(participation.expiresAt) <= clock(now)) return null;
  const startModel = model?.version === "goalie-frozen-window-start-frequency-v1"
    || model?.version === "goalie-roster-observation-start-frequency-v1"
    || model?.version === "goalie-rolling-14d-start-frequency-v1";
  if (model && (model.event !== (startModel ? "official_starter" : "positive_minutes") || model.probabilityStatus !== "uncalibrated_model" || model.calibration !== "unavailable"
    || !/^[a-f0-9]{64}$/.test(model.inputHash) || !Array.isArray(model.evidenceHashes) || !model.evidenceHashes.length
    || model.evidenceHashes.length > (startModel ? 196 : model.version === "skater-participation-frequency-v1" ? 131 : 132) || model.evidenceHashes.some(value => !/^[a-f0-9]{64}$/.test(value))
    || !Number.isInteger(model.numerator) || !Number.isInteger(model.denominator)
    || model.numerator < 0 || model.denominator < 1 || model.denominator > 20 || model.numerator > model.denominator
    || participation.probability !== model.numerator / model.denominator
    || !Array.isArray(model.selectedGameIds) || model.selectedGameIds.length !== model.denominator
    || new Set(model.selectedGameIds).size !== model.selectedGameIds.length
    || model.selectedGameIds.some(value => !Number.isSafeInteger(value) || value <= 0 || value === game.gameId)
    || !Array.isArray(model.limitations) || model.limitations.some(value => typeof value !== "string")
    || !validClock(participation.scheduledAt ?? "") || clock(participation.scheduledAt!) !== clock(game.scheduledAt)
    || clock(participation.issuedAt) >= clock(game.scheduledAt)
    || clock(participation.expiresAt) > clock(game.scheduledAt)
    || clock(participation.expiresAt) <= clock(participation.issuedAt)
    || clock(participation.issuedAt) - clock(participation.cutoffAt) > DAY_MS * 1000
    || clock(participation.expiresAt) - clock(participation.issuedAt) > DAY_MS * 1000)) return null;
  return participation.probability;
}

/** Independently admitted start metadata does not change appearance-conditioned means. */
export function admittedModeledStart(participation: ContributionParticipation | undefined,
  game: ContributionGame, now: string): ContributionParticipation | undefined {
  return (participation?.model?.version === "goalie-frozen-window-start-frequency-v1"
    || participation?.model?.version === "goalie-roster-observation-start-frequency-v1"
    || participation?.model?.version === "goalie-rolling-14d-start-frequency-v1")
    && participation.allowedUses?.totals === true
    && participationProbability(participation, now, game, "start") !== null ? participation : undefined;
}

function participationFor(source: ContributionSource, participation: ContributionParticipation | undefined,
  now: string, game: ContributionGame): number | null {
  // This finite conditional canary has no admitted participation contract.
  if (source.policyVersion === CURRENT_SEASON_SOG_CONTRIBUTION_VERSION) return null;
  if (source.participationIntegrated) return 1;
  const model = participation?.model;
  const skaterModel = model?.version === "skater-participation-frequency-v1"
    || model?.version === "skater-frozen-window-appearance-frequency-v1"
    || model?.version === "skater-roster-observation-appearance-frequency-v1"
    || model?.version === "skater-rolling-14d-appearance-frequency-v1";
  const goalieModel = model?.version === "goalie-appearance-frequency-v1"
    || model?.version === "goalie-frozen-window-appearance-frequency-v1"
    || model?.version === "goalie-roster-observation-appearance-frequency-v1"
    || model?.version === "goalie-rolling-14d-appearance-frequency-v1";
  const compatibleModel = skaterModel
    ? ["skater-baseline-rates-v1", "current-appearance-skater-rates-v1", "native-prior-appearance-skater-rates-v1"].includes(source.policyVersion) && !source.targetKey.endsWith("_GOALIE") && source.targetKey !== "GOALIE_MINUTES"
    : goalieModel && ["native-goalie-appearance-win-rates-v1", "native-goalie-appearance-summary-win-rates-v1",
      "native-goalie-appearance-volume-rates-v1", "native-goalie-appearance-shutout-rates-v1"].includes(source.policyVersion)
      && (source.targetKey.endsWith("_GOALIE") || source.targetKey === "GOALIE_MINUTES");
  if (model && (source.kind !== "baseline" || !compatibleModel
    || source.basis !== "per_appearance"
    || model.event !== "positive_minutes")) return null;
  return participationProbability(participation, now, game, source.basis === "per_start" ? "start" : "appearance");
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
  calendarPolicy?: AnyForecastCalendarPolicy;
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
  const lead = calendarLeadDay(game.scheduledAt, now, calendarPolicy ?? forecastCalendarPolicy(), game.scheduleDate);
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
  if (detailed && baseline && horizonDays > 0 && baseline.policyVersion !== CURRENT_SEASON_SOG_CONTRIBUTION_VERSION) {
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
      ...(probability != null ? input.participation?.model?.limitations ?? [] : []),
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

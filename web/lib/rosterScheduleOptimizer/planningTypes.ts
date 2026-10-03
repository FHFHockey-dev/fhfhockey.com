import type { ContributionAllowedUses, ContributionExclusion, ContributionSource, ForecastCalendarPolicy, ResolvedContribution } from "../player-forecasts/contributions";
export type ForecastExclusionReason = ContributionExclusion | "canary_excluded" | "discovery_timeout"
  | "discovery_failed" | "incomplete_refresh" | "eligibility_unverified" | "game_mismatch"
  | "invalid_cutoff" | "no_usable_target" | "conflicting_forecast";
export type ForecastDiscoveryExclusion = { gameId: string; playerId?: string; targetKey?: string; reasons: ForecastExclusionReason[] };
export type ForecastOpportunityExclusion = { gameId: string; playerId: string; targetKey: string; reasons: ForecastExclusionReason[] };
/** Provider-neutral, serializable in-season planning contracts. No access-tier inputs. */
export type PlanningContext = {
  provider: "manual" | "yahoo" | "fantrax";
  seasonId: number;
  leagueId: string;
  teamId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  asOf: string;
};
export type SourceEvidence = {
  source: string;
  asOf: string | null;
  completeness: "complete" | "partial" | "unknown";
  seasonId: number | null;
  limitations: string[];
};
export type PlayerAvailability = "free_agent" | "waivers" | "rostered" | "manager_available" | "unknown";
export type PlanningPlayer = {
  nhlTeamId?: number;
  rosterRevision?: string;
  id: string;
  nhlId: number | null;
  providerId?: string | null;
  name: string;
  teamAbbreviation: string | null;
  eligiblePositions: string[];
  eligibilityVerified?: boolean;
  playerClass: "skater" | "goalie";
  availability: PlayerAvailability;
  ownership: number | null;
  canDrop: boolean | null;
  holdValue: number | null;
  reserveEligibility: Array<"IR" | "IR+" | "NA">;
  waiverClearsAt?: string | null;
  form?: { label: string; games: number; points: number; includedInForecast: boolean | null };
};
export type RosterEntry = {
  playerId: string;
  position: "active" | "bench" | "IR" | "IR+" | "NA";
};
export type PlanningGame = {
  scheduleRevision?: string;
  id: string;
  date: string;
  startsAt: string | null;
  teamAbbreviation: string;
  opponent: string;
  home: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
};
export type StatLine = Record<string, number | null>;
/** Public whitelist of the immutable schedule and roster identity used when FORGE issued a row. */
export type PlanningIssuedContext = {
  version: "forge-issued-context-v1";
  playerId: string;
  gameId: string;
  nhlPlayerId: number;
  seasonId: number;
  teamId: number;
  scheduledAt: string;
  scheduleRevision: string;
  rosterRevision: string;
  observedAt: string;
  scheduleSourceUpdatedAt: string | null;
  scheduleFetchedAt: string | null;
  identityUpdatedAt: string | null;
  membershipCreatedAt: string[];
};
export type GameForecast = {
  issuedContext?: PlanningIssuedContext;
  /** Opaque fingerprint of retained source reads; not a substitute for their cutoff timestamps. */
  sourceWatermark?: string;
  allowedUses?: ContributionAllowedUses;
  assignmentStats?: StatLine;
  sourceKind?: "detailed" | "baseline" | "blended";
  conditionalStats?: StatLine;
  tieBreakStats?: StatLine;
  appearanceProbability?: number | null;
  contributions?: Record<string, ResolvedContribution>;
  cutoffAt?: string;
  expiresAt?: string;
  playerId: string;
  gameId: string;
  stats: StatLine;
  /** Stats are unconditional expected contributions; never multiply them twice. */
  conditioning: "unconditional";
  startProbability: number | null;
  confirmedStart: boolean;
  revisionId: string;
  issuedAt: string;
  modelVersion: string | null;
  limitations: string[];
};
export type AcquisitionPeriod = {
  id: string;
  start: string;
  end: string;
  remaining: number | null;
  source: "provider" | "manager" | "unknown";
  /** Weekly lineup lock, independently specified from acquisition resets. */
  lineupLockAt?: string | null;
};
export type ScoringCategory = {
  key: string;
  direction: "higher" | "lower";
  numerator?: string;
  denominator?: string;
  multiplier?: number;
};
export type LeagueRules = {
  lineupMode: "daily" | "weekly" | "unsupported";
  rosterSlots: Record<string, number>;
  /** Independent lineup windows; acquisition resets do not establish lineup locks. */
  lineupPeriods?: Array<{ id: string; start: string; end: string; lockAt: string | null }>;
  acquisitionTiming: "same_day" | "next_day" | "unknown";
  acquisitionCost: number | null;
  waivers?: { mode: "priority" | "budget" | "unknown"; remainingBudget: number | null };
  periods: AcquisitionPeriod[];
  scoring: { mode: "points" | "categories"; weights: Record<string, number>; categories: ScoringCategory[] };
  goalieMinimum: {
    required: number | null;
    credited: number | null;
    /** Period for which required and credited are authoritative; end is exclusive. */
    periodStart?: string | null;
    periodEnd?: string | null;
    counts: "starts" | "appearances" | "unknown";
    penalty: "lose_goalie_categories" | "none" | "unknown";
  };
  unsupported: string[];
};
export type LockedAssignment = { date: string; playerId: string; slotId: string | null };
export type AcquisitionEvidence = {
  source: string;
  fetchedAt: string;
  asOf: string | null;
  counter: { present: boolean; coverageType: string | null; coverageWeek: number | null;
    reportedValue: string | number | boolean | null; used: number | null };
  limit: { present: boolean; reportedValue: string | number | boolean | null; verified: boolean };
  period: { week: number | null; startDate: string | null; endDate: string | null; containsHorizon: boolean };
  remaining: number | null;
  limitations: string[];
};
export type PlanningSnapshot = {
  acquisitionEvidence?: AcquisitionEvidence;
  baselineSources?: ContributionSource[];
  forecastManifest?: ForecastManifest;
  /** Internal duplicate-input diagnostics, kept with the evaluated snapshot only. */
  forecastInputExclusions?: ForecastDiscoveryExclusion[];
  id: string;
  context: PlanningContext;
  players: PlanningPlayer[];
  roster: RosterEntry[];
  games: PlanningGame[];
  forecasts: GameForecast[];
  rules: LeagueRules;
  lockedAssignments: LockedAssignment[];
  realized: StatLine;
  opponent: { roster: RosterEntry[]; realized: StatLine; remaining: StatLine | null } | null;
  evidence: Record<string, SourceEvidence>;
};
/** Statistical resolution also serves diagnostics without inventing league rules. */
export type ContributionPlanningSnapshot = Pick<PlanningSnapshot,
  "players" | "games" | "forecasts" | "baselineSources" | "forecastManifest" | "forecastInputExclusions"> & {
  context: Pick<PlanningContext, "seasonId" | "asOf" | "startDate" | "endDate">;
};
export type PlanStep = {
  id: string;
  type: "add" | "drop" | "reserve";
  playerId: string;
  dropPlayerId?: string;
  reservePosition?: "IR" | "IR+" | "NA";
  at: string;
  effectiveAt: string;
  conditional: boolean;
  waiverSpend?: number | null;
  dependsOn: string[];
};
export type PlanIntent = {
  revision: number;
  steps: PlanStep[];
  protectedPlayerIds: string[];
  excludedPlayerIds: string[];
  goalieCoverage: "accept_risk" | "cover";
  goalieWindow: "early" | "late" | "any";
  goalieSplit: "mon_thu" | "mon_wed";
  alternativeCount: 5 | 10 | 20;
};
export type PlanningObjective = "agp" | "outcome";
export type PlanningAssignment = {
  date: string;
  playerId: string;
  gameId: string;
  slotId: string;
  locked: boolean;
};
export type BenchDecision = {
  date: string;
  playerId: string;
  gameId: string;
  reason: "locked_bench" | "locked_capacity" | "ineligible" | "unresolved_quality" | "negative_value"
    | "whole_lineup_scoring" | "schedule_capacity" | "lower_lineup_value" | "equal_lineup_value"
    | "category_tradeoff" | "minimum_priority" | "decision_unresolved" | "explanation_incomplete";
  value: number | null;
  competingPlayerIds: string[];
  evidence?: {
    startDate: string;
    endDate: string;
    lineupMode: "daily" | "weekly" | "unsupported";
    scoreBasis: "points_assignment" | "category_outcomes" | "category_assignment";
    selectedScore: number;
    withPlayerScore: number;
    manifestId: string;
    slotChanges: Array<{ date: string; slotId: string; selectedPlayerId: string | null; withPlayerId: string | null }>;
    categories: Array<{ key: string; selected: number | null; withPlayer: number | null;
      opponent: number | null; selectedResult: string; withPlayerResult: string }>;
    goalie?: { counts: "starts" | "appearances" | "unknown"; credited: number | null; required: number | null;
      selectedProjected: number | null; withPlayerProjected: number | null };
    sources: Array<{ playerId: string; kinds: string[]; revisionIds: string[];
      participation?: Array<{ gameId: string; basis: "start" | "appearance"; probability: number | null; confirmed: boolean }> }>;
  };
};
export type PlanEvaluation = {
  /** Internal lineup score; not approved projected totals or an acquisition comparison. */
  assignmentValue?: number | null;
  comparisonEligible?: boolean;
  /** Exact sanitized resolved inputs used for these assignments. */
  forecastInputs?: GameForecast[];
  forecastManifestId?: string;
  recommendation?: {
    eligible: boolean;
    mode: "quality" | "schedule_capacity";
    reasons: string[];
    exclusions?: BenchDecision[];
    unresolved: Array<{ date: string; playerId: string; gameId: string; missingTargets: string[]; reasons?: ForecastExclusionReason[] }>;
    coverage?: { requiredCount: number; assignmentEligibleCount: number; totalsEligibleCount: number;
      comparisonEligibleCount: number; exclusions: ForecastOpportunityExclusion[] };
    explanationStatus?: "complete" | "partial";
  };
  objective: PlanningObjective;
  steps: PlanStep[];
  legal: boolean;
  budgetVerified: boolean;
  assignments: PlanningAssignment[];
  scheduledGames: number;
  activeGames: number;
  benchGames: number;
  projectedValue: number | null;
  projectedStats: StatLine;
  categoryResults: Array<{ key: string; own: number | null; opponent: number | null; result: "win" | "tie" | "loss" | "unknown" }>;
  goalie: { minimumSatisfied?: boolean | null; credited: number | null; confirmed: number; projected: number | null; required: number | null; risk: boolean };
  acquisitions: Record<string, number>;
  limitations: string[];
};
export type PlanningResult = {
  snapshotId: string;
  intentRevision: number;
  baseline: PlanEvaluation;
  noMoveAgp: PlanEvaluation;
  noMoveOutcome: PlanEvaluation;
  selected: PlanEvaluation;
  alternatives: PlanEvaluation[];
  scheduleFits?: Array<{ teamAbbreviation: string; positions: string[]; playerIds: string[]; addedGames: number; dates: string[] }>;
  /** Legal prefix plans if a selected conditional claim fails before later dependent legs. */
  noClaimContinuations?: Array<{ claimStepId: string; evaluation: PlanEvaluation }>;
  search: { policyVersion?: "rso-search-v2" | "rso-search-v3"; evaluated: number; candidates: number; maxDepthReached?: number; complete: boolean; elapsedMs: number; limitations: string[];
    benchEvidence?: { policyVersion: "rso-bench-v1"; evaluated: number; maxEvaluations: number;
      complete: boolean; workQuotaReached: boolean; timeLimitReached: boolean } };
};
export type RevisionProposal = {
  snapshotId: string;
  intentRevision: number;
  issues: Array<{ stepId: string | null; message: string }>;
  suggestedSteps: PlanStep[] | null;
};
export type ProviderCapabilities = {
  roster: boolean; availability: boolean; rules: boolean; matchup: boolean; acquisitions: boolean;
  limitations: string[];
};
export type PlanningData = {
  baselineSources?: ContributionSource[];
  forecastManifest?: ForecastManifest;
  matchupWeeks?: Array<{ gameKey: string; week: number; startDate: string; endDate: string }>;
  players: PlanningPlayer[];
  games: PlanningGame[];
  forecasts: GameForecast[];
  evidence: Record<string, SourceEvidence>;
};
export type ForecastManifest = {
  version: "planning-forecasts-v1";
  /** Omitted only for retained legacy snapshots. */
  calendarPolicy?: ForecastCalendarPolicy;
  /** Opaque accepted-event receipt hash; null means no verified receipt set. */
  acceptedNewsRevision?: string | null;
  id: string;
  seasonId: number;
  asOf: string;
  scheduleRevision: string;
  rosterRevision: string;
  issuedRevisionIds: string[];
  baselineChecksum: string | null;
  requiredOpportunities: number;
  forecastedOpportunities: number;
  exclusionCounts: Record<string, number>;
  /** Bounded discovery failures; omitted player/target applies to that game. */
  exclusions?: ForecastDiscoveryExclusion[];
};
export type ManagerRuleOverrides = Omit<Partial<LeagueRules>, "scoring" | "goalieMinimum"> & {
  scoring?: Partial<LeagueRules["scoring"]>;
  goalieMinimum?: Partial<LeagueRules["goalieMinimum"]>;
};
export type PlanningWorkspace = {
  version: 1;
  context: PlanningContext;
  rules: LeagueRules;
  /** Explicit manager-entered values; applied only where provider rules are unverified or missing. */
  managerRuleOverrides?: ManagerRuleOverrides;
  roster: RosterEntry[];
  /** Manager-entered assignments used when a current weekly lineup is locked. */
  lockedAssignments?: LockedAssignment[];
  intent: PlanIntent;
  manualPlayers: PlanningPlayer[];
  unresolvedNames: string[];
  realized: StatLine;
  opponent: PlanningSnapshot["opponent"];
};

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
  id: string;
  nhlId: number | null;
  providerId?: string | null;
  name: string;
  teamAbbreviation: string | null;
  eligiblePositions: string[];
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
  id: string;
  date: string;
  startsAt: string | null;
  teamAbbreviation: string;
  opponent: string;
  home: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
};
export type StatLine = Record<string, number | null>;
export type GameForecast = {
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
export type PlanningSnapshot = {
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
export type PlanEvaluation = {
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
  goalie: { credited: number | null; confirmed: number; projected: number | null; required: number | null; risk: boolean };
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
  /** Legal prefix plans if a selected conditional claim fails before later dependent legs. */
  noClaimContinuations?: Array<{ claimStepId: string; evaluation: PlanEvaluation }>;
  search: { evaluated: number; candidates: number; maxDepthReached?: number; complete: boolean; elapsedMs: number; limitations: string[] };
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
  players: PlanningPlayer[];
  games: PlanningGame[];
  forecasts: GameForecast[];
  evidence: Record<string, SourceEvidence>;
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

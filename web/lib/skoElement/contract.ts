/**
 * The Sko Element shared interpretation contract (diagnostic-first, fixture stage).
 *
 * evidence + canonical FORGE game expectations + interpretation config -> interpretation record.
 * FORGE remains the only forecast engine: expected values are read from its
 * `forge-game-expectations-v1` player view and passed through unchanged. Nothing here fits,
 * reweights or rescales a forecast, and no normalized "SKO score" is produced.
 * Buy Low/Sell High consumes the same record and must never mutate it.
 */
import type { GameExpectationsResponse } from "lib/player-forecasts/gameExpectations";

/**
 * v0.3 (W3-7 A1–A3, D3, D4, D7, D10): forecast admission with target-level clocks, permissions and coverage;
 * identity-complete windows with exact game ids; opportunity unknown states, participation share and role `knownAt`;
 * the signed gap with three separate named comparisons (no Rebound/Cooling labels); IPP exposure and a versioned reference.
 */
export const SKO_CONTRACT_VERSION = "sko-interpretation-v0.3" as const;

/** Settled product decision: next 10 scheduled team games by default, 5 or 20 selectable. */
export const HORIZON_OPTIONS = [5, 10, 20] as const;
export type HorizonGames = (typeof HORIZON_OPTIONS)[number];
export const DEFAULT_HORIZON: HorizonGames = 10;

/** Recent-window options are independent of the future horizon (FR-07). */
export const RECENT_WINDOW_OPTIONS = [5, 10, 20] as const;
export type RecentWindowGames = (typeof RECENT_WINDOW_OPTIONS)[number];

/** Model/reference class. Fantasy eligibility is recorded separately and never decides the class. */
export type ModelClass = "F" | "D" | "G";

export const SKATER_TARGETS = [
  "POINTS", "GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES",
] as const;
export type SkaterTarget = (typeof SKATER_TARGETS)[number];
export const GOALIE_TARGETS = [
  "SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "WINS_GOALIE", "SHUTOUTS_GOALIE",
] as const;
export type GoalieTarget = (typeof GOALIE_TARGETS)[number];

export const TARGET_LABELS: Record<SkaterTarget | GoalieTarget, string> = {
  POINTS: "Points", GOALS: "Goals", ASSISTS: "Assists", PP_POINTS: "PP points", SHOTS_ON_GOAL: "Shots on goal",
  HITS: "Hits", BLOCKED_SHOTS: "Blocks", PENALTY_MINUTES: "PIM",
  SAVES_GOALIE: "Saves", GOALS_AGAINST_GOALIE: "Goals against", SHOTS_AGAINST_GOALIE: "Shots against",
  GOALIE_MINUTES: "Goalie minutes", WINS_GOALIE: "Wins", SHUTOUTS_GOALIE: "Shutouts",
};
/** Raw sign is "more of the statistic"; these targets are favorable when lower. */
export const LOWER_IS_BETTER: ReadonlySet<string> = new Set(["GOALS_AGAINST_GOALIE", "GOALS_AGAINST_AVERAGE"]);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** `confirmed_absent` is a verified nonappearance (zero output); `unknown` is a missing or unverified row. */
export type TeamGameStatus = "appeared" | "confirmed_absent" | "unknown";

export type ObservedTeamGame = {
  gameId: string;
  /** Game date (YYYY-MM-DD) in the evidence time zone. */
  date: string;
  team: string;
  status: TeamGameStatus;
  /** When this row became available to the reader. A completed game whose row was not available at `asOf` stays in the
   * window as unknown (its data is excluded, its identity is not), so an older game never backfills it. */
  availableAt: string;
  /** All-situation minutes and power-play minutes; null means unknown, never zero. */
  toiMinutes: number | null;
  ppToiMinutes: number | null;
  /** Counts for appeared games; a null or absent value is unknown. */
  stats: Partial<Record<SkaterTarget, number | null>>;
  /** All-situation on-ice team goals for IPP (same games and strength as POINTS). */
  onIceGoalsFor?: number | null;
  goalie?: { saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; minutes: number | null;
    /** Source-recorded participation; never inferred from minutes or an appearance. */
    appearanceType?: "start" | "relief" | "unknown" };
};

export type ObservedEvidence = {
  evidenceSnapshotId: string;
  playerId: string;
  /** Display name from the evidence source; required when no FORGE forecast is supplied. */
  playerName?: string;
  modelClass: ModelClass;
  /** Fantasy eligibility as recorded by the source, e.g. ["C", "LW"]. Display only. */
  eligibility: string[];
  strengthScope: "all_situations";
  /** Latest source event included and when the snapshot was captured. */
  sourceCutoffAt: string;
  capturedAt: string;
  /** True when historical availability times are reconstructed rather than recorded. */
  retrospective: boolean;
  /** Completed team games before the cutoff, in any order. */
  teamGames: ObservedTeamGame[];
  /** Dated role evidence; absent means unknown. Never inferred from production. `knownAt` is when the report became
   * available: evidence effective before as-of but known after it is excluded. */
  roleEvidence?: RoleEvidence[];
};

export type RoleEvidence = { kind: "pp_unit" | "line" | "injury_replacement"; label: string; effectiveAt: string; knownAt: string; source: string };

export type ForgePlayerExpectation = GameExpectationsResponse["players"][number];
export type ForgeForecastInput = Pick<GameExpectationsResponse,
  "version" | "readAsOf" | "scope" | "manifestId" | "baselineChecksum" | "limitations"> & {
  player: ForgePlayerExpectation;
};

export type OpportunityRule = {
  ruleId: string;
  version: string;
  /** "provisional_fixture" values are illustrative only; magnitude, persistence and hysteresis are undecided. */
  status: "provisional_fixture" | "accepted";
  minToiChangeMinutes: number;
  minPpToiChangeMinutes: number;
  minAppearancesEachBlock: number;
};

/** A versioned, point-in-time class reference (decision 68): admitted only when its cutoff precedes the window. */
export type ClassReference = {
  value: number; source: string; status: "fixture_illustrative" | "accepted";
  version: string; cutoffAt: string | null; population: string | null; sampleSize: number | null;
};

export type InterpretationConfig = {
  configId: string;
  version: string;
  status: "provisional_fixture" | "accepted";
  recentWindowTeamGames: RecentWindowGames;
  /** Below this many appearances a rate is shown with a sparse-sample warning. */
  minAppearancesForRate: number;
  maxEvidenceAgeHours: number;
  /** Null means no alert rule is accepted: the change is shown but not classified. */
  opportunityRule: OpportunityRule | null;
  /** Separate F and D IPP references. No pooled reference is permitted. */
  ippReferences: Partial<Record<"F" | "D", ClassReference>>;
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** A value or an explicit reason it is unavailable. A null value is never a zero. */
export type Measured = { value: number | null; reason: string | null };

/** Sign of a signed difference; carries no alert or advice meaning (decision 130). */
export type GapSign = "positive" | "negative" | "zero" | "unavailable";
/**
 * @deprecated v0.3. Sign alias kept only so the Buy Low/Sell High consumers keep compiling until they read `gapSign`
 * (CLAUDE-FIX-L21-A1-D3-20261112). No Rebound/Cooling words may be displayed from it before an alert contract exists.
 */
export type GapDirection = "rebound" | "cooling" | "level" | "unavailable";

/** One named signed difference in native units per team game. Comparisons are never combined (decision 131). */
export type SignedComparison = Measured & {
  unit: "count_per_team_game";
  minuend: "forge_expected_per_scheduled_team_game" | "recent_observed_per_team_game";
  subtrahend: "recent_observed_per_team_game" | "preceding_disjoint_block_per_team_game" | "same_window_support_expectation";
};

export type MetricInterpretation = {
  target: SkaterTarget;
  label: string;
  unit: "count";
  observedPerTeamGame: Measured;
  observedPerAppearance: Measured;
  /** Same player's immediately preceding, disjoint block; descriptive, not an expected future rate. */
  personalReference: { perTeamGame: Measured; perAppearance: Measured; changePerTeamGame: Measured };
  /** FORGE unconditional horizon total / scheduled team games. Already includes participation. */
  expectedPerTeamGame: Measured;
  /** Mean FORGE conditional (per appearance) value; labeled conditional, never a horizon total. */
  expectedPerAppearanceConditional: Measured;
  /** D = expected − recent observed, both per team game. Positive = more expected than recently produced.
   * Its uncertainty is Var(F) + Var(R) − 2Cov(F, R), which is not supplied; no alert threshold is applied. */
  gapPerTeamGame: Measured;
  gapSign: GapSign;
  /** @deprecated v0.3: use `gapSign`. */
  direction: GapDirection;
  /** Three separate questions (R2): forward forecast vs recent, recent vs the player's own earlier block, and
   * observed vs a same-window support expectation. None is folded into another. */
  comparisons: {
    forecastVsRecent: SignedComparison;
    recentVsPersonalReference: SignedComparison;
    observedVsSameWindowSupport: SignedComparison;
  };
  /** Change versus a prior FORGE issuance of the same target, horizon and unit. Separate from the gap. */
  outlookChangePerTeamGame: Measured;
  /** Sample SD of per-team-game values over the recent window (observed history, not forecast spread). */
  observedVariability: Measured;
  sparse: boolean;
};

export type OpportunityDirection = "rising" | "falling" | "steady" | "unclassified" | "unknown";

export type OpportunityBlock = {
  startDate: string | null; endDate: string | null; teamGames: number; appearances: number; gameIds: string[];
  /** Conditional on appearing. */
  toiPerAppearance: Measured; ppToiPerAppearance: Measured;
  /** Unconditional: confirmed absences count as zero minutes; unknown games withhold. */
  toiPerTeamGame: Measured; appearanceShare: Measured;
};

export type OpportunityInterpretation = {
  recent: OpportunityBlock;
  prior: OpportunityBlock;
  /** Per-appearance minute changes; `direction` classifies these only, and is never "steady" when appearance share
   * moved, PP minutes are unknown or a known role change falls in the window. */
  toiChangeMinutes: Measured;
  ppToiChangeMinutes: Measured;
  toiPerTeamGameChange: Measured;
  appearanceShareChange: Measured;
  direction: OpportunityDirection;
  /** Accessible text label; never a buy/sell instruction. */
  label: string;
  ruleId: string | null;
  ruleStatus: OpportunityRule["status"] | "none";
  /** Coverage of the recent comparison block. Not the duration of a change: no episode onset or length is measured. */
  blockCoverage: { kind: "comparison_block_not_episode"; teamGames: number; appearances: number; startDate: string | null; endDate: string | null };
  powerPlayRole: { value: string | null; status: "sourced" | "unavailable"; source: string | null; effectiveAt: string | null; knownAt: string | null };
  /** Role evidence known by as-of and effective inside the recent block: context, neither discounted nor assumed permanent. */
  roleChanges: RoleEvidence[];
  /** Role reports dropped because they were not known by as-of or carry no valid clocks. */
  roleEvidenceExcluded: number;
  scenarios: { status: "not_supplied"; reason: string };
};

export type GoalieResults = {
    appearances: number; saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; minutes: number | null;
    savePercentage: Measured; goalsAgainstAverage: Measured;
    starts: Measured; reliefAppearances: Measured; startShare: Measured;
  };

export type GoalieInterpretation = {
  observed: GoalieResults;
  personalReference: GoalieResults;
  expected: {
    savePercentage: Measured; goalsAgainstAverage: Measured; expectedStarts: Measured;
    interpretation: "ratio_of_expected_totals";
  };
  gap: { status: "pending_goalie_adapter"; reason: string };
};

export type Explanation = { id: string; text: string; facts: string[] };

/** Admission of one forecast target for the record's comparisons (A1). */
export type TargetAdmission = {
  status: "admitted" | "withheld";
  reasons: string[];
  unit: "count" | "minutes" | null;
  /** True only when every horizon game permits the use. */
  allowedUses: { totals: boolean; comparison: boolean };
  coveredGames: number; requiredGames: number; gameIds: string[];
  /** Composite clocks: latest cutoff, latest issuance, earliest expiry over the horizon games. */
  cutoffAt: string | null; issuedAt: string | null; expiresAt: string | null;
  sourceIds: string[];
};

export type ForecastAdmission = {
  status: "admitted" | "not_admitted" | "no_forecast";
  reasons: string[];
  readAsOf: string | null;
  /** A cached earlier issuance may be used; one read or issued after as-of never is. */
  policy: "read_and_issued_at_or_before_as_of";
  targets: Record<string, TargetAdmission>;
};

export type InterpretationRecord = {
  contractVersion: typeof SKO_CONTRACT_VERSION;
  config: { configId: string; version: string; status: InterpretationConfig["status"] };
  fixture: boolean;
  asOf: string;
  identity: {
    playerId: string; name: string; team: string | null; modelClass: ModelClass; eligibility: string[];
    /** Forecast fields are null for an observation-only record (no FORGE forecast supplied). */
    evidenceSnapshotId: string; forecastVersion: string | null; forecastManifestId: string | null;
    forecastReadAsOf: string | null; baselineChecksum: string | null;
  };
  horizon: {
    requestedGames: number; scheduledGames: number; complete: boolean; gameIds: string[];
    startDate: string | null; endDate: string | null;
    expectedAppearances: number | null; expectedStarts: number | null; reason: string | null;
  };
  recentWindow: {
    requestedTeamGames: number; teamGames: number; appearances: number; confirmedAbsences: number;
    unknownGames: number; startDate: string | null; endDate: string | null; rule: string;
    /** Exact team-game identities in the window, oldest first. */
    gameIds: string[];
    /** "incomplete" when a source row could not be placed (no game id or an impossible date): rates are withheld. */
    membership: "complete" | "incomplete"; unplacedRows: number;
  };
  personalReferenceWindow: {
    teamGames: number; appearances: number; unknownGames: number; gameIds: string[];
    startDate: string | null; endDate: string | null;
    method: "preceding_disjoint_team_game_block";
  };
  /** FORGE horizon totals for comparison arithmetic (trade reads these). A value is passed through unchanged only when its
   * target is admitted for totals and comparison; otherwise `expected` is null with the admission reason, so a denied
   * value cannot be recovered by summing. Full provenance is in `forecastAdmission.targets`. */
  forecastTotals: Record<string, { expected: number | null; unit: "count" | "minutes" | null; reason: string | null }>;
  forecastAdmission: ForecastAdmission;
  /** The prior issuance used for outlook change, validated at its own read time. */
  priorForecastAdmission: { status: "admitted" | "not_admitted"; reasons: string[]; readAsOf: string | null; sameGameIds: boolean | null } | null;
  metrics: MetricInterpretation[];
  ipp: {
    observed: Measured; reference: Measured; deviation: Measured; referenceSource: string | null; strength: "all_situations";
    /** Pooled exposure behind `observed`; one on-ice goal is not ten appearances of information. No universal minimum is set. */
    exposure: { appearances: number; points: number | null; onIceGoalsFor: number | null };
    referenceMeta: Pick<ClassReference, "version" | "status" | "cutoffAt" | "population" | "sampleSize"> | null;
    /** Same player's preceding disjoint block, for an own-history comparison beside the class reference. */
    personalReference: Measured;
  };
  opportunity: OpportunityInterpretation | null;
  goalie: GoalieInterpretation | null;
  uncertainty: { predictiveSpread: Measured; meanUncertainty: Measured };
  freshness: {
    evidenceCutoffAt: string; evidenceAgeHours: number | null; evidenceStatus: "fresh" | "stale" | "invalid";
    /** "unknown" when any supplied target lacks a valid expiry; "not_admitted" when the forecast fails admission. */
    forecastExpiresAt: string | null; forecastStatus: "current" | "expired" | "unknown" | "not_admitted";
  };
  diagnostics: {
    excludedFutureRows: number; invalidRows: number; duplicateRows: number; conflictingGameIds: string[]; retrospective: boolean;
    unplacedRows: number;
  };
  explanations: Explanation[];
  limitations: string[];
};

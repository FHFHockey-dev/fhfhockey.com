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

export const SKO_CONTRACT_VERSION = "sko-interpretation-v0.1" as const;

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
  /** When this row became available to the reader. Rows available after `asOf` are excluded. */
  availableAt: string;
  /** All-situation minutes and power-play minutes; null means unknown, never zero. */
  toiMinutes: number | null;
  ppToiMinutes: number | null;
  /** Counts for appeared games; a null or absent value is unknown. */
  stats: Partial<Record<SkaterTarget, number | null>>;
  /** All-situation on-ice team goals for IPP (same games and strength as POINTS). */
  onIceGoalsFor?: number | null;
  goalie?: { saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; minutes: number | null };
};

export type ObservedEvidence = {
  evidenceSnapshotId: string;
  playerId: string;
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
  /** Dated role evidence; absent means unknown. Never inferred from production. */
  roleEvidence?: Array<{ kind: "pp_unit" | "line" | "injury_replacement"; label: string; effectiveAt: string; source: string }>;
};

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

export type ClassReference = { value: number; source: string; status: "fixture_illustrative" | "accepted" };

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

export type GapDirection = "rebound" | "cooling" | "level" | "unavailable";

export type MetricInterpretation = {
  target: SkaterTarget;
  label: string;
  unit: "count";
  observedPerTeamGame: Measured;
  observedPerAppearance: Measured;
  /** FORGE unconditional horizon total / scheduled team games. Already includes participation. */
  expectedPerTeamGame: Measured;
  /** Mean FORGE conditional (per appearance) value; labeled conditional, never a horizon total. */
  expectedPerAppearanceConditional: Measured;
  /** D = expected − recent observed, both per team game. Positive = more expected than recently produced. */
  gapPerTeamGame: Measured;
  direction: GapDirection;
  /** Change versus a prior FORGE issuance of the same target, horizon and unit. Separate from the gap. */
  outlookChangePerTeamGame: Measured;
  /** Sample SD of per-team-game values over the recent window (observed history, not forecast spread). */
  observedVariability: Measured;
  sparse: boolean;
};

export type OpportunityDirection = "rising" | "falling" | "steady" | "unclassified" | "unknown";

export type OpportunityBlock = {
  startDate: string | null; endDate: string | null; teamGames: number; appearances: number;
  toiPerAppearance: Measured; ppToiPerAppearance: Measured;
};

export type OpportunityInterpretation = {
  recent: OpportunityBlock;
  prior: OpportunityBlock;
  toiChangeMinutes: Measured;
  ppToiChangeMinutes: Measured;
  direction: OpportunityDirection;
  /** Accessible text label; never a buy/sell instruction. */
  label: string;
  ruleId: string | null;
  ruleStatus: OpportunityRule["status"] | "none";
  /** Observed history only; not a forecast of how long the change lasts. */
  observedDuration: { appearances: number; startDate: string | null; endDate: string | null };
  powerPlayRole: { value: string | null; status: "sourced" | "unavailable"; source: string | null; effectiveAt: string | null };
  scenarios: { status: "not_supplied"; reason: string };
};

export type GoalieInterpretation = {
  observed: {
    appearances: number; saves: number | null; shotsAgainst: number | null; goalsAgainst: number | null; minutes: number | null;
    savePercentage: Measured; goalsAgainstAverage: Measured;
  };
  expected: {
    savePercentage: Measured; goalsAgainstAverage: Measured; expectedStarts: Measured;
    interpretation: "ratio_of_expected_totals";
  };
  gap: { status: "pending_goalie_adapter"; reason: string };
};

export type Explanation = { id: string; text: string; facts: string[] };

export type InterpretationRecord = {
  contractVersion: typeof SKO_CONTRACT_VERSION;
  config: { configId: string; version: string; status: InterpretationConfig["status"] };
  fixture: boolean;
  asOf: string;
  identity: {
    playerId: string; name: string; team: string | null; modelClass: ModelClass; eligibility: string[];
    evidenceSnapshotId: string; forecastVersion: string; forecastManifestId: string | null;
    forecastReadAsOf: string; baselineChecksum: string | null;
  };
  horizon: {
    requestedGames: number; scheduledGames: number; complete: boolean; gameIds: string[];
    startDate: string | null; endDate: string | null;
    expectedAppearances: number | null; expectedStarts: number | null; reason: string | null;
  };
  recentWindow: {
    requestedTeamGames: number; teamGames: number; appearances: number; confirmedAbsences: number;
    unknownGames: number; startDate: string | null; endDate: string | null; rule: string;
  };
  /** Unmodified FORGE horizon totals, passed through for both pages (trade arithmetic reads these). */
  forecastTotals: Record<string, { expected: number | null; unit: "count" | "minutes" | null; reason: string | null }>;
  metrics: MetricInterpretation[];
  ipp: { observed: Measured; reference: Measured; deviation: Measured; referenceSource: string | null; strength: "all_situations" };
  opportunity: OpportunityInterpretation | null;
  goalie: GoalieInterpretation | null;
  uncertainty: { predictiveSpread: Measured; meanUncertainty: Measured };
  freshness: {
    evidenceCutoffAt: string; evidenceAgeHours: number | null; evidenceStatus: "fresh" | "stale" | "invalid";
    forecastExpiresAt: string | null; forecastStatus: "current" | "expired" | "unknown";
  };
  diagnostics: {
    excludedFutureRows: number; invalidRows: number; duplicateRows: number; conflictingGameIds: string[]; retrospective: boolean;
  };
  explanations: Explanation[];
  limitations: string[];
};

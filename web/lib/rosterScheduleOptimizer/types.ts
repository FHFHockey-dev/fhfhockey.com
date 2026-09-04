export type PlayerClass = "skater" | "goalie";

export type CanonicalEligibility =
  | "C"
  | "LW"
  | "RW"
  | "F"
  | "W"
  | "D"
  | "UTIL"
  | "G";

export type ActiveSlotType = CanonicalEligibility;

export type NormalizedEligibility = {
  valid: boolean;
  positions: readonly CanonicalEligibility[];
  playerClass: PlayerClass | null;
  unknownLabels: readonly string[];
  sourceLabels: readonly string[];
};

export type RosterPlayerStatus =
  | "active"
  | "bench"
  | "ir"
  | "ir+"
  | "na"
  | "inactive";

export type OptimizerPlayer = {
  id: string;
  name?: string;
  teamAbbreviation: string | null;
  eligiblePositions: string | readonly string[] | null;
  value: number;
  status?: RosterPlayerStatus;
  available?: boolean;
};

export type ActiveSlotInstance = {
  id: string;
  type: ActiveSlotType;
  index: number;
};

export type SlotExpansion = {
  activeSlots: readonly ActiveSlotInstance[];
  benchCapacity: number;
  inactiveCapacity: number;
  diagnostics: readonly OptimizerDiagnostic[];
};

export type ScheduleGameStatus =
  | "scheduled"
  | "live"
  | "final"
  | "postponed"
  | "cancelled";

export type TeamScheduleGame = {
  gameId?: string;
  date: string;
  teamAbbreviation: string;
  yahooWeek?: number | null;
  status?: ScheduleGameStatus;
};

export type YahooMatchupWeek = {
  id?: string | number;
  gameKey: string;
  season: string | number;
  week: number;
  startDate: string;
  endDate: string;
};

export type DateToWeekResult =
  | { status: "mapped"; week: YahooMatchupWeek }
  | {
      status: "unmapped";
      reason: "invalid_date" | "outside_weeks" | "overlapping_weeks";
      matchingWeeks: readonly YahooMatchupWeek[];
    };

export type OptimizerDiagnosticCode =
  | "EMPTY_ELIGIBILITY"
  | "UNKNOWN_ELIGIBILITY"
  | "MIXED_PLAYER_CLASS"
  | "UNKNOWN_ROSTER_SLOT"
  | "INVALID_SLOT_COUNT"
  | "INVALID_PLAYER_VALUE"
  | "DUPLICATE_PLAYER_ID"
  | "INVALID_DATE"
  | "UNMAPPED_DATE"
  | "OVERLAPPING_MATCHUP_WEEKS"
  | "UNKNOWN_TEAM"
  | "MISSING_TEAM"
  | "DUPLICATE_TEAM_DATE"
  | "EMPTY_SCHEDULE"
  | "ROSTER_OVER_CAPACITY"
  | "WEEKLY_LINEUP_UNSUPPORTED";

export type OptimizerDiagnostic = {
  code: OptimizerDiagnosticCode;
  severity: "warning" | "error";
  message: string;
  playerId?: string;
  playerName?: string;
  date?: string;
  teamAbbreviation?: string;
  position?: string;
};

export type PlayerAssignment = {
  playerId: string;
  playerName?: string;
  slotId: string;
  slotType: ActiveSlotType;
  value: number;
};

export type UnresolvedScheduledPlayer = {
  playerId: string;
  playerName?: string;
  reason: "invalid_eligibility";
};

export type DailyAssignment = {
  date: string;
  yahooWeek: number | null;
  scheduledPlayerIds: readonly string[];
  assignments: readonly PlayerAssignment[];
  benchedPlayerIds: readonly string[];
  unresolvedPlayers: readonly UnresolvedScheduledPlayer[];
  scheduledGames: number;
  startableGames: number;
  benchGames: number;
  unresolvedGames: number;
};

export type DailyMatchResult = {
  assignment: DailyAssignment;
  diagnostics: readonly OptimizerDiagnostic[];
};

export type WeeklyBenchGames = {
  week: number | null;
  scheduledGames: number;
  startableGames: number;
  benchGames: number;
  unresolvedGames: number;
};

export type PlayerBenchGames = {
  playerId: string;
  playerName?: string;
  scheduledGames: number;
  startableGames: number;
  benchGames: number;
  unresolvedGames: number;
};

export type PositionCongestion = {
  position: CanonicalEligibility;
  scheduledGames: number;
  benchGames: number;
};

export type RosterEvaluation = {
  totalScheduledGames: number;
  totalStartableGames: number;
  totalBenchGames: number;
  totalUnresolvedGames: number;
  dustRate: number;
  activeSlotUtilization: number;
  daily: readonly DailyAssignment[];
  weekly: readonly WeeklyBenchGames[];
  players: readonly PlayerBenchGames[];
  positions: readonly PositionCongestion[];
  highestConflictDates: readonly DailyAssignment[];
  diagnostics: readonly OptimizerDiagnostic[];
  complete: boolean;
};

export type LineupMode = "daily" | "weekly";

export type PrepareScheduleOptions = {
  matchupWeeks?: readonly YahooMatchupWeek[];
  selectedWeeks?: readonly number[];
  gameKey?: string;
  knownTeamAbbreviations?: readonly string[];
};

export type PreparedScheduleGame = {
  gameId?: string;
  date: string;
  teamAbbreviation: string;
  yahooWeek: number | null;
};

export type PreparedSchedule = {
  gamesByTeam: ReadonlyMap<string, readonly PreparedScheduleGame[]>;
  gamesByDate: ReadonlyMap<string, readonly PreparedScheduleGame[]>;
  knownTeams: ReadonlySet<string>;
  selectedWeeks: ReadonlySet<number> | null;
  diagnostics: readonly OptimizerDiagnostic[];
};

export type RosterEvaluationInput = {
  roster: readonly OptimizerPlayer[];
  rosterSlots: Readonly<Record<string, number>>;
  schedule: PreparedSchedule;
  lineupMode?: LineupMode;
};

export type CandidateDustEvaluation = {
  player: OptimizerPlayer;
  marginalDustGames: number;
  candidateScheduledGames: number;
  activeGamesAdded: number;
  candidateStartableGames: number;
  candidateAttributedBenchGames: number;
  displacedRosterBenchGames: number;
  dustRate: number;
  weekByWeek: readonly CandidateWeeklyDust[];
  highestConflictDates: readonly DailyAssignment[];
  diagnostics: readonly OptimizerDiagnostic[];
};

export type CandidateDustComparable = Pick<
  CandidateDustEvaluation,
  "player" | "marginalDustGames"
>;

export type CandidateWeeklyDust = {
  week: number | null;
  candidateScheduledGames: number;
  candidateStartableGames: number;
  candidateAttributedBenchGames: number;
  displacedRosterBenchGames: number;
  marginalDustGames: number;
};

export type RecommendationThresholds = {
  minimumDustImprovement: number;
  minimumRelativeDustImprovement: number;
  maximumRelativeValueLoss: number;
  maximumAbsoluteValueLoss?: number;
};

export const DEFAULT_RECOMMENDATION_THRESHOLDS: RecommendationThresholds = {
  minimumDustImprovement: 2,
  minimumRelativeDustImprovement: 0.25,
  maximumRelativeValueLoss: 0.05,
};

export type DustRiskLabel = "low" | "moderate" | "elevated" | "high";

export type DustRiskBoundary = {
  minimumDustGames: number;
  minimumDustRate: number;
};

export type DustRiskThresholds = {
  moderate: DustRiskBoundary;
  elevated: DustRiskBoundary;
  high: DustRiskBoundary;
};

export const DEFAULT_DUST_RISK_THRESHOLDS: DustRiskThresholds = {
  moderate: { minimumDustGames: 2, minimumDustRate: 0.05 },
  elevated: { minimumDustGames: 4, minimumDustRate: 0.1 },
  high: { minimumDustGames: 7, minimumDustRate: 0.15 },
};

export type DustRisk = {
  label: DustRiskLabel;
  marginalDustGames: number;
  scheduledGames: number;
  dustRate: number;
};

export type AlternativeRecommendation<
  TDust extends CandidateDustComparable = CandidateDustEvaluation,
> = {
  player: OptimizerPlayer;
  dust: TDust;
  dustImprovement: number;
  valueDifference: number;
  relativeValueLoss: number;
  overlappingSlotTypes: readonly ActiveSlotType[];
};

export type OptimizerCacheSignatureInput = {
  roster: readonly OptimizerPlayer[];
  rosterSlots: Readonly<Record<string, number>>;
  gameKey: string;
  selectedWeeks: readonly number[];
  scheduleVersion: string;
  lineupMode?: LineupMode;
};

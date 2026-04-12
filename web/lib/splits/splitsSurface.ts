export type SplitTeamOption = {
  abbreviation: string;
  name: string;
};

export type SplitLandingSkaterLeader = {
  playerId: number;
  playerName: string;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  positionCode: string | null;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  pointsPerGame: number | null;
};

export type SplitLandingGoalieLeader = {
  playerId: number;
  playerName: string;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  gamesPlayed: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number | null;
};

export type SplitPpShotShareRow = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
  ppShotSharePct: number | null;
};

export type SplitSkaterRow = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
  gamesPlayed: number;
  averageToiSeconds: number | null;
  goals: number;
  assists: number;
  points: number;
  pointsPerGame: number | null;
  shotsOnGoal: number;
  shootingPct: number | null;
  powerPlayToiSecondsPerGame: number | null;
  powerPlayPct: number | null;
  powerPlayGoals: number;
  powerPlayAssists: number;
  powerPlayPoints: number;
  plusMinus: number;
  pim: number;
  faceoffWinPct: number | null;
  hits: number;
  blocks: number;
};

export type SplitGoalieRow = {
  playerId: number;
  playerName: string;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otl: number;
  goalsAllowed: number;
  shotsAgainst: number;
  savePct: number | null;
  goalsAllowedAverage: number | null;
  shutouts: number;
  qualityStarts: number;
  qualityStartsPct: number | null;
};

export type SplitRosterSection = {
  skaters: SplitSkaterRow[];
  goalies: SplitGoalieRow[];
};

export type SplitsApiResponse = {
  generatedAt: string;
  seasonId: number;
  teamOptions: SplitTeamOption[];
  selection: {
    teamAbbreviation: string | null;
    opponentAbbreviation: string | null;
    effectiveOpponentAbbreviation: string | null;
  };
  landing: {
    topSkaters: SplitLandingSkaterLeader[];
    topGoalies: SplitLandingGoalieLeader[];
  };
  ppShotShare: SplitPpShotShareRow[];
  roster: SplitRosterSection | null;
};

export type SplitsApiError = {
  error: string;
  issues?: string[];
};

export function normalizeTeamAbbreviation(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function buildSplitTeamOptions(
  teams: readonly SplitTeamOption[]
): SplitTeamOption[] {
  return [...teams].sort((left, right) =>
    left.abbreviation.localeCompare(right.abbreviation)
  );
}

export function resolveDefaultOpponentAbbreviation(args: {
  selectedTeamAbbreviation: string;
  teamOptions: readonly SplitTeamOption[];
}): string | null {
  return (
    args.teamOptions.find(
      (team) => team.abbreviation !== args.selectedTeamAbbreviation
    )?.abbreviation ?? null
  );
}

export function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toRounded(value: number | null): number | null {
  return value == null ? null : Number(value.toFixed(3));
}

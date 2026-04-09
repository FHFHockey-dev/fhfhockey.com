import type { TeamStatsLandingApiRow } from "lib/underlying-stats/teamStatsLandingApi";

export type SplitTeamOption = {
  abbreviation: string;
  name: string;
};

export type SplitPlayerOption = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
};

export type SplitPpShotShareRow = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
  ppShots: number;
  ppShotSharePct: number | null;
};

export type SplitLeaderRow = {
  playerId: number;
  playerName: string;
  positionCode: string | null;
  teamLabel: string;
  fantasyPulse: number | null;
  shotsPer60: number | null;
  totalPointsPer60: number | null;
  ixgPer60: number | null;
  ppShotSharePct: number | null;
};

export type SplitMatchupCard = {
  key: string;
  label: string;
  description: string;
  teamValue: number | null;
  opponentValue: number | null;
  teamCaption: string;
  opponentCaption: string;
  edge: "favorable" | "warning" | "neutral";
};

export type SplitPlayerSnapshot = {
  gamesPlayed: number;
  toiPerGameSeconds: number | null;
  shotsPer60: number | null;
  totalPointsPer60: number | null;
  ixgPer60: number | null;
  goalsPer60: number | null;
  ppShotSharePct: number | null;
};

export type SplitPlayerVsTeamSummary = {
  playerId: number;
  playerName: string;
  teamLabel: string;
  opponentLabel: string;
  season: SplitPlayerSnapshot | null;
  versusOpponent: SplitPlayerSnapshot | null;
};

export type SplitsApiResponse = {
  generatedAt: string;
  seasonId: number;
  selection: {
    teamAbbreviation: string;
    opponentAbbreviation: string | null;
    playerId: number | null;
  };
  playerOptions: SplitPlayerOption[];
  matchupCards: SplitMatchupCard[];
  teamLeaders: SplitLeaderRow[];
  ppShotShare: SplitPpShotShareRow[];
  playerVsTeam: SplitPlayerVsTeamSummary | null;
};

export type SplitsApiError = {
  error: string;
  issues?: string[];
};

type NumericRecord = Record<string, unknown>;

const FAVORABLE_EDGE_THRESHOLD = 0.05;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeTeamAbbreviation(value: string | null | undefined): string | null {
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

export function buildPpShotShareRows(
  rows: readonly NumericRecord[]
): SplitPpShotShareRow[] {
  const totalShots = rows.reduce((sum, row) => {
    const shots = toFiniteNumber(row.shots);
    return shots == null ? sum : sum + shots;
  }, 0);

  return [...rows]
    .map((row) => {
      const shots = toFiniteNumber(row.shots) ?? 0;
      return {
        playerId: Number(row.playerId),
        playerName: toNullableString(row.playerName) ?? `Player ${row.playerId}`,
        positionCode: toNullableString(row.positionCode),
        ppShots: shots,
        ppShotSharePct: totalShots > 0 ? shots / totalShots : null,
      } satisfies SplitPpShotShareRow;
    })
    .filter((row) => Number.isFinite(row.playerId) && row.playerId > 0)
    .sort((left, right) => {
      const byShare = (right.ppShotSharePct ?? -1) - (left.ppShotSharePct ?? -1);
      if (byShare !== 0) {
        return byShare;
      }

      return right.ppShots - left.ppShots;
    });
}

export function buildTeamLeaderRows(args: {
  leaderRows: readonly NumericRecord[];
  ppShotShareRows: readonly SplitPpShotShareRow[];
}): SplitLeaderRow[] {
  const ppShareByPlayerId = new Map(
    args.ppShotShareRows.map((row) => [row.playerId, row.ppShotSharePct])
  );

  return [...args.leaderRows]
    .map((row) => {
      const playerId = Number(row.playerId);
      const shotsPer60 = toFiniteNumber(row.shotsPer60);
      const totalPointsPer60 = toFiniteNumber(row.totalPointsPer60);
      const ixgPer60 = toFiniteNumber(row.ixgPer60);
      const ppShotSharePct = ppShareByPlayerId.get(playerId) ?? null;
      const fantasyPulse =
        shotsPer60 == null && totalPointsPer60 == null && ixgPer60 == null
          ? null
          : Number(
              (
                (shotsPer60 ?? 0) * 0.55 +
                (totalPointsPer60 ?? 0) * 2.4 +
                (ixgPer60 ?? 0) * 1.35 +
                (ppShotSharePct ?? 0) * 4
              ).toFixed(2)
            );

      return {
        playerId,
        playerName: toNullableString(row.playerName) ?? `Player ${playerId}`,
        positionCode: toNullableString(row.positionCode),
        teamLabel: toNullableString(row.teamLabel) ?? "—",
        fantasyPulse,
        shotsPer60,
        totalPointsPer60,
        ixgPer60,
        ppShotSharePct,
      } satisfies SplitLeaderRow;
    })
    .filter((row) => Number.isFinite(row.playerId) && row.playerId > 0)
    .sort((left, right) => {
      const byPulse = (right.fantasyPulse ?? -1) - (left.fantasyPulse ?? -1);
      if (byPulse !== 0) {
        return byPulse;
      }

      return (right.shotsPer60 ?? -1) - (left.shotsPer60 ?? -1);
    });
}

function toPerGame(total: number | null, gamesPlayed: number | null): number | null {
  if (total == null || gamesPlayed == null || gamesPlayed <= 0) {
    return null;
  }

  return total / gamesPlayed;
}

function toRounded(value: number | null): number | null {
  return value == null ? null : Number(value.toFixed(2));
}

function compareOffenseVsAllowance(
  teamValue: number | null,
  opponentValue: number | null
): SplitMatchupCard["edge"] {
  if (teamValue == null || opponentValue == null || opponentValue === 0) {
    return "neutral";
  }

  const relativeDelta = (teamValue - opponentValue) / Math.abs(opponentValue);
  if (relativeDelta >= FAVORABLE_EDGE_THRESHOLD) {
    return "favorable";
  }
  if (relativeDelta <= -FAVORABLE_EDGE_THRESHOLD) {
    return "warning";
  }
  return "neutral";
}

export function buildMatchupCards(args: {
  teamRow: TeamStatsLandingApiRow | null;
  opponentRow: TeamStatsLandingApiRow | null;
  teamPowerPlayRow: TeamStatsLandingApiRow | null;
  opponentPenaltyKillRow: TeamStatsLandingApiRow | null;
}): SplitMatchupCard[] {
  const { teamRow, opponentRow, teamPowerPlayRow, opponentPenaltyKillRow } = args;
  if (!teamRow || !opponentRow) {
    return [];
  }

  const shotsForPerGame = toPerGame(teamRow.sf, teamRow.gamesPlayed);
  const opponentShotsAgainstPerGame = toPerGame(opponentRow.sa, opponentRow.gamesPlayed);
  const goalsForPerGame = toPerGame(teamRow.gf, teamRow.gamesPlayed);
  const opponentGoalsAgainstPerGame = toPerGame(opponentRow.ga, opponentRow.gamesPlayed);
  const powerPlayGoalsPer60 = toFiniteNumber(teamPowerPlayRow?.gfPer60);
  const opponentPkGoalsAgainstPer60 = toFiniteNumber(opponentPenaltyKillRow?.gaPer60);

  return [
    {
      key: "shots",
      label: "L10 Shot Pressure",
      description: "Recent shot generation stacked against what the opponent has been allowing.",
      teamValue: toRounded(shotsForPerGame),
      opponentValue: toRounded(opponentShotsAgainstPerGame),
      teamCaption: "Team SF/GP",
      opponentCaption: "Opp SA/GP",
      edge: compareOffenseVsAllowance(shotsForPerGame, opponentShotsAgainstPerGame),
    },
    {
      key: "goals",
      label: "L10 Goal Pressure",
      description: "Recent finishing output against the opponent's recent goal suppression.",
      teamValue: toRounded(goalsForPerGame),
      opponentValue: toRounded(opponentGoalsAgainstPerGame),
      teamCaption: "Team GF/GP",
      opponentCaption: "Opp GA/GP",
      edge: compareOffenseVsAllowance(goalsForPerGame, opponentGoalsAgainstPerGame),
    },
    {
      key: "powerPlay",
      label: "L10 Special Teams",
      description: "Power-play scoring rate versus the opponent's recent penalty-kill resistance.",
      teamValue: toRounded(powerPlayGoalsPer60),
      opponentValue: toRounded(opponentPkGoalsAgainstPer60),
      teamCaption: "Team PP GF/60",
      opponentCaption: "Opp PK GA/60",
      edge: compareOffenseVsAllowance(
        powerPlayGoalsPer60,
        opponentPkGoalsAgainstPer60
      ),
    },
  ];
}

function buildPlayerSnapshot(row: NumericRecord | null, ppShotSharePct: number | null) {
  if (!row) {
    return null;
  }

  return {
    gamesPlayed: Number(row.gamesPlayed ?? 0),
    toiPerGameSeconds: toFiniteNumber(row.toiPerGameSeconds),
    shotsPer60: toFiniteNumber(row.shotsPer60),
    totalPointsPer60: toFiniteNumber(row.totalPointsPer60),
    ixgPer60: toFiniteNumber(row.ixgPer60),
    goalsPer60: toFiniteNumber(row.goalsPer60),
    ppShotSharePct,
  } satisfies SplitPlayerSnapshot;
}

export function buildPlayerVsTeamSummary(args: {
  baselineRow: NumericRecord | null;
  versusOpponentRow: NumericRecord | null;
  opponentLabel: string;
  ppShotSharePct: number | null;
}): SplitPlayerVsTeamSummary | null {
  const baselineRow = args.baselineRow;
  if (!baselineRow) {
    return null;
  }

  const playerId = Number(baselineRow.playerId);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    return null;
  }

  return {
    playerId,
    playerName: toNullableString(baselineRow.playerName) ?? `Player ${playerId}`,
    teamLabel: toNullableString(baselineRow.teamLabel) ?? "—",
    opponentLabel: args.opponentLabel,
    season: buildPlayerSnapshot(baselineRow, args.ppShotSharePct),
    versusOpponent: buildPlayerSnapshot(args.versusOpponentRow, args.ppShotSharePct),
  };
}

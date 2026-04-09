import serviceRoleClient from "lib/supabase/server";
import { teamsInfo } from "lib/teamsInfo";
import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
} from "lib/underlying-stats/playerStatsFilters";
import {
  buildPlayerStatsDetailAggregationFromState,
  buildPlayerStatsLandingAggregationFromState,
} from "lib/underlying-stats/playerStatsLandingServer";
import { createDefaultTeamLandingFilterState } from "lib/underlying-stats/teamStatsFilters";
import { queryTeamStatsLanding } from "lib/underlying-stats/teamStatsQueries";
import type { TeamStatsLandingApiRow } from "lib/underlying-stats/teamStatsLandingApi";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";

import {
  buildMatchupCards,
  buildPlayerVsTeamSummary,
  buildPpShotShareRows,
  buildSplitTeamOptions,
  buildTeamLeaderRows,
  normalizeTeamAbbreviation,
  type SplitPlayerOption,
  type SplitTeamOption,
  type SplitsApiResponse,
} from "./splitsSurface";

type TeamLookup = {
  abbreviation: string;
  id: number;
  name: string;
};

type RosterPlayerRow = {
  playerId: number;
  players: {
    fullName: string | null;
    position: string | null;
  } | null;
};

function getAllTeamOptions(): SplitTeamOption[] {
  return buildSplitTeamOptions(
    Object.entries(teamsInfo).map(([abbreviation, team]) => ({
      abbreviation,
      name: team.name,
    }))
  );
}

function resolveTeamLookup(abbreviation: string | null | undefined): TeamLookup | null {
  const normalized = normalizeTeamAbbreviation(abbreviation);
  if (!normalized) {
    return null;
  }

  const team = teamsInfo[normalized];
  if (!team) {
    return null;
  }

  return {
    abbreviation: normalized,
    id: team.id,
    name: team.name,
  };
}

async function fetchTeamRosterOptions(args: {
  currentSeasonId: number;
  teamId: number;
}): Promise<SplitPlayerOption[]> {
  const { data, error } = await serviceRoleClient
    .from("rosters")
    .select("playerId, players:playerId(fullName, position)")
    .eq("teamId", args.teamId)
    .eq("seasonId", args.currentSeasonId);

  if (error) {
    throw new Error(`Unable to load team roster options: ${error.message}`);
  }

  return ((data ?? []) as RosterPlayerRow[])
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.players?.fullName ?? `Player ${row.playerId}`,
      positionCode: row.players?.position ?? null,
    }))
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
}

async function fetchTeamLeaderRows(args: {
  currentSeasonId: number;
  teamId: number;
}) {
  const leaderState = createDefaultLandingFilterState({
    currentSeasonId: args.currentSeasonId,
    pageSize: 60,
  });
  leaderState.primary.strength = "allStrengths";
  leaderState.primary.statMode = "individual";
  leaderState.primary.displayMode = "rates";
  leaderState.expandable.teamId = args.teamId;
  leaderState.view.sort = {
    sortKey: "shotsPer60",
    direction: "desc",
  };

  return buildPlayerStatsLandingAggregationFromState(leaderState);
}

async function fetchPpShotShareRows(args: {
  currentSeasonId: number;
  teamId: number;
}) {
  const ppState = createDefaultLandingFilterState({
    currentSeasonId: args.currentSeasonId,
    pageSize: 60,
  });
  ppState.primary.strength = "powerPlay";
  ppState.primary.statMode = "individual";
  ppState.primary.displayMode = "counts";
  ppState.expandable.teamId = args.teamId;
  ppState.view.sort = {
    sortKey: "shots",
    direction: "desc",
  };

  return buildPlayerStatsLandingAggregationFromState(ppState);
}

async function fetchTeamContextRow(args: {
  currentSeasonId: number;
  teamId: number;
  strength: "allStrengths" | "powerPlay" | "penaltyKill";
  displayMode: "counts" | "rates";
}): Promise<TeamStatsLandingApiRow | null> {
  const teamState = createDefaultTeamLandingFilterState({
    currentSeasonId: args.currentSeasonId,
    pageSize: 1,
  });
  teamState.primary.strength = args.strength;
  teamState.primary.displayMode = args.displayMode;
  teamState.expandable.teamId = args.teamId;
  teamState.expandable.scope = {
    kind: "teamGameRange",
    value: 10,
  };

  const response = await queryTeamStatsLanding({
    state: teamState,
  });

  return response.rows[0] ?? null;
}

async function fetchPlayerDetailSummary(args: {
  currentSeasonId: number;
  playerId: number;
  opponentTeamId: number | null;
}) {
  const detailState = createDefaultDetailFilterState({
    currentSeasonId: args.currentSeasonId,
    pageSize: 10,
  });
  detailState.primary.strength = "allStrengths";
  detailState.primary.statMode = "individual";
  detailState.primary.displayMode = "rates";
  detailState.expandable.againstTeamId = args.opponentTeamId;
  detailState.view.sort = {
    sortKey: "shotsPer60",
    direction: "desc",
  };

  const response = await buildPlayerStatsDetailAggregationFromState(
    args.playerId,
    detailState
  );

  return response.rows[0] ?? null;
}

export async function buildSplitsSurface(args: {
  teamAbbreviation: string;
  opponentAbbreviation?: string | null;
  playerId?: number | null;
}): Promise<SplitsApiResponse> {
  const team = resolveTeamLookup(args.teamAbbreviation);
  if (!team) {
    throw new Error("Unknown team abbreviation.");
  }

  const opponent =
    args.opponentAbbreviation != null
      ? resolveTeamLookup(args.opponentAbbreviation)
      : null;
  if (args.opponentAbbreviation != null && !opponent) {
    throw new Error("Unknown opponent abbreviation.");
  }

  const currentSeason = await fetchCurrentSeason();
  const [playerOptions, leaderResponse, ppResponse] = await Promise.all([
    fetchTeamRosterOptions({
      currentSeasonId: currentSeason.id,
      teamId: team.id,
    }),
    fetchTeamLeaderRows({
      currentSeasonId: currentSeason.id,
      teamId: team.id,
    }),
    fetchPpShotShareRows({
      currentSeasonId: currentSeason.id,
      teamId: team.id,
    }),
  ]);

  const ppShotShareRows = buildPpShotShareRows(ppResponse.rows);
  const ppShotShareByPlayerId = new Map(
    ppShotShareRows.map((row) => [row.playerId, row.ppShotSharePct])
  );

  const teamLeaders = buildTeamLeaderRows({
    leaderRows: leaderResponse.rows,
    ppShotShareRows,
  }).slice(0, 14);

  const selectedPlayerId =
    typeof args.playerId === "number" && Number.isFinite(args.playerId)
      ? Math.trunc(args.playerId)
      : null;

  let matchupCards = [] as SplitsApiResponse["matchupCards"];
  let playerVsTeam = null as SplitsApiResponse["playerVsTeam"];

  if (opponent) {
    const [teamRow, opponentRow, teamPowerPlayRow, opponentPenaltyKillRow] =
      await Promise.all([
        fetchTeamContextRow({
          currentSeasonId: currentSeason.id,
          teamId: team.id,
          strength: "allStrengths",
          displayMode: "counts",
        }),
        fetchTeamContextRow({
          currentSeasonId: currentSeason.id,
          teamId: opponent.id,
          strength: "allStrengths",
          displayMode: "counts",
        }),
        fetchTeamContextRow({
          currentSeasonId: currentSeason.id,
          teamId: team.id,
          strength: "powerPlay",
          displayMode: "rates",
        }),
        fetchTeamContextRow({
          currentSeasonId: currentSeason.id,
          teamId: opponent.id,
          strength: "penaltyKill",
          displayMode: "rates",
        }),
      ]);

    matchupCards = buildMatchupCards({
      teamRow,
      opponentRow,
      teamPowerPlayRow,
      opponentPenaltyKillRow,
    });

    if (selectedPlayerId != null) {
      const [baselineRow, versusOpponentRow] = await Promise.all([
        fetchPlayerDetailSummary({
          currentSeasonId: currentSeason.id,
          playerId: selectedPlayerId,
          opponentTeamId: null,
        }),
        fetchPlayerDetailSummary({
          currentSeasonId: currentSeason.id,
          playerId: selectedPlayerId,
          opponentTeamId: opponent.id,
        }),
      ]);

      playerVsTeam = buildPlayerVsTeamSummary({
        baselineRow,
        versusOpponentRow,
        opponentLabel: opponent.abbreviation,
        ppShotSharePct: ppShotShareByPlayerId.get(selectedPlayerId) ?? null,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    seasonId: currentSeason.id,
    selection: {
      teamAbbreviation: team.abbreviation,
      opponentAbbreviation: opponent?.abbreviation ?? null,
      playerId: selectedPlayerId,
    },
    playerOptions,
    matchupCards,
    teamLeaders,
    ppShotShare: ppShotShareRows.slice(0, 12),
    playerVsTeam,
  };
}

export function getSplitsTeamOptions() {
  return getAllTeamOptions();
}

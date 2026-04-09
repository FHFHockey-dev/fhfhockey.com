import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";

import {
  Player,
  TeamColors,
  defaultColors,
  TableAggregateData
} from "components/WiGO/types";
import { getTeamInfoById, teamNameToAbbreviationMap } from "lib/teamsInfo";
import supabase from "lib/supabase";
import { fetchPlayerAggregatedStats } from "utils/fetchWigoPlayerStats";
import useCurrentSeason from "./useCurrentSeason";

export interface WigoSelectedPlayerDetails {
  player: Player;
  headshotUrl: string | null;
}

interface WigoBranding {
  teamColors: TeamColors;
  teamName: string;
  teamAbbreviation: string | null;
  teamIdForLog: number | null;
}

export const getWigoPlayerDetailsQueryKey = (playerId: number | null) =>
  ["wigoPlayerDetails", playerId] as const;

export const getWigoAggregatedStatsQueryKey = (playerId: number | null) =>
  ["wigoPlayerAggregatedStats", playerId] as const;

export const getPlayerIdFromQueryValue = (
  value: string | string[] | undefined
): number | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  const parsedId = Number(rawValue);
  return Number.isFinite(parsedId) ? parsedId : null;
};

export const buildWigoBranding = (
  teamId: number | null | undefined
): WigoBranding => {
  if (!teamId) {
    return {
      teamColors: defaultColors,
      teamName: "",
      teamAbbreviation: null,
      teamIdForLog: null
    };
  }

  const teamInfo = getTeamInfoById(teamId);

  if (!teamInfo) {
    return {
      teamColors: defaultColors,
      teamName: "",
      teamAbbreviation: null,
      teamIdForLog: teamId
    };
  }

  return {
    teamColors: {
      primaryColor: teamInfo.primaryColor,
      secondaryColor: teamInfo.secondaryColor,
      accentColor: teamInfo.accent,
      altColor: teamInfo.alt,
      jerseyColor: teamInfo.jersey
    },
    teamName: teamInfo.name,
    teamAbbreviation: teamNameToAbbreviationMap[teamInfo.name] ?? null,
    teamIdForLog: teamId
  };
};

export async function fetchWigoPlayerDetails(
  playerId: number
): Promise<WigoSelectedPlayerDetails | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  let headshotUrl = data.image_url || null;

  if (!headshotUrl) {
    try {
      const response = await fetch(
        `https://api-web.nhle.com/v1/player/${data.id}/landing`
      );

      if (response.ok) {
        const landingData = await response.json();
        headshotUrl = landingData.headshot || null;
      }
    } catch (error) {
      console.warn("Failed to fetch fallback player headshot", error);
    }
  }

  return {
    player: data as Player,
    headshotUrl
  };
}

export interface UseWigoPlayerDashboardResult {
  selectedPlayerId: number | null;
  selectedPlayer: Player | null;
  headshotUrl: string | null;
  currentSeasonId: number | null;
  teamColors: TeamColors;
  teamName: string;
  teamAbbreviation: string | null;
  teamIdForLog: number | null;
  rawCombinedData: TableAggregateData[];
  isLoadingAggData: boolean;
  isLoadingPlayer: boolean;
  aggDataError: string | null;
  playerDataError: string | null;
  handlePlayerSelect: (player: Player, headshotUrl: string) => void;
  updateUrlWith: (
    updates: Record<string, string | number | undefined>
  ) => Promise<boolean>;
}

export default function useWigoPlayerDashboard(): UseWigoPlayerDashboardResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentSeasonData = useCurrentSeason();
  const currentSeasonId = currentSeasonData?.seasonId ?? null;

  const selectedPlayerId = useMemo(
    () => getPlayerIdFromQueryValue(router.query.playerId),
    [router.query.playerId]
  );

  const selectedPlayerQuery = useQuery<WigoSelectedPlayerDetails | null>({
    queryKey: getWigoPlayerDetailsQueryKey(selectedPlayerId),
    queryFn: () => fetchWigoPlayerDetails(selectedPlayerId as number),
    enabled: typeof selectedPlayerId === "number"
  });

  const aggregatedStatsQuery = useQuery<TableAggregateData[]>({
    queryKey: getWigoAggregatedStatsQueryKey(selectedPlayerId),
    queryFn: () => fetchPlayerAggregatedStats(selectedPlayerId as number),
    enabled: typeof selectedPlayerId === "number"
  });

  const updateUrlWith = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const nextQuery = { ...router.query } as Record<string, string | number>;

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          delete nextQuery[key];
          return;
        }

        nextQuery[key] = value;
      });

      return router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        {
          shallow: true
        }
      );
    },
    [router]
  );

  const handlePlayerSelect = useCallback(
    (player: Player, headshotUrl: string) => {
      queryClient.setQueryData(getWigoPlayerDetailsQueryKey(player.id), {
        player,
        headshotUrl: headshotUrl || null
      });
      void updateUrlWith({ playerId: player.id });
    },
    [queryClient, updateUrlWith]
  );

  const selectedPlayer = selectedPlayerQuery.data?.player ?? null;
  const headshotUrl = selectedPlayerQuery.data?.headshotUrl ?? null;

  const branding = useMemo(
    () => buildWigoBranding(selectedPlayer?.team_id),
    [selectedPlayer?.team_id]
  );

  return {
    selectedPlayerId,
    selectedPlayer,
    headshotUrl,
    currentSeasonId,
    teamColors: branding.teamColors,
    teamName: branding.teamName,
    teamAbbreviation: branding.teamAbbreviation,
    teamIdForLog: branding.teamIdForLog,
    rawCombinedData: aggregatedStatsQuery.data ?? [],
    isLoadingAggData: aggregatedStatsQuery.isLoading,
    isLoadingPlayer: selectedPlayerQuery.isLoading,
    aggDataError:
      aggregatedStatsQuery.error instanceof Error
        ? aggregatedStatsQuery.error.message
        : null,
    playerDataError:
      selectedPlayerQuery.error instanceof Error
        ? selectedPlayerQuery.error.message
        : null,
    handlePlayerSelect,
    updateUrlWith
  };
}

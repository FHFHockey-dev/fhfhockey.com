import { useEffect, useMemo, useState } from "react";
import { teamsInfo } from "lib/teamsInfo";
import { calculateLinesAndPairs } from "./lineCombinationHelper";
import { getTOIDataForGames } from "./useTOIData";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";

type Source = "raw" | "aggregated";

type UseDRMParams = {
  teamAbbreviation: string | undefined;
  startDate: string | undefined; // YYYY-MM-DD
  endDate: string | undefined;   // YYYY-MM-DD
  mode: Mode;
  source: Source;
  aggregatedData?: any[]; // when source === 'aggregated'
};

type UseDRMReturn = {
  loading: boolean;
  teamId: number | undefined;
  teamName: string | undefined;
  roster: PlayerData[];
  toiData: TOIData[];
  homeAwayInfo: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export function useDateRangeMatrixData({
  teamAbbreviation,
  startDate,
  endDate,
  mode,
  source,
  aggregatedData = [],
}: UseDRMParams): UseDRMReturn {
  const [loading, setLoading] = useState<boolean>(false);
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [toiData, setToiData] = useState<TOIData[]>([]);
  const [homeAwayInfo, setHomeAwayInfo] = useState<
    { gameId: number; homeOrAway: string }[]
  >([]);
  const [playerATOI, setPlayerATOI] = useState<Record<number, string>>({});

  // Resolve team basics from abbreviation
  const teamId = useMemo(() => {
    if (!teamAbbreviation) return undefined;
    const info = (teamsInfo as any)[teamAbbreviation];
    return info?.id as number | undefined;
  }, [teamAbbreviation]);

  const teamName = useMemo(() => {
    if (!teamAbbreviation) return undefined;
    const info = (teamsInfo as any)[teamAbbreviation];
    return info?.name as string | undefined;
  }, [teamAbbreviation]);

  // Load data depending on source
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!teamAbbreviation || !startDate || !endDate) {
        setRoster([]);
        setToiData([]);
        setHomeAwayInfo([]);
        setPlayerATOI({});
        return;
      }
      setLoading(true);
      try {
        if (source === "raw") {
          const { toiData, roster, homeAwayInfo, playerATOI } =
            await getTOIDataForGames(teamAbbreviation, startDate, endDate);
          if (!mounted) return;
          setRoster(roster);
          setToiData(toiData);
          setHomeAwayInfo(homeAwayInfo);
          setPlayerATOI(playerATOI);
        } else {
          // aggregated: map incoming aggregated rows into PlayerData roster
          const mapped: PlayerData[] = (aggregatedData || []).map((item: any) => ({
            id: item.playerId,
            teamId: item.teamId,
            franchiseId: item.franchiseId,
            position: item.primaryPosition,
            sweaterNumber: item.sweaterNumber,
            name: item.playerName,
            playerAbbrevName: item.playerAbbrevName,
            lastName: item.lastName,
            totalTOI: item.regularSeasonData?.totalTOI ?? 0,
            timesOnLine: item.regularSeasonData?.timesOnLine ?? {},
            timesOnPair: item.regularSeasonData?.timesOnPair ?? {},
            percentToiWith: item.regularSeasonData?.percentToiWith ?? {},
            percentToiWithMixed: item.regularSeasonData?.percentToiWithMixed ?? {},
            timeSpentWith: item.regularSeasonData?.timeSpentWith ?? {},
            timeSpentWithMixed: item.regularSeasonData?.timeSpentWithMixed ?? {},
            GP: item.regularSeasonData?.GP ?? 0,
            timesPlayedWith: item.regularSeasonData?.timesPlayedWith ?? {},
            ATOI: item.regularSeasonData?.ATOI ?? "0:00",
            percentOfSeason: item.regularSeasonData?.percentOfSeason ?? {},
            displayPosition: item.regularSeasonData?.displayPosition ?? "",
            mutualSharedToi: {},
            comboPoints: item.comboPoints ?? 0,
          }));
          if (!mounted) return;
          setRoster(mapped);
          // For aggregated flow, upstream already has per-player ATOI; expose as map
          const map: Record<number, string> = {};
          mapped.forEach((p) => {
            map[p.id] = p.ATOI || "0:00";
          });
          setPlayerATOI(map);
          setToiData([]); // DateRangeMatrixInternal uses percentToiWith, so raw toi grid can be empty
          setHomeAwayInfo([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamAbbreviation, startDate, endDate, source, aggregatedData]);

  // Compute lines & pairs when roster/mode changes
  const { lines, pairs } = useMemo(() => {
    if (!roster || roster.length === 0) return { lines: [], pairs: [] };
    if (mode === "line-combination" || mode === "full-roster") {
      return calculateLinesAndPairs(roster, mode);
    }
    return { lines: [], pairs: [] };
  }, [roster, mode]);

  return {
    loading,
    teamId,
    teamName,
    roster,
    toiData,
    homeAwayInfo,
    playerATOI,
    lines,
    pairs,
  };
}


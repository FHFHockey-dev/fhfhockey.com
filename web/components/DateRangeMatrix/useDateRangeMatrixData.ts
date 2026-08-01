import { useEffect, useMemo, useRef, useState } from "react";
import { teamsInfo } from "lib/teamsInfo";
import { calculateLinesAndPairs } from "./lineCombinationHelper";
import type { AggregatedMatrixPlayer } from "./fetchAggregatedData";
import { getTOIDataForGames } from "./useTOIData";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";

type Source = "raw" | "aggregated";
export type DRMSeasonType = "regularSeason" | "playoffs";
export type DRMDataStatus =
  "idle" | "loading" | "success" | "empty" | "partial" | "error";

export type DRMDataCoverage = {
  inputRows: number;
  rosterRows: number;
  skippedRows: number;
};

export type AggregatedDRMPlayer = AggregatedMatrixPlayer;

const EMPTY_AGGREGATED_DATA: AggregatedDRMPlayer[] = [];
const EMPTY_COVERAGE: DRMDataCoverage = {
  inputRows: 0,
  rosterRows: 0,
  skippedRows: 0,
};

type UseDRMParams = {
  teamAbbreviation: string | undefined;
  startDate: string | undefined; // YYYY-MM-DD
  endDate: string | undefined; // YYYY-MM-DD
  mode: Mode;
  source: Source;
  seasonId?: number;
  seasonType?: DRMSeasonType;
  aggregatedData?: AggregatedDRMPlayer[]; // when source === 'aggregated'
  aggregateStatus?: DRMDataStatus;
  aggregateError?: string | null;
  aggregateCoverage?: DRMDataCoverage;
};

export type UseDRMReturn = {
  loading: boolean;
  status: DRMDataStatus;
  error: string | null;
  stale: boolean;
  source: Source;
  coverage: DRMDataCoverage;
  teamId: number | undefined;
  teamName: string | undefined;
  roster: PlayerData[];
  toiData: TOIData[];
  homeAwayInfo: { gameId: number; homeOrAway: string }[];
  playerATOI: Record<number, string>;
  lines: PlayerData[][];
  pairs: PlayerData[][];
};

export function mapAggregatedPlayers(
  aggregatedData: AggregatedDRMPlayer[],
  seasonType: DRMSeasonType,
  teamAbbreviation: string,
): PlayerData[] {
  const canonicalTeamAbbreviation = teamAbbreviation.trim().toUpperCase();
  const teamInfo = teamsInfo[canonicalTeamAbbreviation];
  if (!teamInfo) {
    throw new Error("Aggregated matrix data requires a canonical team.");
  }
  const seasonKey =
    seasonType === "playoffs" ? "playoffData" : "regularSeasonData";
  const seenPlayerIds = new Set<number>();

  return aggregatedData.map((item) => {
    if (!Number.isSafeInteger(item.playerId) || item.playerId <= 0) {
      throw new Error(
        "Aggregated matrix data contains an invalid player identity.",
      );
    }
    if (seenPlayerIds.has(item.playerId)) {
      throw new Error(
        "Aggregated matrix data contains a duplicate player identity.",
      );
    }
    seenPlayerIds.add(item.playerId);
    if (
      item.teamId !== teamInfo.id ||
      item.franchiseId !== teamInfo.franchiseId ||
      item.teamAbbrev.trim().toUpperCase() !== canonicalTeamAbbreviation
    ) {
      throw new Error(
        "Aggregated matrix data does not match the canonical team identity.",
      );
    }

    const seasonData = item[seasonKey];
    return {
      id: item.playerId,
      teamId: item.teamId,
      franchiseId: item.franchiseId,
      position: item.primaryPosition,
      name: item.playerName,
      playerAbbrevName: item.playerAbbrevName,
      lastName: item.lastName,
      sweaterNumber: item.sweaterNumber,
      totalTOI: seasonData.totalTOI,
      timesOnLine: { ...seasonData.timesOnLine },
      timesOnPair: { ...seasonData.timesOnPair },
      percentToiWith: { ...seasonData.percentToiWith },
      percentToiWithMixed: { ...seasonData.percentToiWithMixed },
      timeSpentWith: { ...seasonData.timeSpentWith },
      timeSpentWithMixed: { ...seasonData.timeSpentWithMixed },
      GP: seasonData.GP,
      timesPlayedWith: { ...seasonData.timesPlayedWith },
      ATOI: seasonData.ATOI,
      percentOfSeason: { ...seasonData.percentOfSeason },
      displayPosition: item.displayPosition,
      mutualSharedToi: { ...seasonData.mutualSharedToi },
      comboPoints: item.comboPoints,
      playerType: item.playerType,
    };
  });
}

export function useDateRangeMatrixData({
  teamAbbreviation,
  startDate,
  endDate,
  mode,
  source,
  seasonId,
  seasonType = "regularSeason",
  aggregatedData = EMPTY_AGGREGATED_DATA,
  aggregateStatus = "success",
  aggregateError = null,
  aggregateCoverage,
}: UseDRMParams): UseDRMReturn {
  const aggregateInputRows = aggregateCoverage?.inputRows;
  const aggregateSkippedRows = aggregateCoverage?.skippedRows;
  const requestIdentity = useMemo(
    () => ({
      teamAbbreviation,
      startDate,
      endDate,
      source,
      seasonId,
      seasonType,
      aggregatedData,
      aggregateStatus,
      aggregateError,
      aggregateInputRows,
      aggregateSkippedRows,
    }),
    [
      teamAbbreviation,
      startDate,
      endDate,
      source,
      seasonId,
      seasonType,
      aggregatedData,
      aggregateStatus,
      aggregateError,
      aggregateInputRows,
      aggregateSkippedRows,
    ],
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<DRMDataStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<DRMDataCoverage>(EMPTY_COVERAGE);
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [toiData, setToiData] = useState<TOIData[]>([]);
  const [homeAwayInfo, setHomeAwayInfo] = useState<
    { gameId: number; homeOrAway: string }[]
  >([]);
  const [playerATOI, setPlayerATOI] = useState<Record<number, string>>({});
  const [resolvedRequestIdentity, setResolvedRequestIdentity] = useState<
    typeof requestIdentity | null
  >(null);
  const requestSequence = useRef(0);

  // Resolve team basics through the same canonical abbreviation as the reader.
  const canonicalTeamInfo = useMemo(
    () => teamsInfo[teamAbbreviation?.trim().toUpperCase() ?? ""],
    [teamAbbreviation],
  );
  const teamId = canonicalTeamInfo?.id;
  const teamName = canonicalTeamInfo?.name;

  // Load data depending on source
  useEffect(() => {
    const requestId = ++requestSequence.current;
    let mounted = true;

    const isCurrent = () => mounted && requestId === requestSequence.current;
    const clearData = () => {
      setRoster([]);
      setToiData([]);
      setHomeAwayInfo([]);
      setPlayerATOI({});
      setCoverage({ inputRows: 0, rosterRows: 0, skippedRows: 0 });
    };

    if (!teamAbbreviation || !startDate || !endDate) {
      clearData();
      setResolvedRequestIdentity(requestIdentity);
      setLoading(false);
      setStatus("idle");
      setError(null);
      return () => {
        mounted = false;
      };
    }

    if (source === "aggregated" && aggregateStatus === "loading") {
      clearData();
      setResolvedRequestIdentity(requestIdentity);
      setLoading(true);
      setStatus("loading");
      setError(null);
      return () => {
        mounted = false;
      };
    }

    if (source === "aggregated" && aggregateStatus === "idle") {
      clearData();
      setResolvedRequestIdentity(requestIdentity);
      setLoading(false);
      setStatus("idle");
      setError(null);
      return () => {
        mounted = false;
      };
    }

    if (source === "aggregated" && aggregateStatus === "error") {
      clearData();
      setResolvedRequestIdentity(requestIdentity);
      setLoading(false);
      setStatus("error");
      setError(aggregateError || "Unable to load matrix data.");
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    setStatus("loading");
    setError(null);
    clearData();
    setResolvedRequestIdentity(requestIdentity);

    (async () => {
      try {
        if (source === "raw") {
          const {
            toiData,
            roster,
            homeAwayInfo,
            playerATOI,
            coverage: rawCoverage,
          } = await getTOIDataForGames(
            teamAbbreviation,
            startDate,
            endDate,
            seasonType,
            seasonId,
          );
          if (!isCurrent()) return;
          setRoster(roster);
          setToiData(toiData);
          setHomeAwayInfo(homeAwayInfo);
          setPlayerATOI(playerATOI);
          setCoverage(rawCoverage);
          setStatus(
            rawCoverage.skippedRows > 0
              ? "partial"
              : roster.length > 0
                ? "success"
                : "empty",
          );
        } else {
          const mapped = mapAggregatedPlayers(
            aggregatedData,
            seasonType,
            teamAbbreviation,
          );
          if (!isCurrent()) return;
          setRoster(mapped);
          // For aggregated flow, upstream already has per-player ATOI; expose as map
          const map: Record<number, string> = {};
          mapped.forEach((p) => {
            map[p.id] = p.ATOI;
          });
          setPlayerATOI(map);
          setToiData([]); // DateRangeMatrixInternal uses percentToiWith, so raw toi grid can be empty
          setHomeAwayInfo([]);
          const mappingSkippedRows = Math.max(
            0,
            aggregatedData.length - mapped.length,
          );
          const skippedRows = (aggregateSkippedRows ?? 0) + mappingSkippedRows;
          setCoverage({
            inputRows: aggregateInputRows ?? aggregatedData.length,
            rosterRows: mapped.length,
            skippedRows,
          });
          setStatus(
            aggregateStatus === "partial" || skippedRows > 0
              ? "partial"
              : mapped.length > 0
                ? "success"
                : "empty",
          );
        }
      } catch (caughtError) {
        if (!isCurrent()) return;
        clearData();
        setStatus("error");
        setError(
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : "Unable to load matrix data.",
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    teamAbbreviation,
    startDate,
    endDate,
    source,
    seasonId,
    seasonType,
    aggregatedData,
    aggregateStatus,
    aggregateError,
    aggregateInputRows,
    aggregateSkippedRows,
    requestIdentity,
  ]);

  // Own one canonical line/pair derivation for both matrix and card consumers.
  // Total-TOI does not use the groups in the matrix, but the adjacent card view
  // still needs the same capped line-combination contract.
  const { lines, pairs } = useMemo(() => {
    if (!roster || roster.length === 0) return { lines: [], pairs: [] };
    const groupingMode =
      mode === "full-roster" ? "full-roster" : "line-combination";
    return calculateLinesAndPairs(roster, groupingMode);
  }, [roster, mode]);

  const resultIsCurrent = resolvedRequestIdentity === requestIdentity;
  const transitionStatus: DRMDataStatus =
    !teamAbbreviation || !startDate || !endDate
      ? "idle"
      : source === "aggregated" &&
          (aggregateStatus === "idle" ||
            aggregateStatus === "loading" ||
            aggregateStatus === "error")
        ? aggregateStatus
        : "loading";
  const visibleStatus = resultIsCurrent ? status : transitionStatus;
  const visibleError = resultIsCurrent
    ? error
    : transitionStatus === "error"
      ? aggregateError || "Unable to load matrix data."
      : null;
  const stale =
    !resultIsCurrent &&
    (status === "success" || status === "partial") &&
    roster.length > 0;

  return {
    loading: resultIsCurrent ? loading : transitionStatus === "loading",
    status: visibleStatus,
    error: visibleError,
    stale,
    source,
    coverage: resultIsCurrent ? coverage : EMPTY_COVERAGE,
    teamId,
    teamName,
    roster: resultIsCurrent ? roster : [],
    toiData: resultIsCurrent ? toiData : [],
    homeAwayInfo: resultIsCurrent ? homeAwayInfo : [],
    playerATOI: resultIsCurrent ? playerATOI : {},
    lines: resultIsCurrent ? lines : [],
    pairs: resultIsCurrent ? pairs : [],
  };
}

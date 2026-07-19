import { useEffect, useMemo, useRef, useState } from "react";
import { teamsInfo } from "lib/teamsInfo";
import { calculateLinesAndPairs } from "./lineCombinationHelper";
import { getTOIDataForGames } from "./useTOIData";
import type { Mode, TOIData } from "./index";
import type { PlayerData } from "./utilities";

type Source = "raw" | "aggregated";
export type DRMSeasonType = "regularSeason" | "playoffs";
export type DRMDataStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "partial"
  | "error";

export type DRMDataCoverage = {
  inputRows: number;
  rosterRows: number;
  skippedRows: number;
};

type AggregatedSeasonData = {
  totalTOI?: unknown;
  timesOnLine?: unknown;
  timesOnPair?: unknown;
  percentToiWith?: unknown;
  percentToiWithMixed?: unknown;
  timeSpentWith?: unknown;
  timeSpentWithMixed?: unknown;
  GP?: unknown;
  timesPlayedWith?: unknown;
  ATOI?: unknown;
  percentOfSeason?: unknown;
};

export type AggregatedDRMPlayer = {
  playerId?: unknown;
  teamId?: unknown;
  franchiseId?: unknown;
  primaryPosition?: unknown;
  sweaterNumber?: unknown;
  playerName?: unknown;
  playerAbbrevName?: unknown;
  lastName?: unknown;
  displayPosition?: unknown;
  comboPoints?: unknown;
  playerType?: unknown;
  regularSeasonData?: AggregatedSeasonData;
  playoffData?: AggregatedSeasonData;
};

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
  seasonType?: DRMSeasonType;
  aggregatedData?: AggregatedDRMPlayer[]; // when source === 'aggregated'
  aggregateStatus?: DRMDataStatus;
  aggregateError?: string | null;
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

function toFiniteNumber(value: unknown): number | undefined {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return undefined;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function durationToSeconds(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string" || value.trim() === "") return 0;

  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function normalizeNumericRecord<Key extends string | number = number>(
  value: unknown,
): Record<Key, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<Key, number>;
  }

  const entries = Object.entries(value).flatMap(([key, rawValue]) => {
    const numeric = toFiniteNumber(rawValue);
    return numeric === undefined ? [] : [[key, numeric] as const];
  });
  return Object.fromEntries(entries) as Record<Key, number>;
}

export function mapAggregatedPlayers(
  aggregatedData: AggregatedDRMPlayer[],
  seasonType: DRMSeasonType,
  teamAbbreviation: string,
): PlayerData[] {
  const teamInfo = teamsInfo[teamAbbreviation];
  const seasonKey =
    seasonType === "playoffs" ? "playoffData" : "regularSeasonData";

  return aggregatedData.flatMap((item) => {
    const id = toFiniteNumber(item.playerId);
    if (id === undefined) return [];

    const seasonData = item[seasonKey] ?? {};
    const position = toText(item.primaryPosition);
    const name = toText(item.playerName);

    return [
      {
        id,
        teamId: toFiniteNumber(item.teamId) ?? teamInfo?.id ?? 0,
        franchiseId:
          teamInfo?.franchiseId ?? toFiniteNumber(item.franchiseId) ?? 0,
        position,
        name,
        playerAbbrevName: toText(item.playerAbbrevName, name),
        lastName: toText(item.lastName, name),
        totalTOI: durationToSeconds(seasonData.totalTOI),
        timesOnLine: normalizeNumericRecord<string>(seasonData.timesOnLine),
        timesOnPair: normalizeNumericRecord<string>(seasonData.timesOnPair),
        percentToiWith: normalizeNumericRecord(seasonData.percentToiWith),
        percentToiWithMixed: normalizeNumericRecord(
          seasonData.percentToiWithMixed,
        ),
        timeSpentWith: normalizeNumericRecord(seasonData.timeSpentWith),
        timeSpentWithMixed: normalizeNumericRecord(
          seasonData.timeSpentWithMixed,
        ),
        GP: toFiniteNumber(seasonData.GP) ?? 0,
        timesPlayedWith: normalizeNumericRecord(seasonData.timesPlayedWith),
        ATOI: toText(seasonData.ATOI, "00:00"),
        percentOfSeason: normalizeNumericRecord(seasonData.percentOfSeason),
        displayPosition: toText(item.displayPosition, position),
        mutualSharedToi: {},
        comboPoints: toFiniteNumber(item.comboPoints) ?? 0,
        playerType: toText(item.playerType) || undefined,
      },
    ];
  });
}

export function useDateRangeMatrixData({
  teamAbbreviation,
  startDate,
  endDate,
  mode,
  source,
  seasonType = "regularSeason",
  aggregatedData = EMPTY_AGGREGATED_DATA,
  aggregateStatus = "success",
  aggregateError = null,
}: UseDRMParams): UseDRMReturn {
  const requestIdentity = useMemo(
    () => ({
      teamAbbreviation,
      startDate,
      endDate,
      source,
      seasonType,
      aggregatedData,
      aggregateStatus,
      aggregateError,
    }),
    [
      teamAbbreviation,
      startDate,
      endDate,
      source,
      seasonType,
      aggregatedData,
      aggregateStatus,
      aggregateError,
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
          const { toiData, roster, homeAwayInfo, playerATOI } =
            await getTOIDataForGames(teamAbbreviation, startDate, endDate);
          if (!isCurrent()) return;
          setRoster(roster);
          setToiData(toiData);
          setHomeAwayInfo(homeAwayInfo);
          setPlayerATOI(playerATOI);
          setCoverage({
            inputRows: roster.length,
            rosterRows: roster.length,
            skippedRows: 0,
          });
          setStatus(roster.length > 0 ? "success" : "empty");
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
            map[p.id] = p.ATOI || "0:00";
          });
          setPlayerATOI(map);
          setToiData([]); // DateRangeMatrixInternal uses percentToiWith, so raw toi grid can be empty
          setHomeAwayInfo([]);
          const skippedRows = Math.max(
            0,
            aggregatedData.length - mapped.length,
          );
          setCoverage({
            inputRows: aggregatedData.length,
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
    seasonType,
    aggregatedData,
    aggregateStatus,
    aggregateError,
    requestIdentity,
  ]);

  // Compute lines & pairs when roster/mode changes
  const { lines, pairs } = useMemo(() => {
    if (!roster || roster.length === 0) return { lines: [], pairs: [] };
    if (mode === "line-combination" || mode === "full-roster") {
      return calculateLinesAndPairs(roster, mode);
    }
    return { lines: [], pairs: [] };
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

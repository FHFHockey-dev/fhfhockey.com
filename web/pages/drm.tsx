/////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\drm.tsx

// TO DO
// Filter vs Opponent
// Filter by Home/Away
// Reorganize Line Pair Grid by Yahoo Position LW/C/RW
// Implement Goalie Cards
// fix Line Combo (comboPoints) logic to include a minimum threshold.
//      We need to keep 2GP guys or barely used players from being in the season long line combo sheet.
// Start Date/End Date not responding to the skaterArray date_range - instead L30GP is showing a 30 day span.
// cron job all of the databases to run every day at 3am

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  OPTIONS as DATERANGE_MATRIX_MODES,
  Mode,
} from "components/DateRangeMatrix/index";
import DateRangeMatrixView from "components/DateRangeMatrix/DateRangeMatrixView";
import {
  useDateRangeMatrixData,
  type DRMDataCoverage,
  type DRMDataStatus,
} from "components/DateRangeMatrix/useDateRangeMatrixData";
import TeamSelect from "components/TeamSelect";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import LinePairGrid from "components/DateRangeMatrix/LinePairGrid";
import {
  getTeamColors,
  getDateRangeForGames,
} from "components/DateRangeMatrix/utilities";
import styles from "components/DateRangeMatrix/drm.module.scss";
import { useUrlQueryState } from "hooks/useUrlQueryState";
import { fetchCurrentSeason, fetchSeasonById } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  EMPTY_SCOPED_CARD_STATS,
  fetchAggregatedData,
  type AggregatedMatrixPlayers,
  type ScopedCardStats,
} from "components/DateRangeMatrix/fetchAggregatedData";
import Image from "next/image";

type TeamAbbreviation = Extract<keyof typeof teamsInfo, string>; // remove implicit number from index signature
type DRMTimeFrame = "L7" | "L14" | "L30" | "Totals" | "Custom";
type RollingTimeFrame = Extract<DRMTimeFrame, "L7" | "L14" | "L30">;
type DRMSource = "aggregated" | "raw";
type DRMSeasonType = "regularSeason" | "playoffs";

const DRM_TIME_FRAMES: readonly DRMTimeFrame[] = [
  "L7",
  "L14",
  "L30",
  "Totals",
  "Custom",
];
const DRM_SEASON_ID_PATTERN = /^(\d{4})(\d{4})$/;
const DRM_QUERY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeTeam(value: string | null): TeamAbbreviation | "" {
  const candidate = value?.trim().toUpperCase() ?? "";
  return Object.prototype.hasOwnProperty.call(teamsInfo, candidate)
    ? (candidate as TeamAbbreviation)
    : "";
}

export function sanitizeDRMMode(value: string | null): Mode {
  return (DATERANGE_MATRIX_MODES.find((option) => option.value === value)
    ?.value ?? DATERANGE_MATRIX_MODES[0].value) as Mode;
}

export function sanitizeDRMSeasonId(value: string | null): number | null {
  if (!value) return null;
  const match = DRM_SEASON_ID_PATTERN.exec(value);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;
  return Number(value);
}

function sanitizeSeasonType(value: string | null): DRMSeasonType {
  return value === "playoffs" ? "playoffs" : "regularSeason";
}

function sanitizeSource(value: string | null): DRMSource {
  return value === "raw" ? "raw" : "aggregated";
}

function sanitizeTimeFrame(
  value: string | null,
  hasRestoredDate: boolean,
): DRMTimeFrame {
  if (DRM_TIME_FRAMES.includes(value as DRMTimeFrame)) {
    return value as DRMTimeFrame;
  }
  return hasRestoredDate ? "Custom" : "Totals";
}

function parseQueryDate(value: string | null): Date | undefined {
  if (!value || !DRM_QUERY_DATE_PATTERN.test(value)) return undefined;
  const parsed = parseDRMDate(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isRollingTimeFrame(
  timeFrame: DRMTimeFrame,
): timeFrame is RollingTimeFrame {
  return timeFrame === "L7" || timeFrame === "L14" || timeFrame === "L30";
}

function gamesBackForTimeFrame(timeFrame: RollingTimeFrame): 7 | 14 | 30 {
  if (timeFrame === "L7") return 7;
  if (timeFrame === "L14") return 14;
  return 30;
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const EMPTY_AGGREGATE_COVERAGE: DRMDataCoverage = {
  inputRows: 0,
  rosterRows: 0,
  skippedRows: 0,
};

export function parseDRMDate(value: string | number) {
  if (typeof value === "string") {
    const match = DATE_KEY_PATTERN.exec(value);
    if (match) {
      const [, yearText, monthText, dayText] = match;
      const year = Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const parsed = new Date(year, month - 1, day);
      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }
      return new Date(Number.NaN);
    }
  }
  return new Date(value);
}

export function toDateKey(date: Date | undefined) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rollingWindowKey(args: {
  team: TeamAbbreviation | "";
  seasonId: number | null;
  seasonType: "regularSeason" | "playoffs";
  timeFrame: DRMTimeFrame;
}) {
  if (!args.team || !args.seasonId || !isRollingTimeFrame(args.timeFrame)) {
    return null;
  }
  return `${args.team}:${args.seasonId}:${args.seasonType}:${args.timeFrame}`;
}

function aggregateScopeKey(args: {
  team: TeamAbbreviation | "";
  seasonId: number | null;
  seasonType: "regularSeason" | "playoffs";
  timeFrame: DRMTimeFrame;
  startDate: Date | undefined;
  endDate: Date | undefined;
  fixedGameIds: number[];
  homeOrAway: "home" | "away" | "";
  opponent: string;
}) {
  const startDate = toDateKey(args.startDate);
  const endDate = toDateKey(args.endDate);
  if (!args.team || !args.seasonId || !startDate || !endDate) return null;

  const gamesBack = isRollingTimeFrame(args.timeFrame)
    ? gamesBackForTimeFrame(args.timeFrame)
    : null;
  if (gamesBack != null && args.fixedGameIds.length !== gamesBack) return null;

  return [
    args.team,
    args.seasonId,
    args.seasonType,
    args.timeFrame,
    startDate,
    endDate,
    gamesBack == null ? "date-range" : args.fixedGameIds.join(","),
    args.homeOrAway || "all-venues",
    args.opponent || "all-opponents",
  ].join(":");
}

const DEFAULT_LOGO = "Five Hole.png";
const DEFAULT_COLORS = {
  primary: "#07aae2",
  secondary: "#202020",
  jersey: "#FFFFFF",
  accentColor: "#404040",
};

const DRM_CONTROL_IDS = {
  timeframeLabel: "drm-timeframe-label",
  team: "drm-team",
  opponent: "drm-opponent",
  startDate: "drm-start-date",
  endDate: "drm-end-date",
  matrixLayout: "drm-matrix-layout",
  source: "drm-source",
} as const;

export default function DRMPage() {
  const [dateRangeMatrixModeQ, setDateRangeMatrixMode, modeQueryReady] =
    useUrlQueryState("daterange-matrix-mode", DATERANGE_MATRIX_MODES[0].value);
  // URL query state for the complete restorable matrix scope.
  const [teamQ, setTeamQ, teamQueryReady] = useUrlQueryState("team");
  const [startQ, setStartQ, startQueryReady] = useUrlQueryState("start");
  const [endQ, setEndQ, endQueryReady] = useUrlQueryState("end");
  const [opponentQ, setOpponentQ, opponentQueryReady] =
    useUrlQueryState("opponent");
  const [homeAwayQ, setHomeAwayQ, homeAwayQueryReady] =
    useUrlQueryState("homeAway");
  const [seasonQ, setSeasonQ, seasonQueryReady] = useUrlQueryState("season");
  const [seasonTypeQ, setSeasonTypeQ, seasonTypeQueryReady] =
    useUrlQueryState("seasonType");
  const [timeFrameQ, setTimeFrameQ, timeFrameQueryReady] = useUrlQueryState(
    "timeframe",
    "Totals",
  );
  const [sourceQ, setSourceQ, sourceQueryReady] = useUrlQueryState("source");
  const queryStateReady =
    modeQueryReady &&
    teamQueryReady &&
    startQueryReady &&
    endQueryReady &&
    opponentQueryReady &&
    homeAwayQueryReady &&
    seasonQueryReady &&
    seasonTypeQueryReady &&
    timeFrameQueryReady &&
    sourceQueryReady;
  const dateRangeMatrixMode = sanitizeDRMMode(dateRangeMatrixModeQ);
  const restoredStartDate = useMemo(() => parseQueryDate(startQ), [startQ]);
  const restoredEndDate = useMemo(() => parseQueryDate(endQ), [endQ]);
  const initialTimeFrame = sanitizeTimeFrame(
    timeFrameQ,
    restoredStartDate != null || restoredEndDate != null,
  );
  const selectedTeam = sanitizeTeam(teamQ);
  const opponent = sanitizeTeam(opponentQ);
  const homeOrAway =
    homeAwayQ === "home" || homeAwayQ === "away" ? homeAwayQ : "";
  const seasonType = sanitizeSeasonType(seasonTypeQ);
  const source = sanitizeSource(sourceQ);
  const timeFrame = initialTimeFrame;
  const startDate = restoredStartDate;
  const endDate = restoredEndDate;
  // Ensure runtime value always stays a string (never number)
  const setTeamSafe = (val: string | TeamAbbreviation | null) => {
    const team = sanitizeTeam(val == null ? null : String(val));
    setTeamQ(team || null);
  };
  const setStartDate = useCallback(
    (date: Date | undefined) => setStartQ(toDateKey(date) || null),
    [setStartQ],
  );
  const setEndDate = useCallback(
    (date: Date | undefined) => setEndQ(toDateKey(date) || null),
    [setEndQ],
  );
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [gameIds, setGameIds] = useState<number[]>([]);
  const [resolvedWindowGameIds, setResolvedWindowGameIds] = useState<number[]>(
    [],
  );
  const [resolvedWindowKey, setResolvedWindowKey] = useState<string | null>(
    null,
  );
  const [regularSeasonData, setRegularSeasonData] =
    useState<AggregatedMatrixPlayers>({});
  const [playoffData, setPlayoffData] = useState<AggregatedMatrixPlayers>({});
  const [aggregateStatus, setAggregateStatus] = useState<DRMDataStatus>("idle");
  const [aggregateError, setAggregateError] = useState<string | null>(null);
  const [aggregateCoverage, setAggregateCoverage] = useState<DRMDataCoverage>(
    EMPTY_AGGREGATE_COVERAGE,
  );
  const [resolvedAggregateScopeKey, setResolvedAggregateScopeKey] = useState<
    string | null
  >(null);
  const [scopedCardStats, setScopedCardStats] = useState<ScopedCardStats>(
    EMPTY_SCOPED_CARD_STATS,
  );
  const [regularSeasonDateRange, setRegularSeasonDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const [playoffDateRange, setPlayoffDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const dateRangeRequestSequence = useRef(0);
  const aggregateRequestSequence = useRef(0);
  const resolvedSeasonIdRef = useRef<number | null>(null);

  // State for timeframe selection
  const timeFrameRef = useRef<DRMTimeFrame>(initialTimeFrame);
  const selectTimeFrame = useCallback(
    (nextTimeFrame: DRMTimeFrame) => {
      if (timeFrameRef.current === nextTimeFrame) return;
      dateRangeRequestSequence.current += 1;
      timeFrameRef.current = nextTimeFrame;
      setResolvedWindowGameIds((currentIds) =>
        currentIds.length === 0 ? currentIds : [],
      );
      setResolvedWindowKey(null);
      setTimeFrameQ(nextTimeFrame);
    },
    [setTimeFrameQ],
  );

  useEffect(() => {
    timeFrameRef.current = timeFrame;
  }, [timeFrame]);

  useEffect(() => {
    if (!queryStateReady) return;
    const canonicalTeam = sanitizeTeam(teamQ);
    if (teamQ && canonicalTeam !== teamQ) setTeamQ(canonicalTeam || null);
  }, [queryStateReady, teamQ, setTeamQ]);
  useEffect(() => {
    if (!queryStateReady) return;
    const canonicalOpponent = sanitizeTeam(opponentQ);
    if (opponentQ && canonicalOpponent !== opponentQ) {
      setOpponentQ(canonicalOpponent || null);
    }
  }, [opponentQ, queryStateReady, setOpponentQ]);
  useEffect(() => {
    if (!queryStateReady) return;
    if (homeAwayQ && homeAwayQ !== homeOrAway) {
      setHomeAwayQ(homeOrAway || null);
    }
  }, [homeAwayQ, homeOrAway, queryStateReady, setHomeAwayQ]);
  useEffect(() => {
    if (queryStateReady && seasonTypeQ && seasonTypeQ !== seasonType) {
      setSeasonTypeQ(seasonType);
    }
  }, [queryStateReady, seasonType, seasonTypeQ, setSeasonTypeQ]);
  useEffect(() => {
    if (queryStateReady && sourceQ && sourceQ !== source) setSourceQ(source);
  }, [queryStateReady, source, sourceQ, setSourceQ]);
  useEffect(() => {
    if (queryStateReady && timeFrameQ && timeFrameQ !== timeFrame) {
      setTimeFrameQ(timeFrame);
    }
  }, [queryStateReady, timeFrame, timeFrameQ, setTimeFrameQ]);
  useEffect(() => {
    if (queryStateReady && seasonQ && sanitizeDRMSeasonId(seasonQ) == null) {
      setSeasonQ(null);
    }
  }, [queryStateReady, seasonQ, setSeasonQ]);
  useEffect(() => {
    if (queryStateReady && startQ && !restoredStartDate) setStartQ(null);
  }, [queryStateReady, restoredStartDate, setStartQ, startQ]);
  useEffect(() => {
    if (queryStateReady && endQ && !restoredEndDate) setEndQ(null);
  }, [endQ, queryStateReady, restoredEndDate, setEndQ]);

  useEffect(() => {
    let active = true;
    async function fetchSeason() {
      if (!queryStateReady) return;
      const requestedSeasonId = sanitizeDRMSeasonId(seasonQ);
      if (
        requestedSeasonId &&
        requestedSeasonId === resolvedSeasonIdRef.current
      ) {
        return;
      }
      try {
        setSeasonError(null);
        const currentSeason = requestedSeasonId
          ? await fetchSeasonById(requestedSeasonId)
          : await fetchCurrentSeason();
        if (!active) return;
        resolvedSeasonIdRef.current = currentSeason.id;
        setSeasonId(currentSeason.id);
        if (!requestedSeasonId) setSeasonQ(String(currentSeason.id));

        const regularSeasonStartDate = parseDRMDate(currentSeason.startDate);
        const regularSeasonEndDate = parseDRMDate(
          currentSeason.regularSeasonEndDate,
        );
        const playoffsStartDate = new Date(regularSeasonEndDate);
        playoffsStartDate.setDate(playoffsStartDate.getDate() + 1);
        const playoffsEndDate = parseDRMDate(currentSeason.endDate);

        setRegularSeasonDateRange({
          start: regularSeasonStartDate,
          end: regularSeasonEndDate,
        });
        setPlayoffDateRange({
          start: playoffsStartDate,
          end: playoffsEndDate,
        });

        if (timeFrameRef.current !== "Custom") {
          setStartDate(regularSeasonStartDate);
          setEndDate(regularSeasonEndDate);
        }
      } catch {
        if (!active) return;
        resolvedSeasonIdRef.current = null;
        setSeasonId(null);
        setRegularSeasonDateRange(undefined);
        setPlayoffDateRange(undefined);
        setSeasonError("Unable to resolve the selected season.");
      }
    }
    fetchSeason();
    return () => {
      active = false;
    };
  }, [queryStateReady, seasonQ, setEndDate, setSeasonQ, setStartDate]);

  useEffect(() => {
    if (!queryStateReady) return;
    const requestId = ++dateRangeRequestSequence.current;
    let active = true;
    const isCurrent = () =>
      active && requestId === dateRangeRequestSequence.current;

    async function updateDateRange() {
      if (timeFrame === "Custom") {
        return;
      }

      if (isRollingTimeFrame(timeFrame)) {
        const selectedSeasonRange =
          seasonType === "regularSeason"
            ? regularSeasonDateRange
            : playoffDateRange;

        if (!selectedTeam || !seasonId || !selectedSeasonRange) {
          if (isCurrent()) {
            setResolvedWindowGameIds((currentIds) =>
              currentIds.length === 0 ? currentIds : [],
            );
            setResolvedWindowKey(null);
            setStartDate(undefined);
            setEndDate(undefined);
            setAggregateStatus(selectedTeam ? "loading" : "idle");
            setAggregateError(null);
          }
          return;
        }

        setStartDate(undefined);
        setEndDate(undefined);
        setResolvedWindowGameIds((currentIds) =>
          currentIds.length === 0 ? currentIds : [],
        );
        setResolvedWindowKey(null);
        setAggregateStatus("loading");
        setAggregateError(null);

        try {
          const gamesBack = gamesBackForTimeFrame(timeFrame);
          const dateRange = await getDateRangeForGames({
            teamId: teamsInfo[selectedTeam as TeamAbbreviation].id,
            seasonId,
            seasonType,
            gamesBack,
            scopeStartDate: toDateKey(selectedSeasonRange.start),
            scopeEndDate: toDateKey(selectedSeasonRange.end),
          });
          if (!isCurrent()) return;
          if (!dateRange) {
            setAggregateStatus("empty");
            return;
          }
          setResolvedWindowGameIds(dateRange.gameIds);
          setResolvedWindowKey(
            rollingWindowKey({
              team: selectedTeam,
              seasonId,
              seasonType,
              timeFrame,
            }),
          );
          setStartDate(parseDRMDate(dateRange.startDate));
          setEndDate(parseDRMDate(dateRange.endDate));
        } catch {
          if (!isCurrent()) return;
          setAggregateStatus("error");
          setAggregateError("Unable to resolve the matrix date range.");
        }
      } else if (isCurrent() && seasonType === "regularSeason") {
        setResolvedWindowGameIds((currentIds) =>
          currentIds.length === 0 ? currentIds : [],
        );
        setResolvedWindowKey(null);
        setStartDate(regularSeasonDateRange?.start);
        setEndDate(regularSeasonDateRange?.end);
      } else if (isCurrent()) {
        setResolvedWindowGameIds((currentIds) =>
          currentIds.length === 0 ? currentIds : [],
        );
        setResolvedWindowKey(null);
        setStartDate(playoffDateRange?.start);
        setEndDate(playoffDateRange?.end);
      }
    }

    updateDateRange();
    return () => {
      active = false;
    };
  }, [
    queryStateReady,
    timeFrame,
    seasonType,
    selectedTeam,
    seasonId,
    regularSeasonDateRange,
    playoffDateRange,
    setStartDate,
    setEndDate,
  ]);

  const startStr = toDateKey(startDate);
  const endStr = toDateKey(endDate);
  const rollingGamesBack = isRollingTimeFrame(timeFrame)
    ? gamesBackForTimeFrame(timeFrame)
    : null;
  const activeRollingWindowKey = rollingWindowKey({
    team: selectedTeam,
    seasonId,
    seasonType,
    timeFrame,
  });
  const fixedWindowResolved =
    rollingGamesBack != null &&
    resolvedWindowGameIds.length === rollingGamesBack &&
    resolvedWindowKey === activeRollingWindowKey;
  const activeAggregateScopeKey = aggregateScopeKey({
    team: selectedTeam,
    seasonId,
    seasonType,
    timeFrame,
    startDate,
    endDate,
    fixedGameIds: resolvedWindowGameIds,
    homeOrAway,
    opponent,
  });

  useEffect(() => {
    const requestId = ++aggregateRequestSequence.current;
    let active = true;
    const isCurrent = () =>
      active && requestId === aggregateRequestSequence.current;

    const clearAggregateData = () => {
      setRegularSeasonData({});
      setPlayoffData({});
      setGameIds([]);
      setScopedCardStats(EMPTY_SCOPED_CARD_STATS);
      setAggregateCoverage(EMPTY_AGGREGATE_COVERAGE);
    };

    async function fetchGames() {
      if (source !== "aggregated") {
        clearAggregateData();
        setResolvedAggregateScopeKey(null);
        setAggregateStatus("idle");
        setAggregateError(null);
        return;
      }
      if (!selectedTeam || !seasonId) {
        clearAggregateData();
        setResolvedAggregateScopeKey(null);
        setAggregateStatus(seasonError ? "error" : "idle");
        setAggregateError(seasonError);
        return;
      }

      if (timeFrame === "Custom") {
        if (!startDate || !endDate) {
          clearAggregateData();
          setResolvedAggregateScopeKey(activeAggregateScopeKey);
          setAggregateStatus("error");
          setAggregateError("Select both Custom dates to load matrix data.");
          return;
        }
        if (startDate.getTime() > endDate.getTime()) {
          clearAggregateData();
          setResolvedAggregateScopeKey(activeAggregateScopeKey);
          setAggregateStatus("error");
          setAggregateError("Custom start date must not follow the end date.");
          return;
        }
      }

      if (!startDate || !endDate) {
        clearAggregateData();
        setAggregateStatus((currentStatus) =>
          currentStatus === "error" || currentStatus === "empty"
            ? currentStatus
            : "loading",
        );
        return;
      }

      const rollingGamesBack = isRollingTimeFrame(timeFrame)
        ? gamesBackForTimeFrame(timeFrame)
        : null;
      const currentRollingWindowKey = rollingWindowKey({
        team: selectedTeam,
        seasonId,
        seasonType,
        timeFrame,
      });
      if (
        rollingGamesBack != null &&
        (resolvedWindowGameIds.length !== rollingGamesBack ||
          resolvedWindowKey !== currentRollingWindowKey)
      ) {
        clearAggregateData();
        setAggregateStatus((currentStatus) =>
          currentStatus === "error" || currentStatus === "empty"
            ? currentStatus
            : "loading",
        );
        return;
      }

      const requestScopeKey = activeAggregateScopeKey;
      if (!requestScopeKey) {
        clearAggregateData();
        setAggregateStatus("loading");
        setAggregateError(null);
        return;
      }

      clearAggregateData();
      setAggregateStatus("loading");
      setAggregateError(null);

      try {
        const teamKey = selectedTeam as TeamAbbreviation;
        const {
          regularSeasonPlayersData,
          playoffPlayersData,
          matchedGameIds,
          cardStats = EMPTY_SCOPED_CARD_STATS,
          coverage = EMPTY_AGGREGATE_COVERAGE,
        } = await fetchAggregatedData({
          teamId: teamsInfo[teamKey].id,
          seasonId,
          startDate: toDateKey(startDate),
          endDate: toDateKey(endDate),
          seasonType,
          gameIds: rollingGamesBack == null ? undefined : resolvedWindowGameIds,
          homeOrAway,
          opponentTeamAbbreviation: opponent,
        });
        if (!isCurrent()) return;
        setRegularSeasonData(regularSeasonPlayersData);
        setPlayoffData(playoffPlayersData);
        setScopedCardStats(cardStats);
        setAggregateCoverage(coverage);

        const selectedPlayersData =
          seasonType === "regularSeason"
            ? regularSeasonPlayersData
            : playoffPlayersData;
        const fallbackGameIds = Object.values(
          selectedPlayersData || {},
        ).flatMap((player) =>
          seasonType === "regularSeason"
            ? player.regularSeasonData?.gameIds || []
            : player.playoffData?.gameIds || [],
        );
        const uniqueMatchedGameIds = Array.from(
          new Set(
            (matchedGameIds ?? fallbackGameIds)
              .map(Number)
              .filter((gameId) => Number.isInteger(gameId) && gameId > 0),
          ),
        );

        setGameIds(uniqueMatchedGameIds);
        setResolvedAggregateScopeKey(requestScopeKey);
        setAggregateStatus(
          coverage.skippedRows > 0
            ? "partial"
            : Object.values(selectedPlayersData || {}).length > 0
              ? "success"
              : "empty",
        );
      } catch (error) {
        if (!isCurrent()) return;
        clearAggregateData();
        setResolvedAggregateScopeKey(requestScopeKey);
        setAggregateStatus("error");
        setAggregateError("Unable to load matrix data.");
        console.error("Unable to load Date Range Matrix data:", error);
      }
    }
    fetchGames();
    return () => {
      active = false;
    };
  }, [
    selectedTeam,
    source,
    seasonId,
    seasonError,
    startDate,
    endDate,
    timeFrame,
    resolvedWindowGameIds,
    resolvedWindowKey,
    seasonType,
    homeOrAway,
    opponent,
    activeAggregateScopeKey,
  ]);

  const handleSeasonTypeChange = (
    newSeasonType: "regularSeason" | "playoffs",
  ) => {
    selectTimeFrame("Totals");
    setSeasonTypeQ(newSeasonType);
    if (newSeasonType === "regularSeason") {
      setStartDate(regularSeasonDateRange?.start);
      setEndDate(regularSeasonDateRange?.end);
    } else if (newSeasonType === "playoffs") {
      setStartDate(playoffDateRange?.start);
      setEndDate(playoffDateRange?.end);
    }
  };

  const handleManualStartDateChange = (date: Date | null) => {
    selectTimeFrame("Custom");
    setStartDate(date ?? undefined);
  };

  const handleManualEndDateChange = (date: Date | null) => {
    selectTimeFrame("Custom");
    setEndDate(date ?? undefined);
  };

  const mode = dateRangeMatrixMode;

  // Default to the "Five Hole Fantasy Hockey" logo and colors if no team is selected
  const teamId = selectedTeam
    ? teamsInfo[selectedTeam as TeamAbbreviation].id
    : undefined;
  const { primary, secondary, jersey, accentColor } = teamId
    ? getTeamColors(teamId)
    : DEFAULT_COLORS;
  const logo = selectedTeam
    ? `/teamLogos/${teamsInfo[selectedTeam as TeamAbbreviation].abbrev}.png`
    : `/teamLogos/${DEFAULT_LOGO}`;

  const aggregateResultIsCurrent =
    activeAggregateScopeKey != null &&
    resolvedAggregateScopeKey === activeAggregateScopeKey;
  const visibleAggregateStatus: DRMDataStatus =
    activeAggregateScopeKey != null && !aggregateResultIsCurrent
      ? "loading"
      : aggregateStatus;
  const visibleAggregateError =
    aggregateResultIsCurrent ||
    (activeAggregateScopeKey == null && aggregateStatus === "error")
      ? aggregateError
      : null;
  const visibleGameIds = aggregateResultIsCurrent ? gameIds : [];
  const visibleCardStats = aggregateResultIsCurrent
    ? scopedCardStats
    : EMPTY_SCOPED_CARD_STATS;
  const customRangeError =
    timeFrame !== "Custom"
      ? null
      : !startStr || !endStr
        ? "Select both Custom dates to load matrix data."
        : startStr > endStr
          ? "Custom start date must not follow the end date."
          : null;
  const scopeSummary =
    seasonError ??
    customRangeError ??
    (fixedWindowResolved &&
    (visibleAggregateStatus === "success" ||
      visibleAggregateStatus === "partial" ||
      visibleAggregateStatus === "empty")
      ? `Matrix scope: ${visibleGameIds.length} matching games within last ${rollingGamesBack} team games.`
      : timeFrame === "Custom" && startStr && endStr
        ? `Custom range: ${startStr} through ${endStr} (inclusive).`
        : null);

  useEffect(() => {
    if (
      queryStateReady &&
      dateRangeMatrixModeQ &&
      dateRangeMatrixModeQ !== mode
    ) {
      setDateRangeMatrixMode(mode);
    }
  }, [dateRangeMatrixModeQ, mode, queryStateReady, setDateRangeMatrixMode]);
  const aggregatedForHook = useMemo(() => {
    if (!aggregateResultIsCurrent) return [];
    return seasonType === "regularSeason"
      ? Object.values(regularSeasonData)
      : Object.values(playoffData);
  }, [aggregateResultIsCurrent, seasonType, regularSeasonData, playoffData]);

  const drmData = useDateRangeMatrixData({
    teamAbbreviation: (selectedTeam as TeamAbbreviation) || undefined,
    startDate: startStr,
    endDate: endStr,
    mode,
    source,
    seasonId: seasonId ?? undefined,
    seasonType,
    aggregatedData: aggregatedForHook,
    aggregateStatus: visibleAggregateStatus,
    aggregateError: visibleAggregateError,
    aggregateCoverage: aggregateResultIsCurrent
      ? aggregateCoverage
      : EMPTY_AGGREGATE_COVERAGE,
  });
  const linePairVisible =
    source === "aggregated" &&
    timeFrame !== "Custom" &&
    (rollingGamesBack == null || fixedWindowResolved) &&
    aggregateResultIsCurrent &&
    (visibleAggregateStatus === "success" ||
      visibleAggregateStatus === "partial") &&
    visibleGameIds.length > 0 &&
    (drmData.status === "success" || drmData.status === "partial") &&
    drmData.roster.length > 0;

  return (
    <div
      className={styles.drmContainer}
      style={{
        ["--accent-color" as any]: accentColor,
        ["--secondary-color" as any]: secondary,
        ["--primary-color" as any]: primary,
        ["--jersey-color" as any]: jersey,
      }}
    >
      <TeamSelect
        teams={Object.keys(teamsInfo).map((key) => ({
          abbreviation: key as TeamAbbreviation,
          name: teamsInfo[key as TeamAbbreviation].name,
        }))}
        team={(selectedTeam || "") as string}
        onTeamChange={(teamAbbreviation) => {
          setTeamSafe(teamAbbreviation);
        }}
      />

      <h1 className={styles.pageTitle}>
        <Image
          src={logo}
          alt={
            selectedTeam
              ? `${teamsInfo[selectedTeam as TeamAbbreviation]?.name} Logo`
              : "Five Hole Fantasy Hockey Logo"
          }
          className={styles.teamLogo}
          width={50} // Adjust the width as needed
          height={50} // Adjust the height as needed
        />
        <span className={styles.teamName}>
          <span className={styles.teamLocation}>
            {selectedTeam
              ? teamsInfo[selectedTeam as TeamAbbreviation]?.location
              : "Line Combo"}
          </span>
          {""}
          <span className={styles.teamShortName}>
            {selectedTeam
              ? " " + teamsInfo[selectedTeam as TeamAbbreviation]?.shortName
              : " Matrix"}
          </span>
        </span>
      </h1>

      <div className={styles.columnsContainer}>
        <div className={styles.leftColumn}>
          <div className={styles.options1}>
            <div className={styles.timeFrameGroup}>
              <span
                id={DRM_CONTROL_IDS.timeframeLabel}
                className={styles.label}
              >
                Timeframe
              </span>
              <div
                className={styles.timeFrameToggle}
                role="group"
                aria-labelledby={DRM_CONTROL_IDS.timeframeLabel}
              >
                <button
                  type="button"
                  className={`${styles.button} ${timeFrame === "L7" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L7")}
                  aria-pressed={timeFrame === "L7"}
                >
                  L7
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${timeFrame === "L14" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L14")}
                  aria-pressed={timeFrame === "L14"}
                >
                  L14
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${timeFrame === "L30" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L30")}
                  aria-pressed={timeFrame === "L30"}
                >
                  L30
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${timeFrame === "Totals" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("Totals")}
                  aria-pressed={timeFrame === "Totals"}
                >
                  Season
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${timeFrame === "Custom" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("Custom")}
                  aria-pressed={timeFrame === "Custom"}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className={styles.dropdownGroup}>
              <label htmlFor={DRM_CONTROL_IDS.team} className={styles.label}>
                Team
              </label>
              <TeamDropdown
                id={DRM_CONTROL_IDS.team}
                name="team"
                selectedTeam={(selectedTeam || "") as string}
                onSelect={(team) => {
                  setTeamSafe(team);
                }}
              />
            </div>

            <div className={styles.dropdownGroup}>
              <label
                htmlFor={DRM_CONTROL_IDS.opponent}
                className={styles.label}
              >
                Opponent
              </label>
              <TeamDropdown
                id={DRM_CONTROL_IDS.opponent}
                name="opponent"
                selectedTeam={(opponent || "") as string}
                onSelect={(opp) => {
                  const nextOpponent = sanitizeTeam(
                    opp == null ? null : String(opp),
                  );
                  setOpponentQ(nextOpponent || null);
                }}
              />
            </div>

            <div className={styles.datePickerGroup}>
              <div className={styles.datePicker}>
                <label
                  htmlFor={DRM_CONTROL_IDS.startDate}
                  className={styles.label}
                >
                  Start Date
                </label>
                <DatePicker
                  id={DRM_CONTROL_IDS.startDate}
                  name="start"
                  selected={startDate}
                  onChange={handleManualStartDateChange}
                  withPortal
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  className={styles.datePickerInput}
                  wrapperClassName={styles.datePickerWrapper}
                  calendarClassName={styles.datePickerCalendar}
                />
              </div>
              <div className={styles.datePicker}>
                <label
                  htmlFor={DRM_CONTROL_IDS.endDate}
                  className={styles.label}
                >
                  End Date
                </label>
                <DatePicker
                  id={DRM_CONTROL_IDS.endDate}
                  name="end"
                  selected={endDate}
                  onChange={handleManualEndDateChange}
                  withPortal
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  className={styles.datePickerInput}
                  wrapperClassName={styles.datePickerWrapper}
                  calendarClassName={styles.datePickerCalendar}
                />
              </div>
            </div>
          </div>
          {scopeSummary ? (
            <p
              className={styles.scopeSummary}
              role={seasonError || customRangeError ? "alert" : "status"}
            >
              {scopeSummary}
            </p>
          ) : null}

          <div className={styles.linePairGrid}>
            {linePairVisible && activeAggregateScopeKey ? (
              <LinePairGrid
                key={activeAggregateScopeKey}
                scopeKey={activeAggregateScopeKey}
                status={drmData.status}
                roster={drmData.roster}
                lines={drmData.lines}
                pairs={drmData.pairs}
                scopeGameCount={visibleGameIds.length}
                cardStats={visibleCardStats}
              />
            ) : (
              <p className={styles.linePairNotice} role="status">
                {timeFrame === "Custom"
                  ? "Line and goalie stat cards are unavailable for Custom ranges; the matrix uses the selected dates."
                  : source === "raw"
                    ? "Line and goalie stat cards are unavailable in the raw QA source; the matrix uses exact shift-chart rows."
                    : visibleAggregateStatus === "loading" ||
                        drmData.status === "loading"
                      ? "Updating line and goalie stat cards for the selected matrix scope."
                      : visibleAggregateStatus === "error" ||
                          drmData.status === "error"
                        ? "Line and goalie stat cards are unavailable while the matrix scope cannot be loaded."
                        : "No matching line or goalie stat cards are available for this matrix scope."}
              </p>
            )}
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.options2}>
            <div className={styles.buttonsContainer}>
              <button
                type="button"
                onClick={() => handleSeasonTypeChange("regularSeason")}
                className={`${styles.button} ${seasonType === "regularSeason" ? styles.active : ""}`}
                aria-pressed={seasonType === "regularSeason"}
              >
                Regular Season
              </button>
              <button
                type="button"
                onClick={() => handleSeasonTypeChange("playoffs")}
                className={`${styles.button} ${seasonType === "playoffs" ? styles.active : ""}`}
                aria-pressed={seasonType === "playoffs"}
              >
                Playoffs
              </button>
              <button
                type="button"
                onClick={() =>
                  setHomeAwayQ(homeOrAway === "home" ? null : "home")
                }
                className={`${styles.button} ${homeOrAway === "home" ? styles.active : ""}`}
                aria-pressed={homeOrAway === "home"}
                title="Home games only"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() =>
                  setHomeAwayQ(homeOrAway === "away" ? null : "away")
                }
                className={`${styles.button} ${homeOrAway === "away" ? styles.active : ""}`}
                aria-pressed={homeOrAway === "away"}
                title="Away games only"
              >
                Away
              </button>
            </div>
            <div className={styles.selectWrapper}>
              <label
                htmlFor={DRM_CONTROL_IDS.matrixLayout}
                className={styles.label}
              >
                Matrix layout
              </label>
              <select
                id={DRM_CONTROL_IDS.matrixLayout}
                name="daterange-matrix-mode"
                value={mode}
                onChange={(event) =>
                  setDateRangeMatrixMode(event.target.value as Mode)
                }
                className={styles.datePickerInput}
              >
                {DATERANGE_MATRIX_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.selectWrapper}>
              <label htmlFor={DRM_CONTROL_IDS.source} className={styles.label}>
                Data source
              </label>
              <select
                id={DRM_CONTROL_IDS.source}
                name="source"
                value={source}
                onChange={(event) =>
                  setSourceQ(sanitizeSource(event.target.value))
                }
                className={styles.datePickerInput}
              >
                <option value="aggregated">Aggregated</option>
                <option value="raw">Raw QA</option>
              </select>
            </div>
          </div>
          <div className={styles.dateRangeMatrixContainer}>
            {drmData.teamId && drmData.teamName ? (
              <DateRangeMatrixView
                teamId={drmData.teamId}
                teamName={drmData.teamName}
                roster={drmData.roster}
                toiData={drmData.toiData}
                mode={mode}
                playerATOI={drmData.playerATOI}
                loading={drmData.loading}
                status={drmData.status}
                error={drmData.error}
                stale={drmData.stale}
                source={drmData.source}
                coverage={drmData.coverage}
                lines={drmData.lines}
                pairs={drmData.pairs}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

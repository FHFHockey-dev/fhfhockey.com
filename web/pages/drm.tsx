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
  type DRMDataStatus,
} from "components/DateRangeMatrix/useDateRangeMatrixData";
import TeamSelect from "components/TeamSelect";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import LinePairGrid from "components/DateRangeMatrix/LinePairGrid";
import Select from "components/Select";
import {
  getTeamColors,
  getDateRangeForGames,
} from "components/DateRangeMatrix/utilities";
import styles from "components/DateRangeMatrix/drm.module.scss";
import { queryTypes, useQueryState } from "next-usequerystate";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
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

export default function DRMPage() {
  const [dateRangeMatrixMode, setDateRangeMatrixMode] = useQueryState(
    "daterange-matrix-mode",
    queryTypes.string.withDefault(DATERANGE_MATRIX_MODES[0].value),
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbreviation | "">("");
  // URL query state for team and dates/opponent/homeAway
  const [teamQ, setTeamQ] = useQueryState("team", queryTypes.string);
  const [startQ, setStartQ] = useQueryState("start", queryTypes.string);
  const [endQ, setEndQ] = useQueryState("end", queryTypes.string);
  const [opponentQ, setOpponentQ] = useQueryState(
    "opponent",
    queryTypes.string,
  );
  const [homeAwayQ, setHomeAwayQ] = useQueryState(
    "homeAway",
    queryTypes.string,
  );
  // Ensure runtime value always stays a string (never number)
  const setTeamSafe = (val: string | TeamAbbreviation | null) => {
    if (!val) {
      setSelectedTeam("");
      return;
    }
    setSelectedTeam(val as TeamAbbreviation);
  };
  const [seasonId, setSeasonId] = useState<number | null>(null);
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
  const [resolvedAggregateScopeKey, setResolvedAggregateScopeKey] = useState<
    string | null
  >(null);
  const [scopedCardStats, setScopedCardStats] = useState<ScopedCardStats>(
    EMPTY_SCOPED_CARD_STATS,
  );
  const [seasonType, setSeasonType] = useState<"regularSeason" | "playoffs">(
    "regularSeason",
  );
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [opponent, setOpponent] = useState<string>("");
  const [homeOrAway, setHomeOrAway] = useState<"home" | "away" | "">("");
  const [regularSeasonDateRange, setRegularSeasonDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const [playoffDateRange, setPlayoffDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const dateRangeRequestSequence = useRef(0);
  const aggregateRequestSequence = useRef(0);

  // State for timeframe selection
  const [timeFrame, setTimeFrame] = useState<DRMTimeFrame>("Totals");
  const timeFrameRef = useRef<DRMTimeFrame>("Totals");
  const selectTimeFrame = useCallback((nextTimeFrame: DRMTimeFrame) => {
    if (timeFrameRef.current === nextTimeFrame) return;
    dateRangeRequestSequence.current += 1;
    timeFrameRef.current = nextTimeFrame;
    setResolvedWindowGameIds((currentIds) =>
      currentIds.length === 0 ? currentIds : [],
    );
    setResolvedWindowKey(null);
    setTimeFrame(nextTimeFrame);
  }, []);

  // Sync in: apply initial query values to state
  useEffect(() => {
    if (teamQ && teamQ !== selectedTeam) {
      setSelectedTeam(teamQ as TeamAbbreviation);
    }
  }, [teamQ]);

  useEffect(() => {
    if (opponentQ !== undefined && opponentQ !== opponent) {
      setOpponent(opponentQ || "");
    }
  }, [opponentQ]);

  useEffect(() => {
    if (homeAwayQ !== undefined && homeAwayQ !== homeOrAway) {
      const val = homeAwayQ === "home" || homeAwayQ === "away" ? homeAwayQ : "";
      setHomeOrAway(val);
    }
  }, [homeAwayQ]);

  useEffect(() => {
    // Parse start/end from query on first load or when changed externally
    if (startQ) {
      const d = parseDRMDate(startQ);
      if (!Number.isNaN(d.getTime())) setStartDate(d);
    }
    if (endQ) {
      const d = parseDRMDate(endQ);
      if (!Number.isNaN(d.getTime())) setEndDate(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startQ, endQ]);

  useEffect(() => {
    let active = true;
    async function fetchSeason() {
      const currentSeason = await fetchCurrentSeason();
      if (!active) return;
      setSeasonId(currentSeason.id);

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
    }
    fetchSeason();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
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
    timeFrame,
    seasonType,
    selectedTeam,
    seasonId,
    regularSeasonDateRange,
    playoffDateRange,
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
    };

    async function fetchGames() {
      if (!selectedTeam || !seasonId) {
        clearAggregateData();
        setResolvedAggregateScopeKey(null);
        setAggregateStatus("idle");
        setAggregateError(null);
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
          Object.values(selectedPlayersData || {}).length > 0
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
    seasonId,
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
    setSeasonType(newSeasonType);
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

  const mode = dateRangeMatrixMode as Mode;

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
    customRangeError ??
    (fixedWindowResolved &&
    (visibleAggregateStatus === "success" || visibleAggregateStatus === "empty")
      ? `Matrix scope: ${visibleGameIds.length} matching games within last ${rollingGamesBack} team games.`
      : timeFrame === "Custom" && startStr && endStr
        ? `Custom range: ${startStr} through ${endStr} (inclusive).`
        : null);

  // Sync out: push team/date/opponent/homeAway to URL when local state changes
  useEffect(() => {
    if (selectedTeam) setTeamQ(selectedTeam);
    else setTeamQ(null);
  }, [selectedTeam, setTeamQ]);
  useEffect(() => {
    if (startStr) setStartQ(startStr);
    else setStartQ(null);
  }, [startStr, setStartQ]);
  useEffect(() => {
    if (endStr) setEndQ(endStr);
    else setEndQ(null);
  }, [endStr, setEndQ]);
  useEffect(() => {
    if (opponent) setOpponentQ(opponent);
    else setOpponentQ(null);
  }, [opponent, setOpponentQ]);
  useEffect(() => {
    if (homeOrAway) setHomeAwayQ(homeOrAway);
    else setHomeAwayQ(null);
  }, [homeOrAway, setHomeAwayQ]);
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
    source: "aggregated",
    seasonType,
    aggregatedData: aggregatedForHook,
    aggregateStatus: visibleAggregateStatus,
    aggregateError: visibleAggregateError,
  });
  const linePairVisible =
    timeFrame !== "Custom" &&
    (rollingGamesBack == null || fixedWindowResolved) &&
    aggregateResultIsCurrent &&
    visibleAggregateStatus === "success" &&
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

      <h4 className={styles.pageTitle}>
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
      </h4>

      <div className={styles.columnsContainer}>
        <div className={styles.leftColumn}>
          <div className={styles.options1}>
            <div className={styles.timeFrameGroup}>
              <label className={styles.label}>Timeframe</label>
              <div
                className={styles.timeFrameToggle}
                role="tablist"
                aria-label="Select timeframe"
              >
                <button
                  className={`${styles.button} ${timeFrame === "L7" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L7")}
                  role="tab"
                  aria-selected={timeFrame === "L7"}
                >
                  L7
                </button>
                <button
                  className={`${styles.button} ${timeFrame === "L14" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L14")}
                  role="tab"
                  aria-selected={timeFrame === "L14"}
                >
                  L14
                </button>
                <button
                  className={`${styles.button} ${timeFrame === "L30" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("L30")}
                  role="tab"
                  aria-selected={timeFrame === "L30"}
                >
                  L30
                </button>
                <button
                  className={`${styles.button} ${timeFrame === "Totals" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("Totals")}
                  role="tab"
                  aria-selected={timeFrame === "Totals"}
                >
                  Season
                </button>
                <button
                  className={`${styles.button} ${timeFrame === "Custom" ? styles.active : ""}`}
                  onClick={() => selectTimeFrame("Custom")}
                  role="tab"
                  aria-selected={timeFrame === "Custom"}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className={styles.dropdownGroup}>
              <label htmlFor="teamDropdown" className={styles.label}>
                Team
              </label>
              <TeamDropdown
                selectedTeam={(selectedTeam || "") as string}
                onSelect={(team) => {
                  setSelectedTeam(team as TeamAbbreviation);
                }}
                className={`${styles.select} ${styles.teamDropdown}`}
              />
            </div>

            <div className={styles.dropdownGroup}>
              <label htmlFor="opponentDropdown" className={styles.label}>
                Opponent
              </label>
              <TeamDropdown
                selectedTeam={(opponent || "") as string}
                onSelect={(opp) => {
                  setOpponent(opp == null ? "" : String(opp));
                }}
                className={`${styles.select} ${styles.teamDropdown}`}
              />
            </div>

            <div className={styles.datePickerGroup}>
              <div className={styles.datePicker}>
                <label htmlFor="startDate" className={styles.label}>
                  Start Date
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={handleManualStartDateChange}
                  withPortal
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  className={`${styles.select} ${styles.datePickerInput}`}
                />
              </div>
              <div className={styles.datePicker}>
                <label htmlFor="endDate" className={styles.label}>
                  End Date
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={handleManualEndDateChange}
                  withPortal
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  className={`${styles.select} ${styles.datePickerInput}`}
                />
              </div>
            </div>
          </div>
          {scopeSummary ? (
            <p
              className={styles.scopeSummary}
              role={customRangeError ? "alert" : "status"}
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
                onClick={() => handleSeasonTypeChange("regularSeason")}
                className={`${styles.button} ${seasonType === "regularSeason" ? styles.active : ""}`}
              >
                Regular Season
              </button>
              <button
                onClick={() => handleSeasonTypeChange("playoffs")}
                className={`${styles.button} ${seasonType === "playoffs" ? styles.active : ""}`}
              >
                Playoffs
              </button>
              <button
                onClick={() =>
                  setHomeOrAway(homeOrAway === "home" ? "" : "home")
                }
                className={`${styles.button} ${homeOrAway === "home" ? styles.active : ""}`}
                title="Home games only"
              >
                Home
              </button>
              <button
                onClick={() =>
                  setHomeOrAway(homeOrAway === "away" ? "" : "away")
                }
                className={`${styles.button} ${homeOrAway === "away" ? styles.active : ""}`}
                title="Away games only"
              >
                Away
              </button>
            </div>
            <Select
              options={DATERANGE_MATRIX_MODES}
              option={mode}
              onOptionChange={(newOption) => setDateRangeMatrixMode(newOption)}
              className={styles.selectWrapper}
            />
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

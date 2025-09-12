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

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  OPTIONS as DATERANGE_MATRIX_MODES,
  Mode
} from "components/DateRangeMatrix/index";
import DateRangeMatrixView from "components/DateRangeMatrix/DateRangeMatrixView";
import { useDateRangeMatrixData } from "components/DateRangeMatrix/useDateRangeMatrixData";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import TeamSelect from "components/TeamSelect";
import LinePairGrid from "components/DateRangeMatrix/LinePairGrid";
import Select from "components/Select";
import {
  PlayerData,
  getTeamColors,
  getDateRangeForGames
} from "components/DateRangeMatrix/utilities";
import styles from "components/DateRangeMatrix/drm.module.scss";
import { queryTypes, useQueryState } from "next-usequerystate";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { fetchAggregatedData } from "components/DateRangeMatrix/fetchAggregatedData";
import { calculateLinesAndPairs } from "components/DateRangeMatrix/lineCombinationHelper";
import Image from "next/image";

type TeamAbbreviation = Extract<keyof typeof teamsInfo, string>; // remove implicit number from index signature

const DEFAULT_LOGO = "Five Hole.png";
const DEFAULT_COLORS = {
  primary: "#07aae2",
  secondary: "#202020",
  jersey: "#FFFFFF",
  accentColor: "#404040"
};

export default function DRMPage() {
  const [dateRangeMatrixMode, setDateRangeMatrixMode] = useQueryState(
    "daterange-matrix-mode",
    queryTypes.string.withDefault(DATERANGE_MATRIX_MODES[0].value)
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbreviation | "">("");
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
  const [regularSeasonData, setRegularSeasonData] = useState<any[]>([]);
  const [playoffData, setPlayoffData] = useState<any[]>([]);
  const [seasonType, setSeasonType] = useState<"regularSeason" | "playoffs">(
    "regularSeason"
  );
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [regularSeasonDateRange, setRegularSeasonDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);
  const [playoffDateRange, setPlayoffDateRange] = useState<
    { start: Date; end: Date } | undefined
  >(undefined);

  // State for lines, pairs, and time frame selection
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);
  const [timeFrame, setTimeFrame] = useState<"L7" | "L14" | "L30" | "Totals">(
    "Totals"
  );
  const onLinesAndPairsCalculated = useCallback(
    (calculatedLines: PlayerData[][], calculatedPairs: PlayerData[][]) => {
      setLines(calculatedLines);
      setPairs(calculatedPairs);
    },
    []
  );

  useEffect(() => {
    async function fetchSeason() {
      const currentSeason = await fetchCurrentSeason();
      setSeasonId(currentSeason.id);

      const regularSeasonStartDate = new Date(currentSeason.startDate);
      const regularSeasonEndDate = new Date(currentSeason.endDate);
      const playoffsStartDate = new Date(currentSeason.playoffsStartDate);
      const playoffsEndDate = new Date(currentSeason.playoffsEndDate);

      setRegularSeasonDateRange({
        start: regularSeasonStartDate,
        end: regularSeasonEndDate
      });
      setPlayoffDateRange({
        start: playoffsStartDate,
        end: playoffsEndDate
      });

      setStartDate(regularSeasonStartDate);
      setEndDate(regularSeasonEndDate);
    }
    fetchSeason();
  }, []);

  useEffect(() => {
    async function updateDateRange() {
      if (timeFrame !== "Totals" && selectedTeam) {
        const gamesBack =
          timeFrame === "L7" ? 7 : timeFrame === "L14" ? 14 : 30;
        const dateRange = await getDateRangeForGames(
          teamsInfo[selectedTeam as TeamAbbreviation].id,
          gamesBack
        );
        console.log("Date Range:", dateRange);
        console.log("Time Frame:", timeFrame);

        if (dateRange) {
          setStartDate(new Date(dateRange.startDate));
          setEndDate(new Date(dateRange.endDate));
          console.log("Start Date:", dateRange.startDate);
          console.log("End Date:", dateRange.endDate);
        }
      } else if (seasonType === "regularSeason") {
        setStartDate(regularSeasonDateRange?.start);
        setEndDate(regularSeasonDateRange?.end);
      } else {
        setStartDate(playoffDateRange?.start);
        setEndDate(playoffDateRange?.end);
      }
    }

    updateDateRange();
  }, [
    timeFrame,
    seasonType,
    selectedTeam,
    regularSeasonDateRange,
    playoffDateRange
  ]);

  useEffect(() => {
    async function fetchGames() {
      if (selectedTeam && seasonId && startDate && endDate) {
        const teamKey = selectedTeam as TeamAbbreviation; // selectedTeam guaranteed non-empty
        const { regularSeasonPlayersData, playoffPlayersData } =
          await fetchAggregatedData(
            teamKey,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            seasonType,
            timeFrame,
            "",
            ""
          );
        setRegularSeasonData(regularSeasonPlayersData);
        setPlayoffData(playoffPlayersData);

        const allGameIds = Object.values(
          seasonType === "regularSeason"
            ? regularSeasonPlayersData
            : playoffPlayersData
        ).flatMap((player: any) => player.regularSeasonData.gameIds);

        setGameIds(allGameIds);
      }
    }
    fetchGames();
  }, [selectedTeam, seasonId, startDate, endDate, timeFrame, seasonType]);

  const aggregatedData = useMemo(() => {
    return seasonType === "regularSeason" ? regularSeasonData : playoffData;
  }, [seasonType, regularSeasonData, playoffData]);

  useEffect(() => {
    if (aggregatedData.length > 0 && startDate && endDate) {
      const recalculateLinesAndPairs = () => {
        const { lines: newLines, pairs: newPairs } = calculateLinesAndPairs(
          aggregatedData,
          "line-combination"
        );
        setLines(newLines);
        setPairs(newPairs);
        console.log("Recalculated Lines:", newLines);
        console.log("Recalculated Pairs:", newPairs);
      };

      recalculateLinesAndPairs();
    }
  }, [startDate, endDate, aggregatedData]);

  const handleSeasonTypeChange = (
    newSeasonType: "regularSeason" | "playoffs"
  ) => {
    setSeasonType(newSeasonType);
    if (newSeasonType === "regularSeason") {
      setStartDate(regularSeasonDateRange?.start);
      setEndDate(regularSeasonDateRange?.end);
    } else if (newSeasonType === "playoffs") {
      setStartDate(playoffDateRange?.start);
      setEndDate(playoffDateRange?.end);
    }
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

  const startStr = startDate?.toISOString().split("T")[0] || "";
  const endStr = endDate?.toISOString().split("T")[0] || "";
  const aggregatedForHook =
    seasonType === "regularSeason"
      ? Object.values(regularSeasonData)
      : Object.values(playoffData);

  const drmData = useDateRangeMatrixData({
    teamAbbreviation: (selectedTeam as TeamAbbreviation) || undefined,
    startDate: startStr,
    endDate: endStr,
    mode,
    source: "aggregated",
    aggregatedData: aggregatedForHook
  });

  return (
    <div
      className={styles.drmContainer}
      style={{
        ["--accent-color" as any]: accentColor,
        ["--secondary-color" as any]: secondary,
        ["--primary-color" as any]: primary,
        ["--jersey-color" as any]: jersey
      }}
    >
      <TeamSelect
        teams={Object.keys(teamsInfo).map((key) => ({
          abbreviation: key as TeamAbbreviation,
          name: teamsInfo[key as TeamAbbreviation].name
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

      <div className={styles.optionsContainer}>
        <div className={styles.options1}>
          <div className={styles.dropdownGroup}>
            <label htmlFor="teamDropdown" className={styles.label}>
              Team
            </label>
            <TeamDropdown
              selectedTeam={(selectedTeam || "") as string}
              onSelect={(team) => {
                setSelectedTeam(team as TeamAbbreviation);
              }}
              className={`${styles.select} ${styles.teamDropdown}`} // Apply the styled class names
            />
          </div>

          <div className={styles.datePickerGroup}>
            <div className={styles.datePicker}>
              <label htmlFor="startDate" className={styles.label}>
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) =>
                  setStartDate(date ?? undefined)
                }
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
                onChange={(date: Date | null) => setEndDate(date ?? undefined)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                className={`${styles.select} ${styles.datePickerInput}`}
              />
            </div>
          </div>

          {/* Timeframe Toggle Buttons */}
          <div className={styles.timeFrameToggle}>
            <button
              className={timeFrame === "L7" ? styles.active : ""}
              onClick={() => setTimeFrame("L7")}
            >
              L7
            </button>
            <button
              className={timeFrame === "L14" ? styles.active : ""}
              onClick={() => setTimeFrame("L14")}
            >
              L14
            </button>
            <button
              className={timeFrame === "L30" ? styles.active : ""}
              onClick={() => setTimeFrame("L30")}
            >
              L30
            </button>
            <button
              className={timeFrame === "Totals" ? styles.active : ""}
              onClick={() => setTimeFrame("Totals")}
            >
              Season
            </button>
          </div>
        </div>

        <div className={styles.options2}>
          <div className={styles.buttonsContainer}>
            <button
              onClick={() => handleSeasonTypeChange("regularSeason")}
              className={`${styles.button} ${
                seasonType === "regularSeason" ? styles.active : ""
              }`}
            >
              Regular Season
            </button>
            <button
              onClick={() => handleSeasonTypeChange("playoffs")}
              className={`${styles.button} ${
                seasonType === "playoffs" ? styles.active : ""
              }`}
            >
              Playoffs
            </button>
          </div>
          <Select
            options={DATERANGE_MATRIX_MODES}
            option={mode}
            onOptionChange={(newOption) => setDateRangeMatrixMode(newOption)}
            className={styles.selectWrapper}
          />
        </div>
      </div>

      <div className={styles.contentContainer}>
        <>
          <div className={styles.linePairGrid}>
            <LinePairGrid
              selectedTeam={selectedTeam}
              startDate={startDate}
              endDate={endDate}
              onLinesAndPairsCalculated={onLinesAndPairsCalculated}
              seasonType={seasonType}
              timeFrame={timeFrame} // Pass the selected time frame
              dateRange={{
                start: startDate || new Date(), // Fallback to current date if undefined
                end: endDate || new Date() // Fallback to current date if undefined
              }} // Pass dateRange
              regularSeasonPlayersData={regularSeasonData}
              playoffPlayersData={playoffData}
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
                lines={drmData.lines}
                pairs={drmData.pairs}
              />
            ) : null}
          </div>
        </>
      </div>
    </div>
  );
}

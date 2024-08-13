//////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\drm.tsx

import { useState, useEffect } from "react";
import DateRangeMatrix, {
  OPTIONS as DATERANGE_MATRIX_MODES,
  Mode,
} from "web/components/DateRangeMatrix/index";
import TeamDropdown from "components/DateRangeMatrix/TeamDropdown";
import TeamSelect from "components/TeamSelect";
import LinePairGrid from "components/DateRangeMatrix/LinePairGrid";
import { fetchAggregatedData } from "components/DateRangeMatrix/fetchAggregatedData";
import Select from "components/Select";
import { PlayerData } from "components/DateRangeMatrix/utilities";
import PulsatingGrid from "components/DateRangeMatrix/PulsatingGrid";
import styles from "components/DateRangeMatrix/drm.module.scss"; // Updated stylesheet for this page
import { queryTypes, useQueryState } from "next-usequerystate";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/NHL/teamsInfo";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type TeamAbbreviation = keyof typeof teamsInfo;

export default function DRMPage() {
  const [dateRangeMatrixMode, setDateRangeMatrixMode] = useQueryState(
    "daterange-matrix-mode",
    queryTypes.string.withDefault(DATERANGE_MATRIX_MODES[0].value)
  );
  const [selectedTeam, setSelectedTeam] = useState<TeamAbbreviation | "">("");
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

  const [loadingDRM, setLoadingDRM] = useState<boolean>(true); // Separate loading state for DateRangeMatrix
  const [loadingLPG, setLoadingLPG] = useState<boolean>(true); // Separate loading state for LinePairGrid
  const [pulsating, setPulsating] = useState<boolean>(true);

  // New state for lines and pairs
  const [lines, setLines] = useState<PlayerData[][]>([]);
  const [pairs, setPairs] = useState<PlayerData[][]>([]);

  useEffect(() => {
    console.log("Lines in drm.tsx:", lines);
    console.log("Pairs in drm.tsx:", pairs);
  }, [lines, pairs]);

  useEffect(() => {
    async function fetchSeason() {
      const currentSeason = await fetchCurrentSeason();
      console.log("Current season:", currentSeason);
      setSeasonId(currentSeason.id);

      const regularSeasonStartDate = new Date(currentSeason.startDate);
      const regularSeasonEndDate = new Date(currentSeason.endDate);
      const playoffsStartDate = new Date(currentSeason.playoffsStartDate);
      const playoffsEndDate = new Date(currentSeason.playoffsEndDate);

      setRegularSeasonDateRange({
        start: regularSeasonStartDate,
        end: regularSeasonEndDate,
      });

      setPlayoffDateRange({
        start: playoffsStartDate,
        end: playoffsEndDate,
      });

      setStartDate(regularSeasonStartDate);
      setEndDate(regularSeasonEndDate);
    }
    fetchSeason();
  }, []);

  useEffect(() => {
    async function fetchGames() {
      if (selectedTeam && seasonId && startDate && endDate) {
        setLoadingDRM(true);
        setLoadingLPG(true);
        setPulsating(true);
        console.log(
          "Fetching games for team:",
          selectedTeam,
          "season:",
          seasonId,
          "startDate:",
          startDate.toISOString().split("T")[0],
          "endDate:",
          endDate.toISOString().split("T")[0]
        );
        const { regularSeasonPlayersData, playoffPlayersData } =
          await fetchAggregatedData(
            selectedTeam,
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
            seasonType
          );
        setRegularSeasonData(regularSeasonPlayersData);
        setPlayoffData(playoffData);

        const allGameIds = Object.values(
          seasonType === "regularSeason"
            ? regularSeasonPlayersData
            : playoffData
        ).flatMap((player: any) => player.regularSeasonData.gameIds);

        setGameIds(allGameIds);
        setLoadingDRM(false); // Ensure this is set correctly
        setLoadingLPG(false); // Set this to false if necessary here too
        setPulsating(false);
      }
    }
    fetchGames();
  }, [selectedTeam, seasonId, startDate, endDate]);

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

  const combinedLoading = loadingDRM || loadingLPG; // Combine the loading states

  const mode = dateRangeMatrixMode as Mode;

  return (
    <div className={styles.drmContainer}>
      <TeamSelect
        teams={Object.keys(teamsInfo).map((key) => ({
          abbreviation: key as TeamAbbreviation,
          name: teamsInfo[key as TeamAbbreviation].name,
        }))}
        team={selectedTeam}
        onTeamChange={(teamAbbreviation) => {
          setSelectedTeam(teamAbbreviation as TeamAbbreviation);
          setPulsating(true);
        }}
      />

      <h4 className={styles.pageTitle}>
        {selectedTeam
          ? teamsInfo[selectedTeam as TeamAbbreviation].name
          : "Select a Team"}
      </h4>

      <div className={styles.optionsContainer}>
        <div className={styles.options1}>
          <TeamDropdown
            onSelect={(team) => {
              setSelectedTeam(team as TeamAbbreviation);
              setPulsating(true);
            }}
            className={styles.select}
          />
          <div className={styles.datePickers}>
            <DatePicker
              selected={startDate}
              onChange={(date: Date | null) => setStartDate(date ?? undefined)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              className={styles.select}
            />
            <DatePicker
              selected={endDate}
              onChange={(date: Date | null) => setEndDate(date ?? undefined)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              className={styles.select}
            />
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
        {combinedLoading ? (
          <PulsatingGrid rows={18} cols={18} pulsating={pulsating} />
        ) : (
          <>
            <div className={styles.linePairGrid}>
              <LinePairGrid
                selectedTeam={selectedTeam}
                startDate={startDate}
                endDate={endDate}
                onLinesAndPairsCalculated={(
                  calculatedLines,
                  calculatedPairs
                ) => {
                  setLines(calculatedLines);
                  setPairs(calculatedPairs);
                  setLoadingLPG(false); // Ensure this is called correctly
                }}
                seasonType={seasonType}
              />
            </div>
            <div className={styles.dateRangeMatrixContainer}>
              <DateRangeMatrix
                id={selectedTeam as TeamAbbreviation}
                gameIds={gameIds}
                mode={mode}
                onModeChanged={(newMode) => {
                  setDateRangeMatrixMode(newMode);
                }}
                aggregatedData={
                  seasonType === "regularSeason"
                    ? Object.values(regularSeasonData)
                    : Object.values(playoffData)
                }
                startDate={startDate?.toISOString().split("T")[0] || ""}
                endDate={endDate?.toISOString().split("T")[0] || ""}
                lines={lines}
                pairs={pairs}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// /Users/tim/Desktop/fhfhockey.com/web/pages/trueGoalieValue.tsx

import React, {
  useEffect,
  useState,
  ChangeEvent,
  FC,
  useCallback,
  useMemo
} from "react";
import GoalieList from "components/GoaliePage/GoalieList";
import GoalieLeaderboard from "components/GoaliePage/GoalieLeaderboard";
import styles from "styles/Goalies.module.scss";
import {
  eachWeekOfInterval,
  endOfWeek,
  addDays,
  format,
  startOfWeek,
  parseISO // Import parseISO
} from "date-fns";
import type {
  NumericGoalieStatKey,
  AggregatedGoalieData,
  GoalieRanking,
  Week,
  WeekOption,
  StatColumn,
  Season,
  ApiGoalieData, // Represents raw game data from API now
  GoalieGameStat // Use the renamed type
} from "components/GoaliePage/goalieTypes";
// Import calculation functions from utility file
import { calculateGoalieRankings } from "components/GoaliePage/goalieCalculations";
// Import API functions from utility file
import {
  fetchSeasonData,
  fetchGoalieStatsForWeeks, // Assumes this fetches games within weeks
  fetchGoalieStatsForSingleWeek // Assumes this fetches games within the week
} from "lib/nhlApi"; // Adjust path

// --- Constants ---
// Include new derived stats if they can be selected for ranking
const STAT_COLUMNS: StatColumn[] = [
  { label: "GP", value: "gamesPlayed" }, // In leaderboard, this will be total GP
  { label: "GS", value: "gamesStarted" }, // Total GS
  { label: "W", value: "wins" },
  { label: "L", value: "losses" },
  { label: "OTL", value: "otLosses" },
  { label: "SV", value: "saves" },
  { label: "SA", value: "shotsAgainst" },
  { label: "GA", value: "goalsAgainst" },
  { label: "SV%", value: "savePct" }, // Overall SV%
  { label: "GAA", value: "goalsAgainstAverage" }, // Overall GAA
  { label: "SO", value: "shutouts" },
  { label: "TOI", value: "timeOnIce" }, // Total TOI
  { label: "SV/60", value: "savesPer60" }, // Add derived stats
  { label: "SA/60", value: "shotsAgainstPer60" }
];

const DEFAULT_SELECTED_STATS: NumericGoalieStatKey[] = [
  "saves",
  "savePct",
  "wins",
  "goalsAgainstAverage" // Added GAA as default
];

// --- Helper Function ---
const generateWeekOptions = (season: Season | null): WeekOption[] => {
  if (!season) return [];

  try {
    const seasonStart = season.start;
    const seasonEnd = season.end;

    const firstSunday = endOfWeek(seasonStart, { weekStartsOn: 1 });
    const firstWeek: Week = {
      start: seasonStart,
      end: firstSunday > seasonEnd ? seasonEnd : firstSunday
    };

    let allWeeks: Week[] = [];
    if (firstWeek.start <= firstWeek.end) {
      allWeeks.push(firstWeek);
    }

    const dayAfterFirstSunday = addDays(firstSunday, 1);

    if (dayAfterFirstSunday <= seasonEnd) {
      const intervalWeeks = eachWeekOfInterval(
        { start: dayAfterFirstSunday, end: seasonEnd },
        { weekStartsOn: 1 }
      );

      const remainingWeeks: Week[] = intervalWeeks
        .map((weekStart) => {
          let potentialEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          return {
            start: weekStart,
            end: potentialEnd > seasonEnd ? seasonEnd : potentialEnd
          };
        })
        .filter((w) => w.start <= w.end);
      allWeeks = [...allWeeks, ...remainingWeeks];
    }

    return allWeeks.map((week, index) => ({
      label: `Week ${index + 1} | ${format(week.start, "MM/dd")} - ${format(
        week.end,
        "MM/dd/yy"
      )}`,
      value: week
    }));
  } catch (error) {
    console.error("Error generating week options:", error);
    return []; // Return empty array on error
  }
};

// --- Component Definition ---
const GoalieTrends: FC = () => {
  // --- State Definitions ---
  const [season, setSeason] = useState<Season | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: -1 }); // Initialize end to -1 until weeks load
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedStats, setSelectedStats] = useState<NumericGoalieStatKey[]>(
    DEFAULT_SELECTED_STATS
  );
  const [view, setView] = useState<"leaderboard" | "week">("leaderboard");
  const [useSingleWeek, setUseSingleWeek] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    "Loading season data..."
  );
  const [error, setError] = useState<string | null>(null);

  // State to hold RAW fetched GAME data for the selected range/week
  const [rangeRawGameData, setRangeRawGameData] = useState<Map<
    number, // weekIndex (identifies which week's fetch call this data came from)
    ApiGoalieData[] // Array of game stats fetched for that week
  > | null>(null);
  const [singleWeekGameData, setSingleWeekGameData] = useState<ApiGoalieData[]>(
    []
  ); // Raw game data for single week mode

  // --- Effects ---

  // Initial Load: Fetch season, generate weeks
  useEffect(() => {
    const loadInitialSeason = async () => {
      setLoading(true);
      setLoadingMessage("Loading season data...");
      setError(null);
      try {
        const fetchedSeason = await fetchSeasonData();
        setSeason(fetchedSeason);
        const options = generateWeekOptions(fetchedSeason);
        setWeekOptions(options);
        if (options.length > 0) {
          setSelectedRange({ start: 0, end: options.length - 1 });
          setSelectedWeekIndex(options.length - 1); // Default to last available week
        } else {
          setSelectedRange({ start: 0, end: -1 });
          setError("Could not generate valid weeks for the season.");
        }
      } catch (err: any) {
        console.error("Error loading initial season:", err);
        setError(err.message || "Failed to load season data.");
      }
      // Don't setLoading(false) here, let range fetching handle it
    };
    loadInitialSeason();
  }, []);

  // Fetch Game Data for DATE RANGE when range changes or component initially loads
  useEffect(() => {
    // Conditions to skip fetching
    if (
      weekOptions.length === 0 ||
      selectedRange.end < selectedRange.start ||
      selectedRange.end === -1 ||
      useSingleWeek
    ) {
      setRangeRawGameData(null); // Clear data
      if (weekOptions.length > 0 && !useSingleWeek) setLoading(false);
      return;
    }

    const fetchRangeData = async () => {
      setLoading(true);
      setLoadingMessage(
        `Fetching game data for weeks ${selectedRange.start + 1} to ${
          selectedRange.end + 1
        }...`
      );
      setError(null);
      setRangeRawGameData(null); // Clear previous range data

      const weeksToFetchWithOptions = weekOptions
        .slice(selectedRange.start, selectedRange.end + 1)
        .map((opt, i) => ({
          week: opt.value,
          originalIndex: selectedRange.start + i // Keep track of original week index
        }));

      const weeks = weeksToFetchWithOptions.map((item) => item.week);

      try {
        // fetchGoalieStatsForWeeks returns a Map<fetchIndex, ApiGoalieData[]>
        // fetchIndex corresponds to the order in the 'weeks' array passed to it.
        const fetchedDataMap = await fetchGoalieStatsForWeeks(weeks);

        // Reconstruct map using original week indices
        const finalDataMap = new Map<number, ApiGoalieData[]>();
        weeksToFetchWithOptions.forEach(({ originalIndex }, fetchIndex) => {
          finalDataMap.set(originalIndex, fetchedDataMap.get(fetchIndex) || []);
        });

        setRangeRawGameData(finalDataMap);
      } catch (err: any) {
        console.error("Error fetching range data:", err);
        setError(err.message || "Failed to fetch data for the selected range.");
        setRangeRawGameData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRangeData();
    // Ensure exhaustive deps are correct. weekOptions IS needed because selectedRange depends on its length.
  }, [selectedRange, weekOptions, useSingleWeek]);

  // Fetch Game Data for SINGLE WEEK
  useEffect(() => {
    if (!useSingleWeek || weekOptions.length === 0) {
      setSingleWeekGameData([]);
      return;
    }

    const fetchSingleWeek = async () => {
      const selectedWeekOption = weekOptions[selectedWeekIndex];
      if (!selectedWeekOption) {
        setError("Selected week not found.");
        setSingleWeekGameData([]);
        return;
      }

      setLoading(true);
      setLoadingMessage(
        `Fetching game data for ${selectedWeekOption.label}...`
      );
      setError(null);
      setSingleWeekGameData([]);

      try {
        const data = await fetchGoalieStatsForSingleWeek(
          selectedWeekOption.value
        );
        setSingleWeekGameData(data);
        setView("week"); // Ensure view is correct
      } catch (err: any) {
        console.error("Error fetching single week:", err);
        setError(err.message || "Error fetching single week data.");
      } finally {
        setLoading(false);
      }
    };

    fetchSingleWeek();
  }, [useSingleWeek, selectedWeekIndex, weekOptions]); // Re-run if mode, index, or options change

  // --- Memoized Calculations ---

  // --- Memoized Calculations ---

  // Aggregate Raw GAME Data by Goalie ID
  const aggregatedRangeData = useMemo((): AggregatedGoalieData[] => {
    if (!rangeRawGameData || rangeRawGameData.size === 0) {
      return [];
    }
    console.log("Memo: Aggregating raw game data...");

    const aggregated: Record<number, AggregatedGoalieData> = {};

    // Iterate through the map: Map<weekIndex, ApiGoalieData[]>
    rangeRawGameData.forEach((gamesInWeek, weekIndex) => {
      const weekOption = weekOptions[weekIndex];
      if (!weekOption) return; // Skip if week option not found (shouldn't happen)

      const weekLabel =
        weekOption.label.split(" | ")[0] || `Week ${weekIndex + 1}`; // Get "Week X" part

      gamesInWeek.forEach((gameData) => {
        if (!gameData || typeof gameData.playerId !== "number") return;

        // Initialize goalie if not seen before
        if (!aggregated[gameData.playerId]) {
          aggregated[gameData.playerId] = {
            playerId: gameData.playerId,
            goalieFullName: gameData.goalieFullName,
            // Use team from the first game encountered, or update later if needed
            team: gameData.team,
            games: [] // Initialize games array
          };
        }

        // Add the game stat, including the week label it belongs to
        // Also parse gameDate if available
        const gameDate = gameData.gameDate
          ? typeof gameData.gameDate === "string"
            ? parseISO(gameData.gameDate)
            : gameData.gameDate
          : undefined;

        const gameStat: GoalieGameStat = {
          ...gameData,
          weekLabel: weekLabel, // Add week label for weekly aggregation later
          gameDate: gameDate, // Store parsed date
          // Ensure derived stats are calculated if not provided by API
          savePct:
            gameData.savePct ??
            calculateSavePct(gameData.saves, gameData.shotsAgainst),
          goalsAgainstAverage:
            gameData.goalsAgainstAverage ??
            calculateGAA(gameData.goalsAgainst, gameData.timeOnIce)
        };
        aggregated[gameData.playerId].games.push(gameStat);
        // Update team abbreviation if needed (e.g., use latest game's team)
        aggregated[gameData.playerId].team = gameData.team;
      });
    });

    return Object.values(aggregated);
  }, [rangeRawGameData, weekOptions]);

  // Calculate Leaderboard Rankings (includes variance)
  const leaderboardRankings = useMemo((): GoalieRanking[] => {
    if (useSingleWeek) return []; // Don't calculate leaderboard in single week mode
    console.log("Memo: Recalculating leaderboard rankings...");
    // Pass aggregated game data, selected stats, and week options for weekly aggregation
    return calculateGoalieRankings(
      aggregatedRangeData,
      selectedStats,
      weekOptions
    );
  }, [aggregatedRangeData, selectedStats, weekOptions, useSingleWeek]);

  // --- Event Handlers (useCallback) ---

  const handleWeekChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedWeekIndex(parseInt(event.target.value, 10));
    },
    []
  );

  const handleStatChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value, checked } = event.target;
      const statKey = value as NumericGoalieStatKey;
      setSelectedStats((prev) =>
        checked ? [...prev, statKey] : prev.filter((stat) => stat !== statKey)
      );
    },
    []
  );

  const handleRangeStartChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newStart = parseInt(event.target.value, 10);
      setSelectedRange((prev) => ({
        start: newStart,
        end: Math.max(newStart, prev.end) // Ensure end >= start
      }));
    },
    []
  );

  const handleRangeEndChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newEnd = parseInt(event.target.value, 10);
      setSelectedRange((prev) => ({
        start: Math.min(prev.start, newEnd), // Ensure start <= end
        end: newEnd
      }));
    },
    []
  );

  const handleModeToggle = useCallback((mode: "range" | "single") => {
    const isSingle = mode === "single";
    setUseSingleWeek(isSingle);
    setView(isSingle ? "week" : "leaderboard");
    setError(null); // Clear errors on mode change
  }, []);

  // --- Render Logic ---

  // Get the Week object for the currently selected single week
  const currentSingleWeekForList = useSingleWeek
    ? weekOptions[selectedWeekIndex]?.value
    : undefined;

  const showLeaderboard = !useSingleWeek && view === "leaderboard";
  // Show single week list if in single week mode and data/week obj is available
  const showSingleWeekList =
    useSingleWeek && view === "week" && currentSingleWeekForList;

  return (
    <div className={styles.container}>
      <h1 className={styles.headerText}>NHL Goalie True Value & Variance</h1>
      {error && <p className={styles.errorText}>Error: {error}</p>}

      {/* Mode Toggle */}
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${
            !useSingleWeek ? styles.active : ""
          }`}
          onClick={() => handleModeToggle("range")}
          disabled={loading && useSingleWeek}
        >
          Date Range Leaderboard
        </button>
        <button
          className={`${styles.toggleButton} ${
            useSingleWeek ? styles.active : ""
          }`}
          onClick={() => handleModeToggle("single")}
          disabled={loading && !useSingleWeek}
        >
          Single Week Stats
        </button>
      </div>

      {/* Loading Indicator */}
      {loading && <p>{loadingMessage}</p>}

      {/* Controls Area */}
      {!loading && season && weekOptions.length > 0 && (
        <>
          {useSingleWeek ? (
            // Single Week Selector
            <div className={styles.singleWeekDropdown}>
              <label
                htmlFor="single-week-select"
                className={styles.singleWeekLabel}
              >
                Select Week:
              </label>
              <select
                id="single-week-select"
                className={styles.customSelect}
                value={selectedWeekIndex}
                onChange={handleWeekChange}
              >
                {weekOptions.map((week, index) => (
                  <option key={index} value={index}>
                    {week.label}
                  </option>
                ))}
              </select>
              {/* Simplified note */}
              <p className={styles.singleWeekNote}>
                View game-by-game stats for the selected week. Ranking compares
                goalies within this week.
              </p>
            </div>
          ) : (
            // Date Range Selector
            <div className={styles.weekRangeDropdowns}>
              <label className={styles.singleWeekLabel}>
                Select Week Range for Leaderboard:
              </label>
              <div className={styles.rangeSelectContainer}>
                <div className={styles.startWeekDropdown}>
                  {/* Start Select (unchanged) */}
                  <label
                    htmlFor="range-start-select"
                    className={styles.startEndLabel}
                  >
                    Start:
                  </label>
                  <select
                    id="range-start-select"
                    className={styles.customSelect}
                    value={selectedRange.start}
                    onChange={handleRangeStartChange}
                  >
                    {weekOptions.map((week, index) => (
                      <option key={`start-${index}`} value={index}>
                        {week.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.endWeekDropdown}>
                  {/* End Select (unchanged) */}
                  <label
                    htmlFor="range-end-select"
                    className={styles.startEndLabel}
                  >
                    End:
                  </label>
                  <select
                    id="range-end-select"
                    className={styles.customSelect}
                    value={selectedRange.end}
                    onChange={handleRangeEndChange}
                  >
                    {weekOptions.map((week, index) => (
                      <option key={`end-${index}`} value={index}>
                        {week.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className={styles.singleWeekNote}>
                Leaderboard ranks goalies based on performance across the
                selected weeks, including week-to-week (WoW) and game-to-game
                (GoG) consistency. Adapted from{" "}
                <a
                  href="https://dobberhockey.com/2024/05/19/geek-of-the-week-true-goalie-value-season-recap/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.hyperlink}
                >
                  True Goalie Value
                </a>{" "}
                concepts.
              </p>
            </div>
          )}

          {/* Stat Selection Checkboxes (Common) */}
          <div className={styles.customizeStatsContainer}>
            <label className={styles.customizeStatsLabel}>
              Customize Ranking Stats:
            </label>
            <div className={styles.checkboxContainer}>
              {STAT_COLUMNS
                // Filter out stats that might not be suitable for direct ranking comparison if needed
                // .filter(stat => !['gamesPlayed', 'gamesStarted', 'timeOnIce'].includes(stat.value))
                .map((stat) => (
                  <div key={stat.value} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      id={`checkbox-${stat.value}`}
                      value={stat.value}
                      checked={selectedStats.includes(
                        stat.value as NumericGoalieStatKey
                      )}
                      onChange={handleStatChange}
                    />
                    <label htmlFor={`checkbox-${stat.value}`}>
                      {stat.label}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Content Display Area */}
      {!loading && (
        <>
          {showLeaderboard && (
            <GoalieLeaderboard
              goalieRankings={leaderboardRankings} // Use memoized rankings with variance
              setView={setView} // Pass view setter
              // selectedStats={selectedStats} // Pass selected stats if needed by leaderboard for context/tooltips
            />
          )}

          {showSingleWeekList && currentSingleWeekForList && (
            <GoalieList
              weekGameData={singleWeekGameData} // Pass raw GAME data for the week
              week={currentSingleWeekForList} // Pass the Week object
              selectedStats={selectedStats}
              statColumns={STAT_COLUMNS} // Pass STAT_COLUMNS for table header consistency
              setView={setView}
            />
          )}
        </>
      )}
      {/* Placeholder if no weeks loaded or error state */}
      {!loading && (!season || weekOptions.length === 0) && !error && (
        <p>Waiting for season data to load weeks...</p>
      )}
    </div>
  );
};

export default GoalieTrends;

// Helper function needed within this file or imported
const calculateSavePct = (saves: number, shotsAgainst: number): number => {
  return shotsAgainst > 0 ? saves / shotsAgainst : 0;
};
const calculateGAA = (goalsAgainst: number, timeOnIce: number): number => {
  return timeOnIce > 0 ? (goalsAgainst * 60) / timeOnIce : 0;
};

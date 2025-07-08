// /Users/tim/Desktop/fhfhockey.com/web/pages/trueGoalieValue.tsx

import React, {
  useEffect,
  useState,
  ChangeEvent,
  FC,
  useCallback,
  useMemo,
  useReducer
} from "react";
import GoalieList from "components/GoaliePage/GoalieList";
import GoalieLeaderboard from "components/GoaliePage/GoalieLeaderboard";
import styles from "styles/Goalies.module.scss";
import { format, parseISO, formatISO } from "date-fns";
import supabase from "lib/supabase";
import type {
  NumericGoalieStatKey,
  GoalieRanking,
  WeekOption,
  StatColumn,
  GoalieWeeklyAggregate,
  LeagueWeeklyAverage,
  GoalieGameStat,
  FantasyPointSettings, // Import new type
  FantasyCountStatKey // Import new type
} from "components/GoaliePage/goalieTypes";
import { calculateGoalieRankings } from "components/GoaliePage/goalieCalculations";
import { fetchAllPages } from "utils/fetchAllPages";
import useCurrentSeason from "hooks/useCurrentSeason";

// --- Constants ---
const STAT_COLUMNS: StatColumn[] = [
  { label: "GP", value: "gamesPlayed" /* ... dbFields ... */ },
  { label: "GS", value: "gamesStarted" /* ... dbFields ... */ },
  {
    label: "W",
    value: "wins",
    dbFieldGoalie: "weekly_wins",
    dbFieldAverage: "avg_league_weekly_wins",
    fantasyStatKey: "win" // Map to fantasy key
  },
  { label: "L", value: "losses" /* ... dbFields ... */ },
  { label: "OTL", value: "otLosses" /* ... dbFields ... */ },
  {
    label: "SV",
    value: "saves",
    dbFieldGoalie: "weekly_saves",
    dbFieldAverage: "avg_league_weekly_saves",
    fantasyStatKey: "save" // Map to fantasy key
  },
  { label: "SA", value: "shotsAgainst" /* ... dbFields ... */ },
  {
    label: "GA",
    value: "goalsAgainst",
    dbFieldGoalie: "weekly_ga",
    dbFieldAverage: "avg_league_weekly_ga",
    fantasyStatKey: "goalAgainst" // Map to fantasy key
  },
  {
    label: "SV%",
    value: "savePct",
    dbFieldGoalie: "weekly_sv_pct",
    dbFieldAverage: "avg_league_weekly_sv_pct",
    dbFieldRate: true
  },
  {
    label: "GAA",
    value: "goalsAgainstAverage",
    dbFieldGoalie: "weekly_gaa",
    dbFieldAverage: "avg_league_weekly_gaa",
    dbFieldRate: true
  },
  {
    label: "SO",
    value: "shutouts",
    dbFieldGoalie: "weekly_so",
    dbFieldAverage: "avg_league_weekly_so",
    fantasyStatKey: "shutout" // Map to fantasy key
  },
  {
    label: "SV/60",
    value: "savesPer60",
    dbFieldGoalie: "weekly_saves_per_60",
    dbFieldAverage: "avg_league_weekly_saves_per_60",
    dbFieldRate: true
  },
  {
    label: "SA/60",
    value: "shotsAgainstPer60",
    dbFieldGoalie: "weekly_sa_per_60",
    dbFieldAverage: "avg_league_weekly_sa_per_60",
    dbFieldRate: true
  }
];

const DEFAULT_SELECTED_STATS: NumericGoalieStatKey[] = [
  "wins", // Keep UI values
  "saves",
  "savePct"
];

// Default Fantasy Point Settings
const DEFAULT_FANTASY_SETTINGS: FantasyPointSettings = {
  goalAgainst: -1,
  save: 0.2,
  shutout: 3,
  win: 4
};

// Define the SortConfig interface (can be placed outside component)
export interface SortConfig<T> {
  key: keyof T | null;
  direction: "ascending" | "descending";
}

// --- UNIFIED LOADING STATE MANAGER ---
interface LoadingState {
  isLoading: boolean;
  stage: "idle" | "season" | "weeks" | "leaderboard" | "singleWeek";
  message: string;
  progress?: number; // 0-100 percentage for progress indicators
}

type LoadingAction =
  | { type: "START_LOADING"; stage: LoadingState["stage"]; message: string }
  | { type: "UPDATE_PROGRESS"; progress: number }
  | { type: "UPDATE_MESSAGE"; message: string }
  | { type: "STOP_LOADING" };

const loadingReducer = (
  state: LoadingState,
  action: LoadingAction
): LoadingState => {
  switch (action.type) {
    case "START_LOADING":
      return {
        isLoading: true,
        stage: action.stage,
        message: action.message,
        progress: 0
      };
    case "UPDATE_PROGRESS":
      return { ...state, progress: action.progress };
    case "UPDATE_MESSAGE":
      return { ...state, message: action.message };
    case "STOP_LOADING":
      return {
        isLoading: false,
        stage: "idle",
        message: "",
        progress: 0
      };
    default:
      return state;
  }
};

// --- Component Definition ---
const GoalieTrends: FC = () => {
  const currentSeason = useCurrentSeason(); // Use the hook to get season data

  // --- State Definitions ---
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: -1 });
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedStats, setSelectedStats] = useState<NumericGoalieStatKey[]>(
    DEFAULT_SELECTED_STATS
  );
  const [view, setView] = useState<"leaderboard" | "week">("leaderboard");
  const [useSingleWeek, setUseSingleWeek] = useState<boolean>(false);

  // --- NEW: State for Fantasy Points ---
  const [fantasySettings, setFantasySettings] = useState<FantasyPointSettings>(
    DEFAULT_FANTASY_SETTINGS
  );

  const [loadingState, dispatchLoading] = useReducer(loadingReducer, {
    isLoading: true,
    stage: "season" as const,
    message: "Loading current season...",
    progress: undefined
  });

  const [error, setError] = useState<string | null>(null);

  // Data states (unchanged)
  const [goalieWeeklyData, setGoalieWeeklyData] = useState<
    GoalieWeeklyAggregate[] | null
  >(null);
  const [leagueWeeklyAverages, setLeagueWeeklyAverages] = useState<
    LeagueWeeklyAverage[] | null
  >(null);
  const [singleWeekGoalieData, setSingleWeekGoalieData] = useState<
    GoalieWeeklyAggregate[] | null
  >(null);
  const [singleWeekLeagueAverage, setSingleWeekLeagueAverage] =
    useState<LeagueWeeklyAverage | null>(null);
  const [goalieGameData, setGoalieGameData] = useState<GoalieGameStat[] | null>(
    null
  );
  const [singleWeekLoading, setSingleWeekLoading] = useState<boolean>(false);
  const [singleWeekError, setSingleWeekError] = useState<string | null>(null);

  const [leaderboardRankings_Unsorted, setLeaderboardRankings_Unsorted] =
    useState<GoalieRanking[]>([]); // Store unsorted results

  // State for Leaderboard Sorting
  const [leaderboardSortConfig, setLeaderboardSortConfig] = useState<
    SortConfig<GoalieRanking>
  >({
    key: "totalPoints", // Default sort by points
    direction: "descending" // Default descending
  });

  // --- Effects ---
  // Effect 1: Fetch Week Options once the currentSeason is loaded
  useEffect(() => {
    // Don't run if the season hasn't been loaded yet
    if (!currentSeason) {
      dispatchLoading({
        type: "START_LOADING",
        stage: "season",
        message: "Loading current season..."
      });
      return;
    }

    const fetchOptions = async () => {
      dispatchLoading({
        type: "START_LOADING",
        stage: "weeks",
        message: "Loading week options for current season..."
      });
      setError(null);
      setWeekOptions([]); // Clear previous options
      setSelectedRange({ start: 0, end: -1 }); // Reset range
      setSelectedWeekIndex(-1); // Reset index

      // Derive the target season string (e.g., "2024") for Yahoo weeks
      // from the NHL API season ID (e.g., 20242025)
      const targetSeasonForYahooWeeks = String(
        currentSeason.seasonId
      ).substring(0, 4);
      console.log(`Derived Yahoo season target: ${targetSeasonForYahooWeeks}`); // Log derived season

      try {
        const { data, error: weekError } = await supabase
          .from("yahoo_matchup_weeks")
          .select("season, week, start_date, end_date")
          .eq("season", targetSeasonForYahooWeeks) // Use dynamically determined season
          .order("week", { ascending: true });

        if (weekError) throw weekError;

        const validWeeksData =
          data?.filter(
            (w) =>
              w.start_date && w.end_date && w.week != null && w.season != null
          ) ?? [];

        if (validWeeksData.length === 0) {
          throw new Error(
            `No valid matchup weeks found for season ${targetSeasonForYahooWeeks}`
          );
        }

        const options: WeekOption[] = validWeeksData.map((w) => {
          if (!w.start_date || !w.end_date || !w.season) {
            throw new Error(`Invalid data for week ${w.week}`);
          }
          return {
            label: `Week ${w.week} | ${format(parseISO(w.start_date), "MM/dd")} - ${format(parseISO(w.end_date), "MM/dd/yy")}`,
            value: {
              week: w.week as number,
              season: String(w.season), // Ensure season is string, matching targetSeason format used
              start: parseISO(w.start_date),
              end: parseISO(w.end_date)
            }
          };
        });

        setWeekOptions(options);
        if (options.length > 0) {
          // Default to the full available range for the fetched season
          setSelectedRange({ start: 0, end: options.length - 1 });
          // Default to the latest week for single week view
          setSelectedWeekIndex(options.length - 1);
          console.log(
            `Loaded ${options.length} weeks for season ${targetSeasonForYahooWeeks}. Default range: 0-${options.length - 1}`
          );
        } else {
          setError(
            `Could not load valid weeks for season ${targetSeasonForYahooWeeks}.`
          );
        }
      } catch (err: any) {
        console.error("Error loading matchup weeks:", err);
        setError(err.message || "Failed to load week options.");
      } finally {
        // Set loading false ONLY after options (or error) are processed
        dispatchLoading({ type: "STOP_LOADING" });
      }
    };

    fetchOptions();
    // Depend on currentSeason object. This effect runs when currentSeason is fetched.
  }, [currentSeason]);

  // Effect to fetch Range Data (Aggregates and Games) - No changes needed here from previous version
  useEffect(() => {
    if (
      useSingleWeek ||
      !currentSeason?.seasonId ||
      weekOptions.length === 0 ||
      selectedRange.end < selectedRange.start ||
      selectedRange.end >= weekOptions.length ||
      selectedRange.start >= weekOptions.length ||
      selectedRange.end === -1
    ) {
      if (
        !currentSeason?.seasonId &&
        !useSingleWeek &&
        weekOptions.length > 0 &&
        selectedRange.end !== -1
      ) {
        dispatchLoading({
          type: "UPDATE_MESSAGE",
          message: "Waiting for current season data..."
        });
      } else if (weekOptions.length > 0 && selectedRange.end !== -1) {
        setGoalieWeeklyData(null);
        setLeagueWeeklyAverages(null);
        setGoalieGameData(null);
      }
      return;
    }

    const fetchRangeData = async () => {
      dispatchLoading({
        type: "START_LOADING",
        stage: "leaderboard",
        message: "Fetching leaderboard data (aggregates, games)..."
      });
      setError(null); // Clear previous range errors

      const startWeekValue = weekOptions[selectedRange.start]?.value;
      const endWeekValue = weekOptions[selectedRange.end]?.value;
      const nhlSeasonId = currentSeason.seasonId;

      // Add checks for values existing after index validation
      if (!startWeekValue || !endWeekValue) {
        console.error(
          "Selected week options are missing for the range.",
          selectedRange,
          weekOptions.length
        );
        setError("Invalid week range selected.");
        dispatchLoading({ type: "STOP_LOADING" });
        return;
      }

      const startDateString = formatISO(startWeekValue.start, {
        representation: "date"
      });
      const endDateString = formatISO(endWeekValue.end, {
        representation: "date"
      });
      const seasonForYahooAggregates = startWeekValue.season; // Already derived in week options

      setError(null);
      setGoalieWeeklyData(null);
      setLeagueWeeklyAverages(null);
      setGoalieGameData(null);

      try {
        // Queries using the validated range and season
        const goalieAggQuery = supabase
          .from("goalie_weekly_aggregates")
          .select("*")
          .eq("matchup_season", seasonForYahooAggregates)
          .gte("week", startWeekValue.week)
          .lte("week", endWeekValue.week);

        const avgAggQuery = supabase
          .from("league_weekly_goalie_averages")
          .select("*")
          .eq("matchup_season", seasonForYahooAggregates)
          .gte("week", startWeekValue.week)
          .lte("week", endWeekValue.week);

        const gameDataQuery = supabase
          .from("wgo_goalie_stats")
          .select("*")
          .eq("season_id", nhlSeasonId) // Filter by NHL season ID
          .gte("date", startDateString)
          .lte("date", endDateString);

        console.log("Starting parallel fetchAllPages for range data...");

        // Track progress across parallel fetches
        let completedFetches = 0;
        const updateOverallProgress = () => {
          completedFetches++;
          const progress = Math.round((completedFetches / 3) * 100);
          dispatchLoading({
            type: "UPDATE_MESSAGE",
            message: `Loading leaderboard data... ${progress}%`
          });
        };

        const [allGoalieAggData, allAvgAggData, allGameData] =
          await Promise.all([
            fetchAllPages<GoalieWeeklyAggregate>(goalieAggQuery, {
              useCache: true,
              cacheKey: `goalie_agg_${seasonForYahooAggregates}_${startWeekValue.week}_${endWeekValue.week}`,
              onProgress: () => updateOverallProgress()
            }),
            fetchAllPages<LeagueWeeklyAverage>(avgAggQuery, {
              useCache: true,
              cacheKey: `league_avg_${seasonForYahooAggregates}_${startWeekValue.week}_${endWeekValue.week}`,
              onProgress: () => updateOverallProgress()
            }),
            fetchAllPages<GoalieGameStat>(gameDataQuery, {
              useCache: true,
              cacheKey: `game_stats_${nhlSeasonId}_${startDateString}_${endDateString}`,
              onProgress: () => updateOverallProgress()
            })
          ]);
        console.log("Finished parallel fetchAllPages.");

        // 3. Filter and set state using the complete data sets
        const validGoalieData = allGoalieAggData.filter(
          (g): g is GoalieWeeklyAggregate =>
            g.goalie_id != null && g.week != null && g.matchup_season != null
        );
        const validAverageData = allAvgAggData.filter(
          (a): a is LeagueWeeklyAverage =>
            a.week != null && a.matchup_season != null
        );
        // Ensure game data has essential fields, including date for verification
        const validGameData = allGameData.filter(
          (g): g is GoalieGameStat =>
            g != null &&
            g.goalie_id != null &&
            g.date != null &&
            typeof g.date === "string"
        );

        console.log(
          `Workspaceed Goalie Weekly Aggregates: ${validGoalieData.length} rows`
        );
        console.log(
          `Workspaceed League Average Aggregates: ${validAverageData.length} rows`
        );
        console.log(
          `Workspaceed Goalie Game Stats (wgo_goalie_stats): ${validGameData.length} rows`
        );

        // Quick check: Log the date range of fetched game data
        if (validGameData.length > 0) {
          const minDate = validGameData.reduce(
            (min, p) => (p.date! < min ? p.date! : min),
            validGameData[0].date!
          );
          const maxDate = validGameData.reduce(
            (max, p) => (p.date! > max ? p.date! : max),
            validGameData[0].date!
          );
          console.log(`Game data date range fetched: ${minDate} to ${maxDate}`);
          if (minDate < startDateString || maxDate > endDateString) {
            console.warn(
              "Fetched game data contains dates outside the expected range!"
            );
          }
        }

        setGoalieWeeklyData(validGoalieData);
        setLeagueWeeklyAverages(validAverageData);
        setGoalieGameData(validGameData);
      } catch (err: any) {
        console.error("Error fetching range data:", err);
        setError(err.message || "Failed to fetch range data.");
        // Clear data on error
        setGoalieWeeklyData(null);
        setLeagueWeeklyAverages(null);
        setGoalieGameData(null);
      } finally {
        dispatchLoading({ type: "STOP_LOADING" });
      }
    };

    fetchRangeData();
    // Dependencies: Run when range, options, or mode change.
  }, [selectedRange, weekOptions, useSingleWeek]);

  useEffect(() => {
    // Conditions to skip fetching single week data
    if (!useSingleWeek || weekOptions.length === 0 || selectedWeekIndex < 0) {
      // Clear single week data if conditions met or switching modes
      if (
        useSingleWeek &&
        (weekOptions.length === 0 || selectedWeekIndex < 0)
      ) {
        setSingleWeekGoalieData(null);
        setSingleWeekLeagueAverage(null);
      }
      return;
    }

    const selectedWeekOption = weekOptions[selectedWeekIndex]?.value;
    if (!selectedWeekOption) {
      setSingleWeekError("Selected week data not found.");
      return;
    }

    const fetchSingleWeekData = async () => {
      setSingleWeekLoading(true); // Use specific loading flag
      dispatchLoading({
        type: "START_LOADING",
        stage: "singleWeek",
        message: `Workspaceing data for Week ${selectedWeekOption.week}...`
      }); // Update main message
      setSingleWeekError(null); // Clear previous single week error
      setSingleWeekGoalieData(null); // Clear previous data
      setSingleWeekLeagueAverage(null);

      try {
        const weekNum = selectedWeekOption.week;
        const season = selectedWeekOption.season;

        // Fetch goalie aggregates for the specific week
        const { data: goalieData, error: goalieError } = await supabase
          .from("goalie_weekly_aggregates")
          .select("*")
          .eq("matchup_season", season)
          .eq("week", weekNum);

        if (goalieError) throw goalieError;

        // Fetch league average for the specific week (should be one row)
        const { data: averageData, error: averageError } = await supabase
          .from("league_weekly_goalie_averages")
          .select("*")
          .eq("matchup_season", season)
          .eq("week", weekNum)
          .maybeSingle(); // Expect 0 or 1 row

        if (averageError) throw averageError;

        console.log(
          `Workspaceed Single Week ${weekNum} Goalie Data:`,
          goalieData
        );
        console.log(
          `Workspaceed Single Week ${weekNum} Average Data:`,
          averageData
        );

        // Filter nulls just in case
        const validGoalieData = (goalieData ?? []).filter(
          (g): g is GoalieWeeklyAggregate =>
            g.goalie_id != null && g.week != null && g.matchup_season != null
        );

        setSingleWeekGoalieData(validGoalieData);
        setSingleWeekLeagueAverage(averageData); // Set directly (null if not found)
      } catch (err: any) {
        console.error("Error fetching single week data:", err);
        setSingleWeekError(err.message || "Failed to fetch single week data.");
        setSingleWeekGoalieData(null);
        setSingleWeekLeagueAverage(null);
      } finally {
        setSingleWeekLoading(false);
        dispatchLoading({ type: "STOP_LOADING" }); // Clear message
      }
    };

    fetchSingleWeekData();
  }, [selectedWeekIndex, weekOptions, useSingleWeek]); // Dependencies

  const calculatedLeaderboardRankings = useMemo((): GoalieRanking[] => {
    if (
      useSingleWeek ||
      !goalieWeeklyData ||
      !leagueWeeklyAverages ||
      !goalieGameData ||
      weekOptions.length === 0 ||
      selectedRange.end < 0 ||
      selectedRange.start >= weekOptions.length ||
      selectedRange.end >= weekOptions.length
    ) {
      return [];
    }
    console.log("Memo: Recalculating leaderboard rankings...");

    const startWeekValue = weekOptions[selectedRange.start]?.value;
    const endWeekValue = weekOptions[selectedRange.end]?.value;
    if (!startWeekValue?.week || !endWeekValue?.week) return [];

    return calculateGoalieRankings(
      goalieWeeklyData,
      leagueWeeklyAverages, // Still needed for WoW
      goalieGameData, // Pass game data using updated type
      selectedStats,
      STAT_COLUMNS,
      startWeekValue.week,
      endWeekValue.week,
      fantasySettings // Pass fantasy settings
    );
  }, [
    goalieWeeklyData,
    leagueWeeklyAverages,
    goalieGameData, // Dependency added
    selectedStats,
    weekOptions,
    selectedRange,
    useSingleWeek,
    fantasySettings // Dependency added
  ]);

  // *** NEW: Memo to SORT the calculated rankings ***
  const sortedLeaderboardRankings = useMemo(() => {
    let sortableItems = [...calculatedLeaderboardRankings]; // Create a new array
    if (leaderboardSortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const key = leaderboardSortConfig.key!;

        // Special handling for Total fPts calculation
        if (
          key === "totalGamesPlayed" &&
          leaderboardSortConfig.key === "totalGamesPlayed"
        ) {
          // Check if we're actually trying to sort by Total fPts (when user clicks Total fPts column)
          // We'll use a custom calculation for total fantasy points
          const aTotalFpts = a.averageFantasyPointsPerGame * a.totalGamesPlayed;
          const bTotalFpts = b.averageFantasyPointsPerGame * b.totalGamesPlayed;

          if (aTotalFpts < bTotalFpts) {
            return leaderboardSortConfig.direction === "ascending" ? -1 : 1;
          }
          if (aTotalFpts > bTotalFpts) {
            return leaderboardSortConfig.direction === "ascending" ? 1 : -1;
          }
          return 0;
        }

        // Type guard for properties that might not exist on all items (though GoalieRanking should be consistent)
        if (!(key in a) || !(key in b)) {
          return 0;
        }
        const aValue = a[key];
        const bValue = b[key];

        // Basic comparison logic (expand as needed for specific types)
        if (aValue === null || aValue === undefined) return 1; // Sort nulls/undefined last
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return leaderboardSortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return leaderboardSortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [calculatedLeaderboardRankings, leaderboardSortConfig]);

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

  // Define the specific handler for the back button
  const handleBackToLeaderboard = useCallback(() => {
    handleModeToggle("range"); // Trigger the mode switch to range/leaderboard
  }, [handleModeToggle]); // Dependency is correct

  const handleFantasySettingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      const statKey = name as FantasyCountStatKey;
      const numericValue = parseFloat(value); // Or parseInt if only integers expected

      // Basic validation: ensure it's a number
      if (!isNaN(numericValue)) {
        setFantasySettings((prev) => ({
          ...prev,
          [statKey]: numericValue
        }));
      } else if (value === "" || value === "-") {
        // Allow empty or just negative sign temporarily
        setFantasySettings((prev) => ({
          ...prev,
          // Store as 0 or keep previous value if empty? Let's store 0 for now.
          [statKey]: value === "-" ? prev[statKey] : 0 // Keep if just '-', else 0
          // Alternatively, could store the string temporarily, but number state is cleaner
        }));
      }
      // Add more robust validation if needed (e.g., min/max values)
    },
    []
  );

  const handleLeaderboardSort = useCallback((key: keyof GoalieRanking) => {
    setLeaderboardSortConfig((prevConfig) => {
      let direction: "ascending" | "descending" = "ascending";
      // If clicking the same key, toggle direction
      if (prevConfig.key === key && prevConfig.direction === "ascending") {
        direction = "descending";
      }
      // Otherwise, default to ascending for the new key
      return { key, direction };
    });
  }, []);

  // --- Render Logic ---
  // Get the Week object for the currently selected single week
  const currentSingleWeekValue = useSingleWeek
    ? weekOptions[selectedWeekIndex]?.value
    : undefined;

  const showLeaderboard = !useSingleWeek && view === "leaderboard";
  // Updated condition to check if data is ready for GoalieList
  const showSingleWeekList =
    useSingleWeek && view === "week" && currentSingleWeekValue;

  return (
    // Use the main page container style
    <div className={styles.pageContainer}>
      {/* --- Header --- */}
      <div className={styles.headerWrapper}>
        <h1 className={styles.pageTitle}>
          <span className={styles.spanColorBlue}>NHL</span> Goalie{" "}
          <span className={styles.spanColorBlue}>T</span>rue{" "}
          <span className={styles.spanColorBlue}>V</span>alue &{" "}
          <span className={styles.spanColorBlue}>V</span>ariance
        </h1>
      </div>

      {/* --- Loading / Error --- */}
      {loadingState.isLoading && (
        <p className={styles.loadingMessage}>{loadingState.message}</p>
      )}
      {error && <p className={styles.errorText}>Error: {error}</p>}

      {/* --- Controls --- */}
      {/* Only show controls if week options are loaded */}
      {!loadingState.isLoading && weekOptions.length > 0 && (
        <div className={styles.controlsWrapper}>
          {/* Mode Toggles Section */}
          <div className={styles.controlsSection}>
            <h2 className={styles.sectionTitle}>Display Mode</h2>
            <div className={styles.toggleContainer}>
              <button
                className={`${styles.toggleButton} ${
                  !useSingleWeek ? styles.active : ""
                }`}
                onClick={() => handleModeToggle("range")}
                disabled={loadingState.isLoading && useSingleWeek} // Keep disabled logic if loading state applies here
              >
                Date Range Leaderboard
              </button>
              <button
                className={`${styles.toggleButton} ${
                  useSingleWeek ? styles.active : ""
                }`}
                onClick={() => handleModeToggle("single")}
                disabled={loadingState.isLoading && !useSingleWeek} // Keep disabled logic if loading state applies here
              >
                Single Week Stats
              </button>
            </div>
          </div>

          {/* Date Selection Section */}
          <div className={styles.controlsSection}>
            <h2 className={styles.sectionTitle}>Select Date Range</h2>
            {useSingleWeek ? (
              // Single Week Selector
              <div className={styles.dateSelectorContainer}>
                <div className={styles.dropdownGroup}>
                  <label
                    htmlFor="single-week-select"
                    className={styles.selectLabel}
                  >
                    Week:
                  </label>
                  <select
                    id="single-week-select"
                    className={styles.customSelect}
                    value={selectedWeekIndex}
                    onChange={handleWeekChange}
                  >
                    {weekOptions.map((opt, index) => (
                      <option key={index} value={index}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.selectorNote}>
                  View stats for the selected week.
                </p>
              </div>
            ) : (
              // Date Range Selector
              <div className={styles.dateSelectorContainer}>
                <div className={styles.rangeSelectContainer}>
                  <div className={styles.dropdownGroup}>
                    <label
                      htmlFor="range-start-select"
                      className={styles.selectLabel}
                    >
                      Start:
                    </label>
                    <select
                      id="range-start-select"
                      className={styles.customSelect}
                      value={selectedRange.start}
                      onChange={handleRangeStartChange}
                    >
                      {weekOptions.map((opt, index) => (
                        <option key={`start-${index}`} value={index}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.dropdownGroup}>
                    <label
                      htmlFor="range-end-select"
                      className={styles.selectLabel}
                    >
                      End:
                    </label>
                    <select
                      id="range-end-select"
                      className={styles.customSelect}
                      value={selectedRange.end}
                      onChange={handleRangeEndChange}
                    >
                      {weekOptions.map((opt, index) => (
                        <option key={`end-${index}`} value={index}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className={styles.selectorNote}>
                  Leaderboard ranks goalies based on performance across the
                  selected weeks, including week-to-week (WoW) and game-to-game
                  (GoG) consistency. Adapted from{" "}
                  <a
                    href="https://dobberhockey.com/2024/05/19/geek-of-the-week-true-goalie-value-season-recap/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hyperlink} // Ensure hyperlink style exists or add it
                  >
                    True Goalie Value
                  </a>{" "}
                  concepts.
                </p>
              </div>
            )}
          </div>

          {/* Stat Selection Section */}
          <div className={styles.controlsSection}>
            <h2 className={styles.sectionTitle}>Customize Ranking Stats</h2>
            <div className={styles.checkboxContainer}>
              {STAT_COLUMNS
                // Filter out non-rankable stats if desired, e.g. those without dbFieldGoalie/dbFieldAverage
                // .filter(stat => stat.dbFieldGoalie && stat.dbFieldAverage)
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

          {/* Fantasy Settings Section - Show for BOTH modes */}
          <div className={styles.controlsSection}>
            <h2 className={styles.sectionTitle}>Fantasy Settings</h2>
            <div className={styles.fantasyInputGrid}>
              {selectedStats
                .filter((stat) => {
                  // Only show fantasy inputs for stats that have a corresponding fantasy key
                  const statColumn = STAT_COLUMNS.find(
                    (col) => col.value === stat
                  );
                  return statColumn?.fantasyStatKey;
                })
                .map((stat) => {
                  const statColumn = STAT_COLUMNS.find(
                    (col) => col.value === stat
                  );
                  const fantasyKey = statColumn?.fantasyStatKey;
                  if (!fantasyKey) return null;

                  return (
                    <div key={fantasyKey} className={styles.fantasyInputItem}>
                      <label htmlFor={`fantasy-${fantasyKey}`}>
                        {fantasyKey === "goalAgainst"
                          ? "GA"
                          : fantasyKey === "save"
                            ? "SV"
                            : fantasyKey === "shutout"
                              ? "SO"
                              : "W"}
                      </label>
                      <input
                        type="number"
                        id={`fantasy-${fantasyKey}`}
                        name={fantasyKey}
                        value={fantasySettings[fantasyKey]}
                        onChange={handleFantasySettingChange}
                        step={fantasyKey === "save" ? 0.1 : 1}
                        className={styles.fantasyInput}
                      />
                    </div>
                  );
                })}
            </div>
            <p className={styles.selectorNote}>
              {useSingleWeek
                ? "Adjust points per stat. Fantasy points will be calculated for each goalie in the table."
                : "Adjust points per stat. GoG Variance recalculates based on these values."}
            </p>
          </div>
        </div> // End controlsWrapper
      )}

      {/* --- Main Content Area (Leaderboard or List) --- */}
      {/* Only render content area if not loading initial options, OR if options are loaded */}
      {(!loadingState.isLoading || weekOptions.length > 0) && (
        <div className={styles.contentWrapper}>
          {/* Optional: Add scroll container if tables might overflow */}
          {/* <div className={styles.tableScrollContainer}> */}
          {showLeaderboard && (
            <GoalieLeaderboard
              // Pass SORTED data
              goalieRankings={sortedLeaderboardRankings}
              statColumns={STAT_COLUMNS}
              // Pass sort handler and config
              requestSort={handleLeaderboardSort}
              sortConfig={leaderboardSortConfig}
              setView={setView} // Keep if needed
            />
          )}
          {showSingleWeekList && currentSingleWeekValue && (
            <GoalieList
              goalieAggregates={singleWeekGoalieData}
              leagueAverage={singleWeekLeagueAverage}
              week={currentSingleWeekValue}
              selectedStats={selectedStats}
              statColumns={STAT_COLUMNS}
              setView={setView} // Pass setView if GoalieList/Table needs it internally
              onBackToLeaderboard={handleBackToLeaderboard}
              loading={singleWeekLoading} // Pass correct loading state
              fantasySettings={fantasySettings} // Pass fantasy settings
            />
          )}
          {/* </div> End tableScrollContainer */}

          {/* Placeholder if no weeks loaded after initial load */}
          {!loadingState.isLoading && weekOptions.length === 0 && !error && (
            <p className={styles.loadingMessage}>No week data found.</p>
          )}
        </div> // End contentWrapper
      )}
    </div> // End pageContainer
  );
};

export default GoalieTrends;

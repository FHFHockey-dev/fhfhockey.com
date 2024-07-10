import React, { useEffect, useState } from "react";
import axios from "axios";
import GoalieList from "web/components/GoalieList";
import GoalieLeaderboard from "web/components/GoalieLeaderboard";
import styles from "styles/Goalies.module.scss";
import {
  parseISO,
  eachWeekOfInterval,
  endOfWeek,
  addDays,
  format,
  startOfWeek,
} from "date-fns";

// Helper functions
export const calculateAverages = (goalies) => {
  const totals = goalies.reduce(
    (acc, goalie) => {
      acc.gamesPlayed += goalie.gamesPlayed;
      acc.gamesStarted += goalie.gamesStarted;
      acc.wins += goalie.wins;
      acc.losses += goalie.losses;
      acc.otLosses += goalie.otLosses;
      acc.saves += goalie.saves;
      acc.shotsAgainst += goalie.shotsAgainst;
      acc.goalsAgainst += goalie.goalsAgainst;
      acc.shutouts += goalie.shutouts;
      acc.timeOnIce += goalie.timeOnIce;
      return acc;
    },
    {
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      shutouts: 0,
      timeOnIce: 0,
    }
  );

  const numGoalies = goalies.length;

  return {
    gamesPlayed: (totals.gamesPlayed / numGoalies).toFixed(2),
    gamesStarted: (totals.gamesStarted / numGoalies).toFixed(2),
    wins: (totals.wins / numGoalies).toFixed(2),
    losses: (totals.losses / numGoalies).toFixed(2),
    otLosses: (totals.otLosses / numGoalies).toFixed(2),
    saves: (totals.saves / numGoalies).toFixed(2),
    shotsAgainst: (totals.shotsAgainst / numGoalies).toFixed(2),
    goalsAgainst: (totals.goalsAgainst / numGoalies).toFixed(2),
    savePct: (totals.saves / totals.shotsAgainst).toFixed(3),
    goalsAgainstAverage: (totals.goalsAgainst / numGoalies).toFixed(2),
    shutouts: (totals.shutouts / numGoalies).toFixed(2),
    timeOnIce: (totals.timeOnIce / numGoalies).toFixed(2),
  };
};

export const calculateRanking = (goalie, averages, selectedStats) => {
  const statMap = {
    gamesPlayed: "larger",
    gamesStarted: "larger",
    wins: "larger",
    losses: "smaller",
    otLosses: "smaller",
    saves: "larger",
    shotsAgainst: "larger",
    goalsAgainst: "smaller",
    savePct: "larger",
    goalsAgainstAverage: "smaller",
    shutouts: "larger",
    timeOnIce: "larger",
  };

  let betterStats = 0;

  selectedStats.forEach((stat) => {
    const comparisonType = statMap[stat];
    const value = goalie[stat];
    const averageValue = averages[stat];

    if (comparisonType === "larger" && value >= averageValue) {
      betterStats += 1;
    } else if (comparisonType === "smaller" && value <= averageValue) {
      betterStats += 1;
    }
  });

  const percentage = (betterStats / selectedStats.length) * 100;

  let ranking = "";
  if (percentage >= 80) {
    ranking = "Elite Week";
  } else if (percentage >= 60) {
    ranking = "Quality Week";
  } else if (percentage >= 50) {
    ranking = "Week";
  } else if (percentage >= 35) {
    ranking = "Bad Week";
  } else {
    ranking = "Really Bad Week";
  }

  return { percentage, ranking };
};

const calculateGoalieRankings = (goalies, selectedStats) => {
  const rankingPoints = {
    "Elite Week": 20,
    "Quality Week": 10,
    Week: 5,
    "Bad Week": 3,
    "Really Bad Week": 1,
  };

  const averages = calculateAverages(goalies);

  const goalieRankings = goalies.map((goalie) => {
    let totalPoints = 0;
    const weekCounts = {
      "Elite Week": 0,
      "Quality Week": 0,
      Week: 0,
      "Bad Week": 0,
      "Really Bad Week": 0,
    };

    goalie.weeks.forEach((week) => {
      const { ranking } = calculateRanking(week, averages, selectedStats);
      weekCounts[ranking]++;
      totalPoints += rankingPoints[ranking];
    });

    return {
      ...goalie,
      totalPoints,
      weekCounts,
    };
  });

  return goalieRankings.sort((a, b) => b.totalPoints - a.totalPoints);
};

const statColumns = [
  { label: "GP", value: "gamesPlayed" },
  { label: "GS", value: "gamesStarted" },
  { label: "W", value: "wins" },
  { label: "L", value: "losses" },
  { label: "OTL", value: "otLosses" },
  { label: "SV", value: "saves" },
  { label: "SA", value: "shotsAgainst" },
  { label: "GA", value: "goalsAgainst" },
  { label: "SV%", value: "savePct" },
  { label: "GAA", value: "goalsAgainstAverage" },
  { label: "SO", value: "shutouts" },
  { label: "TOI", value: "timeOnIce" },
];

const defaultSelectedStats = ["saves", "savePct", "wins"];

const GoalieTrends = () => {
  const [season, setSeason] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedStats, setSelectedStats] = useState(defaultSelectedStats);
  const [goalieRankings, setGoalieRankings] = useState([]);
  const [goalies, setGoalies] = useState([]);
  const [view, setView] = useState("leaderboard");
  const [selectedRange, setSelectedRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useSingleWeek, setUseSingleWeek] = useState(true); // Toggle state

  useEffect(() => {
    const fetchSeasonData = async () => {
      try {
        const response = await axios.get(
          "https://api.nhle.com/stats/rest/en/season?sort=%5B%7B%22property%22:%22id%22,%22direction%22:%22DESC%22%7D%5D"
        );
        const seasonData = response.data.data[0];
        const seasonStart = parseISO(seasonData.startDate);
        const seasonEnd = parseISO(seasonData.regularSeasonEndDate);

        setSeason({ start: seasonStart, end: seasonEnd });

        const firstSunday = endOfWeek(seasonStart, { weekStartsOn: 1 });
        const firstWeek = {
          start: seasonStart,
          end: firstSunday,
        };

        const remainingWeeks = eachWeekOfInterval({
          start: addDays(firstSunday, 7),
          end: seasonEnd,
        }).map((weekStart) => ({
          start: startOfWeek(weekStart, { weekStartsOn: 1 }),
          end: endOfWeek(weekStart, { weekStartsOn: 1 }),
        }));

        const allWeeks = [firstWeek, ...remainingWeeks];

        setWeeks(
          allWeeks.map((week, index) => ({
            label: `Week ${index + 1} || ${format(
              week.start,
              "MM/dd/yyyy"
            )} - ${format(week.end, "MM/dd/yyyy")}`,
            value: week,
          }))
        );
        setSelectedWeek(allWeeks[0].value);
        setSelectedRange({ start: 0, end: allWeeks.length - 1 });

        const allGoalieData = await Promise.all(
          allWeeks.map((week) =>
            axios.get(
              `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameDate%3C=%22${format(
                new Date(week.end),
                "yyyy-MM-dd HH:mm:ss"
              )}%22%20and%20gameDate%3E=%22${format(
                new Date(week.start),
                "yyyy-MM-dd HH:mm:ss"
              )}%22%20and%20gameTypeId=2`
            )
          )
        );

        const aggregatedData = allGoalieData.reduce((acc, weekData, index) => {
          weekData.data.data.forEach((goalie) => {
            if (!acc[goalie.playerId]) {
              acc[goalie.playerId] = { ...goalie, weeks: [] };
            }
            acc[goalie.playerId].weeks.push({
              ...goalie,
              weekLabel: `Week ${index + 1}`,
            });
          });
          return acc;
        }, {});

        const goalieRankings = calculateGoalieRankings(
          Object.values(aggregatedData),
          selectedStats
        );
        setGoalieRankings(goalieRankings);

        console.log("Season Start:", seasonStart);
        console.log("Season End:", seasonEnd);
        console.log("Total Weeks:", allWeeks.length);
      } catch (error) {
        console.error("Error fetching season data:", error);
      }
    };

    fetchSeasonData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      const fetchGoalies = async () => {
        setLoading(true);
        try {
          const startDate = format(
            new Date(selectedWeek.start),
            "yyyy-MM-dd HH:mm:ss"
          );
          const endDate = format(
            new Date(selectedWeek.end),
            "yyyy-MM-dd HH:mm:ss"
          );
          console.log(`Fetching data for: ${startDate} to ${endDate}`);
          const response = await axios.get(
            `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameDate%3C=%22${endDate}%22%20and%20gameDate%3E=%22${startDate}%22%20and%20gameTypeId=2`
          );
          setGoalies(response.data.data);
        } catch (error) {
          console.error("Error fetching goalie data:", error);
          setError("Error fetching data");
        } finally {
          setLoading(false);
        }
      };

      fetchGoalies();
    }
  }, [selectedWeek, selectedStats]);

  const handleWeekChange = (event) => {
    setSelectedWeek(weeks[event.target.value].value);
    setView("week");
  };

  const handleStatChange = (event) => {
    const { value, checked } = event.target;
    setSelectedStats((prevSelectedStats) =>
      checked
        ? [...prevSelectedStats, value]
        : prevSelectedStats.filter((stat) => stat !== value)
    );
  };

  const handleRangeChange = (start, end) => {
    setSelectedRange({ start, end });
  };

  const handleRangeSubmit = async () => {
    setLoading(true);
    try {
      const selectedWeeks = weeks.slice(
        selectedRange.start,
        selectedRange.end + 1
      );
      const allGoalieData = await Promise.all(
        selectedWeeks.map((week) =>
          axios.get(
            `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameDate%3C=%22${format(
              new Date(week.end),
              "yyyy-MM-dd HH:mm:ss"
            )}%22%20and%20gameDate%3E=%22${format(
              new Date(week.start),
              "yyyy-MM-dd HH:mm:ss"
            )}%22%20and%20gameTypeId=2`
          )
        )
      );

      const aggregatedData = allGoalieData.reduce((acc, weekData, index) => {
        weekData.data.data.forEach((goalie) => {
          if (!acc[goalie.playerId]) {
            acc[goalie.playerId] = { ...goalie, weeks: [] };
          }
          acc[goalie.playerId].weeks.push({
            ...goalie,
            weekLabel: `Week ${index + 1}`,
          });
        });
        return acc;
      }, {});

      const goalieRankings = calculateGoalieRankings(
        Object.values(aggregatedData),
        selectedStats
      );
      setGoalieRankings(goalieRankings);
      setView("leaderboard");
    } catch (error) {
      console.error("Error fetching goalie data:", error);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.headerText}>NHL Goalie Stats</h1>
      <div className={styles.toggleContainer}>
        <button
          className={`${styles.toggleButton} ${
            useSingleWeek ? styles.active : ""
          }`}
          onClick={() => setUseSingleWeek(true)}
        >
          Single Week
        </button>
        <button
          className={`${styles.toggleButton} ${
            !useSingleWeek ? styles.active : ""
          }`}
          onClick={() => setUseSingleWeek(false)}
        >
          Date Range
        </button>
      </div>
      {useSingleWeek ? (
        <div className={styles.singleWeekDropdown}>
          <label className={styles.singleWeekLabel}>Single Week Stats:</label>
          {weeks.length > 0 && (
            <select className={styles.customSelect} onChange={handleWeekChange}>
              {weeks.map((week, index) => (
                <option key={index} value={index}>
                  {week.label}
                </option>
              ))}
            </select>
          )}
          <p className={styles.singleWeekNote}>
            Adapted from the{" "}
            <a
              href="https://dobberhockey.com/2024/05/19/geek-of-the-week-true-goalie-value-season-recap/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.hyperlink}
            >
              {" "}
              True Goalie Value{" "}
            </a>
            Goalie Rankings and Constructs by
            <a
              href="https://twitter.com/fantasycheddar"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.hyperlink}
            >
              {" "}
              @TopCheddarFantasy{" "}
            </a>
          </p>
        </div>
      ) : (
        <div className={styles.weekRangeDropdowns}>
          <label className={styles.singleWeekLabel}>Week Range Stats:</label>
          <div className={styles.startWeekDropdown}>
            <label className={styles.startEndLabel}>Start:</label>
            <select
              className={styles.customSelect}
              value={selectedRange.start}
              onChange={(e) =>
                handleRangeChange(parseInt(e.target.value), selectedRange.end)
              }
            >
              {weeks.map((week, index) => (
                <option key={index} value={index}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.endWeekDropdown}>
            <label className={styles.startEndLabel}>End:</label>
            <select
              className={styles.customSelect}
              value={selectedRange.end}
              onChange={(e) =>
                handleRangeChange(selectedRange.start, parseInt(e.target.value))
              }
            >
              {weeks.map((week, index) => (
                <option key={index} value={index}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className={styles.weekLeaderboardButton}
            onClick={handleRangeSubmit}
          >
            Submit
          </button>
        </div>
      )}
      <div className={styles.customizeStatsContainer}>
        <label className={styles.customizeStatsLabel}>Customize Stats</label>
        <div className={styles.checkboxContainer}>
          {statColumns.map((stat) => (
            <div key={stat.value} className={styles.checkboxItem}>
              <input
                type="checkbox"
                id={`checkbox-${stat.value}`}
                value={stat.value}
                checked={selectedStats.includes(stat.value)}
                onChange={handleStatChange}
              />
              <label htmlFor={`checkbox-${stat.value}`}>{stat.label}</label>
            </div>
          ))}
        </div>
      </div>
      {view === "leaderboard" && (
        <GoalieLeaderboard goalieRankings={goalieRankings} setView={setView} />
      )}
      {view === "week" && selectedWeek && (
        <GoalieList
          week={selectedWeek}
          selectedStats={selectedStats}
          statColumns={statColumns}
          handleStatChange={handleStatChange}
          setView={setView}
        />
      )}
    </div>
  );
};

export default GoalieTrends;

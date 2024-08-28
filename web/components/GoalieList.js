import React, { useEffect, useState } from "react";
import Fetch from "lib/cors-fetch";
import GoalieTable from "./GoalieTable";
import styles from "styles/Goalies.module.scss";
import { format } from "date-fns";

const GoalieList = ({ week, selectedStats, statColumns, setView }) => {
  const [goalies, setGoalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGoalies = async () => {
      if (!week || !week.start || !week.end) {
        console.error("Invalid week object:", week);
        setError("Invalid week object");
        setLoading(false);
        return;
      }

      try {
        const startDate = format(new Date(week.start), "yyyy-MM-dd HH:mm:ss");
        const endDate = format(new Date(week.end), "yyyy-MM-dd HH:mm:ss");
        console.log(`Fetching data for: ${startDate} to ${endDate}`);
        const response = await Fetch(
          `https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=true&isGame=true&sort=%5B%7B%22property%22:%22wins%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22savePct%22,%22direction%22:%22DESC%22%7D,%7B%22property%22:%22playerId%22,%22direction%22:%22ASC%22%7D%5D&start=0&limit=50&cayenneExp=gameDate%3C=%22${endDate}%22%20and%20gameDate%3E=%22${startDate}%22%20and%20gameTypeId=2`
        ).then((res) => res.json());
        setGoalies(response.data);
      } catch (error) {
        console.error("Error fetching goalie data:", error);
        setError("Error fetching data");
      } finally {
        setLoading(false);
      }
    };

    fetchGoalies();
  }, [week, selectedStats]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  const startDate = format(new Date(week.start), "MM/dd/yyyy");
  const endDate = format(new Date(week.end), "MM/dd/yyyy");

  return (
    <div className={styles.tableContainer}>
      <GoalieTable
        goalies={goalies}
        selectedStats={selectedStats}
        statColumns={statColumns}
        setView={setView}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

export default GoalieList;

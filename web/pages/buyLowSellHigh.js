import React, { useState, useEffect, useRef } from "react";

import supabase from "lib/supabase";
import styles from "styles/BLSH.module.scss";
import useCareerAveragesStats from "hooks/useCareerAveragesStats";

// TO DO:
// Make Goalie Career Averages Endpoint via NST
// Make Team Career Averages Endpoint via NST
// make an algorithm for sustainability using different luck and skill metrics

function SkaterStats() {
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("Forwards");

  useEffect(() => {
    // Fetch data from Supabase
    const fetchData = async () => {
      let query = supabase.from("wgo_skater_stats_totals").select("*");

      // Filter based on the active tab
      if (activeTab === "Forwards") {
        query = query.in("position_code", ["L", "R", "C"]);
      } else if (activeTab === "Defenseman") {
        query = query.eq("position_code", "D");
      }

      const { data: skaterStats, error } = await query;

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        console.log("Data fetched:", skaterStats);
        setData(skaterStats);
      }
    };

    fetchData();
  }, [activeTab]);

  return (
    <div className={styles.skaterStats}>
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabs} ${
            activeTab === "Forwards" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("Forwards")}
        >
          Forwards
        </button>
        <button
          className={`${styles.tabs} ${
            activeTab === "Defenseman" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("Defenseman")}
        >
          Defenseman
        </button>
        {/* Add more buttons for Goalies and Teams later */}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>Player Name</th>
              <th>Position</th>
              <th>Team</th>
              <th>Games Played</th>
              <th>Goals</th>
              <th>Assists</th>
              <th>Points</th>
              <th>Shots</th>
              <th>Shooting %</th>
              <th>Time On Ice</th>
              <th>Power Play Goals</th>
              <th>Power Play Assists</th>
              <th>Power Play Points</th>
              <th>Short Handed Goals</th>
              <th>Short Handed Assists</th>
              <th>Short Handed Points</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player) => (
              <tr key={player.id}>
                <td>{player.player_name}</td>
                <td>{player.position_code}</td>
                <td>{player.current_team_abbreviation}</td>
                <td>{player.games_played}</td>
                <td>{player.goals}</td>
                <td>{player.assists}</td>
                <td>{player.points}</td>
                <td>{player.shots}</td>
                <td>{player.shooting_percentage}</td>
                <td>{player.toi_per_game}</td>
                <td>{player.pp_goals}</td>
                <td>{player.pp_assists}</td>
                <td>{player.pp_points}</td>
                <td>{player.sh_goals}</td>
                <td>{player.sh_assists}</td>
                <td>{player.sh_points}</td>
                <td>{player.plus_minus}</td>

                {/* Add more data cells as needed */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SkaterStats;

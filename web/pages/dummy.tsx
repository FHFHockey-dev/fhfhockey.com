// pages/dummy.tsx

import React, { useState } from "react";
import { useTeamsMap } from "../hooks/useTeams";
import PoissonHeatmap from "../components/GameGrid/PDHC/PoissonHeatMap"; // Adjust the import path if necessary
import styles from "../styles/DummyPage.module.scss"; // Create corresponding CSS module

const DummyPage: React.FC = () => {
  const teamsMap = useTeamsMap();
  const teamIds = Object.keys(teamsMap).map((id) => Number(id));

  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);
  const [situation, setSituation] = useState<string>("5v5"); // Default situation

  const handleHomeTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setHomeTeamId(Number(e.target.value));
  };

  const handleAwayTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAwayTeamId(Number(e.target.value));
  };

  const handleSituationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSituation(e.target.value);
  };

  return (
    <div className={styles.container}>
      <h1>Dummy Page for Data Inspection and PDHC Testing</h1>

      <div className={styles.selectionContainer}>
        <div className={styles.dropdown}>
          <label htmlFor="homeTeam">Select Home Team:</label>
          <select
            id="homeTeam"
            onChange={handleHomeTeamChange}
            value={homeTeamId ?? ""}
          >
            <option value="" disabled>
              --Select Home Team--
            </option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {teamsMap[id]?.name} ({teamsMap[id]?.abbreviation})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.dropdown}>
          <label htmlFor="awayTeam">Select Away Team:</label>
          <select
            id="awayTeam"
            onChange={handleAwayTeamChange}
            value={awayTeamId ?? ""}
          >
            <option value="" disabled>
              --Select Away Team--
            </option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {teamsMap[id]?.name} ({teamsMap[id]?.abbreviation})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.dropdown}>
          <label htmlFor="situation">Select Situation:</label>
          <select
            id="situation"
            onChange={handleSituationChange}
            value={situation}
          >
            <option value="5v5">5v5</option>
            <option value="pp">Power Play (PP)</option>
            <option value="pk">Penalty Kill (PK)</option>
            <option value="all">All Situations</option>
          </select>
        </div>
      </div>

      {homeTeamId && awayTeamId ? (
        <div className={styles.pdchContainer}>
          <h2>
            Poisson Distribution Heatmap: {teamsMap[homeTeamId]?.name} (
            {teamsMap[homeTeamId]?.abbreviation}) vs{" "}
            {teamsMap[awayTeamId]?.name} ({teamsMap[awayTeamId]?.abbreviation})
            - {situation.toUpperCase()}
          </h2>
          <PoissonHeatmap
            homeTeamAbbreviation={teamsMap[homeTeamId]?.abbreviation ?? ""}
            awayTeamAbbreviation={teamsMap[awayTeamId]?.abbreviation ?? ""}
            situation={situation as any} // Adjust type as necessary
          />
        </div>
      ) : (
        <p>Please select both Home and Away teams to view the PDHC.</p>
      )}

      <div className={styles.tableContainer}>
        <h2>All Teams Statistics</h2>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>Team ID</th>
              <th>Name</th>
              <th>Abbreviation</th>
              <th>Logo</th>
            </tr>
          </thead>
          <tbody>
            {teamIds.map((id) => (
              <tr key={id}>
                <td>{id}</td>
                <td>{teamsMap[id]?.name}</td>
                <td>{teamsMap[id]?.abbreviation}</td>
                <td>
                  <img
                    src={teamsMap[id]?.logo}
                    alt={`${teamsMap[id]?.name} logo`}
                    width={50}
                    height={50}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DummyPage;

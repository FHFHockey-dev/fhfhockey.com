// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\testLogoMaker.tsx

import React, { useState } from "react";
import LogoMaker from "../components/LogoMaker/logoMaker";
import { teamsInfo } from "lib/teamsInfo";
import styles from "../components/LogoMaker/logoMaker.module.scss";

const TestLogoMaker = () => {
  const [selectedTeam, setSelectedTeam] =
    useState<keyof typeof teamsInfo>("ANA"); // Default to ANA

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(e.target.value as keyof typeof teamsInfo);
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "20px",
        backgroundColor: "#333",
        color: "#fff"
      }}
    >
      <h1 className={styles.header}>Team Logo Selector</h1>
      <p>Select a team abbreviation from the dropdown to view its logo:</p>
      <div>
        <label htmlFor="team-select">Choose a team:</label>
        <select
          id="team-select"
          value={selectedTeam}
          onChange={handleTeamChange}
          style={{ marginLeft: "10px", padding: "5px" }}
        >
          {Object.keys(teamsInfo)
            .sort()
            .map((teamAbbreviation) => (
              <option key={teamAbbreviation} value={teamAbbreviation}>
                {teamAbbreviation}
              </option>
            ))}
        </select>
      </div>
      <div style={{ marginTop: "20px" }}>
        <LogoMaker selectedTeam={selectedTeam} />
      </div>
    </div>
  );
};

export default TestLogoMaker;

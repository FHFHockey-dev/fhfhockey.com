/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\TeamDropdown.tsx

import React from "react";
import { teamsInfo } from "lib/teamsInfo";
import styles from "./drm.module.scss"; // Assuming your custom styles are in drm.module.scss

type TeamAbbreviation = keyof typeof teamsInfo;

type TeamDropdownProps = {
  selectedTeam: TeamAbbreviation | "";
  onSelect: (team: TeamAbbreviation) => void;
  className?: string;
};

const TeamDropdown: React.FC<TeamDropdownProps> = ({
  selectedTeam,
  onSelect
}) => {
  const teamOptions = Object.keys(teamsInfo)
    .sort()
    .map((key) => ({
      value: key,
      label: key
    }));

  return (
    <div className={styles.customSelect}>
      <select
        value={selectedTeam}
        onChange={(e) => {
          const selectedTeam = e.target.value as TeamAbbreviation;
          console.log("Selected team:", selectedTeam);
          onSelect(selectedTeam);
        }}
        className={styles.select}
      >
        <option value="">Select a team</option>
        {teamOptions.map((team) => (
          <option key={team.value} value={team.value}>
            {team.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TeamDropdown;

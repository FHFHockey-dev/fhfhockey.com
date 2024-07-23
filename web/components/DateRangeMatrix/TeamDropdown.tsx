// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\TeamDropdown.tsx

import React from "react";
import { teamsInfo } from "lib/NHL/teamsInfo";

type TeamAbbreviation = keyof typeof teamsInfo;

type TeamDropdownProps = {
  onSelect: (team: TeamAbbreviation) => void;
};

const TeamDropdown: React.FC<TeamDropdownProps> = ({ onSelect }) => {
  const teamOptions = Object.keys(teamsInfo)
    .sort()
    .map((key) => ({
      value: key,
      label: key,
    }));

  return (
    <select
      onChange={(e) => {
        const selectedTeam = e.target.value as TeamAbbreviation;
        console.log("Selected team:", selectedTeam);
        onSelect(selectedTeam);
      }}
    >
      <option value="">Select a team</option>
      {teamOptions.map((team) => (
        <option key={team.value} value={team.value}>
          {team.label}
        </option>
      ))}
    </select>
  );
};

export default TeamDropdown;

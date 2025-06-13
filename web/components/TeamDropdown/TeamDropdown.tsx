import React from "react";
import { useRouter } from "next/router";
import styles from "./TeamDropdown.module.scss";

interface TeamListItem {
  team_id: number;
  name: string;
  abbreviation: string;
}

interface TeamDropdownProps {
  teams: TeamListItem[];
  currentTeam: string;
  className?: string;
}

export default function TeamDropdown({
  teams,
  currentTeam,
  className
}: TeamDropdownProps) {
  const router = useRouter();

  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTeam = event.target.value;
    if (selectedTeam && selectedTeam !== currentTeam) {
      router.push(`/stats/team/${selectedTeam}`);
    }
  };

  return (
    <div className={`${styles.teamDropdown} ${className || ""}`}>
      <select
        id="team-selector"
        name="team-selector"
        value={currentTeam}
        onChange={handleTeamChange}
        className={styles.select}
        aria-label="Select team"
      >
        {teams.map((team) => (
          <option key={team.team_id} value={team.abbreviation}>
            {team.abbreviation}
          </option>
        ))}
      </select>
    </div>
  );
}

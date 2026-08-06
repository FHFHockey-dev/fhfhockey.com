/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\TeamDropdown.tsx

import React from "react";
import classNames from "classnames";
import { teamsInfo } from "lib/teamsInfo";
import styles from "./drm.module.scss"; // Assuming your custom styles are in drm.module.scss

type TeamAbbreviation = Extract<keyof typeof teamsInfo, string>;

type TeamDropdownProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "className" | "defaultValue" | "onChange" | "onSelect" | "value"
> & {
  selectedTeam: TeamAbbreviation | "";
  onSelect: (team: TeamAbbreviation | "") => void;
  className?: string;
};

function TeamDropdown({
  selectedTeam,
  onSelect,
  className,
  ...selectProps
}: TeamDropdownProps) {
  const teamOptions = Object.keys(teamsInfo)
    .sort()
    .map((key) => ({
      value: key,
      label: key,
    }));

  return (
    <div className={styles.customSelect}>
      <select
        {...selectProps}
        value={selectedTeam}
        onChange={(event) => {
          onSelect(event.currentTarget.value as TeamAbbreviation | "");
        }}
        className={classNames(styles.select, className)}
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
}

export default TeamDropdown;

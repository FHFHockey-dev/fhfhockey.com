// components/DraftDashboard/TeamRosterSelect.tsx
import React from "react";

export interface TeamOption {
  id: string;
  label: string;
}

interface TeamRosterSelectProps {
  value: string;
  onChange: (id: string) => void;
  options: TeamOption[];
  selectClassName?: string;
}

const TeamRosterSelect: React.FC<TeamRosterSelectProps> = ({
  value,
  onChange,
  options,
  selectClassName
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClassName}
      aria-label="Select team to view"
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

export default TeamRosterSelect;

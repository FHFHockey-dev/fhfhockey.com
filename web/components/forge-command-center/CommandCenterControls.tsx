import type { ChangeEvent } from "react";

import type {
  CommandCenterAddMode,
  CommandCenterPosition,
  CommandCenterSlateMode
} from "lib/dashboard/commandCenterTypes";
import styles from "styles/ForgeCommandCenter.module.scss";

type CommandCenterControlsProps = {
  date: string;
  team: string;
  position: CommandCenterPosition;
  slateMode: CommandCenterSlateMode;
  addMode: CommandCenterAddMode;
  teamOptions: string[];
  onDateChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onPositionChange: (value: CommandCenterPosition) => void;
  onSlateModeChange: (value: CommandCenterSlateMode) => void;
  onAddModeChange: (value: CommandCenterAddMode) => void;
  onReset: () => void;
};

export default function CommandCenterControls({
  date,
  team,
  position,
  slateMode,
  addMode,
  teamOptions,
  onDateChange,
  onTeamChange,
  onPositionChange,
  onSlateModeChange,
  onAddModeChange,
  onReset
}: CommandCenterControlsProps) {
  const handlePositionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "all" || value === "f" || value === "d" || value === "g") {
      onPositionChange(value);
    }
  };

  const handleSlateModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "main" || value === "all") {
      onSlateModeChange(value);
    }
  };

  const handleAddModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "tonight" || value === "week") {
      onAddModeChange(value);
    }
  };

  return (
    <section className={styles.controlsPanel} aria-label="Command center filters">
      <label className={styles.controlItem}>
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>

      <label className={styles.controlItem}>
        <span>Team</span>
        <select value={team} onChange={(event) => onTeamChange(event.target.value)}>
          <option value="all">All Teams</option>
          {teamOptions.map((abbr) => (
            <option key={abbr} value={abbr}>
              {abbr}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.controlItem}>
        <span>Position</span>
        <select value={position} onChange={handlePositionChange}>
          <option value="all">All</option>
          <option value="f">Forwards</option>
          <option value="d">Defense</option>
          <option value="g">Goalies</option>
        </select>
      </label>

      <label className={styles.controlItem}>
        <span>Slate</span>
        <select value={slateMode} onChange={handleSlateModeChange}>
          <option value="main">Main slate</option>
          <option value="all">All games</option>
        </select>
      </label>

      <label className={styles.controlItem}>
        <span>Adds</span>
        <select value={addMode} onChange={handleAddModeChange}>
          <option value="tonight">Tonight</option>
          <option value="week">This week</option>
        </select>
      </label>

      <button type="button" className={styles.resetButton} onClick={onReset}>
        Reset
      </button>
    </section>
  );
}

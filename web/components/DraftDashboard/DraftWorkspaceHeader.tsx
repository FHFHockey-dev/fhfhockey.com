import type { SettingsSection } from "./DraftSettingsShell";
import styles from "./DraftWorkspace.module.scss";

interface DraftWorkspaceHeaderProps {
  leagueName: string;
  seasonId?: string | number;
  manual: boolean;
  health: "loading" | "warning" | "healthy";
  healthLabel: string;
  onSettings: (section: SettingsSection) => void;
  onManual: () => void;
  onSummary: () => void;
}

export default function DraftWorkspaceHeader({
  leagueName,
  seasonId,
  manual,
  health,
  healthLabel,
  onSettings,
  onManual,
  onSummary,
}: DraftWorkspaceHeaderProps) {
  const season = seasonId
    ? `${String(seasonId).slice(0, 4)}–${String(seasonId).slice(-2)}`
    : "Loading…";
  return (
    <header className={styles.workspaceHeader}>
      <span className={styles.workspaceLabel}>Draft Workspace</span>
      <label>
        League
        <select
          value="current"
          onChange={() => onSettings("integrations")}
          aria-label="Draft league"
        >
          <option value="current">{leagueName}</option>
          <option value="manage">Manage leagues…</option>
        </select>
      </label>
      <label>
        Season
        <select aria-label="Draft season" value={season} onChange={() => {}}>
          <option>{season}</option>
        </select>
      </label>
      <div className={styles.modeSwitch} aria-label="Draft mode">
        <button type="button" aria-pressed={manual} onClick={onManual}>
          Manual
        </button>
        <button
          type="button"
          aria-pressed={!manual}
          onClick={() => onSettings("integrations")}
        >
          Live Sync
        </button>
      </div>
      <nav aria-label="Workspace actions">
        <button type="button" onClick={() => onSettings("league")}>
          Setup
        </button>
        <button type="button" onClick={() => onSettings("projections")}>
          Sources
        </button>
        <button type="button" onClick={() => onSettings("integrations")}>
          Integrations
        </button>
        <button type="button" onClick={onSummary}>
          Summary
        </button>
      </nav>
      <button
        type="button"
        className={health === "healthy" ? styles.healthy : styles.warning}
        title={healthLabel}
        onClick={() => onSettings("integrations")}
      >
        <span aria-hidden="true">●</span> {healthLabel}
      </button>
    </header>
  );
}

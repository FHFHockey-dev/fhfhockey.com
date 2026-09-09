import styles from "./DraftWorkspace.module.scss";

interface DraftWorkspaceHeaderProps {
  seasonId?: string | number;
  health: "loading" | "warning" | "healthy";
  healthLabel: string;
  draftProEligible: boolean;
  onSettings: () => void;
  onHealth: () => void;
}

export default function DraftWorkspaceHeader({
  seasonId,
  health,
  healthLabel,
  draftProEligible,
  onSettings,
  onHealth,
}: DraftWorkspaceHeaderProps) {
  const season = seasonId
    ? `${String(seasonId).slice(0, 4)}–${String(seasonId).slice(-2)}`
    : "Loading…";
  return (
    <header className={styles.workspaceHeader}>
      <output className={styles.seasonValue} aria-label="Draft season">
        {season}
      </output>
      <button
        type="button"
        className={health === "healthy" ? styles.healthy : styles.warning}
        title={healthLabel}
        onClick={onHealth}
      >
        <span aria-hidden="true">●</span> {healthLabel}
      </button>
      <a className={styles.draftProLink} href="/account?section=draft-pro">
        {draftProEligible ? "Manage Draft Pro" : "Explore Draft Pro"}
      </a>
      <button type="button" className={styles.settingsButton} onClick={onSettings}>
        Settings
      </button>
    </header>
  );
}

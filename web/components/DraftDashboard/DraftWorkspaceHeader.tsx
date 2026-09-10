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
      <span className={styles.toolbarDivider} aria-hidden="true" />
      <button
        type="button"
        className={health === "healthy" ? styles.healthy : styles.warning}
        title={healthLabel}
        onClick={onHealth}
      >
        <span aria-hidden="true">●</span> {healthLabel}
      </button>
      <a className={styles.draftProLink} href="/account?section=draft-pro" aria-label={draftProEligible ? "Manage Draft Pro" : "Explore Draft Pro"}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 6 5 4 4-7 4 7 5-4-2 12H5L3 6Zm2 15h14" /></svg> Draft Pro
      </a>
      <span className={styles.toolbarDivider} aria-hidden="true" />
      <button type="button" className={styles.settingsButton} onClick={onSettings}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="11" cy="11" r="3"/></svg> Settings
      </button>
    </header>
  );
}

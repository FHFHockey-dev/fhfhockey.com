import controls from "styles/Controls.module.scss";
import styles from "./DraftWorkspace.module.scss";
import type { ReactNode } from "react";

interface DraftWorkspaceHeaderProps {
  soundControl?: ReactNode;
  settingsExpanded?: boolean;
  health: "loading" | "warning" | "healthy";
  healthLabel: string;
  draftProEligible: boolean;
  onSettings: () => void;
  onFullSettings: () => void;
  onHealth: () => void;
  onMock?: () => void;
}

export default function DraftWorkspaceHeader({
  soundControl,
  settingsExpanded = false,
  health,
  healthLabel,
  draftProEligible,
  onSettings,
  onFullSettings,
  onHealth,
  onMock,
}: DraftWorkspaceHeaderProps) {
  return (
    <div className={styles.workspaceHeader}>
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
      <div className={`${styles.settingsActionsGroup} ${controls.scope}`}>
      {soundControl}
      {onMock && <button type="button" onClick={onMock}>Practice / Mock Draft</button>}
      <button type="button" data-control-variant="primary" className={styles.settingsButton} aria-label="Toggle quick settings" title="Quick settings" onClick={onSettings} aria-expanded={settingsExpanded} aria-controls="draft-quick-settings">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="11" cy="11" r="3"/></svg> Settings <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: settingsExpanded ? "rotate(180deg)" : undefined }}><path d="m3 6 5 5 5-5" /></svg>
      </button>
      <button type="button" data-control-variant="primary" onClick={onFullSettings} aria-label="Open full draft settings" title="Open full draft settings" aria-haspopup="dialog">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3h7v7M21 3 10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /></svg>
      </button>
      </div>
    </div>
  );
}

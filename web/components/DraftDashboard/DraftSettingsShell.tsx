import type { ReactNode } from "react";
import type { DraftSettings } from "./DraftDashboard";
import { getEffectiveSourceShares } from "lib/draftDashboard/sourceWeights";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import styles from "./DraftWorkspace.module.scss";

export type SettingsSection = "setup" | "sources" | "integrations";

interface DraftSettingsShellProps {
  settings: DraftSettings;
  sourceControls: ProjectionSourceControls;
  goalieSourceControls: ProjectionSourceControls;
  open: boolean;
  onToggle: () => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  children: ReactNode;
}

// UI visibility never owns or replaces the draft configuration. The same children
// remain mounted when this shell collapses or switches settings sections.
export default function DraftSettingsShell({
  settings,
  sourceControls,
  goalieSourceControls,
  open,
  onToggle,
  section,
  onSectionChange,
  children,
}: DraftSettingsShellProps) {
  const spots = Object.values(settings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalWeight = (controls: ProjectionSourceControls) =>
    Math.round(
      Object.values(getEffectiveSourceShares(controls)).reduce(
        (sum, value) => sum + value,
        0,
      ) * 100,
    );
  const skaterWeight = totalWeight(sourceControls);
  const goalieWeight = totalWeight(goalieSourceControls);
  const valid =
    settings.teamCount > 0 &&
    spots > 0 &&
    settings.draftOrder.length === settings.teamCount &&
    (skaterWeight > 0 || goalieWeight > 0);
  const custom = [
    ...Object.keys(sourceControls),
    ...Object.keys(goalieSourceControls),
  ].some(
    (id) =>
      id.startsWith("custom_csv") &&
      (sourceControls[id]?.isSelected || goalieSourceControls[id]?.isSelected),
  );
  return (
    <section
      className={styles.settingsShell}
      data-open={open}
      data-section={section}
      aria-label="Draft Settings"
    >
      <div className={styles.settingsSummary}>
        <svg
          className={styles.settingsIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path d="M9.6 3.1 10 1h4l.4 2.1a9 9 0 0 1 1.7.7l1.8-1.2 2.8 2.8-1.2 1.8a9 9 0 0 1 .7 1.7l2.1.4v4l-2.1.4a9 9 0 0 1-.7 1.7l1.2 1.8-2.8 2.8-1.8-1.2a9 9 0 0 1-1.7.7L14 23h-4l-.4-2.1a9 9 0 0 1-1.7-.7l-1.8 1.2-2.8-2.8 1.2-1.8a9 9 0 0 1-.7-1.7l-2.1-.4v-4l2.1-.4a9 9 0 0 1 .7-1.7L3.3 5.4l2.8-2.8 1.8 1.2a9 9 0 0 1 1.7-.7ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
        <h2>Draft Settings</h2>
        <span>{settings.teamCount} Teams</span>
        <span>{spots} Roster Spots</span>
        <span>
          {settings.leagueType === "categories" ? "Categories" : "Points"}{" "}
          League
        </span>
        <span>{custom ? "Custom" : "Blended"} Projections</span>
        <span className={styles.weightSummary}>
          Weights {skaterWeight}% / {goalieWeight}%
        </span>
        <span
          className={valid ? styles.healthy : styles.warning}
          title="Skater / goalie effective projection-weight totals"
        >
          {valid ? "✓ Settings valid" : "⚠ Review configuration"}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="draft-inline-settings"
        >
          {open ? "Done" : "Edit Settings"}{" "}
          <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
        </button>
      </div>
      <div
        id="draft-inline-settings"
        className={styles.settingsBody}
        hidden={!open}
      >
        <nav
          className={styles.settingsTabs}
          aria-label="Draft settings sections"
        >
          {(["setup", "sources", "integrations"] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              aria-pressed={section === tab}
              onClick={() => onSectionChange(tab)}
            >
              {tab === "setup"
                ? "League, Roster & Scoring"
                : tab === "sources"
                  ? "Projection Sources"
                  : "Integrations & Live Sync"}
            </button>
          ))}
        </nav>
        {children}
      </div>
    </section>
  );
}

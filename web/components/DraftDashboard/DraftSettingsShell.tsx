import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DraftSettings } from "./DraftDashboard";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import type {
  DraftSettingsValidation,
  SettingsDomain,
} from "lib/draftDashboard/settingsValidation";
import styles from "./DraftWorkspace.module.scss";

export type SettingsSection = SettingsDomain | "integrations";
const domains: Array<{ id: SettingsDomain; label: string }> = [
  { id: "league", label: "League & Draft" },
  { id: "roster", label: "Roster" },
  { id: "scoring", label: "Scoring" },
  { id: "projections", label: "Projections" },
];
interface DraftSettingsShellProps {
  settings: DraftSettings;
  sourceControls: ProjectionSourceControls;
  goalieSourceControls: ProjectionSourceControls;
  validation: DraftSettingsValidation;
  open: boolean;
  full: boolean;
  configured: boolean;
  onToggle: () => void;
  onFullSetup: () => void;
  onDone: () => boolean;
  onResetSettings: () => void;
  onImport: () => void;
  onExport: () => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  saveError?: string | null;
  children: ReactNode;
}

// View changes only affect layout. Both editors and the live dashboard stay mounted.
export default function DraftSettingsShell({
  settings,
  sourceControls,
  goalieSourceControls,
  validation,
  open,
  full,
  configured,
  onToggle,
  onFullSetup,
  onDone,
  onResetSettings,
  onImport,
  onExport,
  section,
  onSectionChange,
  saveError,
  children,
}: DraftSettingsShellProps) {
  const toggle = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLElement>(null);
  const [reviewErrors, setReviewErrors] = useState(false);
  const custom = [sourceControls, goalieSourceControls].some((controls) =>
    Object.entries(controls).some(
      ([id, control]) => id.startsWith("custom_csv") && control.isSelected,
    ),
  );
  const reveal = (
    domain: SettingsDomain,
    target = `draft-domain-${domain}`,
  ) => {
    onSectionChange(domain);
    requestAnimationFrame(() => {
      const control =
        document.getElementById(target) ||
        document.getElementById(`draft-domain-${domain}`);
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };
  const done = () => {
    setReviewErrors(true);
    if (!validation.valid) {
      const issue = validation.errors[0];
      reveal(issue.domain, issue.target);
      return;
    }
    if (onDone()) {
      setReviewErrors(false);
      requestAnimationFrame(() =>
        toggle.current?.focus({ preventScroll: true }),
      );
    }
  };
  useEffect(() => {
    if (open)
      shell.current
        ?.querySelector<HTMLButtonElement>(`#draft-tab-${section}`)
        ?.focus({ preventScroll: true });
    // Focus only on entry, not while typing or navigating sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, full]);
  return (
    <section
      ref={shell}
      className={styles.settingsShell}
      data-open={open}
      data-full={full}
      data-section={section}
      aria-label="Draft Settings"
    >
      <div className={styles.settingsSummary}>
        <svg
          className={styles.settingsIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
        >
          <path d="M9.6 3.1 10 1h4l.4 2.1a9 9 0 0 1 1.7.7l1.8-1.2 2.8 2.8-1.2 1.8a9 9 0 0 1 .7 1.7l2.1.4v4l-2.1.4a9 9 0 0 1-.7 1.7l1.2 1.8-2.8 2.8-1.8-1.2a9 9 0 0 1-1.7.7L14 23h-4l-.4-2.1a9 9 0 0 1-1.7-.7l-1.8 1.2-2.8-2.8 1.2-1.8a9 9 0 0 1-.7-1.7l-2.1-.4v-4l2.1-.4a9 9 0 0 1 .7-1.7L3.3 5.4l2.8-2.8 1.8 1.2a9 9 0 0 1 1.7-.7ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
        <h2>Draft Settings</h2>
        <span>{settings.teamCount} Teams</span>
        <span>{validation.spots} Roster Spots</span>
        <span>
          {settings.leagueType === "categories" ? "Categories" : "Points"}{" "}
          League
        </span>
        <span>{custom ? "Custom" : "Blended"} Projections</span>
        <span className={styles.weightSummary}>
          Weights {validation.skaterWeight}% / {validation.goalieWeight}%
        </span>
        <span className={validation.valid ? styles.healthy : styles.warning}>
          {validation.valid ? "✓ Settings valid" : "⚠ Review configuration"}
        </span>
        {open && (
          <div className={styles.settingsActions}>
            <button type="button" onClick={onResetSettings}>
              Reset Settings
            </button>
            <button type="button" onClick={onImport}>
              Import
            </button>
            <button type="button" onClick={onExport}>
              Export
            </button>
          </div>
        )}
        <button
          ref={toggle}
          type="button"
          onClick={open ? done : onToggle}
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
          <div role={full ? "group" : "tablist"} aria-label="Settings domains">
            {domains.map(({ id, label }, index) => (
              <button
                id={`draft-tab-${id}`}
                key={id}
                type="button"
                role={full ? undefined : "tab"}
                aria-selected={full ? undefined : section === id}
                aria-pressed={full ? section === id : undefined}
                aria-controls={`draft-domain-${id}`}
                tabIndex={
                  full ||
                  section === id ||
                  (section === "integrations" && index === 0)
                    ? 0
                    : -1
                }
                onClick={() => (full ? reveal(id) : onSectionChange(id))}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? domains.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            domains.length) %
                          domains.length;
                  onSectionChange(domains[next].id);
                  document
                    .getElementById(`draft-tab-${domains[next].id}`)
                    ?.focus();
                }}
              >
                {label}
                {!validation.domains[id] && (
                  <span aria-label="Needs review"> ⚠</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={section === "integrations"}
            onClick={() => onSectionChange("integrations")}
          >
            Integrations & Live Sync
          </button>
          {!full && (
            <button
              type="button"
              className={styles.fullSetupButton}
              onClick={onFullSetup}
            >
              Open Full Setup ↗
            </button>
          )}
        </nav>
        {!configured && (
          <p className={styles.setupNotice}>
            Review your league setup, then select Done to start drafting.
          </p>
        )}
        {(saveError || (reviewErrors && !validation.valid)) && (
          <div className={styles.settingsErrors} role="alert">
            {saveError ||
              "Resolve these settings before returning to the draft."}
            {validation.errors.map((issue) => (
              <button
                key={`${issue.target}-${issue.message}`}
                type="button"
                onClick={() => reveal(issue.domain, issue.target)}
              >
                {issue.message}
              </button>
            ))}
          </div>
        )}
        <div className={styles.settingsContent}>{children}</div>
        <footer
          className={styles.validationStrip}
          aria-label="Settings validation"
        >
          <span className={validation.valid ? styles.healthy : styles.warning}>
            {validation.valid ? "✓ Settings valid" : "⚠ Settings need review"}
          </span>
          {domains.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => reveal(id)}
              className={validation.domains[id] ? undefined : styles.warning}
            >
              {validation.domains[id] ? "✓" : "⚠"}{" "}
              {id === "roster"
                ? `Roster: ${validation.spots} spots`
                : id === "scoring"
                  ? `Scoring: ${validation.scoringCount} cats`
                  : id === "projections"
                    ? `Weights: ${validation.skaterWeight}% / ${validation.goalieWeight}%`
                    : label}
            </button>
          ))}
          <span>
            {validation.errors.length
              ? `${validation.errors.length} configuration conflicts`
              : validation.warnings[0]?.message || "No configuration conflicts"}
          </span>
        </footer>
      </div>
    </section>
  );
}

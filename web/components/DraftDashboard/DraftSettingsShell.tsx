import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DraftSettings } from "./DraftDashboard";
import type { ProjectionSourceControls } from "lib/draftDashboard/sourceControlPreferences";
import type {
  DraftSettingsValidation,
  SettingsDomain,
} from "lib/draftDashboard/settingsValidation";
import styles from "./DraftWorkspace.module.scss";

export type SettingsSection = SettingsDomain | "integrations" | "saved-drafts" | "roster-impact" | "reports";
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
  draftProEligible?: boolean;
  onToggle: () => void;
  onClose: () => void;
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
  draftProEligible = false,
  onToggle,
  onClose,
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
  const shell = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
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
  const restoreFocus = () => {
    previousFocus.current?.focus({ preventScroll: true });
    previousFocus.current = null;
  };
  const dismiss = () => {
    restoreFocus();
    onClose();
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
      restoreFocus();
    }
  };
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);
  useEffect(() => {
    if (open) previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!open && previousFocus.current) {
      restoreFocus();
    }
  }, [open]);
  useEffect(() => {
    if (open)
      shell.current
        ?.querySelector<HTMLButtonElement>(`#draft-tab-${section}`)
        ?.focus({ preventScroll: true });
  }, [open, full, section]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        previousFocus.current?.focus({ preventScroll: true });
        previousFocus.current = null;
        onClose();
        return;
      }
      if (event.key !== "Tab" || !shell.current) return;
      const focusable = Array.from(shell.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
  if (!portalRoot) return null;
  return createPortal(
    <div className={styles.settingsBackdrop} hidden={!open} onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
    <section
      ref={shell}
      className={styles.settingsShell}
      data-open={open}
      data-full={full}
      data-section={section}
      aria-label="Draft Settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-settings-title"
    >
      <div className={styles.settingsSummary}>
        <svg
          className={styles.settingsIcon}
          aria-hidden="true"
          viewBox="0 0 24 24"
        >
          <path d="M9.6 3.1 10 1h4l.4 2.1a9 9 0 0 1 1.7.7l1.8-1.2 2.8 2.8-1.2 1.8a9 9 0 0 1 .7 1.7l2.1.4v4l-2.1.4a9 9 0 0 1-.7 1.7l1.2 1.8-2.8 2.8-1.8-1.2a9 9 0 0 1-1.7.7L14 23h-4l-.4-2.1a9 9 0 0 1-1.7-.7l-1.8 1.2-2.8-2.8 1.2-1.8a9 9 0 0 1-.7-1.7l-2.1-.4v-4l2.1-.4a9 9 0 0 1 .7-1.7L3.3 5.4l2.8-2.8 1.8 1.2a9 9 0 0 1 1.7-.7ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
        <h2 id="draft-settings-title">Draft Settings</h2>
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
        <a className={styles.draftProLink} href="/account?section=draft-pro">
          {draftProEligible ? "Manage Draft Pro" : "Explore Draft Pro"}
        </a>
        <div className={styles.settingsActions}>
          <button type="button" onClick={onResetSettings}>Reset Settings</button>
          <button type="button" onClick={onImport}>Import</button>
          <button type="button" onClick={onExport}>Export</button>
        </div>
        <button
          type="button"
          onClick={done}
        >
          Done
        </button>
        <button type="button" className={styles.closeSettings} onClick={dismiss} aria-label="Close settings">×</button>
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
          <div className={styles.settingsQuickActions} aria-label="Workspace actions">
            <button type="button" onClick={() => onSectionChange("league")}>Setup</button>
            <button type="button" onClick={() => onSectionChange("projections")}>Sources</button>
            <button type="button" onClick={() => onSectionChange("integrations")}>Integrations</button>
            <button type="button" onClick={onToggle}>Summary</button>
          </div>
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
        <div className={styles.workspaceOptions} role="tablist" aria-label="Draft Pro workspaces">
          <button id="draft-tab-saved-drafts" type="button" role="tab" aria-selected={section === "saved-drafts"} onClick={() => onSectionChange("saved-drafts")}>Saved Drafts</button>
          <button id="draft-tab-roster-impact" type="button" role="tab" aria-selected={section === "roster-impact"} onClick={() => onSectionChange("roster-impact")}>Roster Impact</button>
          <button id="draft-tab-reports" type="button" role="tab" aria-selected={section === "reports"} onClick={() => onSectionChange("reports")}>Analytical Reports</button>
        </div>
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
    </div>,
    portalRoot,
  );
}

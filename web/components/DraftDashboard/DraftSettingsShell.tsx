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
const sections: Array<{ id: SettingsSection; label: string }> = [
  ...domains,
  { id: "integrations", label: "Integrations" },
  { id: "saved-drafts", label: "Saved Drafts" },
  { id: "roster-impact", label: "Roster Impact" },
  { id: "reports", label: "Reports" },
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
        <span className={styles.settingsContext}>{settings.teamCount} teams · {validation.spots} spots · {settings.leagueType === "categories" ? "Categories" : "Points"}</span>
        <a className={styles.draftProLink} href="/account?section=draft-pro">
          {draftProEligible ? "Manage Draft Pro" : "Explore Draft Pro"}
        </a>
        <button type="button" className={styles.closeSettings} onClick={dismiss} aria-label="Close settings">×</button>
      </div>
      <div
        id="draft-inline-settings"
        className={styles.settingsBody}
        hidden={!open}
      >
        <nav className={styles.settingsRail} aria-label="Draft settings sections">
          <div role="tablist" aria-label="Settings domains" aria-orientation="vertical" className={styles.sectionTabs}>
            {sections.map(({ id, label }, index) => (
              <button id={`draft-tab-${id}`} key={id} type="button" role="tab"
                aria-selected={section === id} tabIndex={section === id ? 0 : -1}
                onClick={() => onSectionChange(id)}
                onKeyDown={(event) => {
                  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1
                    : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + sections.length) % sections.length;
                  onSectionChange(sections[next].id);
                  document.getElementById(`draft-tab-${sections[next].id}`)?.focus();
                }}>
                {label}{id in validation.domains && !validation.domains[id as SettingsDomain] ? " ⚠" : ""}
              </button>
            ))}
          </div>
          <div className={styles.railActions} aria-label="Draft utilities">
            <button type="button" onClick={onToggle}>Draft summary</button>
            <button type="button" onClick={onImport}>Import bookmark</button>
            <button type="button" onClick={onExport}>Export bookmark</button>
            <button type="button" onClick={onResetSettings}>Reset settings</button>
          </div>
        </nav>
        <div className={styles.settingsMain}>
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
          <span>
            {validation.errors.length
              ? `${validation.errors.length} configuration conflicts`
              : validation.warnings[0]?.message || "No configuration conflicts"}
          </span>
          <button type="button" className={styles.settingsDone} onClick={done}>Done</button>
        </footer>
        </div>
      </div>
    </section>
    </div>,
    portalRoot,
  );
}

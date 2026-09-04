// components/DraftDashboard/DraftSettings.tsx
import React from "react";
import {
  decompressFromEncodedURIComponent,
} from "lz-string";
import type {
  DraftedPlayer,
  DraftSettings as DraftSettingsType,
} from "./DraftDashboard";
import {
  getEffectiveRosterConfig,
  setForwardRosterTotal,
} from "lib/draftDashboard/forwardGrouping";
import {
  keeperUsesPick,
  type KeeperCandidate,
  type KeeperEntry,
} from "lib/draftDashboard/keepers";
import type { PickTradeEntry } from "lib/draftDashboard/pickTrades";
import {
  draftOrderPatternFromSnake,
  type DraftOrderPattern,
} from "lib/draftDashboard/draftOrder";
import type { DraftCustomSourceMetadata } from "lib/draftDashboard/summaryConfiguration";
import ManageTradesModal from "./ManageTradesModal";
import QuickFixModal from "./QuickFixModal";
import styles from "./DraftSettings.module.scss";
import DraftScoringSettings from "./DraftScoringSettings";
import ProjectionSourceSettings from "./ProjectionSourceSettings";
import { bookmarkImportError, type DraftSettingsValidation, type SettingsDomain } from "lib/draftDashboard/settingsValidation";

export interface DraftSettingsHandle {
  importBookmark: () => void;
  exportBookmark: () => void;
}

type LeagueType = "points" | "categories";

interface DraftSettingsProps {
  validation?: DraftSettingsValidation;
  variant?: "standalone" | "inline" | "full";
  activeSection?: SettingsDomain;
  settings: DraftSettingsType;
  onSettingsChange: (newSettings: Partial<DraftSettingsType>) => void;
  draftOrderPattern?: DraftOrderPattern;
  onDraftOrderPatternChange?: (pattern: DraftOrderPattern) => void;
  isSnakeDraft?: boolean;
  onSnakeDraftChange?: (isSnake: boolean) => void;
  myTeamId: string;
  onMyTeamIdChange: (teamId: string) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  draftHistory: any[];
  draftedPlayers: DraftedPlayer[];
  currentPick: number;
  customTeamNames?: Record<string, string>;
  forwardGrouping?: "split" | "fwd";
  onForwardGroupingChange?: (mode: "split" | "fwd") => void;
  sourceControls?: Record<string, { isSelected: boolean; weight: number }>;
  onSourceControlsChange?: (
    next: Record<string, { isSelected: boolean; weight: number }>,
  ) => void;
  goalieSourceControls?: Record<
    string,
    { isSelected: boolean; weight: number }
  >;
  onGoalieSourceControlsChange?: (
    next: Record<string, { isSelected: boolean; weight: number }>,
  ) => void;
  goalieScoringCategories?: Record<string, number>;
  onGoalieScoringChange?: (next: Record<string, number>) => void;
  goalieScoringCategoriesVersion?: number; // for future migrations
  onOpenSummary?: () => void;
  onOpenImportCsv?: () => void;
  customSourceLabel?: string;
  customSourceMetadata?: DraftCustomSourceMetadata[];
  availableSkaterStatKeys?: string[];
  availableGoalieStatKeys?: string[];
  onExportCsv?: () => void;
  onRemoveCustomSource?: (id: string) => void;
  pickOwnerOverrides?: Record<string, string>;
  pickTrades?: PickTradeEntry[];
  onAddTradedPick?: (
    round: number,
    pickInRound: number,
    teamId: string,
  ) => { ok: boolean; message: string };
  onImportTradedPicks?: (input: string) => { ok: boolean; message: string };
  onRemoveTradedPick?: (round: number, pickInRound: number) => void;
  onResetTradedPicks?: () => void;
  keepers?: KeeperEntry[];
  onAddKeeper?: (candidate: KeeperCandidate) => {
    ok: boolean;
    message: string;
  };
  onImportKeepers?: (input: string) => { ok: boolean; message: string };
  onRemoveKeeper?: (playerId: string) => { ok: boolean; message: string };
  availablePlayersForQuickFix?: Array<{ id: string; fullName: string }>;
  onReplaceDraftPick?: (
    pickNumber: number,
    replacementPlayerId: string,
  ) => { ok: boolean; message: string };
  onBookmarkCreate?: (key: string) => void;
  onBookmarkImport?: (data: any) => void;
  playersForKeeperAutocomplete?: Array<{
    id: number;
    fullName: string;
    sweaterNumber?: number;
    teamId?: number;
  }>;
  draftLocked?: boolean;
  draftLockReason?: string;
  structuralSettingsLocked?: boolean;
}

import PlayerAutocomplete from "components/PlayerAutocomplete";

const DraftSettings = React.forwardRef<DraftSettingsHandle, DraftSettingsProps>(({
  validation,
  variant = "standalone",
  activeSection = "league",
  settings,
  onSettingsChange,
  draftOrderPattern,
  onDraftOrderPatternChange,
  isSnakeDraft = true,
  onSnakeDraftChange,
  myTeamId,
  onMyTeamIdChange,
  undoLastPick,
  resetDraft,
  draftHistory,
  draftedPlayers,
  currentPick,
  customTeamNames = {},
  forwardGrouping = "split",
  onForwardGroupingChange,
  sourceControls,
  onSourceControlsChange,
  goalieSourceControls,
  onGoalieSourceControlsChange,
  goalieScoringCategories,
  onGoalieScoringChange,
  onOpenSummary,
  onOpenImportCsv,
  customSourceLabel,
  customSourceMetadata = [],
  availableSkaterStatKeys = [],
  availableGoalieStatKeys = [],
  onExportCsv,
  onRemoveCustomSource,
  pickOwnerOverrides = {},
  pickTrades = [],
  onAddTradedPick,
  onImportTradedPicks,
  onRemoveTradedPick,
  onResetTradedPicks,
  keepers = [],
  onAddKeeper,
  onImportKeepers,
  onRemoveKeeper,
  availablePlayersForQuickFix = [],
  onReplaceDraftPick,
  onBookmarkCreate,
  onBookmarkImport,
  playersForKeeperAutocomplete,
  draftLocked = false,
  draftLockReason = "Yahoo live sync is authoritative.",
  structuralSettingsLocked = false,
}, ref) => {
  const activeDraftOrderPattern = draftOrderPattern ?? draftOrderPatternFromSnake(isSnakeDraft);
  const handleTeamCountChange = (count: number) => {
    if (draftLocked) return;
    if (
      (draftedPlayers.length > 0 || keepers.length > 0 || pickTrades.length > 0) &&
      count !== settings.teamCount
    ) {
      setTradeFeedback({
        ok: false,
        message:
          "Team count is locked while picks, keepers, or trades exist. Reset the draft first to change its structure.",
      });
      return;
    }
    const newDraftOrder = Array.from(
      { length: count },
      (_, i) => `Team ${i + 1}`,
    );
    onSettingsChange({
      teamCount: count,
      draftOrder: newDraftOrder,
    });

    if (!newDraftOrder.includes(myTeamId)) {
      onMyTeamIdChange("Team 1");
    }
  };

  const handleRosterConfigChange = (position: string, count: number) => {
    if (draftLocked) return;
    if (!Number.isInteger(count) || count < 0 || count > (positionMax[position] ?? 40)) return;
    const nextRosterConfig =
      position === "FWD" && forwardGrouping === "fwd"
        ? setForwardRosterTotal(settings.rosterConfig, count)
        : { ...settings.rosterConfig, [position]: count };
    const nextRoundCount = Object.values(nextRosterConfig).reduce(
      (sum, value) => sum + value,
      0,
    );
    const latestReservedRound = [
      ...keepers.filter(keeperUsesPick).map((keeper) => keeper.round),
      ...pickTrades.map((trade) => trade.round),
      ...draftedPlayers.map((player) => player.round),
    ].reduce((latest, round) => Math.max(latest, round), 0);
    if (nextRoundCount < latestReservedRound) {
      setTradeFeedback({
        ok: false,
        message: `Roster size cannot be below reserved round ${latestReservedRound}.`,
      });
      return;
    }
    if (position === "FWD" && forwardGrouping === "fwd") {
      onSettingsChange({
        rosterConfig: nextRosterConfig as any,
      });
      return;
    }
    onSettingsChange({
      rosterConfig: nextRosterConfig as DraftSettingsType["rosterConfig"],
    });
  };

  const handleDraftOrderChange = (next: DraftOrderPattern) => {
    if (draftLocked) return;
    if (structuralSettingsLocked) {
      setTradeFeedback({
        ok: false,
        message: "Draft order is locked after the first ordinary pick.",
      });
      return;
    }
    const changed =
      next.mode !== activeDraftOrderPattern.mode ||
      next.reversedRounds.join(",") !==
        activeDraftOrderPattern.reversedRounds.join(",");
    if (pickTrades.length > 0 && changed) {
      setTradeFeedback({
        ok: false,
        message: "Remove configured trades before changing draft order type.",
      });
      return;
    }
    if (onDraftOrderPatternChange) {
      onDraftOrderPatternChange(next);
    } else if (next.mode !== "custom") {
      onSnakeDraftChange?.(next.mode === "snake");
    }
  };

  const leagueType: LeagueType = settings.leagueType || "points";

  const stepRoster = (position: string, delta: number) => {
    const current =
      position === "FWD" && forwardGrouping === "fwd"
        ? getEffectiveRosterConfig(settings.rosterConfig, "fwd").FWD
        : settings.rosterConfig[position];
    const max = positionMax[position] ?? 10;
    const next = Math.min(max, Math.max(0, current + delta));
    if (next !== current) handleRosterConfigChange(position, next);
  };

  const customSource = sourceControls?.custom_csv;

  const firstInteractiveRef = React.useRef<HTMLInputElement | null>(null);

  // Keepers & Traded Picks visibility now controlled by settings.isKeeper
  const playerNamesById = React.useMemo(() => {
    const map = new Map<string, string>();
    if (playersForKeeperAutocomplete) {
      playersForKeeperAutocomplete.forEach((p) => {
        map.set(String(p.id), p.fullName);
      });
    }
    return map;
  }, [playersForKeeperAutocomplete]);

  const [keeperSelectedPlayerId, setKeeperSelectedPlayerId] = React.useState<
    string | undefined
  >(undefined);
  const [keeperCost, setKeeperCost] = React.useState<"pick" | "none">("pick");
  const [keeperBulkInput, setKeeperBulkInput] = React.useState("");
  const [keeperFeedback, setKeeperFeedback] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [tradeManagerOpen, setTradeManagerOpen] = React.useState(false);
  const [quickFixOpen, setQuickFixOpen] = React.useState(false);
  const [tradeFeedback, setTradeFeedback] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  // Separate refs for traded picks vs keeper steppers
  const tradeRoundStepperRef = React.useRef<HTMLDivElement | null>(null);
  const tradePickStepperRef = React.useRef<HTMLDivElement | null>(null);
  const keeperRoundStepperRef = React.useRef<HTMLDivElement | null>(null);
  const keeperPickStepperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (structuralSettingsLocked && keeperCost === "none") {
      setKeeperCost("pick");
    }
  }, [keeperCost, structuralSettingsLocked]);

  // Position-specific maximums (utility limited to 2)
  const positionMax: Record<string, number> = {
    C: 6,
    LW: 6,
    RW: 6,
    FWD: 18,
    D: 8,
    G: 4,
    utility: 2,
    bench: 10,
  };

  const totalRosterSpots = Object.values(settings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0,
  );
  const displayedRosterConfig = getEffectiveRosterConfig(
    settings.rosterConfig,
    forwardGrouping,
  );
  const rosterTotalClass =
    totalRosterSpots > 22 ? styles.rosterTotalWarning : "";

  const [confirmReset, setConfirmReset] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const handleResetDraftClick = () => {
    if (draftLocked) return;
    if (!confirmReset) { setConfirmReset(true); return; }
    resetDraft();
    setConfirmReset(false);
  };

  // --- Bookmark (Portable Draft Session) ---
  // Build a serializable payload capturing draft state & settings for cross-device restoration.
  const buildBookmarkPayload = React.useCallback(() => {
    const ls = (k: string, def: any = undefined) => {
      if (typeof window === "undefined") return def;
      return window.localStorage.getItem(k) ?? def;
    };
    let personalizeReplacement: boolean | undefined;
    let needWeightEnabled: boolean | undefined;
    let needAlpha: number | undefined;
    let baselineMode: string | undefined;
    try {
      personalizeReplacement =
        ls("draftDashboard.personalizeReplacement.v1") === "true";
      needWeightEnabled = ls("draftDashboard.needWeight.v1") === "true";
      const naRaw = ls("draftDashboard.needAlpha.v1");
      needAlpha = naRaw ? parseFloat(naRaw) : undefined;
      baselineMode = ls("draftDashboard.baselineMode") || undefined;
    } catch {}
    return {
      v: 3,
      ts: Date.now(),
      settings,
      draftedPlayers,
      draftHistory,
      currentPick,
      myTeamId,
      forwardGrouping,
      customTeamNames,
      sourceControls,
      goalieSourceControls,
      goalieScoringCategories,
      personalizeReplacement,
      needWeightEnabled,
      needAlpha,
      baselineMode,
      keepers,
      pickOwnerOverrides,
      pickTrades,
      customSourceMetadata,
    };
  }, [
    settings,
    draftedPlayers,
    draftHistory,
    currentPick,
    myTeamId,
    forwardGrouping,
    customTeamNames,
    sourceControls,
    goalieSourceControls,
    goalieScoringCategories,
    keepers,
    pickOwnerOverrides,
    pickTrades,
    customSourceMetadata,
  ]);

  const deserializeBookmark = (key: string): any | null => {
    if (!key) return null;
    try {
      const json = decompressFromEncodedURIComponent(key);
      if (json) return JSON.parse(json);
    } catch {}
    try {
      const json =
        typeof atob === "function"
          ? decodeURIComponent(escape(atob(key)))
          : key;
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
    try {
      return JSON.parse(key);
    } catch {}
    return null;
  };

  const handleCreateBookmark = () => {
    const blob = new Blob([JSON.stringify(buildBookmarkPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fhfh-draft-bookmark.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const handleImportBookmark = () => setImportOpen(true);
  React.useImperativeHandle(ref, () => ({ importBookmark: handleImportBookmark, exportBookmark: handleCreateBookmark }));
  const applyBookmark = () => {
    const data = deserializeBookmark(importText.trim());
    const message = bookmarkImportError(data, customSourceMetadata.map(source => source.id));
    if (message) { setTradeFeedback({ ok: false, message }); return; }
    if ((draftedPlayers.length || keepers.length || pickTrades.length) && !window.confirm("Replace the current draft with this bookmark? Current picks, keepers, trades, and settings will be replaced. Export a bookmark first to keep a copy.")) return;
    if (!onBookmarkImport) { setTradeFeedback({ ok: false, message: "Draft import is unavailable." }); return; }
    onBookmarkImport(data);
    setImportOpen(false);
    setImportText("");
    setTradeFeedback({ ok: true, message: "Draft bookmark imported." });
  };

  const domainIssues = (domain: SettingsDomain) => <div id={`draft-issues-${domain}`} className={styles.domainIssues}>{validation?.issues.filter(issue => issue.domain === domain).map(issue => <p key={issue.message}>{issue.message}</p>)}</div>;

  return (
    <div className={`${styles.settingsContainer} ${variant !== "standalone" ? styles.inlineSettings : ""}`} data-section={activeSection} data-variant={variant}>
      {variant === "standalone" && <div className={styles.settingsHeader}>
        <h2 className={styles.legend}>Draft Settings</h2>
        <button type="button" onClick={handleImportBookmark} disabled={draftLocked}>Import</button>
        <button type="button" onClick={handleCreateBookmark}>Export</button>
      </div>}
      {tradeFeedback && <div className={styles.lockNotice} role={tradeFeedback.ok ? "status" : "alert"}>{tradeFeedback.message}<button type="button" aria-label="Dismiss settings message" onClick={() => setTradeFeedback(null)}>×</button></div>}
      {draftLocked && (
        <div className={styles.lockNotice} role="status">
          {draftLockReason}
        </div>
      )}
      {(
        <div className={styles.settingsGrid}>
          <div className={styles.leagueDomain} data-settings-domain="league" hidden={variant === "inline" && activeSection !== "league"} role={variant === "inline" ? "tabpanel" : undefined} aria-labelledby={variant === "inline" ? "draft-tab-league" : undefined} id="draft-domain-league" tabIndex={-1}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>League Format</legend>
            {domainIssues("league")}
            {importOpen && <div className={styles.importPanel}>
              <label htmlFor="draft-bookmark">Import draft bookmark</label>
              <textarea id="draft-bookmark" value={importText} onChange={event => setImportText(event.target.value)} placeholder="Paste a bookmark key or exported JSON" rows={3} />
              <input type="file" accept=".json,.txt" aria-label="Read draft bookmark file" onChange={async event => { const file = event.target.files?.[0]; if (file) setImportText(await file.text()); }} />
              <button type="button" disabled={!importText.trim() || draftLocked} onClick={applyBookmark}>Import Bookmark</button>
              <button type="button" onClick={() => setImportOpen(false)}>Cancel Import</button>
            </div>}

            <div className={styles.settingRow}>
              <label className={styles.label} htmlFor="teamCount">
                Teams:
              </label>
              {/* Replaced fixed select with flexible numeric stepper input */}
              <div
                className={styles.rosterStepper}
                data-testid="team-count-stepper"
              >
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() =>
                    handleTeamCountChange(
                      Math.max(2, (settings.teamCount || 0) - 1),
                    )
                  }
                  disabled={draftLocked || settings.teamCount <= 2}
                  aria-label="Decrease team count"
                >
                  −
                </button>
                <input
                  id="teamCount"
                  ref={firstInteractiveRef}
                  type="number"
                  min={2}
                  max={40}
                  value={settings.teamCount}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    if (!Number.isNaN(raw)) {
                      const clamped = Math.min(40, Math.max(2, raw));
                      if (clamped !== settings.teamCount) {
                        handleTeamCountChange(clamped);
                      }
                    }
                  }}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  className={styles.numberInput}
                  data-testid="team-count-select" /* keep legacy test id */
                  aria-label="Number of teams"
                  aria-describedby="draft-issues-league"
                  aria-invalid={validation ? !validation.domains.league : undefined}
                  disabled={draftLocked}
                />
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() =>
                    handleTeamCountChange(
                      Math.min(40, (settings.teamCount || 0) + 1),
                    )
                  }
                  disabled={draftLocked || settings.teamCount >= 40}
                  aria-label="Increase team count"
                >
                  +
                </button>
              </div>
            </div>
            <div className={styles.settingRow}>
              <label className={styles.label} htmlFor="myTeam">
                My Team:
              </label>
              <select
                id="myTeam"
                aria-describedby="draft-issues-league"
                value={myTeamId}
                onChange={(e) => onMyTeamIdChange(e.target.value)}
                className={styles.select}
                disabled={draftLocked}
              >
                {settings.draftOrder.map((teamId) => (
                  <option key={teamId} value={teamId}>
                    {customTeamNames[teamId] || teamId}
                  </option>
                ))}
              </select>
            </div>
            <div id="draft-order-mode" tabIndex={-1} className={styles.orderControls}>
              <span className={styles.label}>Draft Order</span>
          <div
            className={styles.draftTypeToggle}
            role="tablist"
            aria-label="Draft order mode"
          >
            <button
              className={`${styles.toggleButton} ${activeDraftOrderPattern.mode === "standard" ? styles.active : ""}`}
              onClick={() =>
                handleDraftOrderChange({
                  mode: "standard",
                  reversedRounds: [],
                })
              }
              role="tab"
              aria-selected={activeDraftOrderPattern.mode === "standard"}
              disabled={draftLocked || structuralSettingsLocked}
              title={draftLocked ? draftLockReason : undefined}
            >
              Standard
            </button>
            <button
              className={`${styles.toggleButton} ${activeDraftOrderPattern.mode === "snake" ? styles.active : ""}`}
              onClick={() =>
                handleDraftOrderChange({ mode: "snake", reversedRounds: [] })
              }
              role="tab"
              aria-selected={activeDraftOrderPattern.mode === "snake"}
              disabled={draftLocked || structuralSettingsLocked}
              title={draftLocked ? draftLockReason : undefined}
            >
              Snake
            </button>
            <button
              className={`${styles.toggleButton} ${activeDraftOrderPattern.mode === "custom" ? styles.active : ""}`}
              onClick={() =>
                handleDraftOrderChange({
                  mode: "custom",
                  reversedRounds: activeDraftOrderPattern.reversedRounds,
                })
              }
              role="tab"
              aria-selected={activeDraftOrderPattern.mode === "custom"}
              disabled={draftLocked || structuralSettingsLocked}
              title={draftLocked ? draftLockReason : undefined}
            >
              Custom
            </button>
          </div>
              <p className={styles.structuralLockHint}>{structuralSettingsLocked ? "Order is locked after the first ordinary pick." : activeDraftOrderPattern.mode === "snake" ? "Odd rounds: normal order · Even rounds: reversed order" : "Choose Custom to edit individual reversed rounds."}</p>
            </div>
            {activeDraftOrderPattern.mode === "custom" && (
              <div className={styles.customRoundsRow}>
                <span className={styles.label}>Reversed rounds:</span>
                <div
                  className={styles.roundChips}
                  role="group"
                  aria-label="Custom reversed rounds"
                >
                  {Array.from({ length: totalRosterSpots }, (_, index) => {
                    const round = index + 1;
                    const selected =
                      activeDraftOrderPattern.reversedRounds.includes(round);
                    return (
                      <button
                        key={round}
                        type="button"
                        className={`${styles.roundChip} ${selected ? styles.roundChipActive : ""}`}
                        aria-pressed={selected}
                        aria-label={`Round ${round}${selected ? ", reversed" : ", forward"}`}
                        disabled={draftLocked || structuralSettingsLocked}
                        onClick={() =>
                          handleDraftOrderChange({
                            mode: "custom",
                            reversedRounds: selected
                              ? activeDraftOrderPattern.reversedRounds.filter(
                                  (candidate) => candidate !== round,
                                )
                              : [
                                  ...activeDraftOrderPattern.reversedRounds,
                                  round,
                                ].sort((left, right) => left - right),
                          })
                        }
                      >
                        {round}
                      </button>
                    );
                  })}
                </div>
                {structuralSettingsLocked && (
                  <span className={styles.structuralLockHint} role="status">
                    Locked after the first ordinary pick.
                  </span>
                )}
              </div>
            )}
            <div className={styles.settingRow}>
              <label className={styles.label} htmlFor="leagueType">
                League Type:
              </label>
              <select
                id="leagueType"
                aria-describedby="draft-issues-league"
                value={leagueType}
                onChange={(e) =>
                  onSettingsChange({ leagueType: e.target.value as LeagueType })
                }
                className={styles.select}
                disabled={draftLocked}
              >
                <option value="points">Points</option>
                <option value="categories">Categories</option>
              </select>
            </div>
            <div className={styles.settingRow}>
              <label className={styles.label}>Keeper League:</label>
              <div id="keeper-league" className={styles.draftTypeToggle} role="tablist">
                <button
                  className={`${styles.toggleButton} ${!settings.isKeeper ? styles.active : ""}`}
                  onClick={() => { if (keepers.length) setTradeFeedback({ ok: false, message: "Remove assigned keepers before disabling Keeper League." }); else onSettingsChange({ isKeeper: false }); }}
                  role="tab"
                  aria-selected={!settings.isKeeper}
                  disabled={draftLocked}
                >
                  No
                </button>
                <button
                  className={`${styles.toggleButton} ${settings.isKeeper ? styles.active : ""}`}
                  onClick={() => onSettingsChange({ isKeeper: true })}
                  role="tab"
                  aria-selected={!!settings.isKeeper}
                  disabled={draftLocked}
                >
                  Yes
                </button>
              </div>
            </div>
            <h3 className={styles.managementTitle}>Draft Management</h3>
            <div id="resetDraftWarning" className={styles.visuallyHidden}>
              This will clear all picks. Action cannot be undone.
            </div>
            {confirmReset && <div className={styles.lockNotice} role="alert">Clear all picks, keepers, trades, and pick history? Your settings stay in place.<button type="button" onClick={() => setConfirmReset(false)}>Cancel Reset</button></div>}
            <div className={styles.actionButtons}>
              <button
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                onClick={undoLastPick}
                disabled={draftLocked || draftHistory.length === 0}
                title={
                  draftHistory.length > 0
                    ? `Undo Pick #${currentPick - 1}`
                    : "No picks to undo"
                }
                data-testid="undo-pick-btn"
              >
                Undo Last Pick
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => setQuickFixOpen(true)}
                disabled={
                  draftLocked ||
                  !onReplaceDraftPick ||
                  !draftedPlayers.some((player) => !player.isKeeper)
                }
                title="Replace a completed manual pick without rewinding the draft"
              >
                Pick Correction
              </button>
              <button
                className={`${styles.actionButton} ${styles.actionButtonDanger} ${confirmReset ? styles.confirmReset : ""}`}
                onClick={handleResetDraftClick}
                disabled={
                  draftLocked || (draftedPlayers.length === 0 && keepers.length === 0 && pickTrades.length === 0 && !confirmReset)
                }
                aria-describedby="resetDraftWarning"
                data-testid="reset-draft-btn"
                title="Reset entire draft"
              >
                {confirmReset ? "Confirm Reset Entire Draft" : "Reset Entire Draft"}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => onOpenImportCsv && onOpenImportCsv()}
                title="Import custom projections from CSV"
                aria-label="Import CSV"
                data-testid="import-csv-btn"
              >
                {customSource ? "Reimport CSV" : "Import CSV"}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => {
                  if (onExportCsv) {
                    onExportCsv();
                    return;
                  }
                  try {
                    const payload = {
                      type: "fhf-draft-settings",
                      version: 1,
                      generatedAt: new Date().toISOString(),
                      settings: { ...settings },
                      sourceControls: sourceControls || null,
                      goalieSourceControls: goalieSourceControls || null,
                      goalieScoringCategories: goalieScoringCategories || null,
                      meta: {
                        teamCount: settings.teamCount,
                        leagueType: settings.leagueType,
                        totalRosterSpots: Object.values(
                          settings.rosterConfig || {},
                        ).reduce((s: number, v: number) => s + v, 0),
                      },
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: "application/json",
                    });
                    const filename = `draft-settings-${settings.teamCount}teams-${Date.now()}.json`;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }, 0);
                  } catch (e) {
                    console.error("Failed to export settings", e);
                  }
                }}
                data-testid="export-settings-btn"
                title={
                  onExportCsv
                    ? "Export blended projections CSV"
                    : "Export current draft settings JSON"
                }
              >
                {onExportCsv ? "Export CSV" : "Export Settings"}
              </button>
            </div>
          </fieldset>
          {settings.isKeeper && (
            <fieldset className={styles.fieldset} disabled={draftLocked}>
              <legend className={styles.legend}>Keepers & Traded Picks</legend>
              <>
                {/* Traded Picks subsection */}
                <div className={styles.subsection}>
                  <div className={styles.sectionHeaderRow}>
                    <div className={styles.subsectionTitle}>Traded Picks</div>
                    <button
                      type="button"
                      className={styles.inlineResetBtn}
                      onClick={() => setTradeManagerOpen(true)}
                    >
                      Manage Trades
                    </button>
                  </div>
                  {/* Controls */}
                  <div className={styles.settingRow}>
                    <div className={styles.inlineFormRow}>
                      <label
                        className={styles.visuallyHidden}
                        htmlFor="trade-owner"
                      >
                        Trade Owner
                      </label>
                      <select
                        id="trade-owner"
                        className={`${styles.select} ${styles.ownerSelectInline}`}
                      >
                        {settings.draftOrder.map((teamId) => (
                          <option key={teamId} value={teamId}>
                            {customTeamNames[teamId] || teamId}
                          </option>
                        ))}
                      </select>
                      <div
                        className={styles.rosterStepper}
                        ref={tradeRoundStepperRef}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Decrease trade round"
                          onClick={() => {
                            const el = document.getElementById(
                              "trade-round",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.max(1, cur - 1));
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={totalRosterSpots}
                          placeholder="RD"
                          className={styles.numberInput}
                          id="trade-round"
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Increase trade round"
                          onClick={() => {
                            const el = document.getElementById(
                              "trade-round",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || totalRosterSpots || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.min(max, cur + 1));
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div
                        className={styles.rosterStepper}
                        ref={tradePickStepperRef}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Decrease trade pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "trade-pick",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.max(1, cur - 1));
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={settings.teamCount}
                          placeholder="Pick"
                          className={styles.numberInput}
                          id="trade-pick"
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Increase trade pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "trade-pick",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.min(max, cur + 1));
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.addActionBtn}
                        aria-label="Add traded pick override"
                        onClick={() => {
                          const r = parseInt(
                            (
                              document.getElementById(
                                "trade-round",
                              ) as HTMLInputElement
                            )?.value || "",
                            10,
                          );
                          const p = parseInt(
                            (
                              document.getElementById(
                                "trade-pick",
                              ) as HTMLInputElement
                            )?.value || "",
                            10,
                          );
                          const owner = (
                            document.getElementById(
                              "trade-owner",
                            ) as HTMLSelectElement
                          )?.value;
                          if (
                            onAddTradedPick &&
                            Number.isFinite(r) &&
                            Number.isFinite(p) &&
                            owner
                          ) {
                            setTradeFeedback(onAddTradedPick(r, p, owner));
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Traded picks list */}
                  <div className={styles.settingRow}>
                    <div className={styles.mutedSmallLabel}>Traded Picks:</div>
                    <div className={styles.listScrollable}>
                      {Object.entries(pickOwnerOverrides).length === 0 && (
                        <div className={styles.smallText}>None</div>
                      )}
                      {Object.entries(pickOwnerOverrides).map(
                        ([key, teamId]) => (
                          <div key={key} className={styles.inlineItemRow}>
                            <span>
                              {key} → {customTeamNames[teamId] || teamId}
                            </span>
                            {onRemoveTradedPick && (
                              <button
                                type="button"
                                className={styles.inlineResetBtn}
                                onClick={() => {
                                  const [r, p] = key
                                    .split("-")
                                    .map((s) => parseInt(s, 10));
                                  onRemoveTradedPick(r, p);
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {/* Keepers subsection */}
                <div className={styles.subsection}>
                  <div className={styles.subsectionTitle}>Keepers</div>
                  {/* Autocomplete first to reduce vertical bounce */}
                  <div className={styles.playerAutocompleteWrap}>
                    <PlayerAutocomplete
                      playerId={
                        keeperSelectedPlayerId
                          ? Number(keeperSelectedPlayerId)
                          : undefined
                      }
                      onPlayerIdChange={(id) => {
                        setKeeperSelectedPlayerId(id ? String(id) : undefined);
                      }}
                      showButton={false}
                      inputClassName={styles.playerAutoInputSmall}
                      playersOverride={playersForKeeperAutocomplete?.map(
                        (p) => ({
                          id: p.id,
                          fullName: p.fullName,
                          sweaterNumber: p.sweaterNumber ?? undefined,
                          teamId: p.teamId,
                        }),
                      )}
                    />
                    <span
                      className={`${styles.statusIcon} ${keeperSelectedPlayerId ? styles.statusOk : styles.statusError} ${styles.statusIconInput}`}
                      aria-label={
                        keeperSelectedPlayerId
                          ? "Player selected"
                          : "No player selected"
                      }
                      title={
                        keeperSelectedPlayerId
                          ? "Player selected"
                          : "No player selected"
                      }
                    >
                      {keeperSelectedPlayerId ? "✓" : "✕"}
                    </span>
                  </div>
                  <div className={styles.settingRow}>
                    <div className={styles.inlineFormRow}>
                      <label
                        className={styles.visuallyHidden}
                        htmlFor="keeper-team"
                      >
                        Keeper Team
                      </label>
                      <select
                        id="keeper-team"
                        className={`${styles.select} ${styles.ownerSelectInline}`}
                      >
                        {settings.draftOrder.map((teamId) => (
                          <option key={teamId} value={teamId}>
                            {customTeamNames[teamId] || teamId}
                          </option>
                        ))}
                      </select>
                      <label
                        className={styles.visuallyHidden}
                        htmlFor="keeper-cost"
                      >
                        Keeper cost
                      </label>
                      <select
                        id="keeper-cost"
                        className={`${styles.select} ${styles.ownerSelectInline}`}
                        value={keeperCost}
                        onChange={(event) =>
                          setKeeperCost(event.target.value as "pick" | "none")
                        }
                      >
                        <option value="pick">Costs a pick</option>
                        <option value="none" disabled={structuralSettingsLocked}>
                          No pick cost
                        </option>
                      </select>
                      <div
                        className={styles.rosterStepper}
                        ref={keeperRoundStepperRef}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          disabled={keeperCost === "none"}
                          aria-label="Decrease keeper round"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-round",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.max(1, cur - 1));
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={totalRosterSpots}
                          placeholder="RD"
                          className={styles.numberInput}
                          id="keeper-round"
                          disabled={keeperCost === "none"}
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          disabled={keeperCost === "none"}
                          aria-label="Increase keeper round"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-round",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || totalRosterSpots || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.min(max, cur + 1));
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div
                        className={styles.rosterStepper}
                        ref={keeperPickStepperRef}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          disabled={keeperCost === "none"}
                          aria-label="Decrease keeper pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-pick",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.max(1, cur - 1));
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={settings.teamCount}
                          placeholder="Pick"
                          className={styles.numberInput}
                          id="keeper-pick"
                          disabled={keeperCost === "none"}
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          disabled={keeperCost === "none"}
                          aria-label="Increase keeper pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-pick",
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10)),
                            );
                            el.value = String(Math.min(max, cur + 1));
                          }}
                        >
                          +
                        </button>
                      </div>
                      {/* Status icon moved next to autocomplete */}
                      <button
                        type="button"
                        className={styles.addActionBtn}
                        aria-label="Add keeper"
                        onClick={() => {
                          const r = parseInt(
                            (
                              document.getElementById(
                                "keeper-round",
                              ) as HTMLInputElement
                            )?.value || "",
                            10,
                          );
                          const p = parseInt(
                            (
                              document.getElementById(
                                "keeper-pick",
                              ) as HTMLInputElement
                            )?.value || "",
                            10,
                          );
                          const teamId = (
                            document.getElementById(
                              "keeper-team",
                            ) as HTMLSelectElement
                          )?.value;
                          const playerId = keeperSelectedPlayerId;
                          const pickCostIsValid =
                            keeperCost === "none" ||
                            (Number.isFinite(r) && Number.isFinite(p));
                          if (
                            onAddKeeper &&
                            pickCostIsValid &&
                            teamId &&
                            playerId
                          ) {
                            const result = onAddKeeper({
                              cost: keeperCost,
                              teamId,
                              playerId: String(playerId),
                              ...(keeperCost === "pick"
                                ? { round: r, pickInRound: p }
                                : {}),
                            });
                            setKeeperFeedback(result);
                            if (result.ok) setKeeperSelectedPlayerId(undefined);
                          } else {
                            // Pulse invalid inputs to indicate required fields
                            const roundEl = document.getElementById(
                              "keeper-round",
                            ) as HTMLInputElement | null;
                            const pickEl = document.getElementById(
                              "keeper-pick",
                            ) as HTMLInputElement | null;
                            const pulse = (el: HTMLInputElement | null) => {
                              if (!el) return;
                              el.classList.remove(styles.inputErrorPulse);
                              // force reflow to restart animation te
                              (el as any).offsetWidth;
                              el.classList.add(styles.inputErrorPulse);
                              window.setTimeout(
                                () =>
                                  el.classList.remove(styles.inputErrorPulse),
                                1000,
                              );
                            };
                            if (keeperCost === "pick" && !Number.isFinite(r))
                              pulse(roundEl);
                            if (keeperCost === "pick" && !Number.isFinite(p))
                              pulse(pickEl);
                            const pulseGroup = (
                              groupEl: HTMLDivElement | null,
                            ) => {
                              if (!groupEl) return;
                              groupEl.classList.remove(
                                styles.rosterStepperError,
                              );
                              (groupEl as any).offsetWidth;
                              groupEl.classList.add(styles.rosterStepperError);
                              window.setTimeout(() => {
                                groupEl.classList.remove(
                                  styles.rosterStepperError,
                                );
                              }, 1000);
                            };
                            if (keeperCost === "pick" && !Number.isFinite(r))
                              pulseGroup(keeperRoundStepperRef.current);
                            if (keeperCost === "pick" && !Number.isFinite(p))
                              pulseGroup(keeperPickStepperRef.current);
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className={styles.settingRow}>
                    <div className={styles.keeperBulkBlock}>
                      <label
                        htmlFor="keeper-bulk"
                        className={styles.mutedSmallLabel}
                      >
                        Bulk keepers (JSON or CSV: playerId, teamId, cost,
                        round, pickInRound)
                      </label>
                      <textarea
                        id="keeper-bulk"
                        className={styles.keeperBulkInput}
                        value={keeperBulkInput}
                        onChange={(event) =>
                          setKeeperBulkInput(event.target.value)
                        }
                        rows={4}
                        placeholder={
                          "playerId,teamId,cost,round,pickInRound\n8478402,Team 1,pick,3,1\n8471214,Team 2,none,,"
                        }
                      />
                      <button
                        type="button"
                        className={styles.addActionBtn}
                        disabled={!keeperBulkInput.trim() || !onImportKeepers}
                        onClick={() => {
                          if (!onImportKeepers) return;
                          const result = onImportKeepers(keeperBulkInput);
                          setKeeperFeedback(result);
                          if (result.ok) setKeeperBulkInput("");
                        }}
                      >
                        Import Keepers
                      </button>
                      {keeperFeedback && (
                        <div
                          className={
                            keeperFeedback.ok
                              ? styles.keeperFeedbackSuccess
                              : styles.keeperFeedbackError
                          }
                          role={keeperFeedback.ok ? "status" : "alert"}
                        >
                          {keeperFeedback.message}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Keepers list */}
                  <div className={styles.settingRow}>
                    <div className={styles.mutedSmallLabel}>Keepers:</div>
                    <div className={styles.listScrollable}>
                      {keepers.length === 0 && (
                        <div className={styles.smallText}>None</div>
                      )}
                      {keepers.map((k) => (
                        <div
                          key={k.playerId}
                          className={styles.inlineItemRow}
                        >
                          <span>
                            {keeperUsesPick(k)
                              ? `${k.round}-${k.pickInRound}`
                              : "No pick"}{" "}
                            →{" "}
                            {customTeamNames[k.teamId] || k.teamId} (
                            {playerNamesById.get(k.playerId) ||
                              `Player #${k.playerId}`}
                            )
                          </span>
                          {onRemoveKeeper && (
                            <button
                              type="button"
                              className={styles.inlineResetBtn}
                              disabled={
                                !keeperUsesPick(k) && structuralSettingsLocked
                              }
                              title={
                                !keeperUsesPick(k) && structuralSettingsLocked
                                  ? "No-pick keepers are locked after the first ordinary pick."
                                  : undefined
                              }
                              onClick={() => {
                                const result = onRemoveKeeper(k.playerId);
                                setKeeperFeedback(result);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            </fieldset>
          )}
          </div>
          <fieldset data-settings-domain="roster" hidden={variant === "inline" && activeSection !== "roster"} role={variant === "inline" ? "tabpanel" : undefined} aria-labelledby={variant === "inline" ? "draft-tab-roster" : undefined} id="draft-domain-roster" tabIndex={-1} className={styles.fieldset} disabled={draftLocked}>
            <legend className={styles.legend}>
              Roster Configuration{" "}
              <span className={`${styles.rosterTotal} ${rosterTotalClass}`}>
                {totalRosterSpots}
              </span>
            </legend>
            {domainIssues("roster")}
            <div className={styles.settingRow}>
              <label className={styles.label}>Forward Positions:</label>
              <div className={styles.draftTypeToggle} role="tablist">
                <button
                  className={`${styles.toggleButton} ${forwardGrouping === "split" ? styles.active : ""}`}
                  onClick={() =>
                    onForwardGroupingChange && onForwardGroupingChange("split")
                  }
                  role="tab"
                  aria-selected={forwardGrouping === "split"}
                >
                  C/LW/RW
                </button>
                <button
                  className={`${styles.toggleButton} ${forwardGrouping === "fwd" ? styles.active : ""}`}
                  onClick={() =>
                    onForwardGroupingChange && onForwardGroupingChange("fwd")
                  }
                  role="tab"
                  aria-selected={forwardGrouping === "fwd"}
                >
                  FWD
                </button>
              </div>
            </div>
            {[
              { title: "Forwards", positions: ["C", "LW", "RW", "FWD"] },
              { title: "Defense & Goaltending", positions: ["D", "G"] },
              { title: "Flexible", positions: ["utility", "bench"] },
            ].map(group => <div className={styles.rosterGroup} data-roster-group={group.title} key={group.title}>
            <h4>{group.title}</h4>
            <div className={styles.rosterGrid}>
              {group.positions.filter(position => position in displayedRosterConfig).map(position => [position, displayedRosterConfig[position]] as [string, number]).map(
                ([position, count]) => {
                  const max = positionMax[position] ?? 10;
                  return (
                    <div
                      key={position}
                      className={styles.rosterSetting}
                      data-testid={`roster-${position}`}
                      data-position={position.toUpperCase()}
                    >
                      <label
                        className={styles.positionLabel}
                        htmlFor={`pos-${position}`}
                      >
                        {position === "utility" ? "UTIL" : position.toUpperCase()}
                      </label>
                      <div
                        className={styles.rosterStepper}
                        data-testid={`roster-step-${position}`}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          onClick={() => stepRoster(position, -1)}
                          disabled={count <= 0}
                          aria-label={`Decrease ${position} spots`}
                        >
                          −
                        </button>
                        <input
                          id={`pos-${position}`}
                          aria-describedby="draft-issues-roster"
                          aria-invalid={validation ? !validation.domains.roster : undefined}
                          type="number"
                          min={0}
                          max={max}
                          value={count}
                          onWheel={(e) =>
                            (e.currentTarget as HTMLInputElement).blur()
                          }
                          onChange={(e) =>
                            handleRosterConfigChange(
                              position,
                              Number(e.target.value),
                            )
                          }
                          className={styles.numberInput}
                          data-testid={`roster-input-${position}`}
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          onClick={() => stepRoster(position, 1)}
                          disabled={count >= max}
                          aria-label={`Increase ${position} spots`}
                        >
                          +
                        </button>
                      </div>
                      <small>{count} {position === "bench" ? "bench" : "required"}</small>
                    </div>
                  );
                },
              )}
            </div>
            </div>)}
            <div className={styles.rosterSummary}><h4>Roster Summary <span>{totalRosterSpots} total spots</span></h4><p>{["C", "LW", "RW", "FWD"].reduce((sum, pos) => sum + (displayedRosterConfig[pos] || 0), 0)} forwards · {displayedRosterConfig.D || 0} defense · {displayedRosterConfig.G || 0} goalies · {displayedRosterConfig.utility || 0} utility · {displayedRosterConfig.bench || 0} bench</p></div>
            <p className={styles.structuralLockHint}>Changes apply to this draft only. Completed picks are preserved.</p>
          </fieldset>
          <fieldset data-settings-domain="scoring" hidden={variant === "inline" && activeSection !== "scoring"} role={variant === "inline" ? "tabpanel" : undefined} aria-labelledby={variant === "inline" ? "draft-tab-scoring" : undefined} id="draft-domain-scoring" tabIndex={-1} className={`${styles.fieldset} ${styles.settingsGroupScoring}`} disabled={draftLocked}>
            <legend className={styles.legend}>Scoring Configuration</legend>
            {domainIssues("scoring")}
            <DraftScoringSettings settings={settings} onSettingsChange={onSettingsChange} goalieScoring={goalieScoringCategories} onGoalieScoringChange={onGoalieScoringChange} availableSkaterStats={availableSkaterStatKeys} availableGoalieStats={availableGoalieStatKeys} hasPicks={draftedPlayers.length > 0} />
          </fieldset>
          <fieldset data-settings-domain="projections" hidden={variant === "inline" && activeSection !== "projections"} role={variant === "inline" ? "tabpanel" : undefined} aria-labelledby={variant === "inline" ? "draft-tab-projections" : undefined} id="draft-domain-projections" tabIndex={-1} className={styles.fieldset}>
            <legend className={styles.legend}>Projection Sources</legend>
            {domainIssues("projections")}
            <ProjectionSourceSettings skaters={sourceControls} goalies={goalieSourceControls} onSkatersChange={onSourceControlsChange} onGoaliesChange={onGoalieSourceControlsChange} customSources={customSourceMetadata} onRemoveCustomSource={onRemoveCustomSource} hasPicks={draftedPlayers.length > 0} />
          </fieldset>
          {/* Quick Actions fieldset removed; actions moved under League Setup */}

        </div>
      )}
      {onReplaceDraftPick && (
        <QuickFixModal
          open={quickFixOpen}
          onClose={() => setQuickFixOpen(false)}
          teamCount={settings.teamCount}
          roundCount={totalRosterSpots}
          draftedPlayers={draftedPlayers}
          availablePlayers={availablePlayersForQuickFix}
          allPlayerNames={playerNamesById}
          customTeamNames={customTeamNames}
          onReplace={onReplaceDraftPick}
        />
      )}
      <ManageTradesModal
        open={tradeManagerOpen && !draftLocked}
        onClose={() => setTradeManagerOpen(false)}
        draftOrder={settings.draftOrder}
        customTeamNames={customTeamNames}
        roundCount={totalRosterSpots}
        trades={pickTrades}
        keepers={keepers}
        onSave={(round, pickInRound, owner) =>
          onAddTradedPick?.(round, pickInRound, owner) || {
            ok: false,
            message: "Trade handler is unavailable.",
          }
        }
        onImport={(input) =>
          onImportTradedPicks?.(input) || {
            ok: false,
            message: "Trade import is unavailable.",
          }
        }
        onRemove={(round, pickInRound) =>
          onRemoveTradedPick?.(round, pickInRound)
        }
        onReset={() => onResetTradedPicks?.()}
      />
    </div>
  );
});
DraftSettings.displayName = "DraftSettings";

export default DraftSettings;

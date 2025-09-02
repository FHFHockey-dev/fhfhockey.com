// components/DraftDashboard/DraftSettings.tsx

import React from "react";
import type { DraftSettings as DraftSettingsType } from "./DraftDashboard";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import styles from "./DraftSettings.module.scss";

type LeagueType = "points" | "categories";

interface DraftSettingsProps {
  settings: DraftSettingsType;
  onSettingsChange: (newSettings: Partial<DraftSettingsType>) => void;
  isSnakeDraft: boolean;
  onSnakeDraftChange: (isSnake: boolean) => void;
  myTeamId: string;
  onMyTeamIdChange: (teamId: string) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  draftHistory: any[];
  draftedPlayers: any[];
  currentPick: number;
  customTeamNames?: Record<string, string>;
  // NEW: forward grouping mode controls
  forwardGrouping?: "split" | "fwd";
  onForwardGroupingChange?: (mode: "split" | "fwd") => void;
  // Projection source controls
  sourceControls?: Record<string, { isSelected: boolean; weight: number }>;
  onSourceControlsChange?: (
    next: Record<string, { isSelected: boolean; weight: number }>
  ) => void;
  goalieSourceControls?: Record<
    string,
    { isSelected: boolean; weight: number }
  >;
  onGoalieSourceControlsChange?: (
    next: Record<string, { isSelected: boolean; weight: number }>
  ) => void;
  goalieScoringCategories?: Record<string, number>;
  onGoalieScoringChange?: (values: Record<string, number>) => void;
  onOpenSummary?: () => void;
  // New: open Import CSV modal
  onOpenImportCsv?: () => void;
  // New: label to show for the custom CSV source
  customSourceLabel?: string;
  // NEW: available stat keys derived from projections/custom CSV
  availableSkaterStatKeys?: string[];
  availableGoalieStatKeys?: string[];
  // NEW: export blended projections CSV
  onExportCsv?: () => void;
  // NEW: traded picks & keepers
  pickOwnerOverrides?: Record<string, string>;
  onAddTradedPick?: (
    round: number,
    pickInRound: number,
    teamId: string
  ) => void;
  onRemoveTradedPick?: (round: number, pickInRound: number) => void;
  keepers?: Array<{
    round: number;
    pickInRound: number;
    teamId: string;
    playerId: string;
  }>;
  onAddKeeper?: (
    round: number,
    pickInRound: number,
    teamId: string,
    playerId: string
  ) => void;
  onRemoveKeeper?: (round: number, pickInRound: number) => void;
}

const CAT_KEYS = [
  "GOALS",
  "ASSISTS",
  "PP_POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS"
] as const;

type CatKey = (typeof CAT_KEYS)[number];

const SKATER_LABELS: Record<string, string> = {
  // Core
  GOALS: "G",
  ASSISTS: "A",
  PP_POINTS: "PPP",
  SHOTS_ON_GOAL: "SOG",
  HITS: "HIT",
  BLOCKED_SHOTS: "BLK",
  // Requested skater abbreviations
  FACEOFFS_LOST: "FOL",
  FACEOFFS_WON: "FOW",
  GAMES_PLAYED: "GP",
  PENALTY_MINUTES: "PIM",
  POINTS: "PTS",
  PP_ASSISTS: "PPA",
  PP_GOALS: "PPG",
  SH_POINTS: "SHP",
  PLUS_MINUS: "+/-",
  TIME_ON_ICE_PER_GAME: "ATOI"
};

const GOALIE_LABELS: Record<string, string> = {
  WINS_GOALIE: "W",
  SAVES_GOALIE: "SV",
  SHUTOUTS_GOALIE: "SHO",
  GOALS_AGAINST_GOALIE: "GAA",
  SAVE_PERCENTAGE: "SV%",
  GOALS_AGAINST_AVERAGE: "GAA",
  // Requested goalie abbreviations
  GAA: "GAA",
  GAMES_PLAYED: "GP",
  LOSSES_GOALIE: "L",
  OTL_GOALIE: "OTL",
  SHOTS_AGAINST_GOALIE: "SA"
};

function getShortLabel(statKey: string): string {
  if (SKATER_LABELS[statKey]) return SKATER_LABELS[statKey];
  if (GOALIE_LABELS[statKey]) return GOALIE_LABELS[statKey];
  switch (statKey) {
    case "GOALS":
      return "G";
    case "ASSISTS":
      return "A";
    case "PP_POINTS":
      return "PPP";
    case "SHOTS_ON_GOAL":
      return "SOG";
    case "HITS":
      return "HIT";
    case "BLOCKED_SHOTS":
      return "BLK";
    default:
      return statKey;
  }
}

import PlayerAutocomplete from "components/PlayerAutocomplete";

const DraftSettings: React.FC<DraftSettingsProps> = ({
  settings,
  onSettingsChange,
  isSnakeDraft,
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
  availableSkaterStatKeys = [],
  availableGoalieStatKeys = [],
  onExportCsv,
  pickOwnerOverrides = {},
  onAddTradedPick,
  onRemoveTradedPick,
  keepers = [],
  onAddKeeper,
  onRemoveKeeper
}) => {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("draftSettings.collapsed");
    return v === "true";
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("draftSettings.collapsed", String(collapsed));
  }, [collapsed]);

  const [dirtyHash, setDirtyHash] = React.useState<string>("");
  const [isDirty, setIsDirty] = React.useState(false);
  const stableHashRef = React.useRef<string>("");
  const dirtyTimerRef = React.useRef<number | null>(null);

  const computeHash = () =>
    JSON.stringify({
      s: settings,
      sc: sourceControls,
      gsc: goalieSourceControls,
      gs: goalieScoringCategories
    });

  React.useEffect(() => {
    const h = computeHash();
    setDirtyHash(h);
    if (h !== stableHashRef.current) {
      setIsDirty(true);
      if (dirtyTimerRef.current) window.clearTimeout(dirtyTimerRef.current);
      dirtyTimerRef.current = window.setTimeout(() => {
        // auto-set saved after debounce
        stableHashRef.current = h;
        setIsDirty(false);
      }, 800);
    }
    return () => {
      if (dirtyTimerRef.current) window.clearTimeout(dirtyTimerRef.current);
    };
  }, [settings, sourceControls, goalieSourceControls, goalieScoringCategories]);

  const handleTeamCountChange = (count: number) => {
    const newDraftOrder = Array.from(
      { length: count },
      (_, i) => `Team ${i + 1}`
    );
    onSettingsChange({
      teamCount: count,
      draftOrder: newDraftOrder
    });

    if (!newDraftOrder.includes(myTeamId)) {
      onMyTeamIdChange("Team 1");
    }
  };

  const handleRosterConfigChange = (position: string, count: number) => {
    onSettingsChange({
      rosterConfig: {
        ...settings.rosterConfig,
        [position]: count
      }
    });
  };

  const leagueType: LeagueType = settings.leagueType || "points";
  const weights = settings.categoryWeights || ({} as Record<string, number>);
  const getWeight = (k: CatKey) =>
    typeof weights[k] === "number" ? weights[k] : 1;

  const normalizeWeights = (
    controls?: Record<string, { isSelected: boolean; weight: number }>
  ) => {
    if (!controls) return controls;
    const entries = Object.entries(controls);
    const active = entries.filter(([, v]) => v.isSelected && v.weight > 0);
    const sum = active.reduce((acc, [, v]) => acc + v.weight, 0);
    if (sum <= 0) return controls;
    const next: typeof controls = { ...controls };
    active.forEach(([k, v]) => {
      next[k] = { ...v, weight: parseFloat((v.weight / sum).toFixed(3)) };
    });
    return next;
  };

  const handleNormalizeAll = () => {
    if (onSourceControlsChange && sourceControls) {
      onSourceControlsChange(normalizeWeights(sourceControls)!);
    }
    if (onGoalieSourceControlsChange && goalieSourceControls) {
      onGoalieSourceControlsChange(normalizeWeights(goalieSourceControls)!);
    }
  };

  const totalActiveSourceWeight = React.useMemo(() => {
    if (!sourceControls) return 0;
    return Object.values(sourceControls).reduce(
      (acc, v) => (v.isSelected ? acc + v.weight : acc),
      0
    );
  }, [sourceControls]);
  const totalActiveGoalieSourceWeight = React.useMemo(() => {
    if (!goalieSourceControls) return 0;
    return Object.values(goalieSourceControls).reduce(
      (acc, v) => (v.isSelected ? acc + v.weight : acc),
      0
    );
  }, [goalieSourceControls]);

  const isNormalized = React.useMemo(() => {
    const approxOne = (n: number) => Math.abs(n - 1) < 0.01 || n === 0;
    return (
      approxOne(totalActiveSourceWeight) &&
      approxOne(totalActiveGoalieSourceWeight)
    );
  }, [totalActiveSourceWeight, totalActiveGoalieSourceWeight]);

  const handleResetSkaterScoring = () => {
    onSettingsChange({
      scoringCategories: getDefaultFantasyPointsConfig("skater")
    });
  };
  const handleResetGoalieScoring = () => {
    if (onGoalieScoringChange) {
      onGoalieScoringChange(getDefaultFantasyPointsConfig("goalie"));
    }
  };
  const handleResetSourceWeights = () => {
    handleNormalizeAll();
  };

  const stepRoster = (position: string, delta: number) => {
    const current = settings.rosterConfig[position];
    const max = positionMax[position] ?? 10;
    const next = Math.min(max, Math.max(0, current + delta));
    if (next !== current) handleRosterConfigChange(position, next);
  };

  const customSource = sourceControls?.custom_csv;

  const firstInteractiveRef = React.useRef<HTMLInputElement | null>(null);

  // Pending (debounced) source weight edits
  const [pendingSourceWeights, setPendingSourceWeights] = React.useState<
    Record<string, number>
  >({});
  const [pendingGoalieSourceWeights, setPendingGoalieSourceWeights] =
    React.useState<Record<string, number>>({});
  const sourceDebounceTimers = React.useRef<Map<string, number>>(new Map());
  const goalieSourceDebounceTimers = React.useRef<Map<string, number>>(
    new Map()
  );
  const DEBOUNCE_MS = 200;

  // Keepers & Traded Picks visibility now controlled by settings.isKeeper
  const [keeperSelectedPlayerId, setKeeperSelectedPlayerId] = React.useState<
    string | undefined
  >(undefined);
  // Separate refs for traded picks vs keeper steppers
  const tradeRoundStepperRef = React.useRef<HTMLDivElement | null>(null);
  const tradePickStepperRef = React.useRef<HTMLDivElement | null>(null);
  const keeperRoundStepperRef = React.useRef<HTMLDivElement | null>(null);
  const keeperPickStepperRef = React.useRef<HTMLDivElement | null>(null);

  const applyDebouncedSourceWeight = (id: string, value: number) => {
    if (!onSourceControlsChange || !sourceControls) return;
    const timers = sourceDebounceTimers.current;
    if (timers.has(id)) {
      window.clearTimeout(timers.get(id)!);
      timers.delete(id);
    }
    setPendingSourceWeights((prev) => ({ ...prev, [id]: value }));
    const t = window.setTimeout(() => {
      onSourceControlsChange({
        ...sourceControls,
        [id]: { isSelected: sourceControls[id].isSelected, weight: value }
      });
      setPendingSourceWeights((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      timers.delete(id);
    }, DEBOUNCE_MS);
    timers.set(id, t);
  };

  const applyDebouncedGoalieSourceWeight = (id: string, value: number) => {
    if (!onGoalieSourceControlsChange || !goalieSourceControls) return;
    const timers = goalieSourceDebounceTimers.current;
    if (timers.has(id)) {
      window.clearTimeout(timers.get(id)!);
      timers.delete(id);
    }
    setPendingGoalieSourceWeights((prev) => ({ ...prev, [id]: value }));
    const t = window.setTimeout(() => {
      onGoalieSourceControlsChange({
        ...goalieSourceControls,
        [id]: { isSelected: goalieSourceControls[id].isSelected, weight: value }
      });
      setPendingGoalieSourceWeights((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      timers.delete(id);
    }, DEBOUNCE_MS);
    timers.set(id, t);
  };

  // Focus first interactive element when expanding
  React.useEffect(() => {
    if (!collapsed && firstInteractiveRef.current) {
      firstInteractiveRef.current.focus();
    }
  }, [collapsed]);

  // Position-specific maximums (utility limited to 2)
  const positionMax: Record<string, number> = {
    c: 6,
    lw: 6,
    rw: 6,
    d: 8,
    g: 4,
    util: 2,
    bench: 10
  };

  const totalRosterSpots = Object.values(settings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0
  );
  const rosterTotalClass =
    totalRosterSpots > 22 ? styles.rosterTotalWarning : "";

  // Two-step confirmation for dangerous Reset Draft
  const [confirmReset, setConfirmReset] = React.useState(false);
  const confirmResetTimeout = React.useRef<number | null>(null);
  const handleResetDraftClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (confirmResetTimeout.current)
        window.clearTimeout(confirmResetTimeout.current);
      confirmResetTimeout.current = window.setTimeout(
        () => setConfirmReset(false),
        4000
      );
      return;
    }
    resetDraft();
    setConfirmReset(false);
    if (confirmResetTimeout.current)
      window.clearTimeout(confirmResetTimeout.current);
  };
  React.useEffect(
    () => () => {
      if (confirmResetTimeout.current)
        window.clearTimeout(confirmResetTimeout.current);
    },
    []
  );

  // Popover for editing projection weights
  const [showWeightsPopover, setShowWeightsPopover] = React.useState(false);
  const [showDisabledSources, setShowDisabledSources] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!showWeightsPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowWeightsPopover(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWeightsPopover]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowWeightsPopover(false);
  };

  // Auto-normalize toggle
  const [autoNormalize, setAutoNormalize] = React.useState(true);
  React.useEffect(() => {
    if (autoNormalize && !isNormalized) {
      handleNormalizeAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNormalize, sourceControls, goalieSourceControls, isNormalized]);

  // Order sources: active first, then disabled
  const orderSources = <T extends { isSelected: boolean }>(
    obj: Record<string, T>
  ) => {
    return Object.entries(obj).sort((a, b) => {
      if (a[1].isSelected === b[1].isSelected) return a[0].localeCompare(b[0]);
      return a[1].isSelected ? -1 : 1;
    });
  };

  const renderSourceChips = () => {
    if (!sourceControls) return null;
    const entries = orderSources(sourceControls);
    const active = entries.filter(([_, v]) => v.isSelected);
    const disabled = entries.filter(([_, v]) => !v.isSelected);

    const chipFor = (
      id: string,
      ctrl: { isSelected: boolean; weight: number }
    ) => {
      const src = PROJECTION_SOURCES_CONFIG.find((s) => s.id === id);
      const isCustom = id === "custom_csv";
      const displayName = isCustom
        ? customSourceLabel || "Custom CSV"
        : src?.displayName || id;
      const shareBase = ctrl.isSelected ? totalActiveSourceWeight : 0;
      const weightVal = pendingSourceWeights[id] ?? ctrl.weight;
      const share =
        ctrl.isSelected && shareBase > 0
          ? ((weightVal / shareBase) * 100).toFixed(0) + "%"
          : "-";
      return (
        <div
          key={id}
          className={`${styles.sourceChip} ${ctrl.isSelected ? styles.sourceChipEnabled : styles.sourceChipDisabled}`}
          data-testid={`source-chip-${id}`}
          title={`${displayName} ${weightVal.toFixed(1)}x ${share}`}
          onClick={() => setShowWeightsPopover(true)}
        >
          <span className={styles.sourceChipName}>{displayName}</span>
          <span className={styles.sourceChipWeight}>
            {weightVal.toFixed(1)}x
          </span>
          <span className={styles.sourceChipShare}>{share}</span>
        </div>
      );
    };

    return (
      <div className={styles.sourceChipsRow}>
        {active.map(([id, ctrl]) => chipFor(id, ctrl))}
        {showDisabledSources && disabled.map(([id, ctrl]) => chipFor(id, ctrl))}
        {disabled.length > 0 && (
          <button
            type="button"
            className={styles.editWeightsBtn}
            onClick={() => setShowDisabledSources((s) => !s)}
            data-testid="toggle-disabled-sources"
            aria-pressed={showDisabledSources}
          >
            {showDisabledSources
              ? "Hide Disabled"
              : `+${disabled.length} Disabled`}
          </button>
        )}
        <button
          type="button"
          className={styles.editWeightsBtn}
          onClick={() => setShowWeightsPopover(true)}
          data-testid="open-weights-popover"
        >
          Edit Weights
        </button>
      </div>
    );
  };

  // Handle direct numeric change inside popover
  const handleDirectWeightInput = (
    id: string,
    value: number,
    isGoalie: boolean
  ) => {
    const clamped = Math.max(0, Math.min(2, value));
    if (isGoalie) {
      applyDebouncedGoalieSourceWeight(id, clamped);
    } else {
      applyDebouncedSourceWeight(id, clamped);
    }
  };

  // NEW: state for managing scoring metric expansion & add/remove UI
  const [showManageSkaterStats, setShowManageSkaterStats] =
    React.useState(false);

  // Note: goalie addable keys computed directly below; no separate memo needed.

  const [newSkaterStatKey, setNewSkaterStatKey] = React.useState("");
  const [newSkaterStatValue, setNewSkaterStatValue] = React.useState("1");

  // Goalie manage/add state mirrors skaters
  const [showAllGoalieStats, setShowAllGoalieStats] = React.useState(false);
  const addableGoalieStats = React.useMemo(() => {
    const existing = new Set(Object.keys(goalieScoringCategories || {}));
    return (availableGoalieStatKeys || [])
      .filter((k) => !existing.has(k))
      .filter((k) => /[A-Z0-9_]/.test(k));
  }, [availableGoalieStatKeys, goalieScoringCategories]);
  const [newGoalieStatKey, setNewGoalieStatKey] = React.useState("");
  const [newGoalieStatValue, setNewGoalieStatValue] = React.useState("1");
  const handleAddGoalieStat = () => {
    if (!onGoalieScoringChange || !goalieScoringCategories) return;
    if (!newGoalieStatKey) return;
    const val = parseFloat(newGoalieStatValue) || 0;
    onGoalieScoringChange({
      ...goalieScoringCategories,
      [newGoalieStatKey]: val
    });
    setNewGoalieStatKey("");
    setNewGoalieStatValue("1");
  };
  const handleRemoveGoalieStat = (key: string) => {
    if (!onGoalieScoringChange || !goalieScoringCategories) return;
    const { [key]: _, ...rest } = goalieScoringCategories;
    onGoalieScoringChange(rest);
  };

  // Derive addable skater stat keys (exclude already added + some core exclusions)
  const addableSkaterStats = React.useMemo(() => {
    const existing = new Set(Object.keys(settings.scoringCategories));
    return availableSkaterStatKeys
      .filter((k) => !existing.has(k))
      .filter((k) => /[A-Z0-9_]/.test(k));
  }, [availableSkaterStatKeys, settings.scoringCategories]);

  const handleAddSkaterStat = () => {
    if (!newSkaterStatKey) return;
    const val = parseFloat(newSkaterStatValue) || 0;
    onSettingsChange({
      scoringCategories: {
        ...settings.scoringCategories,
        [newSkaterStatKey]: val
      }
    });
    setNewSkaterStatKey("");
    setNewSkaterStatValue("1");
  };

  const handleRemoveSkaterStat = (key: string) => {
    const { [key]: _, ...rest } = settings.scoringCategories;
    onSettingsChange({ scoringCategories: rest });
  };

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        <h1 className={styles.title}>
          Fantasy Hockey{" "}
          <span className={styles.titleAccent}>Draft Companion Dashboard</span>
        </h1>
        <div className={styles.headerActions}>
          <div className={styles.statusCluster}>
            <span
              className={`${styles.unsavedBadge} ${!isDirty ? "saved" : ""}`}
              aria-live="polite"
            >
              {isDirty ? "Unsaved" : "Saved"}
            </span>
            {isNormalized && (
              <span
                className={styles.normalizedBadge}
                title="Projection source weights normalized to 1.00"
              >
                Weights 1.00
              </span>
            )}
          </div>
          <div
            className={styles.draftTypeToggle}
            role="tablist"
            aria-label="Draft order mode"
          >
            <button
              className={`${styles.toggleButton} ${!isSnakeDraft ? styles.active : ""}`}
              onClick={() => onSnakeDraftChange(false)}
              role="tab"
              aria-selected={!isSnakeDraft}
            >
              Standard
            </button>
            <button
              className={`${styles.toggleButton} ${isSnakeDraft ? styles.active : ""}`}
              onClick={() => onSnakeDraftChange(true)}
              role="tab"
              aria-selected={isSnakeDraft}
            >
              Snake
            </button>
          </div>
          <button
            type="button"
            className={styles.summaryButton}
            onClick={() => onOpenSummary && onOpenSummary()}
            disabled={!draftedPlayers.length}
            aria-label="Open Draft Summary"
            title="Open Draft Summary"
          >
            Summary
          </button>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-pressed={!collapsed}
            aria-label={collapsed ? "Expand settings" : "Collapse settings"}
            title={collapsed ? "Expand settings" : "Collapse settings"}
          >
            {collapsed ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M8 5l8 7-8 7V5z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path fill="currentColor" d="M16 19l-8-7 8-7v14z" />
              </svg>
            )}
            <span className={styles.visuallyHidden}>
              {collapsed ? "Expand" : "Collapse"}
            </span>
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={styles.settingsGrid}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>League Setup</legend>
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
                      Math.max(2, (settings.teamCount || 0) - 1)
                    )
                  }
                  disabled={settings.teamCount <= 2}
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
                />
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() =>
                    handleTeamCountChange(
                      Math.min(40, (settings.teamCount || 0) + 1)
                    )
                  }
                  disabled={settings.teamCount >= 40}
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
                value={myTeamId}
                onChange={(e) => onMyTeamIdChange(e.target.value)}
                className={styles.select}
              >
                {settings.draftOrder.map((teamId) => (
                  <option key={teamId} value={teamId}>
                    {customTeamNames[teamId] || teamId}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.settingRow}>
              <label className={styles.label} htmlFor="leagueType">
                League Type:
              </label>
              <select
                id="leagueType"
                value={leagueType}
                onChange={(e) =>
                  onSettingsChange({ leagueType: e.target.value as LeagueType })
                }
                className={styles.select}
              >
                <option value="points">Points</option>
                <option value="categories">Categories</option>
              </select>
            </div>
            <div className={styles.settingRow}>
              <label className={styles.label}>Keeper League:</label>
              <div className={styles.draftTypeToggle} role="tablist">
                <button
                  className={`${styles.toggleButton} ${!settings.isKeeper ? styles.active : ""}`}
                  onClick={() => onSettingsChange({ isKeeper: false })}
                  role="tab"
                  aria-selected={!settings.isKeeper}
                >
                  No
                </button>
                <button
                  className={`${styles.toggleButton} ${settings.isKeeper ? styles.active : ""}`}
                  onClick={() => onSettingsChange({ isKeeper: true })}
                  role="tab"
                  aria-selected={!!settings.isKeeper}
                >
                  Yes
                </button>
              </div>
            </div>
            {/* Quick Actions moved into League Setup to reduce containers */}
            <div id="resetDraftWarning" className={styles.visuallyHidden}>
              This will clear all picks. Action cannot be undone.
            </div>
            <div className={styles.actionButtons}>
              <button
                className={styles.actionButton}
                onClick={undoLastPick}
                disabled={draftHistory.length === 0}
                title={
                  draftHistory.length > 0
                    ? `Undo Pick #${currentPick - 1}`
                    : "No picks to undo"
                }
                data-testid="undo-pick-btn"
              >
                Undo Pick
              </button>
              <button
                className={`${styles.actionButton} ${confirmReset ? styles.confirmReset : ""}`}
                onClick={handleResetDraftClick}
                disabled={draftedPlayers.length === 0 && !confirmReset}
                aria-describedby="resetDraftWarning"
                data-testid="reset-draft-btn"
                title="Reset entire draft"
              >
                {confirmReset ? "Confirm Reset" : "Reset Draft"}
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
                          settings.rosterConfig || {}
                        ).reduce((s: number, v: number) => s + v, 0)
                      }
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: "application/json"
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
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Roster Spots{" "}
              <span className={`${styles.rosterTotal} ${rosterTotalClass}`}>
                {totalRosterSpots}
              </span>
            </legend>
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
            <div className={styles.rosterGrid}>
              {Object.entries(settings.rosterConfig).map(
                ([position, count]) => {
                  const max = positionMax[position] ?? 10;
                  return (
                    <div
                      key={position}
                      className={styles.rosterSetting}
                      data-testid={`roster-${position}`}
                    >
                      <label
                        className={styles.positionLabel}
                        htmlFor={`pos-${position}`}
                      >
                        {position.toUpperCase()}
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
                              Number(e.target.value)
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
                    </div>
                  );
                }
              )}
            </div>
            {/* Reset buttons moved under Scoring Categories */}
          </fieldset>
          <fieldset
            className={`${styles.fieldset} ${styles.settingsGroupScoring}`}
          >
            <legend className={styles.legend}>
              {leagueType === "categories"
                ? "Category Weights"
                : "Scoring Categories"}
            </legend>
            {leagueType === "categories" ? (
              <div className={styles.scoringGrid}>
                {CAT_KEYS.map((k) => (
                  <div key={k} className={styles.scoringSetting}>
                    <label className={styles.statLabel} htmlFor={`cat-${k}`}>
                      {SKATER_LABELS[k]}
                    </label>
                    <input
                      id={`cat-${k}`}
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={getWeight(k)}
                      aria-label={`${k} weight`}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={getWeight(k)}
                      aria-valuetext={`${getWeight(k).toFixed(1)}x`}
                      onChange={(e) =>
                        onSettingsChange({
                          categoryWeights: {
                            ...settings.categoryWeights,
                            [k]: parseFloat(e.target.value)
                          }
                        })
                      }
                      className={styles.rangeInput}
                    />
                    <div className={styles.weightLabel}>
                      {getWeight(k).toFixed(1)}x
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Scoring subgroups side-by-side wrapper */}
                <div className={styles.scoringSubgroupsRow}>
                  <div
                    className={`${styles.scoringSubgroup} ${styles.scoringSubgroupSplit}`}
                  >
                    {" "}
                    {/* Skaters */}
                    <h4 className={styles.subgroupTitle}>Skaters</h4>
                    <div className={styles.scoringGrid}>
                      {Object.entries(settings.scoringCategories)
                        .slice(0, showManageSkaterStats ? undefined : 6)
                        .map(([stat, points]) => (
                          <div key={stat} className={styles.scoringSetting}>
                            <label className={styles.statLabel}>
                              {getShortLabel(stat)}:
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={points}
                              onChange={(e) =>
                                onSettingsChange({
                                  scoringCategories: {
                                    ...settings.scoringCategories,
                                    [stat]: Number(e.target.value)
                                  }
                                })
                              }
                              className={styles.pointsInput}
                            />
                            {showManageSkaterStats && (
                              <button
                                type="button"
                                className={styles.removeStatBtn}
                                aria-label={`Remove ${stat}`}
                                title="Remove stat"
                                onClick={() => handleRemoveSkaterStat(stat)}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      {showManageSkaterStats ? (
                        <div className={styles.inlineManage}>
                          <select
                            value={newSkaterStatKey}
                            onChange={(e) =>
                              setNewSkaterStatKey(e.target.value)
                            }
                            className={styles.select}
                            aria-label="Select stat to add"
                          >
                            <option value="">Select Stat...</option>
                            {addableSkaterStats.map((k) => (
                              <option key={k} value={k}>
                                {getShortLabel(k)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step={0.1}
                            className={`${styles.pointsInput} ${styles.pointsInputNarrow}`}
                            value={newSkaterStatValue}
                            aria-label="New stat point value"
                            onChange={(e) =>
                              setNewSkaterStatValue(e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={handleAddSkaterStat}
                            disabled={!newSkaterStatKey}
                          >
                            Add Stat
                          </button>
                          <button
                            type="button"
                            className={styles.inlineResetBtn}
                            onClick={() => setShowManageSkaterStats(false)}
                          >
                            Hide
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.expandButton}
                          type="button"
                          aria-expanded={showManageSkaterStats}
                          onClick={() => {
                            setNewSkaterStatKey("");
                            setNewSkaterStatValue("1");
                            setShowManageSkaterStats(true);
                          }}
                          title="Manage / Add scoring stats"
                        >
                          {`+${Math.max(0, Object.keys(settings.scoringCategories).length - 6)} more`}
                        </button>
                      )}
                    </div>
                    {showManageSkaterStats &&
                      addableSkaterStats.length === 0 && (
                        <div className={styles.noAddableStatsMsg}>
                          All available skater projection metrics are already
                          added.
                        </div>
                      )}
                  </div>
                  {goalieScoringCategories && onGoalieScoringChange && (
                    <div
                      className={`${styles.scoringSubgroup} ${styles.scoringSubgroupSplit}`}
                    >
                      {" "}
                      {/* Goalies */}
                      <h4 className={styles.subgroupTitle}>Goalies</h4>
                      <div
                        className={`${styles.scoringGrid} ${styles.goalieGrid}`}
                      >
                        {Object.entries(goalieScoringCategories)
                          .slice(0, showAllGoalieStats ? undefined : 6)
                          .map(([stat, points]) => (
                            <div key={stat} className={styles.scoringSetting}>
                              <label className={styles.statLabel}>
                                {getShortLabel(stat)}:
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={points}
                                onChange={(e) =>
                                  onGoalieScoringChange({
                                    ...goalieScoringCategories,
                                    [stat]: Number(e.target.value)
                                  })
                                }
                                className={styles.pointsInput}
                              />
                              {showAllGoalieStats && (
                                <button
                                  type="button"
                                  className={styles.removeStatBtn}
                                  aria-label={`Remove ${stat}`}
                                  title="Remove stat"
                                  onClick={() => handleRemoveGoalieStat(stat)}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        {showAllGoalieStats ? (
                          <div className={styles.inlineManage}>
                            <select
                              value={newGoalieStatKey}
                              onChange={(e) =>
                                setNewGoalieStatKey(e.target.value)
                              }
                              className={styles.select}
                              aria-label="Select goalie stat to add"
                            >
                              <option value="">Select Stat...</option>
                              {addableGoalieStats.map((k) => (
                                <option key={k} value={k}>
                                  {getShortLabel(k)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step={0.1}
                              className={`${styles.pointsInput} ${styles.pointsInputNarrow}`}
                              value={newGoalieStatValue}
                              aria-label="New goalie stat point value"
                              onChange={(e) =>
                                setNewGoalieStatValue(e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={handleAddGoalieStat}
                              disabled={!newGoalieStatKey}
                            >
                              Add Stat
                            </button>
                            <button
                              type="button"
                              className={styles.inlineResetBtn}
                              onClick={() => setShowAllGoalieStats(false)}
                            >
                              Hide
                            </button>
                          </div>
                        ) : (
                          <button
                            className={styles.expandButton}
                            type="button"
                            aria-expanded={showAllGoalieStats}
                            onClick={() => {
                              setNewGoalieStatKey("");
                              setNewGoalieStatValue("1");
                              setShowAllGoalieStats(true);
                            }}
                            title="Manage / Add goalie stats"
                          >
                            {`+${Math.max(0, Object.keys(goalieScoringCategories).length - 6)} more`}
                          </button>
                        )}
                      </div>
                      {showAllGoalieStats &&
                        addableGoalieStats.length === 0 && (
                          <div className={styles.noAddableStatsMsg}>
                            All available goalie projection metrics are already
                            added.
                          </div>
                        )}
                    </div>
                  )}
                </div>
                <div className={styles.inlineActions}>
                  <button
                    type="button"
                    className={styles.inlineResetBtn}
                    onClick={handleResetSkaterScoring}
                    title="Reset skater scoring to defaults"
                  >
                    Reset Skater Scoring
                  </button>
                  {goalieScoringCategories && (
                    <button
                      type="button"
                      className={styles.inlineResetBtn}
                      onClick={handleResetGoalieScoring}
                      title="Reset goalie scoring to defaults"
                    >
                      Reset Goalie Scoring
                    </button>
                  )}
                </div>
              </>
            )}
          </fieldset>
          {(sourceControls || goalieSourceControls) && (
            <fieldset className={`${styles.fieldset} ${styles.slimFieldset}`}>
              <legend className={styles.legend}>Projection Sources</legend>
              {renderSourceChips()}
              {autoNormalize && (
                <>
                  <span
                    className={`${styles.normalizedBadge} ${styles.normalizedBadgeSpaced}`}
                  >
                    {isNormalized ? "Normalized" : "Normalizing..."}
                  </span>
                  <div className={styles.sourcePlug}>
                    <a
                      href="https://www.reddit.com/r/fantasyhockey/comments/1n1wsqc/dtz_20252026_nhl_projections/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DtZ Projections
                    </a>
                    <span aria-hidden>— community contributed</span>
                  </div>
                </>
              )}
            </fieldset>
          )}
          {/* Quick Actions fieldset removed; actions moved under League Setup */}
          {settings.isKeeper && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Keepers & Traded Picks</legend>
              <>
                {/* Traded Picks subsection */}
                <div className={styles.subsection}>
                  <div className={styles.subsectionTitle}>Traded Picks</div>
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
                              "trade-round"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                              "trade-round"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || totalRosterSpots || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                              "trade-pick"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                              "trade-pick"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                                "trade-round"
                              ) as HTMLInputElement
                            )?.value || "",
                            10
                          );
                          const p = parseInt(
                            (
                              document.getElementById(
                                "trade-pick"
                              ) as HTMLInputElement
                            )?.value || "",
                            10
                          );
                          const owner = (
                            document.getElementById(
                              "trade-owner"
                            ) as HTMLSelectElement
                          )?.value;
                          if (
                            onAddTradedPick &&
                            Number.isFinite(r) &&
                            Number.isFinite(p) &&
                            owner
                          ) {
                            onAddTradedPick(r, p, owner);
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
                        )
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
                      playerId={undefined}
                      onPlayerIdChange={(id) => {
                        setKeeperSelectedPlayerId(id ? String(id) : undefined);
                      }}
                      showButton={false}
                      inputClassName={styles.playerAutoInputSmall}
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
                      <div
                        className={styles.rosterStepper}
                        ref={keeperRoundStepperRef}
                      >
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Decrease keeper round"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-round"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Increase keeper round"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-round"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max = Number(el.max) || totalRosterSpots || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                          aria-label="Decrease keeper pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-pick"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                        />
                        <button
                          type="button"
                          className={styles.stepButton}
                          aria-label="Increase keeper pick"
                          onClick={() => {
                            const el = document.getElementById(
                              "keeper-pick"
                            ) as HTMLInputElement | null;
                            if (!el) return;
                            const max =
                              Number(el.max) || settings.teamCount || 1;
                            const cur = Math.max(
                              1,
                              Math.min(max, parseInt(el.value || "1", 10))
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
                                "keeper-round"
                              ) as HTMLInputElement
                            )?.value || "",
                            10
                          );
                          const p = parseInt(
                            (
                              document.getElementById(
                                "keeper-pick"
                              ) as HTMLInputElement
                            )?.value || "",
                            10
                          );
                          const teamId = (
                            document.getElementById(
                              "keeper-team"
                            ) as HTMLSelectElement
                          )?.value;
                          const playerId = keeperSelectedPlayerId;
                          if (
                            onAddKeeper &&
                            Number.isFinite(r) &&
                            Number.isFinite(p) &&
                            teamId &&
                            playerId
                          ) {
                            onAddKeeper(r, p, teamId, String(playerId));
                          } else {
                            // Pulse invalid inputs to indicate required fields
                            const roundEl = document.getElementById(
                              "keeper-round"
                            ) as HTMLInputElement | null;
                            const pickEl = document.getElementById(
                              "keeper-pick"
                            ) as HTMLInputElement | null;
                            const pulse = (el: HTMLInputElement | null) => {
                              if (!el) return;
                              el.classList.remove(styles.inputErrorPulse);
                              // force reflow to restart animation te
                              // eslint-disable-next-line no-unused-expressions
                              (el as any).offsetWidth;
                              el.classList.add(styles.inputErrorPulse);
                              window.setTimeout(
                                () =>
                                  el.classList.remove(styles.inputErrorPulse),
                                1000
                              );
                            };
                            if (!Number.isFinite(r)) pulse(roundEl);
                            if (!Number.isFinite(p)) pulse(pickEl);
                            const pulseGroup = (
                              groupEl: HTMLDivElement | null
                            ) => {
                              if (!groupEl) return;
                              groupEl.classList.remove(
                                styles.rosterStepperError
                              );
                              (groupEl as any).offsetWidth;
                              groupEl.classList.add(styles.rosterStepperError);
                              window.setTimeout(() => {
                                groupEl.classList.remove(
                                  styles.rosterStepperError
                                );
                              }, 1000);
                            };
                            if (!Number.isFinite(r))
                              pulseGroup(keeperRoundStepperRef.current);
                            if (!Number.isFinite(p))
                              pulseGroup(keeperPickStepperRef.current);
                          }
                        }}
                      >
                        +
                      </button>
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
                          key={`${k.round}-${k.pickInRound}`}
                          className={styles.inlineItemRow}
                        >
                          <span>
                            {k.round}-{k.pickInRound} →{" "}
                            {customTeamNames[k.teamId] || k.teamId} (Player{" "}
                            {k.playerId})
                          </span>
                          {onRemoveKeeper && (
                            <button
                              type="button"
                              className={styles.inlineResetBtn}
                              onClick={() =>
                                onRemoveKeeper(k.round, k.pickInRound)
                              }
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
      )}
      {showWeightsPopover && (
        <div
          className={styles.weightsPopoverOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Edit Projection Source Weights"
          onClick={handleOverlayClick}
        >
          <div className={styles.weightsPopover} ref={popoverRef}>
            <div className={styles.weightsPopoverHeader}>
              <div className={styles.weightsPopoverTitle}>
                Projection Weights
              </div>
              <div className={styles.weightsHeaderControls}>
                <label className={styles.popoverInlineLabel}>
                  <input
                    type="checkbox"
                    checked={autoNormalize}
                    onChange={(e) => setAutoNormalize(e.target.checked)}
                    aria-label="Auto normalize weights"
                  />{" "}
                  Auto
                </label>
                <button
                  type="button"
                  className={styles.inlineResetBtn}
                  onClick={handleNormalizeAll}
                  disabled={isNormalized}
                >
                  Normalize
                </button>
                <button
                  type="button"
                  className={styles.closePopoverBtn}
                  aria-label="Close"
                  onClick={() => setShowWeightsPopover(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div>
              <div className={styles.popoverSectionTitle}>Skater Sources</div>
              <div
                className={styles.popoverGrid}
                data-testid="weights-popover-skaters"
              >
                {sourceControls &&
                  orderSources(sourceControls)
                    .filter(
                      ([id]) =>
                        PROJECTION_SOURCES_CONFIG.some(
                          (s) => s.id === id && s.playerType === "skater"
                        ) || id === "custom_csv"
                    )
                    .map(([id, ctrl]) => {
                      const src = PROJECTION_SOURCES_CONFIG.find(
                        (s) => s.id === id
                      );
                      const isCustom = id === "custom_csv";
                      const displayName = isCustom
                        ? customSourceLabel || "Custom CSV"
                        : src?.displayName || id;
                      const weightVal = pendingSourceWeights[id] ?? ctrl.weight;
                      const share =
                        ctrl.isSelected && totalActiveSourceWeight > 0
                          ? (
                              (weightVal / totalActiveSourceWeight) *
                              100
                            ).toFixed(0) + "%"
                          : "-";
                      return (
                        <div
                          key={id}
                          className={`${styles.popoverSourceCard} ${!ctrl.isSelected ? styles.popoverSourceCardDisabled : ""}`}
                        >
                          <div className={styles.popoverSourceHeader}>
                            <label
                              className={styles.popoverInlineLabel}
                              htmlFor={`popover-skater-${id}`}
                            >
                              <input
                                id={`popover-skater-${id}`}
                                type="checkbox"
                                checked={ctrl.isSelected}
                                onChange={(e) =>
                                  onSourceControlsChange &&
                                  onSourceControlsChange({
                                    ...sourceControls,
                                    [id]: {
                                      isSelected: e.target.checked,
                                      weight: ctrl.weight
                                    }
                                  })
                                }
                                aria-label={`Toggle source ${displayName}`}
                              />
                              <span className={styles.popoverSourceName}>
                                {displayName}
                              </span>
                            </label>
                            <span className={styles.shareBadge}>{share}</span>
                          </div>
                          <div className={styles.popoverSliderRow}>
                            <input
                              type="range"
                              min={0}
                              max={2}
                              step={0.1}
                              value={weightVal}
                              onChange={(e) =>
                                applyDebouncedSourceWeight(
                                  id,
                                  parseFloat(e.target.value)
                                )
                              }
                              disabled={!ctrl.isSelected}
                              aria-label={`${displayName} weight`}
                              aria-valuetext={`${weightVal.toFixed(1)}x`}
                              className={`${styles.rangeInput} ${styles.popoverSlider}`}
                            />
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              max={2}
                              value={weightVal}
                              onChange={(e) =>
                                handleDirectWeightInput(
                                  id,
                                  parseFloat(e.target.value || "0"),
                                  false
                                )
                              }
                              disabled={!ctrl.isSelected}
                              className={styles.weightNumberInput}
                              aria-label={`${displayName} numeric weight`}
                            />
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
            {goalieSourceControls && (
              <div className={styles.sectionSpacer}>
                <div className={styles.popoverSectionTitle}>Goalie Sources</div>
                <div
                  className={styles.popoverGrid}
                  data-testid="weights-popover-goalies"
                >
                  {goalieSourceControls &&
                    orderSources(goalieSourceControls)
                      .filter(([id]) =>
                        PROJECTION_SOURCES_CONFIG.some(
                          (s) => s.id === id && s.playerType === "goalie"
                        )
                      )
                      .map(([id, ctrl]) => {
                        const src = PROJECTION_SOURCES_CONFIG.find(
                          (s) => s.id === id
                        );
                        const displayName = src?.displayName || id;
                        const weightVal =
                          pendingGoalieSourceWeights[id] ?? ctrl.weight;
                        const share =
                          ctrl.isSelected && totalActiveGoalieSourceWeight > 0
                            ? (
                                (weightVal / totalActiveGoalieSourceWeight) *
                                100
                              ).toFixed(0) + "%"
                            : "-";
                        return (
                          <div
                            key={id}
                            className={`${styles.popoverSourceCard} ${!ctrl.isSelected ? styles.popoverSourceCardDisabled : ""}`}
                          >
                            <div className={styles.popoverSourceHeader}>
                              <label
                                className={styles.popoverInlineLabel}
                                htmlFor={`popover-goalie-${id}`}
                              >
                                <input
                                  id={`popover-goalie-${id}`}
                                  type="checkbox"
                                  checked={ctrl.isSelected}
                                  onChange={(e) =>
                                    onGoalieSourceControlsChange &&
                                    onGoalieSourceControlsChange({
                                      ...goalieSourceControls,
                                      [id]: {
                                        isSelected: e.target.checked,
                                        weight: ctrl.weight
                                      }
                                    })
                                  }
                                  aria-label={`Toggle source ${displayName}`}
                                />
                                <span className={styles.popoverSourceName}>
                                  {displayName}
                                </span>
                              </label>
                              <span className={styles.shareBadge}>{share}</span>
                            </div>
                            <div className={styles.popoverSliderRow}>
                              <input
                                type="range"
                                min={0}
                                max={2}
                                step={0.1}
                                value={weightVal}
                                onChange={(e) =>
                                  applyDebouncedGoalieSourceWeight(
                                    id,
                                    parseFloat(e.target.value)
                                  )
                                }
                                disabled={!ctrl.isSelected}
                                aria-label={`${displayName} weight`}
                                aria-valuetext={`${weightVal.toFixed(1)}x`}
                                className={`${styles.rangeInput} ${styles.popoverSlider}`}
                              />
                              <input
                                type="number"
                                step={0.1}
                                min={0}
                                max={2}
                                value={weightVal}
                                onChange={(e) =>
                                  handleDirectWeightInput(
                                    id,
                                    parseFloat(e.target.value || "0"),
                                    true
                                  )
                                }
                                disabled={!ctrl.isSelected}
                                className={styles.weightNumberInput}
                                aria-label={`${displayName} numeric weight`}
                              />
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftSettings;

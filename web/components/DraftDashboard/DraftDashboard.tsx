// components/DraftDashboard/DraftDashboard.tsx

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  useProcessedProjectionsData,
  ProcessedPlayer, // Add this import
} from "hooks/useProcessedProjectionsData";
import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import useCurrentSeason from "hooks/useCurrentSeason";
import supabase from "lib/supabase";

import DraftSettings from "./DraftSettings";
import DraftBoard from "./DraftBoard";
import MyRoster from "./MyRoster";
import ProjectionsTable from "./ProjectionsTable";
import { useVORPCalculations } from "hooks/useVORPCalculations";
import SuggestedPicks from "./SuggestedPicks";
import DraftSummaryModal from "./DraftSummaryModal";
import ImportCsvModal from "./ImportCsvModal";
import ComparePlayersModal from "./ComparePlayersModal";
import ProjectionSourceAccuracy from "./ProjectionSourceAccuracy";
import {
  clearCustomCsvSession,
  loadCustomCsvSession,
  saveCustomCsvSession,
  type SessionCsvEntry,
} from "lib/draftDashboard/csvImportSession";
import {
  createDefaultSourceControls,
  loadSourceControlPreferences,
  saveSourceControlPreferences,
} from "lib/draftDashboard/sourceControlPreferences";
import {
  calculateSourceRankImpacts,
  rankProjectionPlayers,
  type SourceRankImpact,
} from "lib/draftDashboard/sourceRankImpact";
import type { CustomAdditionalProjectionSource } from "hooks/useProcessedProjectionsData";
import {
  allocateGroupedRosterSlots,
  getEffectiveRosterConfig,
  getRosterPositions,
  loadForwardGroupingPreference,
  normalizePlayerEligibility,
  saveForwardGroupingPreference,
} from "lib/draftDashboard/forwardGrouping";
import {
  getNextOpenPick,
  materializeKeeperPicks,
  migrateKeeperEntries,
  parseKeeperImport,
  validateKeeperBatch,
  validateKeeperCandidate,
  type KeeperEntry,
} from "lib/draftDashboard/keepers";
import {
  findPicksUntilTeamTurn,
  migratePickTrades,
  parsePickTradeImport,
  resolvePickOwner,
  tradeOwnerOverrides,
  upsertPickTrade,
  validatePickTradeBatch,
  type PickTradeEntry,
} from "lib/draftDashboard/pickTrades";
import {
  buildDraftConfigurationSummary,
  toCustomSourceMetadata,
} from "lib/draftDashboard/summaryConfiguration";
import { isGlobalShortcutBlockedTarget } from "lib/draftDashboard/keyboardShortcuts";
import { buildProjectionFreshnessNotices } from "lib/draftDashboard/projectionFreshness";

import styles from "./DraftDashboard.module.scss";

// Data Models from PRD
export interface DraftSettings {
  teamCount: number;
  scoringCategories: Record<string, number>;
  leagueType?: "points" | "categories";
  categoryWeights?: Record<string, number>; // used in categories mode
  // Whether this is a keeper league. Controls visibility of Keepers & Traded Picks section.
  isKeeper?: boolean;
  // Custom source safeguards
  allowCustomNameFallback?: boolean;
  customSourceMinimumCoverage?: number; // percentage 0-100
  rosterConfig: {
    [position: string]: number;
    bench: number;
    utility: number;
  };
  draftOrder: string[];
}

export interface DraftedPlayer {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  isKeeper?: boolean;
  keeperVersion?: number;
}

export interface TeamDraftStats {
  teamId: string;
  teamName: string;
  owner: string;
  projectedPoints: number;
  categoryTotals: Record<string, number>;
  rosterSlots: {
    [position: string]: DraftedPlayer[];
  };
  bench: DraftedPlayer[];
  // NEW: total team VORP (sum of player VORP)
  teamVorp?: number;
}

export interface VORPCalculation {
  playerId: string;
  playerName: string;
  position: string;
  projectedPoints: number;
  replacementPlayerPoints: number;
  vorp: number;
  positionalRank: number;
  overallRank: number;
}

const DEFAULT_DRAFT_SETTINGS: DraftSettings = {
  teamCount: 12,
  scoringCategories: getDefaultFantasyPointsConfig("skater"),
  leagueType: "points",
  isKeeper: false,
  allowCustomNameFallback: true,
  customSourceMinimumCoverage: 25,
  categoryWeights: {
    GOALS: 1,
    ASSISTS: 1,
    PP_POINTS: 1,
    SHOTS_ON_GOAL: 1,
    HITS: 1,
    BLOCKED_SHOTS: 1,
    WINS_GOALIE: 1,
    SAVES_GOALIE: 1,
    SAVE_PERCENTAGE: 1,
  },
  rosterConfig: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    bench: 4,
    utility: 1,
  },
  draftOrder: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`),
};

const DraftDashboard: React.FC = () => {
  const currentSeason = useCurrentSeason();
  const currentSeasonId = currentSeason?.seasonId;

  // Draft State
  const [draftSettings, setDraftSettings] = useState<DraftSettings>(
    DEFAULT_DRAFT_SETTINGS,
  );
  // Ensure baseline goalie categories appear in categories leagues if user has none.
  useEffect(() => {
    if (draftSettings.leagueType !== "categories") return;
    const cw = draftSettings.categoryWeights || {};
    const goalieKeys = ["WINS_GOALIE", "SAVES_GOALIE", "SAVE_PERCENTAGE"];
    if (!goalieKeys.some((k) => k in cw)) {
      setDraftSettings((prev) => ({
        ...prev,
        categoryWeights: {
          ...prev.categoryWeights,
          WINS_GOALIE: 1,
          SAVES_GOALIE: 1,
          SAVE_PERCENTAGE: 1,
        },
      }));
    }
  }, [draftSettings.leagueType, draftSettings.categoryWeights]);
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  // Explicit per-player slot overrides (C/LW/RW/FWD/D/G/UTILITY)
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, string>
  >({});
  const [currentPick, setCurrentPick] = useState<number>(1);
  const [isSnakeDraft, setIsSnakeDraft] = useState<boolean>(true);
  const [myTeamId, setMyTeamId] = useState<string>("Team 1");
  // NEW: baseline mode for VORP replacement source (persisted)
  const [baselineMode, setBaselineMode] = useState<"remaining" | "full">(
    "remaining",
  );
  // NEW: need-weighting toggle for VBD adjustments (persisted)
  const [needWeightEnabled, setNeedWeightEnabled] = useState<boolean>(false);
  // NEW: alpha strength for need weighting (persisted)
  const [needAlpha, setNeedAlpha] = useState<number>(0.5);
  // Guard to ensure we don't overwrite saved session before offering resume
  const [sessionReady, setSessionReady] = React.useState(false);
  const resumeAttemptedRef = React.useRef(false);

  // NEW: Forward grouping mode (split C/LW/RW vs combined FWD)
  const [forwardGrouping, setForwardGrouping] = useState<"split" | "fwd">(
    () => {
      if (typeof window === "undefined") return "split";
      return loadForwardGroupingPreference(window.localStorage);
    },
  );
  // NEW: personalized replacement toggle
  const [personalizeReplacement, setPersonalizeReplacement] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      return (
        window.localStorage.getItem(
          "draftDashboard.personalizeReplacement.v1",
        ) === "true"
      );
    },
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "draftDashboard.personalizeReplacement.v1",
      String(personalizeReplacement),
    );
  }, [personalizeReplacement]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    saveForwardGroupingPreference(window.localStorage, forwardGrouping);
  }, [forwardGrouping]);

  // NEW: Traded pick ownership overrides and keeper entries
  const [pickTrades, setPickTrades] = useState<PickTradeEntry[]>([]);
  const pickOwnerOverrides = useMemo(
    () => tradeOwnerOverrides(pickTrades),
    [pickTrades],
  );
  const [keepers, setKeepers] = useState<KeeperEntry[]>([]);

  // Add custom team names state
  const [customTeamNames, setCustomTeamNames] = useState<
    Record<string, string>
  >(() => {
    // Initialize with default team names
    const initialNames: Record<string, string> = {};
    DEFAULT_DRAFT_SETTINGS.draftOrder.forEach((teamId, index) => {
      initialNames[teamId] = `Team ${index + 1}`;
    });
    return initialNames;
  });

  // Add draft history for undo functionality
  const [draftHistory, setDraftHistory] = useState<
    {
      players: DraftedPlayer[];
      pickNumber: number;
    }[]
  >([]);

  // Add summary modal state
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [suggestedCompareIds, setSuggestedCompareIds] = useState<string[]>([]);
  const [suggestedCompareOpen, setSuggestedCompareOpen] = useState(false);

  // Import CSV modal state
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  // New: Custom CSV source label (from session import)
  const [customCsvLabel, setCustomCsvLabel] = useState<string | undefined>(
    undefined,
  );
  // Multi-CSV rows live in memory with a versioned, tab-scoped fallback only.
  const [customCsvList, setCustomCsvList] = useState<SessionCsvEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return loadCustomCsvSession();
  });
  const getCsvList = useCallback(() => customCsvList, [customCsvList]);
  const setCsvList = useCallback((next: SessionCsvEntry[]) => {
    if (typeof window === "undefined") return;
    try {
      setCustomCsvList(next);
      saveCustomCsvSession(next);
    } catch {}
  }, []);

  // Snapshot V2 will be defined after dependent state declarations

  // Projection Data Setup
  const sourceControlDefaults = useMemo(
    () => ({
      skater: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "skater"),
      goalie: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "goalie"),
    }),
    [],
  );
  const initialSourcePreferences = useMemo(() => {
    if (typeof window === "undefined") {
      return { version: 4 as const, ...sourceControlDefaults };
    }
    return loadSourceControlPreferences(sourceControlDefaults);
  }, [sourceControlDefaults]);
  const [sourceControls, setSourceControls] = useState(
    initialSourcePreferences.skater,
  );

  // NEW: Goalie projection source controls
  const [goalieSourceControls, setGoalieSourceControls] = useState(
    initialSourcePreferences.goalie,
  );
  const sourceControlSignature = useMemo(
    () =>
      JSON.stringify({ skater: sourceControls, goalie: goalieSourceControls }),
    [goalieSourceControls, sourceControls],
  );
  const latestSourceControlSignatureRef = useRef(sourceControlSignature);
  latestSourceControlSignatureRef.current = sourceControlSignature;
  const previousSourceRanksRef = useRef<{
    signature: string;
    ranks: Record<string, number>;
  } | null>(null);
  const [sourceRankImpacts, setSourceRankImpacts] = useState<
    Record<string, SourceRankImpact>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      try {
        saveSourceControlPreferences(
          { version: 4, skater: sourceControls, goalie: goalieSourceControls },
          sourceControlDefaults,
        );
      } catch {}
    }, 180);
    return () => window.clearTimeout(timer);
  }, [goalieSourceControls, sourceControlDefaults, sourceControls]);

  // NEW: Goalie scoring values (editable via settings)
  const [goaliePointValues, setGoaliePointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("goalie"));

  // --- Snapshot V2: save & load full session (after state declarations) ---
  type DraftSnapshotV2 = {
    v: 2;
    ts: number;
    draftSettings: DraftSettings;
    draftedPlayers: DraftedPlayer[];
    keepers: KeeperEntry[];
    pickOwnerOverrides: Record<string, string>;
    pickTrades?: PickTradeEntry[];
    positionOverrides: Record<string, string>;
    customTeamNames: Record<string, string>;
    currentPick: number;
    isSnakeDraft: boolean;
    myTeamId: string;
    baselineMode: "remaining" | "full";
    needWeightEnabled: boolean;
    needAlpha: number;
    forwardGrouping: "split" | "fwd";
    personalizeReplacement: boolean;
    goaliePointValues: Record<string, number>;
    sourceControls: Record<string, { isSelected: boolean; weight: number }>;
    goalieSourceControls: Record<
      string,
      { isSelected: boolean; weight: number }
    >;
    customCsvList: SessionCsvEntry[];
  };

  const saveSnapshot = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload: DraftSnapshotV2 = {
      v: 2,
      ts: Date.now(),
      draftSettings,
      draftedPlayers,
      keepers,
      pickOwnerOverrides,
      pickTrades,
      positionOverrides,
      customTeamNames,
      currentPick,
      isSnakeDraft,
      myTeamId,
      baselineMode,
      needWeightEnabled,
      needAlpha,
      forwardGrouping,
      personalizeReplacement,
      goaliePointValues,
      sourceControls,
      goalieSourceControls,
      customCsvList: getCsvList(),
    };
    try {
      sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(payload));
    } catch {}
  }, [
    draftSettings,
    draftedPlayers,
    keepers,
    pickOwnerOverrides,
    pickTrades,
    positionOverrides,
    customTeamNames,
    currentPick,
    isSnakeDraft,
    myTeamId,
    baselineMode,
    needWeightEnabled,
    needAlpha,
    forwardGrouping,
    personalizeReplacement,
    goaliePointValues,
    sourceControls,
    goalieSourceControls,
    getCsvList,
  ]);

  const loadSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem("draft.snapshot.v2");
      if (!raw) return false;
      const snap = JSON.parse(raw) as DraftSnapshotV2;
      if (snap.v !== 2) return false;
      setDraftSettings({
        ...DEFAULT_DRAFT_SETTINGS,
        ...snap.draftSettings,
        allowCustomNameFallback:
          snap.draftSettings?.allowCustomNameFallback ?? true,
        customSourceMinimumCoverage:
          typeof snap.draftSettings?.customSourceMinimumCoverage === "number"
            ? snap.draftSettings.customSourceMinimumCoverage
            : 25,
      });
      const restoredKeepers = migrateKeeperEntries(
        snap.keepers,
        snap.draftSettings?.teamCount || DEFAULT_DRAFT_SETTINGS.teamCount,
      );
      setKeepers(restoredKeepers);
      setDraftedPlayers(
        materializeKeeperPicks(snap.draftedPlayers || [], restoredKeepers),
      );
      setPickTrades(
        migratePickTrades(snap.pickTrades ?? snap.pickOwnerOverrides, {
          draftOrder:
            snap.draftSettings?.draftOrder || DEFAULT_DRAFT_SETTINGS.draftOrder,
          roundCount: Object.values(
            snap.draftSettings?.rosterConfig ||
              DEFAULT_DRAFT_SETTINGS.rosterConfig,
          ).reduce((sum, count) => sum + Number(count || 0), 0),
          isSnakeDraft: !!snap.isSnakeDraft,
        }),
      );
      setPositionOverrides(snap.positionOverrides || {});
      setCustomTeamNames(snap.customTeamNames || {});
      setCurrentPick(snap.currentPick || 1);
      setIsSnakeDraft(!!snap.isSnakeDraft);
      setMyTeamId(snap.myTeamId || "Team 1");
      setBaselineMode(snap.baselineMode || "remaining");
      setNeedWeightEnabled(!!snap.needWeightEnabled);
      setNeedAlpha(typeof snap.needAlpha === "number" ? snap.needAlpha : 0.5);
      setForwardGrouping(snap.forwardGrouping || "split");
      setPersonalizeReplacement(!!snap.personalizeReplacement);
      setGoaliePointValues(
        snap.goaliePointValues || getDefaultFantasyPointsConfig("goalie"),
      );
      setSourceControls(snap.sourceControls || {});
      setGoalieSourceControls(snap.goalieSourceControls || {});
      if (Array.isArray(snap.customCsvList)) setCsvList(snap.customCsvList);
      return true;
    } catch {
      return false;
    }
  }, [setCsvList]);

  // On mount: offer to resume snapshot
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;
    const raw = sessionStorage.getItem("draft.snapshot.v2");
    if (raw) {
      const ok = window.confirm("Resume your last Draft Dashboard session?");
      if (ok) loadSnapshot();
    }
    setSessionReady(true);
  }, [loadSnapshot]);

  // Persist snapshot as state changes
  useEffect(() => {
    if (!sessionReady) return;
    saveSnapshot();
  }, [sessionReady, saveSnapshot]);

  // Get player projections data (skaters)
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);
  const skaterData = useProcessedProjectionsData({
    activePlayerType: "skater",
    sourceControls,
    yahooDraftMode: "ALL",
    fantasyPointSettings: draftSettings.scoringCategories,
    supabaseClient: supabase,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    styles: {},
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: () => {},
    teamCountForRoundSummaries: draftSettings.teamCount,
    // inject custom CSVs as additional sources for skaters
    customAdditionalSources: (() => {
      const list = getCsvList();
      if (!list.length) return undefined;
      const COL_TO_STAT: Record<string, string> = {
        Games_Played: "GAMES_PLAYED",
        Goals: "GOALS",
        Assists: "ASSISTS",
        Points: "POINTS",
        Plus_Minus: "PLUS_MINUS",
        Shots_on_Goal: "SHOTS_ON_GOAL",
        Hits: "HITS",
        Blocked_Shots: "BLOCKED_SHOTS",
        Penalty_Minutes: "PENALTY_MINUTES",
        PP_Points: "PP_POINTS",
        PP_Goals: "PP_GOALS",
        PP_Assists: "PP_ASSISTS",
        SH_Points: "SH_POINTS",
        SH_Goals: "SH_GOALS",
        Time_on_Ice_Per_Game: "TIME_ON_ICE_PER_GAME",
        Faceoffs_Won: "FACEOFFS_WON",
        Faceoffs_Lost: "FACEOFFS_LOST",
      };
      const statMappings = Object.entries(COL_TO_STAT).map(([col, key]) => ({
        key: key as any,
        dbColumnName: col,
      }));
      return list
        .map((entry) => {
          const rows = (entry.rows || []).filter((r) => {
            const pos = String(r["Position"] || "").toUpperCase();
            return !pos
              .split(",")
              .map((s: string) => s.trim())
              .includes("G");
          });
          if (!rows.length) return undefined as any;
          const src: CustomAdditionalProjectionSource = {
            id: entry.id,
            displayName: entry.label || entry.id,
            playerType: "skater",
            rows,
            primaryPlayerIdKey: "player_id",
            originalPlayerNameKey: "Player_Name",
            teamKey: "Team_Abbreviation",
            positionKey: "Position",
            statMappings,
            resolution: entry.resolution,
          };
          return src;
        })
        .filter(Boolean) as CustomAdditionalProjectionSource[];
    })(),
    refreshKey: dataRefreshKey,
    allowCustomNameFallback: draftSettings.allowCustomNameFallback ?? true,
  });

  // Get player projections data (goalies) - use editable goalie points config
  const goalieData = useProcessedProjectionsData({
    activePlayerType: "goalie",
    sourceControls: goalieSourceControls,
    yahooDraftMode: "ALL",
    fantasyPointSettings: goaliePointValues,
    supabaseClient: supabase,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    styles: {},
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: () => {},
    teamCountForRoundSummaries: draftSettings.teamCount,
    customAdditionalSources: (() => {
      const list = getCsvList();
      if (!list.length) return undefined;
      const COL_TO_STAT: Record<string, string> = {
        Games_Played: "GAMES_PLAYED",
        Wins_Goalie: "WINS_GOALIE",
        Losses_Goalie: "LOSSES_GOALIE",
        Otl: "OTL_GOALIE",
        Saves_Goalie: "SAVES_GOALIE",
        Sa: "SHOTS_AGAINST_GOALIE",
        Ga: "GOALS_AGAINST_GOALIE",
        Save_Percentage: "SAVE_PERCENTAGE",
        Goals_Against_Average: "GOALS_AGAINST_AVERAGE",
        Shutouts_Goalie: "SHUTOUTS_GOALIE",
      };
      const statMappings = Object.entries(COL_TO_STAT).map(([col, key]) => ({
        key: key as any,
        dbColumnName: col,
      }));
      return list
        .map((entry) => {
          const rows = (entry.rows || []).filter((r) => {
            const pos = String(r["Position"] || "").toUpperCase();
            return pos
              .split(",")
              .map((s: string) => s.trim())
              .includes("G");
          });
          if (!rows.length) return undefined as any;
          const src: CustomAdditionalProjectionSource = {
            id: entry.id,
            displayName: entry.label || entry.id,
            playerType: "goalie",
            rows,
            primaryPlayerIdKey: "player_id",
            originalPlayerNameKey: "Player_Name",
            teamKey: "Team_Abbreviation",
            positionKey: "Position",
            statMappings,
            resolution: entry.resolution,
          };
          return src;
        })
        .filter(Boolean) as CustomAdditionalProjectionSource[];
    })(),
    refreshKey: dataRefreshKey,
    allowCustomNameFallback: draftSettings.allowCustomNameFallback ?? true,
  });

  const mergedCustomResolutions = useMemo(
    () => ({
      ...(skaterData.customSourceResolutions || {}),
      ...(goalieData.customSourceResolutions || {}),
    }),
    [skaterData.customSourceResolutions, goalieData.customSourceResolutions],
  );

  const skaterFallbackCount = skaterData.customFallbackUsage?.total ?? 0;
  const goalieFallbackCount = goalieData.customFallbackUsage?.total ?? 0;

  const onlyCustomSkater = useMemo(() => {
    const selected = Object.entries(sourceControls).filter(
      ([, ctrl]) => ctrl.isSelected,
    );
    return (
      selected.length > 0 &&
      selected.every(([id]) => id.startsWith("custom_csv"))
    );
  }, [sourceControls]);

  const onlyCustomGoalie = useMemo(() => {
    const selected = Object.entries(goalieSourceControls).filter(
      ([, ctrl]) => ctrl.isSelected,
    );
    return (
      selected.length > 0 &&
      selected.every(([id]) => id.startsWith("custom_csv"))
    );
  }, [goalieSourceControls]);

  const fallbackBannerMessages = useMemo(() => {
    const messages: string[] = [];
    if (onlyCustomSkater && skaterFallbackCount > 0) {
      messages.push(
        `${skaterFallbackCount} skater${skaterFallbackCount === 1 ? "" : "s"}`,
      );
    }
    if (onlyCustomGoalie && goalieFallbackCount > 0) {
      messages.push(
        `${goalieFallbackCount} goalie${goalieFallbackCount === 1 ? "" : "s"}`,
      );
    }
    return messages;
  }, [
    onlyCustomSkater,
    skaterFallbackCount,
    onlyCustomGoalie,
    goalieFallbackCount,
  ]);

  const showFallbackBanner =
    (draftSettings.allowCustomNameFallback ?? true) &&
    fallbackBannerMessages.length > 0;

  const coverageThreshold = draftSettings.customSourceMinimumCoverage ?? 25;
  const lowCoverageSources = useMemo(
    () =>
      Object.entries(mergedCustomResolutions).filter(
        ([, res]) => res && res.coverage * 100 < coverageThreshold,
      ),
    [mergedCustomResolutions, coverageThreshold],
  );

  // Restore persisted baselineMode
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("draftDashboard.baselineMode");
    if (saved === "remaining" || saved === "full") setBaselineMode(saved);
  }, []);
  // Persist baselineMode
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("draftDashboard.baselineMode", baselineMode);
  }, [baselineMode]);
  // Restore/persist needWeightEnabled
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("draftDashboard.needWeight.v1");
    if (saved === "true" || saved === "false")
      setNeedWeightEnabled(saved === "true");
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "draftDashboard.needWeight.v1",
      String(needWeightEnabled),
    );
  }, [needWeightEnabled]);
  // Restore/persist needAlpha
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("draftDashboard.needAlpha.v1");
    if (saved != null) {
      const v = parseFloat(saved);
      if (!Number.isNaN(v)) setNeedAlpha(Math.max(0, Math.min(1, v)));
    }
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "draftDashboard.needAlpha.v1",
      String(needAlpha),
    );
  }, [needAlpha]);

  // Resume Draft: load saved session on mount (once)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (resumeAttemptedRef.current) return; // prevent double-run in StrictMode
    resumeAttemptedRef.current = true;
    try {
      const raw = window.localStorage.getItem("draftDashboard.session.v1");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          const ok = window.confirm("Resume draft from previous session?");
          if (ok) {
            if (saved.draftSettings) setDraftSettings(saved.draftSettings);
            const restoredKeepers = migrateKeeperEntries(
              saved.keepers,
              saved.draftSettings?.teamCount ||
                DEFAULT_DRAFT_SETTINGS.teamCount,
            );
            setKeepers(restoredKeepers);
            setDraftedPlayers(
              materializeKeeperPicks(
                Array.isArray(saved.draftedPlayers) ? saved.draftedPlayers : [],
                restoredKeepers,
              ),
            );
            if (typeof saved.currentPick === "number")
              setCurrentPick(saved.currentPick);
            if (typeof saved.isSnakeDraft === "boolean")
              setIsSnakeDraft(saved.isSnakeDraft);
            if (typeof saved.myTeamId === "string") setMyTeamId(saved.myTeamId);
            if (saved.customTeamNames)
              setCustomTeamNames(saved.customTeamNames);
            if (
              saved.forwardGrouping === "fwd" ||
              saved.forwardGrouping === "split"
            )
              setForwardGrouping(saved.forwardGrouping);
            setPickTrades(
              migratePickTrades(saved.pickTrades ?? saved.pickOwnerOverrides, {
                draftOrder:
                  saved.draftSettings?.draftOrder ||
                  DEFAULT_DRAFT_SETTINGS.draftOrder,
                roundCount: Object.values(
                  saved.draftSettings?.rosterConfig ||
                    DEFAULT_DRAFT_SETTINGS.rosterConfig,
                ).reduce<number>((sum, count) => sum + Number(count || 0), 0),
                isSnakeDraft: !!saved.isSnakeDraft,
              }),
            );
          } else {
            // Fresh start: clear saved draft and any session CSV artifacts
            try {
              window.localStorage.removeItem("draftDashboard.session.v1");
            } catch {}
            try {
              sessionStorage.setItem("draft.resume.declined", "true");
              clearCustomCsvSession();
            } catch {}
            setSourceControls((prev) => {
              const next = { ...prev } as any;
              delete next.custom_csv;
              return next as typeof prev;
            });
            setCustomCsvLabel(undefined);
          }
        }
      }
    } catch {
    } finally {
      // Allow persistence after resume decision (or if none existed)
      setSessionReady(true);
    }
  }, []);

  // Restore tab-scoped custom source controls without copying row payloads to localStorage.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Skip restoring if user declined to resume saved session on this load
      const declined =
        sessionStorage.getItem("draft.resume.declined") === "true";
      if (declined) {
        sessionStorage.removeItem("draft.resume.declined");
        return;
      }
      if (!customCsvList.length) return;
      setCustomCsvLabel(customCsvList.at(-1)?.label || "Custom CSV");
      setSourceControls((prev) => {
        const next = { ...prev };
        for (const entry of customCsvList) {
          next[entry.id] ||= { isSelected: true, weight: 1 };
        }
        return next;
      });
      setGoalieSourceControls((prev) => {
        const next = { ...prev };
        for (const entry of customCsvList) {
          next[entry.id] ||= { isSelected: true, weight: 1 };
        }
        return next;
      });
    } catch {}
  }, [customCsvList]);

  // Persist session on change (only after resume decision)
  React.useEffect(() => {
    if (!sessionReady) return;
    if (typeof window === "undefined") return;
    const payload = {
      version: 1,
      draftSettings,
      draftedPlayers,
      currentPick,
      isSnakeDraft,
      myTeamId,
      customTeamNames,
      forwardGrouping,
      pickOwnerOverrides,
      pickTrades,
      keepers,
    };
    try {
      window.localStorage.setItem(
        "draftDashboard.session.v1",
        JSON.stringify(payload),
      );
    } catch {}
  }, [
    sessionReady,
    draftSettings,
    draftedPlayers,
    currentPick,
    isSnakeDraft,
    myTeamId,
    customTeamNames,
    forwardGrouping,
    keepers,
    pickOwnerOverrides,
    pickTrades,
  ]);

  // Calculate current turn and team
  const currentTurn = useMemo(() => {
    const round = Math.ceil(currentPick / draftSettings.teamCount);
    const pickInRound = ((currentPick - 1) % draftSettings.teamCount) + 1;

    const teamId = resolvePickOwner({
      round,
      pickInRound,
      draftOrder: draftSettings.draftOrder,
      isSnakeDraft,
      trades: pickTrades,
      keepers,
    }).currentTeamId;

    return {
      round,
      pickInRound,
      teamId,
      isMyTurn: teamId === myTeamId,
    };
  }, [
    currentPick,
    draftSettings.teamCount,
    draftSettings.draftOrder,
    isSnakeDraft,
    myTeamId,
    pickTrades,
    keepers,
  ]);

  // Add team name update function
  const updateTeamName = useCallback((teamId: string, newName: string) => {
    setCustomTeamNames((prev) => ({
      ...prev,
      [teamId]: newName,
    }));
  }, []);

  // Compute all players array from both skater and goalie data
  const skaterPlayers: ProcessedPlayer[] = useMemo(
    () =>
      skaterData.processedPlayers.filter(
        (p): p is ProcessedPlayer => !("type" in p),
      ),
    [skaterData.processedPlayers],
  );
  const goaliePlayers: ProcessedPlayer[] = useMemo(
    () =>
      goalieData.processedPlayers.filter(
        (p): p is ProcessedPlayer => !("type" in p),
      ),
    [goalieData.processedPlayers],
  );

  const allPlayers: ProcessedPlayer[] = useMemo(
    () => [...skaterPlayers, ...goaliePlayers],
    [skaterPlayers, goaliePlayers],
  );

  useEffect(() => {
    if (skaterData.isLoading || goalieData.isLoading || !allPlayers.length)
      return;
    const ranks = rankProjectionPlayers(allPlayers);
    const previous = previousSourceRanksRef.current;
    const completedSignature = latestSourceControlSignatureRef.current;
    if (previous && previous.signature !== completedSignature) {
      setSourceRankImpacts(calculateSourceRankImpacts(previous.ranks, ranks));
    }
    previousSourceRanksRef.current = { signature: completedSignature, ranks };
  }, [allPlayers, goalieData.isLoading, skaterData.isLoading]);

  // NEW: derive available stat keys (skater vs goalie) from projections + custom CSV
  const { availableSkaterStatKeys, availableGoalieStatKeys } = useMemo(() => {
    const skaterKeys = new Set<string>();
    const goalieKeys = new Set<string>();
    allPlayers.forEach((p) => {
      const pos = (p.displayPosition || "").toUpperCase();
      const isGoalie = pos
        .split(",")
        .map((s) => s.trim())
        .includes("G");
      const target = isGoalie ? goalieKeys : skaterKeys;
      Object.keys(p.combinedStats || {}).forEach((k) => target.add(k));
    });
    return {
      availableSkaterStatKeys: Array.from(skaterKeys).sort(),
      availableGoalieStatKeys: Array.from(goalieKeys).sort(),
    };
  }, [allPlayers]);

  const availablePlayers = useMemo(() => {
    const draftedPlayerIds = new Set(draftedPlayers.map((p) => p.playerId));
    return allPlayers.filter((p) => !draftedPlayerIds.has(String(p.playerId)));
  }, [allPlayers, draftedPlayers]);

  // Track prorate82 toggle (shared via localStorage)
  const [prorate82, setProrate82] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("projections.prorate82") === "true";
  });
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail && typeof e.detail.value === "boolean") {
        setProrate82(e.detail.value);
      } else {
        // fallback read
        setProrate82(
          window.localStorage.getItem("projections.prorate82") === "true",
        );
      }
    };
    window.addEventListener("projections:prorate82", handler as any);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "projections.prorate82") {
        setProrate82(ev.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("projections:prorate82", handler as any);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Build TeamRosterSelect options from current draft order and custom names
  const teamOptions = useMemo(
    () =>
      draftSettings.draftOrder.map((id) => ({
        id,
        label: customTeamNames[id] || id,
      })),
    [draftSettings.draftOrder, customTeamNames],
  );

  // Helper: compute picks until my next pick considering snake draft
  const picksUntilNext = useMemo(() => {
    const teamCount = draftSettings.teamCount;
    if (!draftSettings.draftOrder.includes(myTeamId) || teamCount <= 0) {
      return teamCount;
    }
    const remainingDraftSpan =
      teamCount *
      Math.max(
        2,
        Object.values(draftSettings.rosterConfig).reduce(
          (sum, count) => sum + Number(count || 0),
          0,
        ),
      );

    return findPicksUntilTeamTurn({
      currentPick,
      teamId: myTeamId,
      draftOrder: draftSettings.draftOrder,
      isSnakeDraft,
      trades: pickTrades,
      keepers,
      completedPickNumbers: draftedPlayers.map((player) => player.pickNumber),
      maxPickNumber: currentPick + remainingDraftSpan,
    });
  }, [
    draftSettings.teamCount,
    draftSettings.draftOrder,
    draftSettings.rosterConfig,
    myTeamId,
    isSnakeDraft,
    currentPick,
    draftedPlayers,
    pickTrades,
    keepers,
  ]);

  const myFilledSlotsForVorp = useMemo(() => {
    const rosterPlayers = draftedPlayers
      .filter((draftedPlayer) => draftedPlayer.teamId === myTeamId)
      .map((draftedPlayer) => {
        const player = allPlayers.find(
          (candidate) => String(candidate.playerId) === draftedPlayer.playerId,
        );
        return {
          id: draftedPlayer.playerId,
          eligibility: normalizePlayerEligibility(
            player?.displayPosition,
            player?.eligiblePositions,
          ),
        };
      });
    return allocateGroupedRosterSlots({
      players: rosterPlayers,
      rosterConfig: draftSettings.rosterConfig,
      grouping: forwardGrouping,
      overrides: positionOverrides,
    }).counts;
  }, [
    allPlayers,
    draftSettings.rosterConfig,
    draftedPlayers,
    forwardGrouping,
    myTeamId,
    positionOverrides,
  ]);

  // NEW: VORP metrics computed on full player pool (not just available)
  const {
    playerMetrics: vorpMetrics,
    replacementByPos,
    expectedTakenByPos,
    expectedN,
  } = useVORPCalculations({
    players: allPlayers,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType: draftSettings.leagueType || "points",
    baselineMode,
    categoryWeights: draftSettings.categoryWeights,
    forwardGrouping,
    myFilledSlots: myFilledSlotsForVorp,
    personalizeReplacement,
    prorate82,
  });

  const effectiveRosterConfig = useMemo(
    () => getEffectiveRosterConfig(draftSettings.rosterConfig, forwardGrouping),
    [draftSettings.rosterConfig, forwardGrouping],
  );

  // Team stats calculations
  const teamStats = useMemo((): TeamDraftStats[] => {
    return draftSettings.draftOrder.map((teamId) => {
      const teamPlayers = draftedPlayers.filter((p) => p.teamId === teamId);

      // Calculate projected points for this team (use merged pool)
      const projectedPoints = teamPlayers.reduce((total, draftedPlayer) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId,
        );
        return total + (player ? player.fantasyPoints.projected || 0 : 0);
      }, 0);

      // Group players by position for roster slots with UTIL separate and BENCH rules
      const rosterSlots: { [position: string]: DraftedPlayer[] } = {};
      Object.keys(effectiveRosterConfig).forEach((pos) => {
        if (pos !== "bench") {
          rosterSlots[pos.toUpperCase()] = [];
        }
      });

      teamPlayers.forEach((draftedPlayer) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId,
        );

        if (player) {
          const displayPos =
            player.displayPosition?.split(",")[0]?.trim()?.toUpperCase() ||
            "UTIL";
          const isGoalie = displayPos === "G";
          const elig = Array.isArray((player as any).eligiblePositions)
            ? ((player as any).eligiblePositions as string[])
            : (player.displayPosition || "")
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean);

          // Apply override if valid and capacity exists
          const overridePos = (positionOverrides as any)[
            draftedPlayer.playerId
          ];
          if (
            overridePos &&
            rosterSlots[overridePos] &&
            rosterSlots[overridePos].length <
              (effectiveRosterConfig as any)[overridePos] &&
            (overridePos === "FWD"
              ? !elig.includes("G") && !elig.includes("D")
              : elig.includes(overridePos))
          ) {
            rosterSlots[overridePos].push(draftedPlayer);
            return;
          }

          const hasFwdSlots = Boolean((effectiveRosterConfig as any)["FWD"]);
          const isSkater =
            displayPos === "F" ||
            elig.some((p) => p === "C" || p === "LW" || p === "RW");
          const canFillPrimary =
            rosterSlots[displayPos] &&
            rosterSlots[displayPos].length <
              (effectiveRosterConfig as any)[displayPos];

          if (isGoalie) {
            // Goalies fill G slots first, never UTIL
            if (
              rosterSlots["G"] &&
              rosterSlots["G"].length < (effectiveRosterConfig as any)["G"]
            ) {
              rosterSlots["G"].push(draftedPlayer);
            } else {
              rosterSlots["BENCH"] ||= [];
              rosterSlots["BENCH"].push(draftedPlayer);
            }
          } else if (hasFwdSlots && isSkater) {
            if (
              rosterSlots["FWD"] &&
              rosterSlots["FWD"].length < (effectiveRosterConfig as any)["FWD"]
            ) {
              rosterSlots["FWD"].push(draftedPlayer);
            } else if (canFillPrimary) {
              rosterSlots[displayPos].push(draftedPlayer);
            } else if (elig && elig.length) {
              // Try alternate eligible positions before UTIL/bench
              const alt = elig.find((p) => {
                if (p === displayPos) return false;
                return (
                  rosterSlots[p] &&
                  rosterSlots[p].length < (effectiveRosterConfig as any)[p]
                );
              });
              if (alt) {
                rosterSlots[alt].push(draftedPlayer);
              } else if (
                rosterSlots["UTILITY"] &&
                rosterSlots["UTILITY"].length < effectiveRosterConfig.utility
              ) {
                rosterSlots["UTILITY"].push(draftedPlayer);
              } else {
                rosterSlots["BENCH"] ||= [];
                rosterSlots["BENCH"].push(draftedPlayer);
              }
            } else if (
              rosterSlots["UTILITY"] &&
              rosterSlots["UTILITY"].length < effectiveRosterConfig.utility
            ) {
              rosterSlots["UTILITY"].push(draftedPlayer);
            } else {
              rosterSlots["BENCH"] ||= [];
              rosterSlots["BENCH"].push(draftedPlayer);
            }
          } else if (canFillPrimary) {
            rosterSlots[displayPos].push(draftedPlayer);
          } else if (elig && elig.length) {
            // Split mode (no FWD): try alternate eligible slots before UTIL
            const alt = elig.find((p) => {
              if (p === displayPos) return false;
              return (
                rosterSlots[p] &&
                rosterSlots[p].length < (effectiveRosterConfig as any)[p]
              );
            });
            if (alt) {
              rosterSlots[alt].push(draftedPlayer);
            } else if (
              rosterSlots["UTILITY"] &&
              rosterSlots["UTILITY"].length < effectiveRosterConfig.utility
            ) {
              rosterSlots["UTILITY"].push(draftedPlayer);
            } else {
              rosterSlots["BENCH"] ||= [];
              rosterSlots["BENCH"].push(draftedPlayer);
            }
          } else if (
            rosterSlots["UTILITY"] &&
            rosterSlots["UTILITY"].length < effectiveRosterConfig.utility
          ) {
            rosterSlots["UTILITY"].push(draftedPlayer);
          } else {
            // Bench fallback
            rosterSlots["BENCH"] ||= [];
            rosterSlots["BENCH"].push(draftedPlayer);
          }
        }
      });

      const bench = rosterSlots["BENCH"] || [];
      delete rosterSlots["BENCH"]; // keep bench separate from rosterSlots

      // NEW: Sum of player VORP for team
      const teamVorp = teamPlayers.reduce((sum, p) => {
        const m = vorpMetrics.get(p.playerId);
        return sum + (m?.vorp || 0);
      }, 0);

      // NEW: category totals for team (skater categories only for v1)
      const CAT_KEYS = [
        "GOALS",
        "ASSISTS",
        "PP_POINTS",
        "SHOTS_ON_GOAL",
        "HITS",
        "BLOCKED_SHOTS",
      ] as const;
      const categoryTotals: Record<string, number> = {};
      CAT_KEYS.forEach((k) => (categoryTotals[k] = 0));
      teamPlayers.forEach((dp) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === dp.playerId,
        );
        if (!player) return;
        CAT_KEYS.forEach((k) => {
          const v = (player.combinedStats as any)?.[k]?.projected as
            | number
            | null;
          if (typeof v === "number" && Number.isFinite(v)) {
            categoryTotals[k] += v;
          }
        });
      });

      return {
        teamId,
        teamName: customTeamNames[teamId] || teamId,
        owner: teamId,
        projectedPoints,
        categoryTotals,
        rosterSlots,
        bench,
        teamVorp,
      };
    });
  }, [
    draftSettings,
    draftedPlayers,
    allPlayers,
    customTeamNames,
    vorpMetrics,
    effectiveRosterConfig,
    positionOverrides,
  ]);

  // NEW: compute my team's positional needs normalized 0..1 (remaining slots / total slots)
  const myTeamStats = React.useMemo(
    () => teamStats.find((t) => t.teamId === myTeamId),
    [teamStats, myTeamId],
  );
  const posNeeds = React.useMemo(() => {
    const res: Record<string, number> = {};
    if (!myTeamStats) return res;
    const rc = effectiveRosterConfig;
    const rs = myTeamStats.rosterSlots || {};
    getRosterPositions(forwardGrouping).forEach((pos) => {
      const total = Math.max(1, Number(rc[pos] || 0));
      const filled = (rs[pos]?.length || 0) as number;
      const remaining = Math.max(0, total - filled);
      res[pos] = Math.min(1, remaining / total);
    });
    return res;
  }, [effectiveRosterConfig, forwardGrouping, myTeamStats]);

  // NEW: category deficits vector for my team (categories mode): league mean - my totals
  const catNeeds = React.useMemo(() => {
    if ((draftSettings.leagueType || "points") !== "categories")
      return undefined;
    const teams = teamStats;
    const CAT_KEYS = [
      "GOALS",
      "ASSISTS",
      "PP_POINTS",
      "SHOTS_ON_GOAL",
      "HITS",
      "BLOCKED_SHOTS",
    ] as const;
    const means: Record<string, number> = {};
    CAT_KEYS.forEach((k) => (means[k] = 0));
    if (teams.length > 0) {
      CAT_KEYS.forEach((k) => {
        const sum = teams.reduce(
          (acc, t) => acc + (t.categoryTotals[k] || 0),
          0,
        );
        means[k] = sum / teams.length;
      });
    }
    const mine = teams.find((t) => t.teamId === myTeamId);
    const deficits: Record<string, number> = {};
    CAT_KEYS.forEach((k) => {
      const myVal = mine?.categoryTotals[k] || 0;
      deficits[k] = Math.max(0, means[k] - myVal); // focus on below-average needs
    });
    return deficits;
  }, [teamStats, myTeamId, draftSettings.leagueType]);

  // NEW: roster progress for progress bar (C/LW/RW/D/UTIL/G)
  const rosterProgress = React.useMemo(() => {
    const rc = effectiveRosterConfig;
    const rs = myTeamStats?.rosterSlots || {};
    const items: { pos: string; filled: number; total: number }[] = [];
    const order = [...getRosterPositions(forwardGrouping), "UTIL"];
    order.forEach((pos) => {
      const total =
        pos === "UTIL"
          ? Number(rc.utility || 0)
          : Number((rc as any)[pos] || 0);
      if (total > 0) {
        const filled =
          pos === "UTIL"
            ? Number(rs["UTILITY"]?.length || 0)
            : Number(rs[pos]?.length || 0);
        items.push({ pos, filled, total });
      }
    });
    return items;
  }, [effectiveRosterConfig, forwardGrouping, myTeamStats]);

  // Calculate total roster size (rounds) and total picks
  const totalRosterSize = useMemo(
    () =>
      Object.values(draftSettings.rosterConfig).reduce((sum, c) => sum + c, 0),
    [draftSettings.rosterConfig],
  );
  const totalPicks = useMemo(
    () => draftSettings.teamCount * totalRosterSize,
    [draftSettings.teamCount, totalRosterSize],
  );
  const draftComplete = draftedPlayers.length >= totalPicks;

  // Auto-open summary when draft completes
  useEffect(() => {
    if (draftComplete) setIsSummaryOpen(true);
  }, [draftComplete]);

  // Draft a player - Updated to track history for undo and prevent drafting beyond completion
  const draftPlayer = useCallback(
    (playerId: string) => {
      // Prevent drafting beyond completion; open summary instead
      if (draftComplete) {
        setIsSummaryOpen(true);
        return;
      }

      const newDraftedPlayer: DraftedPlayer = {
        playerId,
        teamId: currentTurn.teamId,
        pickNumber: currentPick,
        round: currentTurn.round,
        pickInRound: currentTurn.pickInRound,
      };

      // Save current state to history before making changes
      setDraftHistory((prev) => [
        ...prev,
        {
          players: [...draftedPlayers],
          pickNumber: currentPick,
        },
      ]);

      setDraftedPlayers((prev) => [...prev, newDraftedPlayer]);
      setCurrentPick((prev) => prev + 1);
    },
    [currentTurn, currentPick, draftedPlayers, draftComplete],
  );

  // Assign a drafted player to a specific eligible slot (C/LW/RW/FWD/D/G/UTILITY)
  const assignPlayerToSlot = useCallback((playerId: string, pos: string) => {
    setPositionOverrides((prev) => ({
      ...prev,
      [playerId]: pos.toUpperCase(),
    }));
  }, []);

  // Auto-skip picks that are already drafted (e.g., keepers)
  useEffect(() => {
    if (draftComplete) return;
    const nextOpenPick = getNextOpenPick(
      currentPick,
      totalPicks,
      draftedPlayers,
    );
    if (nextOpenPick !== currentPick) setCurrentPick(nextOpenPick);
  }, [currentPick, draftedPlayers, draftComplete, totalPicks]);

  // Add undo functionality
  const undoLastPick = useCallback(() => {
    if (draftHistory.length > 0) {
      const lastState = draftHistory[draftHistory.length - 1];
      setDraftedPlayers(lastState.players);
      setCurrentPick(lastState.pickNumber);
      setDraftHistory((prev) => prev.slice(0, -1));
    }
  }, [draftHistory]);

  // Add reset draft functionality
  const resetDraft = useCallback(() => {
    setDraftedPlayers(materializeKeeperPicks([], keepers));
    setCurrentPick(1);
    setDraftHistory([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("draftDashboard.session.v1");
      } catch {}
    }
  }, [keepers]);

  const updateDraftSettings = useCallback(
    (newSettings: Partial<DraftSettings>) => {
      setDraftSettings((prev) => {
        const next = { ...prev, ...newSettings };
        // Ensure draftOrder length matches teamCount if teamCount changed
        if (typeof newSettings.teamCount === "number") {
          const count = newSettings.teamCount;
          if (!next.draftOrder || next.draftOrder.length !== count) {
            next.draftOrder = Array.from(
              { length: count },
              (_, i) => `Team ${i + 1}`,
            );
          }
        }
        // Ensure myTeamId is valid
        if (!next.draftOrder.includes(myTeamId)) {
          setMyTeamId(next.draftOrder[0] || "Team 1");
        }
        return next;
      });
    },
    [myTeamId],
  );

  // Handlers: traded picks and keepers
  const addTradedPick = useCallback(
    (round: number, pickInRound: number, newOwnerTeamId: string) => {
      const result = upsertPickTrade(
        { round, pickInRound, currentTeamId: newOwnerTeamId },
        {
          draftOrder: draftSettings.draftOrder,
          roundCount: totalRosterSize,
          isSnakeDraft,
          trades: pickTrades,
          keepers,
          draftedPlayers,
        },
      );
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join(" ") };
      }
      setPickTrades(result.trades);
      return {
        ok: true as const,
        message: ["Trade saved.", ...result.warnings].join(" "),
      };
    },
    [
      draftSettings.draftOrder,
      draftedPlayers,
      isSnakeDraft,
      keepers,
      pickTrades,
      totalRosterSize,
    ],
  );
  const removeTradedPick = useCallback((round: number, pickInRound: number) => {
    const key = `${round}-${pickInRound}`;
    setPickTrades((previous) =>
      previous.filter((trade) => `${trade.round}-${trade.pickInRound}` !== key),
    );
  }, []);
  const importTradedPicks = useCallback(
    (input: string) => {
      const parsed = parsePickTradeImport(input);
      if (!parsed.ok) {
        return { ok: false as const, message: parsed.errors.join(" ") };
      }
      const result = validatePickTradeBatch(parsed.candidates, {
        draftOrder: draftSettings.draftOrder,
        roundCount: totalRosterSize,
        isSnakeDraft,
        trades: pickTrades,
        keepers,
        draftedPlayers,
      });
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join("\n") };
      }
      setPickTrades(result.trades);
      return {
        ok: true as const,
        message: [
          `${parsed.candidates.length} trade${parsed.candidates.length === 1 ? "" : "s"} imported.`,
          ...result.warnings,
        ].join("\n"),
      };
    },
    [
      draftSettings.draftOrder,
      draftedPlayers,
      isSnakeDraft,
      keepers,
      pickTrades,
      totalRosterSize,
    ],
  );
  const resetTradedPicks = useCallback(() => setPickTrades([]), []);

  const addKeeper = useCallback(
    (round: number, pickInRound: number, teamId: string, playerId: string) => {
      const result = validateKeeperCandidate(
        { round, pickInRound, teamId, playerId },
        {
          teamCount: draftSettings.teamCount,
          roundCount: totalRosterSize,
          teamIds: draftSettings.draftOrder,
          playerIds: allPlayers.map((player) => String(player.playerId)),
          keepers,
          draftedPlayers,
        },
      );
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join(" ") };
      }
      const nextKeepers = [...keepers, result.keeper];
      setKeepers(nextKeepers);
      setDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
      return { ok: true as const, message: "Keeper added." };
    },
    [allPlayers, draftSettings, draftedPlayers, keepers, totalRosterSize],
  );
  const importKeepers = useCallback(
    (input: string) => {
      const parsed = parseKeeperImport(input);
      if (!parsed.ok) {
        return { ok: false as const, message: parsed.errors.join(" ") };
      }
      const result = validateKeeperBatch(parsed.candidates, {
        teamCount: draftSettings.teamCount,
        roundCount: totalRosterSize,
        teamIds: draftSettings.draftOrder,
        playerIds: allPlayers.map((player) => String(player.playerId)),
        keepers,
        draftedPlayers,
      });
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join("\n") };
      }
      const nextKeepers = [...keepers, ...result.keepers];
      setKeepers(nextKeepers);
      setDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
      return {
        ok: true as const,
        message: `${result.keepers.length} keeper${result.keepers.length === 1 ? "" : "s"} imported.`,
      };
    },
    [allPlayers, draftSettings, draftedPlayers, keepers, totalRosterSize],
  );
  const removeKeeper = useCallback(
    (round: number, pickInRound: number) => {
      const nextKeepers = keepers.filter(
        (keeper) =>
          keeper.round !== round || keeper.pickInRound !== pickInRound,
      );
      setKeepers(nextKeepers);
      setDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
    },
    [draftedPlayers, keepers],
  );

  // Add handy keyboard shortcuts for power users
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Avoid when focused inside inputs/textareas/contenteditable
      if (
        isGlobalShortcutBlockedTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      const key = e.key.toLowerCase();
      if (key === "u") {
        e.preventDefault();
        undoLastPick();
      } else if (key === "s") {
        e.preventDefault();
        setIsSummaryOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        setNeedWeightEnabled((v) => !v);
      } else if (key === "b") {
        e.preventDefault();
        setBaselineMode((m) => (m === "remaining" ? "full" : "remaining"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoLastPick]);

  const hasLoadedPlayers = allPlayers.length > 0;
  const isLoading =
    !hasLoadedPlayers && (skaterData.isLoading || goalieData.isLoading);
  const combinedSourceErrors = [skaterData.error, goalieData.error].filter(
    (message): message is string => Boolean(message),
  );
  const errorMessage =
    !hasLoadedPlayers && combinedSourceErrors.length > 0
      ? combinedSourceErrors.join(" ")
      : null;
  const skaterSourcesEnabled = Object.values(sourceControls).some(
    (control) => control.isSelected,
  );
  const goalieSourcesEnabled = Object.values(goalieSourceControls).some(
    (control) => control.isSelected,
  );
  const projectionDataNotices = useMemo(() => {
    const notices: string[] = [];
    if (hasLoadedPlayers && skaterData.isLoading) {
      notices.push(
        "Skater projections are refreshing; loaded players remain available.",
      );
    }
    if (hasLoadedPlayers && goalieData.isLoading) {
      notices.push(
        "Goalie projections are refreshing; loaded players remain available.",
      );
    }
    if (hasLoadedPlayers && skaterData.error) {
      notices.push(
        `Skater projection refresh failed; showing the healthy or previously loaded pool. ${skaterData.error}`,
      );
    }
    if (hasLoadedPlayers && goalieData.error) {
      notices.push(
        `Goalie projection refresh failed; showing the healthy or previously loaded pool. ${goalieData.error}`,
      );
    }
    for (const warning of skaterData.sourceWarnings ?? []) {
      notices.push(
        `Skater source ${warning.sourceName} is unavailable; remaining enabled sources are still included. ${warning.message}`,
      );
    }
    for (const warning of goalieData.sourceWarnings ?? []) {
      notices.push(
        `Goalie source ${warning.sourceName} is unavailable; remaining enabled sources are still included. ${warning.message}`,
      );
    }
    notices.push(
      ...buildProjectionFreshnessNotices({
        hasLoadedPlayers,
        hasOfficialSources: skaterSourcesEnabled || goalieSourcesEnabled,
        refreshFailed: Boolean(skaterData.error || goalieData.error),
        customSources: customCsvList,
      }),
    );
    return Array.from(new Set(notices));
  }, [
    customCsvList,
    goalieData.error,
    goalieData.isLoading,
    goalieData.sourceWarnings,
    hasLoadedPlayers,
    goalieSourcesEnabled,
    skaterData.error,
    skaterData.isLoading,
    skaterData.sourceWarnings,
    skaterSourcesEnabled,
  ]);
  const projectionEmptyStateMessage =
    !skaterSourcesEnabled && !goalieSourcesEnabled
      ? "No projection sources are enabled. Enable at least one skater or goalie source in Draft Settings."
      : !skaterSourcesEnabled
        ? "No skater sources are enabled, and no goalie players are available. Enable a skater source or review the goalie source status."
        : !goalieSourcesEnabled
          ? "No goalie sources are enabled, and no skater players are available. Enable a goalie source or review the skater source status."
          : "No players found matching your filters.";

  const nextPickNumber = useMemo(
    () => currentPick + picksUntilNext,
    [currentPick, picksUntilNext],
  );

  // --- CSV Export: Blended Projections ---
  const exportBlendedProjectionsCsv = useCallback(() => {
    try {
      const players = allPlayers; // blended list already includes custom CSV players
      if (!players.length) return;
      // Collect all stat keys present
      const statKeySet = new Set<string>();
      players.forEach((p) => {
        Object.keys(p.combinedStats || {}).forEach((k) => statKeySet.add(k));
      });
      const statKeys = Array.from(statKeySet).sort();

      const headers = [
        "playerId",
        "fullName",
        "team",
        "positions",
        "fantasyPointsProjected",
        "fantasyPointsPerGame",
        "yahooAvgPick",
        "yahooAvgRound",
        "yahooPctDrafted",
        "projectedRank",
        ...statKeys.map((k) => `${k}_proj`),
      ];

      const esc = (v: any) => {
        if (v == null) return "";
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const lines: string[] = [headers.join(",")];
      players.forEach((p) => {
        const rowBase = [
          p.playerId,
          p.fullName,
          p.displayTeam || "",
          p.displayPosition || "",
          p.fantasyPoints.projected ?? "",
          p.fantasyPoints.projectedPerGame ?? "",
          p.yahooAvgPick ?? "",
          p.yahooAvgRound ?? "",
          p.yahooPctDrafted ?? "",
          p.projectedRank ?? "",
        ];
        const statVals = statKeys.map((k) => {
          const v = (p.combinedStats as any)?.[k]?.projected;
          return typeof v === "number" && Number.isFinite(v) ? v : "";
        });
        const row = [...rowBase, ...statVals].map(esc).join(",");
        lines.push(row);
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const filename = `blended-projections-${players.length}players-${Date.now()}.csv`;
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
      console.error("Failed to export projections CSV", e);
    }
  }, [allPlayers]);

  const handleForwardGroupingChange = (mode: "split" | "fwd") => {
    setForwardGrouping(mode);
  };
  const toggleSuggestedComparison = useCallback((playerId: string) => {
    setSuggestedCompareIds((previous) => {
      if (previous.includes(playerId)) {
        return previous.filter((id) => id !== playerId);
      }
      const next =
        previous.length >= 2
          ? [previous[1], playerId]
          : [...previous, playerId];
      if (next.length === 2) setSuggestedCompareOpen(true);
      return next;
    });
  }, []);
  const customSourceMetadata = useMemo(
    () => toCustomSourceMetadata(customCsvList),
    [customCsvList],
  );
  const draftConfigurationSummary = useMemo(
    () =>
      buildDraftConfigurationSummary({
        projectionSources: PROJECTION_SOURCES_CONFIG,
        sourceControls,
        goalieSourceControls,
        customCsvEntries: customCsvList,
        forwardGrouping,
        baselineMode,
        personalizeReplacement,
        needWeightEnabled,
        needAlpha,
      }),
    [
      baselineMode,
      customCsvList,
      forwardGrouping,
      goalieSourceControls,
      needAlpha,
      needWeightEnabled,
      personalizeReplacement,
      sourceControls,
    ],
  );

  return (
    <div className={styles.dashboardContainer}>
      <DraftSettings
        settings={draftSettings}
        onSettingsChange={updateDraftSettings}
        isSnakeDraft={isSnakeDraft}
        onSnakeDraftChange={setIsSnakeDraft}
        myTeamId={myTeamId}
        onMyTeamIdChange={setMyTeamId}
        undoLastPick={undoLastPick}
        resetDraft={resetDraft}
        draftHistory={draftHistory}
        draftedPlayers={draftedPlayers}
        currentPick={currentPick}
        customTeamNames={customTeamNames}
        forwardGrouping={forwardGrouping}
        onForwardGroupingChange={handleForwardGroupingChange}
        sourceControls={sourceControls}
        onSourceControlsChange={setSourceControls}
        goalieSourceControls={goalieSourceControls}
        onGoalieSourceControlsChange={setGoalieSourceControls}
        goalieScoringCategories={goaliePointValues}
        onGoalieScoringChange={setGoaliePointValues}
        onOpenSummary={() => setIsSummaryOpen(true)}
        onOpenImportCsv={() => setIsImportCsvOpen(true)}
        customSourceLabel={customCsvLabel}
        customSourceMetadata={customSourceMetadata}
        availableSkaterStatKeys={availableSkaterStatKeys}
        availableGoalieStatKeys={availableGoalieStatKeys}
        onExportCsv={exportBlendedProjectionsCsv}
        onRemoveCustomSource={(id) => {
          // Remove from session list and controls
          const list = getCsvList();
          const next = list.filter((e) => e.id !== id);
          setCsvList(next);
          setSourceControls((prev) => {
            const { [id]: _, ...rest } = prev;
            return rest as typeof prev;
          });
          setGoalieSourceControls((prev) => {
            const { [id]: _, ...rest } = prev;
            return rest as typeof prev;
          });
          // Force data refresh
          setDataRefreshKey((k) => k + 1);
        }}
        pickOwnerOverrides={pickOwnerOverrides}
        pickTrades={pickTrades}
        onAddTradedPick={addTradedPick}
        onImportTradedPicks={importTradedPicks}
        onRemoveTradedPick={removeTradedPick}
        onResetTradedPicks={resetTradedPicks}
        keepers={keepers}
        onAddKeeper={addKeeper}
        onImportKeepers={importKeepers}
        onRemoveKeeper={removeKeeper}
        playersForKeeperAutocomplete={allPlayers.map((p) => ({
          id: Number(p.playerId),
          fullName: p.fullName,
        }))}
        onBookmarkCreate={() => {}}
        onBookmarkImport={(data) => {
          try {
            if (data.settings) setDraftSettings(data.settings);
            const restoredKeepers = migrateKeeperEntries(
              data.keepers,
              data.settings?.teamCount || draftSettings.teamCount,
            );
            setKeepers(restoredKeepers);
            setDraftedPlayers(
              materializeKeeperPicks(
                Array.isArray(data.draftedPlayers) ? data.draftedPlayers : [],
                restoredKeepers,
              ),
            );
            setPickTrades(
              migratePickTrades(data.pickTrades ?? data.pickOwnerOverrides, {
                draftOrder:
                  data.settings?.draftOrder || draftSettings.draftOrder,
                roundCount: Object.values(
                  data.settings?.rosterConfig || draftSettings.rosterConfig,
                ).reduce<number>((sum, count) => sum + Number(count || 0), 0),
                isSnakeDraft:
                  typeof data.isSnakeDraft === "boolean"
                    ? data.isSnakeDraft
                    : isSnakeDraft,
              }),
            );
            if (typeof data.currentPick === "number")
              setCurrentPick(data.currentPick);
            if (typeof data.myTeamId === "string") setMyTeamId(data.myTeamId);
            if (
              data.forwardGrouping === "fwd" ||
              data.forwardGrouping === "split"
            )
              setForwardGrouping(data.forwardGrouping);
            if (data.sourceControls) setSourceControls(data.sourceControls);
            if (data.goalieSourceControls)
              setGoalieSourceControls(data.goalieSourceControls);
            if (data.goalieScoringCategories)
              setGoaliePointValues(data.goalieScoringCategories);
            if (typeof data.personalizeReplacement === "boolean")
              setPersonalizeReplacement(data.personalizeReplacement);
            if (typeof data.needWeightEnabled === "boolean")
              setNeedWeightEnabled(data.needWeightEnabled);
            if (typeof data.needAlpha === "number")
              setNeedAlpha(Math.max(0, Math.min(1, data.needAlpha)));
            if (
              data.baselineMode === "remaining" ||
              data.baselineMode === "full"
            )
              setBaselineMode(data.baselineMode);
            if (
              data.customTeamNames &&
              typeof data.customTeamNames === "object"
            )
              setCustomTeamNames(data.customTeamNames);
            // Reset history since imported state may not map cleanly
            setDraftHistory([]);
          } catch (e) {
            console.error("Failed to apply imported bookmark", e);
          }
        }}
      />

      {showFallbackBanner && (
        <div className={styles.warningBanner}>
          {`Name-fallback used for ${fallbackBannerMessages.join(" and ")}.`}
          {lowCoverageSources.length > 0 &&
            ` Coverage remains below ${coverageThreshold.toFixed(0)}%.`}
        </div>
      )}

      {/* Full-width Suggested Picks above the three panels */}
      <section className={styles.suggestedSection}>
        <SuggestedPicks
          players={availablePlayers}
          vorpMetrics={vorpMetrics}
          needWeightEnabled={needWeightEnabled}
          needAlpha={needAlpha}
          posNeeds={posNeeds}
          currentPick={currentPick}
          teamCount={draftSettings.teamCount}
          baselineMode={baselineMode}
          nextPickNumber={nextPickNumber}
          onDraftPlayer={(id) => draftPlayer(id)}
          canDraft={true}
          leagueType={draftSettings.leagueType || "points"}
          catNeeds={catNeeds}
          rosterProgress={rosterProgress}
          personalizeReplacement={personalizeReplacement}
          onPersonalizeReplacementChange={setPersonalizeReplacement}
          forwardGrouping={forwardGrouping}
          onComparePlayer={toggleSuggestedComparison}
          compareSelectedIds={suggestedCompareIds}
        />
      </section>

      <ProjectionSourceAccuracy players={allPlayers} />

      <div className={styles.mainContent}>
        <section className={styles.leftPanel}>
          <DraftBoard
            draftSettings={draftSettings}
            draftedPlayers={draftedPlayers}
            currentTurn={currentTurn}
            teamStats={teamStats}
            isSnakeDraft={isSnakeDraft}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            onUpdateTeamName={updateTeamName}
            pickTrades={pickTrades}
            keepers={keepers}
            vorpMetrics={vorpMetrics}
          />
        </section>

        <section className={styles.centerPanel}>
          <MyRoster
            myTeamId={myTeamId}
            teamStatsList={teamStats}
            draftSettings={draftSettings}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            onDraftPlayer={(id) => draftPlayer(id)}
            onMovePlayer={assignPlayerToSlot}
            canDraft={true}
            currentPick={currentPick}
            currentTurn={currentTurn}
            teamOptions={teamOptions}
            vorpMetrics={vorpMetrics}
            needWeightEnabled={needWeightEnabled}
            needAlpha={needAlpha}
            posNeeds={posNeeds}
            forwardGrouping={forwardGrouping}
          />
        </section>

        <section className={styles.rightPanel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 0,
            }}
          >
            <div style={{ color: "#9aa4af", fontSize: 12 }}>
              {skaterData.isLoading || goalieData.isLoading
                ? "Refreshing…"
                : ""}
            </div>
          </div>
          <ProjectionsTable
            players={allPlayers}
            allPlayers={allPlayers}
            draftedPlayers={draftedPlayers}
            isLoading={isLoading}
            error={errorMessage}
            onDraftPlayer={(id) => draftPlayer(id)}
            canDraft={true}
            vorpMetrics={vorpMetrics}
            replacementByPos={replacementByPos}
            baselineMode={baselineMode}
            onBaselineModeChange={setBaselineMode}
            expectedRuns={
              expectedTakenByPos && typeof expectedN === "number"
                ? { byPos: expectedTakenByPos, N: expectedN }
                : undefined
            }
            needWeightEnabled={needWeightEnabled}
            onNeedWeightChange={setNeedWeightEnabled}
            posNeeds={posNeeds}
            needAlpha={needAlpha}
            onNeedAlphaChange={setNeedAlpha}
            nextPickNumber={nextPickNumber}
            leagueType={draftSettings.leagueType || "points"}
            forwardGrouping={forwardGrouping}
            enabledSkaterStatKeys={
              draftSettings.leagueType === "categories"
                ? Object.keys(draftSettings.categoryWeights || {}).filter(
                    (k) => !availableGoalieStatKeys.includes(k),
                  )
                : Object.keys(draftSettings.scoringCategories || {})
            }
            enabledGoalieStatKeys={
              draftSettings.leagueType === "categories"
                ? Object.keys(draftSettings.categoryWeights || {}).filter((k) =>
                    availableGoalieStatKeys.includes(k),
                  )
                : Object.keys(goaliePointValues || {})
            }
            yahooMappingDiagnostics={{
              skater: skaterData.yahooMappingDiagnostics,
              goalie: goalieData.yahooMappingDiagnostics,
            }}
            sourceRankImpacts={sourceRankImpacts}
            inclusionDiagnostics={{
              skater: skaterData.inclusionDiagnostics,
              goalie: goalieData.inclusionDiagnostics,
            }}
            dataNotices={projectionDataNotices}
            emptyStateMessage={projectionEmptyStateMessage}
          />
          <button
            onClick={() => setDataRefreshKey((k) => k + 1)}
            className={styles.refreshButton}
            title="Force refresh projections from database"
          >
            Refresh Data
          </button>
        </section>
      </div>

      <DraftSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        draftSettings={draftSettings}
        draftedPlayers={draftedPlayers}
        teamStats={teamStats}
        allPlayers={allPlayers}
        vorpMetrics={vorpMetrics}
        forwardGrouping={forwardGrouping}
        pickTrades={pickTrades}
        configurationSummary={draftConfigurationSummary}
      />

      <ImportCsvModal
        open={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        minimumCoveragePercent={draftSettings.customSourceMinimumCoverage ?? 25}
        allowNameFallback={draftSettings.allowCustomNameFallback ?? true}
        onFallbackSettingsChange={({
          allowCustomNameFallback,
          minimumCoveragePercent,
        }) => {
          setDraftSettings((prev) => ({
            ...prev,
            allowCustomNameFallback,
            customSourceMinimumCoverage: minimumCoveragePercent,
          }));
        }}
        onImported={({ headers, rows, sourceId, label, resolution }) => {
          // Append to list with incremental id custom_csv_1..n
          const list = getCsvList();
          const nextIndex = list.length + 1;
          const id = `custom_csv_${nextIndex}`;
          const next = [
            ...list,
            {
              id,
              label,
              headers,
              rows,
              resolution: {
                ...resolution,
                lastUpdated: resolution.lastUpdated || Date.now(),
              },
            },
          ];
          setCsvList(next);
          // Add/enable the custom source control so it appears in settings (skater controls by default)
          setSourceControls((prev) => ({
            ...prev,
            [id]: prev[id] || { isSelected: true, weight: 1 },
          }));
          // Also add goalie controls entry so it can be toggled
          setGoalieSourceControls((prev) => ({
            ...prev,
            [id]: prev[id] || { isSelected: true, weight: 1 },
          }));
          setCustomCsvLabel(label);
        }}
      />

      <ComparePlayersModal
        open={suggestedCompareOpen}
        onClose={() => setSuggestedCompareOpen(false)}
        selectedIds={suggestedCompareIds}
        allPlayers={allPlayers}
        leagueType={draftSettings.leagueType || "points"}
      />
    </div>
  );
};

export default DraftDashboard;

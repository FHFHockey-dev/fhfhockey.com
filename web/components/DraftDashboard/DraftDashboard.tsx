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
import { FANTASY_PROJECTION_SEASON_ID } from "lib/fantasy-projections/contracts";
import { useCurrentSeasonQuery } from "hooks/useCurrentSeason";
import { useDraftRanking } from "hooks/useDraftRanking";
import { useYahooDraftSync } from "hooks/useYahooDraftSync";
import { useEspnDraftSync } from "hooks/useEspnDraftSync";
import supabase from "lib/supabase";
import { useAuth } from "contexts/AuthProviderContext";

import DraftSettings, { type DraftSettingsHandle } from "./DraftSettings";
import { validateDraftSettings, bookmarkImportError } from "lib/draftDashboard/settingsValidation";
import DraftBoard from "./DraftBoard";
import DraftWorkspaceHeader from "./DraftWorkspaceHeader";
import DraftSettingsShell, { type SettingsSection } from "./DraftSettingsShell";
import DraftStatus from "./DraftStatus";
import LeagueStandings from "./LeagueStandings";
import MyRoster from "./MyRoster";
import GodView from "./GodView";
import { godViewRosterNeeds, godViewRosterProgress, selectGodViewQueue } from "lib/draftDashboard/godView";
import DustMatrix from "./DustMatrix";
import SavedDraftsWorkspace from "./SavedDraftsWorkspace";
import type { SavedDraftAnnotations } from "./SavedDraftsPanel";
import { adaptScenarioDashboard, type ScenarioSavedImportContext } from "lib/draft-pro/scenarioDashboardAdapter";
import { ScenarioComparisonWorkspace } from "./ScenarioComparisonWorkspace";
import { showScenarioWorkspace, type ScenarioWorkspaceState } from "lib/draftDashboard/scenarioWorkspaceState";
import { adaptReportDashboard, type OpenedReportDraft } from "lib/draft-pro/reportDashboardAdapter";
import { AnalyticalReportsPanel } from "./AnalyticalReportsPanel";
import ProjectionsTable from "./ProjectionsTable";
import { useVORPCalculations } from "hooks/useVORPCalculations";
import { useDraftProAccess } from "hooks/useDraftProAccess";
import { useDraftProDust } from "hooks/useDraftProDust";
import { buildDraftProDustNotices } from "lib/draftDashboard/draftProDustPresentation";
import { buildDraftProDustRequest } from "lib/draftDashboard/draftProDustRequest";
import { useDraftSchedule } from "hooks/useDraftSchedule";
import { normalizeScheduleSettings } from "lib/draftDashboard/scheduleMetrics";
import { useRosterScheduleOptimizer } from "hooks/useRosterScheduleOptimizer";
import SuggestedPicks from "./SuggestedPicks";
import DraftSummaryModal from "./DraftSummaryModal";
import ImportCsvModal from "./ImportCsvModal";
import ComparePlayersModal from "./ComparePlayersModal";
import YahooLiveDraftPanel from "./YahooLiveDraftPanel";
import EspnLiveDraftPanel from "./EspnLiveDraftPanel";
import MobileDraftTabs, { useMobileDraftTab } from "./MobileDraftTabs";
import FantraxLeagueSettingsPanel, {
  type DraftFantraxSelection,
} from "./FantraxLeagueSettingsPanel";
import type { FantraxConnectionLeague } from "lib/integrations/fantrax/contracts";
import EspnLeagueSettingsPanel, {
  type EspnLeagueSelection,
} from "components/integrations/EspnLeagueSettingsPanel";
import type { EspnConnectionLeague } from "lib/integrations/espn/contracts";
import { mapUserSettingsRowToLeagueSettings } from "lib/user-settings/mappers";
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
  sanitizeControls,
} from "lib/draftDashboard/sourceControlPreferences";
import {
  parseBrowserSnapshot,
  restoreBrowserSnapshot,
  serializeSavedDraft,
  toNormalizedPrivateImports,
  type BrowserDraftSnapshot,
} from "lib/draft-pro/savedDrafts";
import {
  calculateSourceRankImpacts,
  rankProjectionPlayers,
  type SourceRankImpact,
} from "lib/draftDashboard/sourceRankImpact";
import { buildCustomProjectionSources } from "lib/draftDashboard/customProjectionSources";
import { requestDraftProExport } from "lib/draftDashboard/draftProExportRequest";
import {
  allocateGroupedRosterSlots,
  groupPlayerEligibility,
  getEffectiveRosterConfig,
  getRosterPositions,
  loadForwardGroupingPreference,
  normalizePlayerEligibility,
  saveForwardGroupingPreference,
} from "lib/draftDashboard/forwardGrouping";
import {
  getNextOpenPick,
  keeperUsesPick,
  materializeKeeperPicks,
  migrateKeeperEntries,
  parseKeeperImport,
  validateKeeperBatch,
  validateKeeperCandidate,
  type KeeperCandidate,
  type KeeperEntry,
} from "lib/draftDashboard/keepers";
import {
  findNextActionablePick,
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
  normalizeDraftOrderPattern,
  type DraftOrderMode,
  type DraftOrderPattern,
} from "lib/draftDashboard/draftOrder";
import {
  buildDraftConfigurationSummary,
  toCustomSourceMetadata,
} from "lib/draftDashboard/summaryConfiguration";
import { isGlobalShortcutBlockedTarget } from "lib/draftDashboard/keyboardShortcuts";
import { buildProjectionFreshnessNotices } from "lib/draftDashboard/projectionFreshness";
import { replaceManualDraftPick } from "lib/draftDashboard/quickFix";
import {
  continueManuallyFromYahoo,
  deriveYahooDraftDashboardConfiguration,
  loadYahooDraftPersistence,
  reconcileYahooDraftState,
  saveYahooDraftPersistence,
  selectDraftedPlayersForMode,
  yahooSettingsRequireScoringConfirmation,
  yahooSettingsRequireDraftOrderConfirmation,
  yahooSettingsRequireGeneralConfirmation,
  yahooSettingsWarnings,
  type DraftDashboardMode,
} from "lib/draftDashboard/yahooLiveDraft";
import {
  espnDraftDashboardConfiguration,
  reconcileEspnDraftState,
} from "lib/draftDashboard/espnLiveDraft";

import styles from "./DraftDashboard.module.scss";

const EMPTY_PROJECTION_STYLES: Record<string, string> = {};
const NOOP_PROJECTION_TOGGLE = () => {};
const readStoredFavoriteIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("projections.favorites") ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

// Data Models from PRD
export interface DraftSettings {
  playoffWeeks?: number[];
  scheduleScope?: "season" | "playoffs";
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
  draftOrderMode?: DraftOrderMode;
  reversedRounds?: number[];
}

export interface DraftedPlayer {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  isKeeper?: boolean;
  keeperVersion?: number;
  source?: "manual" | "yahoo" | "espn";
  yahooSessionId?: string;
  yahooPlayerKey?: string;
  yahooPlayerId?: string;
  yahooDisplayName?: string;
  yahooMappingStatus?: "mapped" | "unresolved" | "review_required";
  espnSessionId?: string;
  espnPlayerId?: string;
  espnDisplayName?: string;
  espnMappingStatus?: "mapped" | "unresolved" | "review_required";
  auctionCost?: number | null;
}

export type RosterAssignment =
  | DraftedPlayer
  | {
      playerId: string;
      teamId: string;
      isKeeper: true;
      keeperCost: "none";
    };

export interface TeamDraftStats {
  teamId: string;
  teamName: string;
  owner: string;
  projectedPoints: number;
  categoryTotals: Record<string, number>;
  rosterSlots: {
    [position: string]: RosterAssignment[];
  };
  bench: RosterAssignment[];
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
  playoffWeeks: [],
  scheduleScope: "season",
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
  draftOrderMode: "snake",
  reversedRounds: [],
};

function rosterRoundCount(rosterConfig: Record<string, number>) {
  return Object.values(rosterConfig).reduce(
    (sum, count) => sum + Number(count || 0),
    0,
  );
}

function normalizeDraftSettingsOrder(
  settings: DraftSettings,
  legacyIsSnakeDraft = true,
) {
  const pattern = normalizeDraftOrderPattern(
    {
      mode: settings.draftOrderMode,
      reversedRounds: settings.reversedRounds,
    },
    rosterRoundCount(settings.rosterConfig),
    legacyIsSnakeDraft,
  );
  return {
    ...settings,
    ...normalizeScheduleSettings(settings),
    draftOrderMode: pattern.mode,
    reversedRounds: pattern.reversedRounds,
  };
}

function isDraftSettings(value: unknown): value is DraftSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.teamCount === "number" &&
    !!candidate.rosterConfig && typeof candidate.rosterConfig === "object" && !Array.isArray(candidate.rosterConfig) &&
    !!candidate.scoringCategories && typeof candidate.scoringCategories === "object" && !Array.isArray(candidate.scoringCategories) &&
    Array.isArray(candidate.draftOrder) && candidate.draftOrder.every((team) => typeof team === "string");
}

const isSnapshotRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function adaptSavedDraftRows(snapshot: { draftedPlayers: readonly unknown[]; customCsvList?: readonly unknown[] }) {
  const draftedPlayers = snapshot.draftedPlayers.map((value) => {
    if (!isSnapshotRecord(value) || typeof value.playerId !== "string" || typeof value.teamId !== "string" || !Number.isInteger(value.pickNumber) || !Number.isInteger(value.round) || !Number.isInteger(value.pickInRound)) throw new Error("Saved draft picks are invalid.");
    const optionalStrings = ["yahooSessionId", "yahooPlayerKey", "yahooPlayerId", "yahooDisplayName", "espnSessionId", "espnPlayerId", "espnDisplayName"] as const;
    if (optionalStrings.some((field) => value[field] !== undefined && typeof value[field] !== "string")) throw new Error("Saved draft pick metadata is invalid.");
    if (value.source !== undefined && !["manual", "yahoo", "espn"].includes(String(value.source))) throw new Error("Saved draft pick source is invalid.");
    if (value.yahooMappingStatus !== undefined && !["mapped", "unresolved", "review_required"].includes(String(value.yahooMappingStatus))) throw new Error("Saved Yahoo mapping status is invalid.");
    if (value.espnMappingStatus !== undefined && !["mapped", "unresolved", "review_required"].includes(String(value.espnMappingStatus))) throw new Error("Saved ESPN mapping status is invalid.");
    if (value.isKeeper !== undefined && typeof value.isKeeper !== "boolean" || value.keeperVersion !== undefined && !Number.isInteger(value.keeperVersion) || value.auctionCost !== undefined && value.auctionCost !== null && typeof value.auctionCost !== "number") throw new Error("Saved draft pick metadata is invalid.");
    const player: DraftedPlayer = { playerId: value.playerId, teamId: value.teamId, pickNumber: value.pickNumber as number, round: value.round as number, pickInRound: value.pickInRound as number };
    for (const field of optionalStrings) if (typeof value[field] === "string") Object.assign(player, { [field]: value[field] });
    if (value.source) player.source = value.source as DraftedPlayer["source"];
    if (value.yahooMappingStatus) player.yahooMappingStatus = value.yahooMappingStatus as DraftedPlayer["yahooMappingStatus"];
    if (value.espnMappingStatus) player.espnMappingStatus = value.espnMappingStatus as DraftedPlayer["espnMappingStatus"];
    if (typeof value.isKeeper === "boolean") player.isKeeper = value.isKeeper;
    if (typeof value.keeperVersion === "number") player.keeperVersion = value.keeperVersion;
    if (typeof value.auctionCost === "number" || value.auctionCost === null) player.auctionCost = value.auctionCost;
    return player;
  });
  const customCsvList: SessionCsvEntry[] = (snapshot.customCsvList ?? []).map((value) => {
    if (!isSnapshotRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || !Array.isArray(value.rows) || value.rows.some((row) => !isSnapshotRecord(row))) throw new Error("Saved private import data is invalid.");
    const headers = value.headers;
    if (headers !== undefined && (!Array.isArray(headers) || headers.some((header) => !isSnapshotRecord(header) || typeof header.original !== "string" || typeof header.standardized !== "string" || typeof header.selected !== "boolean"))) throw new Error("Saved private import mapping is invalid.");
    const entry: SessionCsvEntry = { id: value.id, label: value.label, rows: value.rows as Record<string, unknown>[] };
    if (value.playerType === "skater" || value.playerType === "goalie" || value.playerType === "both") entry.playerType = value.playerType;
    if (headers) entry.headers = headers.map((header) => ({ original: header.original as string, standardized: header.standardized as string, selected: header.selected as boolean }));
    const resolution = value.resolution;
    if (isSnapshotRecord(resolution) && Object.keys(resolution).length) {
      const requiredNumbers = ["totalRows", "idMatched", "nameMatched", "unresolved", "coverage", "lastUpdated"] as const;
      const optionalNumbers = ["fuzzyMatched", "manualOverrides", "invalidIds"] as const;
      if (requiredNumbers.some((field) => typeof resolution[field] !== "number" || !Number.isFinite(resolution[field])) || optionalNumbers.some((field) => resolution[field] !== undefined && (typeof resolution[field] !== "number" || !Number.isFinite(resolution[field]))) || !Array.isArray(resolution.unresolvedNames) || resolution.unresolvedNames.some((name) => typeof name !== "string")) throw new Error("Saved private import resolution is invalid.");
      entry.resolution = {
        totalRows: resolution.totalRows as number, idMatched: resolution.idMatched as number, nameMatched: resolution.nameMatched as number,
        unresolved: resolution.unresolved as number, coverage: resolution.coverage as number, lastUpdated: resolution.lastUpdated as number,
        unresolvedNames: resolution.unresolvedNames as string[],
        ...(typeof resolution.fuzzyMatched === "number" ? { fuzzyMatched: resolution.fuzzyMatched } : {}),
        ...(typeof resolution.manualOverrides === "number" ? { manualOverrides: resolution.manualOverrides } : {}),
        ...(typeof resolution.invalidIds === "number" ? { invalidIds: resolution.invalidIds } : {}),
      };
    } else if (resolution !== undefined && !isSnapshotRecord(resolution)) throw new Error("Saved private import resolution is invalid.");
    return entry;
  });
  return { draftedPlayers, customCsvList };
}

function resizeDraftOrder(order: string[], teamCount: number) {
  return Array.from(
    { length: teamCount },
    (_, index) => order[index] ?? `Team ${index + 1}`,
  );
}

function forwardGroupingForRoster(rosterConfig: Record<string, number>) {
  const hasGenericForwards = (rosterConfig.FWD ?? 0) > 0;
  const hasPositionForwards = ["C", "LW", "RW"].some(
    (position) => (rosterConfig[position] ?? 0) > 0,
  );
  if (hasGenericForwards && !hasPositionForwards) return "fwd" as const;
  if (hasPositionForwards) return "split" as const;
  return null;
}

const DraftDashboard: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const draftRanking = useDraftRanking(user?.id || null);
  const yahooDraftSync = useYahooDraftSync(Boolean(user?.id));
  const espnDraftSync = useEspnDraftSync(Boolean(user?.id));
  const {
    enabled: yahooFeatureEnabled,
    selectedLeagueId: yahooSelectedLeagueId,
    sessionId: yahooSessionId,
    requestState: yahooRequestState,
    terminalSessionMissing: yahooTerminalSessionMissing,
    resumeSession: resumeYahooSession,
    clearSession: clearYahooSession,
    start: startYahooSession,
    stop: stopYahooSession,
  } = yahooDraftSync;
  const { data: currentSeason, isLoading: seasonLoading } = useCurrentSeasonQuery();
  const currentSeasonId = currentSeason?.seasonId;

  // Draft State
  const [draftSettings, setDraftSettings] = useState<DraftSettings>(
    DEFAULT_DRAFT_SETTINGS,
  );
  const [preserveExactCategoryWeights, setPreserveExactCategoryWeights] =
    useState(false);
  // Ensure baseline goalie categories appear in categories leagues if user has none.
  useEffect(() => {
    if (
      draftSettings.leagueType !== "categories" ||
      preserveExactCategoryWeights
    ) {
      return;
    }
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
  }, [
    draftSettings.leagueType,
    draftSettings.categoryWeights,
    preserveExactCategoryWeights,
  ]);
  const [manualDraftedPlayers, setManualDraftedPlayers] = useState<
    DraftedPlayer[]
  >([]);
  const [draftMode, setDraftMode] = useState<DraftDashboardMode>(() => {
    if (typeof window === "undefined") return "manual";
    const saved = loadYahooDraftPersistence(window.sessionStorage);
    return saved.mode === "yahoo" && saved.sessionId ? "yahoo" : "manual";
  });
  const espnLiveActive =
    espnDraftSync.draftState?.session.status === "predraft" ||
    espnDraftSync.draftState?.session.status === "active";
  const manualDraftingEnabled = draftMode === "manual" && !espnLiveActive;
  const restoredYahooPersistenceRef = useRef(
    typeof window === "undefined"
      ? null
      : loadYahooDraftPersistence(window.sessionStorage),
  );
  // Explicit per-player slot overrides (C/LW/RW/FWD/D/G/UTILITY)
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, string>
  >({});
  const [godViewOpen, setGodViewOpen] = useState(false);
  const [inspectedTeamId, setInspectedTeamId] = useState<string>("");
  const [rosterViewRequest, setRosterViewRequest] = useState<{ teamId: string }>();
  const [graphExpandRequest, setGraphExpandRequest] = useState(0);
  const [currentPick, setCurrentPick] = useState<number>(1);
  const [activeMobileTab, setActiveMobileTab] = useMobileDraftTab();
  const [mobileWorkspaceEnabled, setMobileWorkspaceEnabled] = useState(false);
  const draftOrderPattern = useMemo<DraftOrderPattern>(
    () =>
      normalizeDraftOrderPattern(
        {
          mode: draftSettings.draftOrderMode,
          reversedRounds: draftSettings.reversedRounds,
        },
        rosterRoundCount(draftSettings.rosterConfig),
      ),
    [
      draftSettings.draftOrderMode,
      draftSettings.reversedRounds,
      draftSettings.rosterConfig,
    ],
  );
  const isSnakeDraft = draftOrderPattern.mode === "snake";

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(max-width: 799px)");
    const update = () => setMobileWorkspaceEnabled(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

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
  const snapshotResumeAttemptedRef = React.useRef(false);
  const legacyResumeAttemptedRef = React.useRef(false);
  const snapshotWasPresentRef = React.useRef(false);
  const restoredLeagueSettingsRef = React.useRef(false);
  const manualLeagueSettingsDirtyRef = React.useRef(false);
  const accountDefaultsAppliedForUserRef = React.useRef<string | null>(null);
  const espnAppliedConfigurationRef = React.useRef<string | null>(null);

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
  const { access: draftProAccess } = useDraftProAccess();
  const draftProEligible = Boolean(draftProAccess?.eligible);
  const canUseProExport = Boolean(draftProAccess?.capabilities.includes("blended_csv"));
  const canUseProRecommendations = Boolean(
    draftProAccess?.capabilities.includes("recommendations"),
  );
  const canUseProScenarios = Boolean(draftProAccess?.capabilities.includes("scenarios"));
  const canUseProReports = Boolean(draftProAccess?.capabilities.includes("reports"));
  const canOpenScenarioHistory = Boolean(user);
  const canOpenReportHistory = Boolean(user);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("league");
  const [fullSettings, setFullSettings] = useState(false);
  const [settingsConfigured, setSettingsConfigured] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [accountSettingsKnown, setAccountSettingsKnown] = useState(false);
  const settingsEditorRef = useRef<DraftSettingsHandle>(null);
  const initialSetupChecked = useRef(false);
  const sessionResumedRef = useRef(false);
  const openSettings = useCallback((section: SettingsSection) => {
    setSettingsSection(section);
    setFullSettings(false);
    setSettingsOpen(true);
  }, []);
  useEffect(() => {
    if (mobileWorkspaceEnabled && activeMobileTab === "setup") {
      setActiveMobileTab("players");
    }
  }, [activeMobileTab, mobileWorkspaceEnabled, setActiveMobileTab]);
  const [suggestedCompareIds, setSuggestedCompareIds] = useState<string[]>([]);
  const [suggestedCompareOpen, setSuggestedCompareOpen] = useState(false);
  const [savedDraftsMounted, setSavedDraftsMounted] = useState(false);
  const [scenarioWorkspace, setScenarioWorkspace] = useState<ScenarioWorkspaceState>({ mounted: false, open: false, candidateIds: [] });
  const [reportsMounted, setReportsMounted] = useState(false);
  const [openedReportDraft, setOpenedReportDraft] = useState<OpenedReportDraft | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readStoredFavoriteIds);
  const [scenarioSavedImportContext, setScenarioSavedImportContext] = useState<ScenarioSavedImportContext | null>(null);
  const [workspaceAnnotations, setWorkspaceAnnotations] = useState<SavedDraftAnnotations>({
    selectedPlayerId: null,
    notes: [],
    tiers: {},
  });

  // Import CSV modal state
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  // New: Custom CSV source label (from session import)
  const [customCsvLabel, setCustomCsvLabel] = useState<string | undefined>(
    undefined,
  );
  // Multi-CSV rows live in memory with a versioned, tab-scoped fallback only.
  const [customCsvList, setCustomCsvList] = useState<SessionCsvEntry[]>([]);
  const [exportCsvState, setExportCsvState] = useState<"idle" | "loading">("idle");
  const [exportCsvMessage, setExportCsvMessage] = useState<string | null>(null);
  const getCsvList = useCallback(() => customCsvList, [customCsvList]);
  const setCsvList = useCallback((next: SessionCsvEntry[]) => {
    if (typeof window === "undefined") return;
    try {
      setCustomCsvList(next);
      saveCustomCsvSession(next);
    } catch {}
  }, []);
  useEffect(() => {
    setCustomCsvList(loadCustomCsvSession());
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
  const [sourceControls, setSourceControls] = useState(
    sourceControlDefaults.skater,
  );

  // NEW: Goalie projection source controls
  const [goalieSourceControls, setGoalieSourceControls] = useState(
    sourceControlDefaults.goalie,
  );
  const [sourcePreferencesReady, setSourcePreferencesReady] = useState(false);
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
    const saved = loadSourceControlPreferences(sourceControlDefaults);
    setSourceControls(saved.skater);
    setGoalieSourceControls(saved.goalie);
    setSourcePreferencesReady(true);
  }, [sourceControlDefaults]);

  useEffect(() => {
    if (typeof window === "undefined" || !sourcePreferencesReady) return;
    const timer = window.setTimeout(() => {
      try {
        saveSourceControlPreferences(
          { version: 4, skater: sourceControls, goalie: goalieSourceControls },
          sourceControlDefaults,
        );
      } catch {}
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    goalieSourceControls,
    sourceControlDefaults,
    sourceControls,
    sourcePreferencesReady,
  ]);

  // NEW: Goalie scoring values (editable via settings)
  const [goaliePointValues, setGoaliePointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("goalie"));
  const [fantraxLeagueOverride, setFantraxLeagueOverride] =
    useState<DraftFantraxSelection | null>(null);
  const [espnLeagueOverride, setEspnLeagueOverride] =
    useState<EspnLeagueSelection | null>(null);

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
    favorites?: (string | number)[];
    notes?: readonly { readonly id: string; readonly text: string }[];
    tiers?: Record<string, string>;
    fantraxLeagueOverride?: DraftFantraxSelection | null;
    espnLeagueOverride?: EspnLeagueSelection | null;
    preserveExactCategoryWeights?: boolean;
    configured?: boolean;
  };
  type AdaptableBrowserSnapshot = ReturnType<typeof parseBrowserSnapshot> | ReturnType<typeof restoreBrowserSnapshot>;

  const adaptBrowserSnapshot = useCallback((snapshot: AdaptableBrowserSnapshot): DraftSnapshotV2 => {
    if (!isDraftSettings(snapshot.draftSettings)) throw new Error("Saved draft settings are invalid.");
    const isRecord = isSnapshotRecord;
    const { draftedPlayers, customCsvList } = adaptSavedDraftRows(snapshot);
    const stringRecord = (value: Record<string, unknown>, label: string) => {
      if (Object.values(value).some((entry) => typeof entry !== "string")) throw new Error(`Saved ${label} are invalid.`);
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, entry as string]));
    };
    const sourceControlRecord = (value: Record<string, unknown>, label: string) => Object.fromEntries(Object.entries(value).map(([id, control]) => {
      if (!isRecord(control) || typeof control.isSelected !== "boolean" || typeof control.weight !== "number" || !Number.isFinite(control.weight)) throw new Error(`Saved ${label} source controls are invalid.`);
      return [id, { isSelected: control.isSelected, weight: control.weight }];
    }));
    const fantrax = snapshot.fantraxLeagueOverride;
    if (fantrax !== undefined && fantrax !== null && (!isRecord(fantrax) || typeof fantrax.connectedAccountId !== "string" || typeof fantrax.externalLeagueId !== "string" || !(typeof fantrax.externalTeamId === "string" || fantrax.externalTeamId === null) || typeof fantrax.settingsHash !== "string")) throw new Error("Saved Fantrax league selection is invalid.");
    const espn = snapshot.espnLeagueOverride;
    if (espn !== undefined && espn !== null && (!isRecord(espn) || espn.provider !== "espn" || typeof espn.namespace !== "string" || typeof espn.connectedAccountId !== "string" || typeof espn.externalLeagueId !== "string" || !(typeof espn.externalTeamId === "string" || espn.externalTeamId === null) || typeof espn.settingsHash !== "string")) throw new Error("Saved ESPN league selection is invalid.");
    const roundCount = rosterRoundCount(snapshot.draftSettings.rosterConfig);
    return {
      v: 2, ts: Date.now(), draftSettings: snapshot.draftSettings, draftedPlayers,
      keepers: migrateKeeperEntries(snapshot.keepers, snapshot.draftSettings.teamCount),
      pickOwnerOverrides: snapshot.pickOwnerOverrides,
      pickTrades: migratePickTrades(snapshot.pickTrades ?? snapshot.pickOwnerOverrides, { draftOrder: snapshot.draftSettings.draftOrder, roundCount, orderPattern: normalizeDraftOrderPattern({ mode: snapshot.draftSettings.draftOrderMode, reversedRounds: snapshot.draftSettings.reversedRounds }, roundCount, snapshot.isSnakeDraft) }),
      positionOverrides: snapshot.positionOverrides, customTeamNames: snapshot.customTeamNames, currentPick: snapshot.currentPick,
      isSnakeDraft: snapshot.isSnakeDraft, myTeamId: snapshot.myTeamId, baselineMode: snapshot.baselineMode,
      needWeightEnabled: snapshot.needWeightEnabled, needAlpha: snapshot.needAlpha, forwardGrouping: snapshot.forwardGrouping,
      personalizeReplacement: snapshot.personalizeReplacement, goaliePointValues: snapshot.goaliePointValues,
      sourceControls: sourceControlRecord(snapshot.sourceControls, "skater"), goalieSourceControls: sourceControlRecord(snapshot.goalieSourceControls, "goalie"), customCsvList,
      favorites: snapshot.favorites, notes: snapshot.notes, tiers: isRecord(snapshot.tiers) ? stringRecord(snapshot.tiers, "tiers") : (() => { throw new Error("Saved tiers are invalid."); })(),
      fantraxLeagueOverride: fantrax as DraftFantraxSelection | null | undefined,
      espnLeagueOverride: espn as EspnLeagueSelection | null | undefined,
      preserveExactCategoryWeights: snapshot.preserveExactCategoryWeights, configured: snapshot.configured,
    };
  }, []);

  const saveSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !manualDraftingEnabled) return;
    const payload: DraftSnapshotV2 = {
      v: 2,
      ts: Date.now(),
      draftSettings,
      draftedPlayers: manualDraftedPlayers,
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
      favorites: favoriteIds,
      notes: workspaceAnnotations.notes,
      tiers: workspaceAnnotations.tiers,
      fantraxLeagueOverride,
      espnLeagueOverride,
      preserveExactCategoryWeights,
      configured: settingsConfigured,
    };
    try {
      sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(payload));
      return true;
    } catch {
      setSettingsSaveError("Could not save this draft on this device. Export a bookmark, free browser storage, then try Done again.");
      return false;
    }
  }, [
    draftSettings,
    manualDraftedPlayers,
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
    settingsConfigured,
    manualDraftingEnabled,
    fantraxLeagueOverride,
    espnLeagueOverride,
    preserveExactCategoryWeights,
    workspaceAnnotations,
    favoriteIds,
  ]);

  const prepareSnapshot = useCallback((snap: DraftSnapshotV2) => {
    if (snap.v !== 2) throw new Error("Unsupported draft snapshot.");
      const restoredSettings = normalizeDraftSettingsOrder({
        ...DEFAULT_DRAFT_SETTINGS,
        ...snap.draftSettings,
        allowCustomNameFallback:
          snap.draftSettings?.allowCustomNameFallback ?? true,
        customSourceMinimumCoverage:
          typeof snap.draftSettings?.customSourceMinimumCoverage === "number"
            ? snap.draftSettings.customSourceMinimumCoverage
            : 25,
      }, snap.isSnakeDraft ?? true);
      const restoredKeepers = migrateKeeperEntries(
        snap.keepers,
        snap.draftSettings?.teamCount || DEFAULT_DRAFT_SETTINGS.teamCount,
      );
      const restoredDraftedPlayers = materializeKeeperPicks(
        snap.draftedPlayers || [], restoredKeepers,
      );
      const restoredPickTrades = migratePickTrades(
        snap.pickTrades ?? snap.pickOwnerOverrides, {
          draftOrder: restoredSettings.draftOrder,
          roundCount: rosterRoundCount(restoredSettings.rosterConfig),
          orderPattern: normalizeDraftOrderPattern(
            {
              mode: restoredSettings.draftOrderMode,
              reversedRounds: restoredSettings.reversedRounds,
            },
            rosterRoundCount(restoredSettings.rosterConfig),
            snap.isSnakeDraft ?? true,
          ),
        },
      );
      const customCsvList = Array.isArray(snap.customCsvList) ? snap.customCsvList : [];
      const customSourceIds = Array.isArray(snap.customCsvList)
        ? snap.customCsvList.map((entry: SessionCsvEntry) => entry.id)
        : [];
      const restoredSourceControls = sanitizeControls(sourceControlDefaults.skater, snap.sourceControls, customSourceIds);
      const restoredGoalieSourceControls = sanitizeControls(sourceControlDefaults.goalie, snap.goalieSourceControls, customSourceIds);
      const preserveExactCategoryWeights = snap.preserveExactCategoryWeights === true ||
          Boolean(
            (snap.fantraxLeagueOverride || snap.espnLeagueOverride) &&
              snap.draftSettings?.leagueType === "categories",
          );
      const nextFavorites = Array.isArray(snap.favorites) ? snap.favorites.map(String) : favoriteIds;
      const browser: BrowserDraftSnapshot = {
        v: 2,
        draftSettings: restoredSettings as unknown as Record<string, unknown>,
        draftedPlayers: restoredDraftedPlayers as BrowserDraftSnapshot["draftedPlayers"],
        keepers: restoredKeepers as BrowserDraftSnapshot["keepers"],
        pickOwnerOverrides: snap.pickOwnerOverrides || {},
        pickTrades: restoredPickTrades as BrowserDraftSnapshot["pickTrades"],
        positionOverrides: snap.positionOverrides || {}, customTeamNames: snap.customTeamNames || {},
        currentPick: snap.currentPick || 1, isSnakeDraft: snap.isSnakeDraft ?? true, myTeamId: snap.myTeamId || "Team 1",
        baselineMode: snap.baselineMode || "remaining", needWeightEnabled: !!snap.needWeightEnabled,
        needAlpha: typeof snap.needAlpha === "number" ? snap.needAlpha : 0.5,
        forwardGrouping: snap.forwardGrouping || "split", personalizeReplacement: !!snap.personalizeReplacement,
        goaliePointValues: snap.goaliePointValues || getDefaultFantasyPointsConfig("goalie"),
        sourceControls: restoredSourceControls, goalieSourceControls: restoredGoalieSourceControls,
        customCsvList: customCsvList as BrowserDraftSnapshot["customCsvList"], favorites: nextFavorites,
        notes: [...(snap.notes ?? [])], tiers: snap.tiers ?? {}, fantraxLeagueOverride: snap.fantraxLeagueOverride ?? null,
        espnLeagueOverride: snap.espnLeagueOverride ?? null, preserveExactCategoryWeights, configured: snap.configured !== false,
      };
      return { browser, apply: () => {
        setDraftSettings(restoredSettings); setSettingsConfigured(snap.configured !== false); setKeepers(restoredKeepers);
        setManualDraftedPlayers(restoredDraftedPlayers); setPickTrades(restoredPickTrades); setPositionOverrides(snap.positionOverrides || {});
        setCustomTeamNames(snap.customTeamNames || {}); setCurrentPick(snap.currentPick || 1); setMyTeamId(snap.myTeamId || "Team 1");
        setBaselineMode(snap.baselineMode || "remaining"); setNeedWeightEnabled(!!snap.needWeightEnabled);
        setNeedAlpha(typeof snap.needAlpha === "number" ? snap.needAlpha : 0.5); setForwardGrouping(snap.forwardGrouping || "split");
        setPersonalizeReplacement(!!snap.personalizeReplacement); setGoaliePointValues(snap.goaliePointValues || getDefaultFantasyPointsConfig("goalie"));
        setSourceControls(restoredSourceControls); setGoalieSourceControls(restoredGoalieSourceControls);
        setFantraxLeagueOverride(snap.fantraxLeagueOverride ?? null); setEspnLeagueOverride(snap.espnLeagueOverride ?? null);
        setPreserveExactCategoryWeights(preserveExactCategoryWeights); setCsvList(customCsvList);
        setWorkspaceAnnotations({ selectedPlayerId: null, notes: [...(snap.notes ?? [])], tiers: snap.tiers ?? {} });
        setFavoriteIds(nextFavorites);
        try { window.localStorage.setItem("projections.favorites", JSON.stringify(nextFavorites)); } catch {}
        window.dispatchEvent(new CustomEvent("draft-saved-favorites-changed"));
        restoredLeagueSettingsRef.current = true; manualLeagueSettingsDirtyRef.current = true;
      } };
  }, [favoriteIds, setCsvList, sourceControlDefaults]);

  const loadSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem("draft.snapshot.v2");
      if (!raw) return false;
      const prepared = prepareSnapshot(JSON.parse(raw) as DraftSnapshotV2);
      prepared.apply();
      return true;
    } catch {
      return false;
    }
  }, [prepareSnapshot]);

  const getSavedBrowserSnapshot = useCallback((): BrowserDraftSnapshot => ({
    v: 2,
    draftSettings: draftSettings as unknown as Record<string, unknown>,
    draftedPlayers: manualDraftedPlayers as unknown as BrowserDraftSnapshot["draftedPlayers"],
    keepers: keepers as unknown as BrowserDraftSnapshot["keepers"],
    pickOwnerOverrides,
    pickTrades: pickTrades as unknown as BrowserDraftSnapshot["pickTrades"],
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
    customCsvList: customCsvList as BrowserDraftSnapshot["customCsvList"],
    favorites: favoriteIds,
    notes: [...workspaceAnnotations.notes],
    tiers: workspaceAnnotations.tiers,
    fantraxLeagueOverride,
    espnLeagueOverride,
    preserveExactCategoryWeights,
    configured: settingsConfigured,
  }), [customCsvList, currentPick, draftSettings, espnLeagueOverride, fantraxLeagueOverride, favoriteIds, forwardGrouping, goaliePointValues, goalieSourceControls, isSnakeDraft, keepers, manualDraftedPlayers, myTeamId, needAlpha, needWeightEnabled, pickOwnerOverrides, pickTrades, positionOverrides, preserveExactCategoryWeights, sourceControls, customTeamNames, settingsConfigured, baselineMode, personalizeReplacement, workspaceAnnotations]);

  const applySavedBrowserSnapshot = useCallback((snapshot: BrowserDraftSnapshot) => {
    try {
      const validated = parseBrowserSnapshot(snapshot);
      // Validate the same canonical round trip used by cloud restores before
      // writing the session or touching live dashboard state.
      const serialized = serializeSavedDraft(validated);
      const incoming = adaptBrowserSnapshot(validated);
      const imports = toNormalizedPrivateImports(incoming.customCsvList);
      const restored = restoreBrowserSnapshot(serialized, imports);
      const prepared = prepareSnapshot(adaptBrowserSnapshot(restored));
      sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ ...prepared.browser, ts: Date.now() }));
      prepared.apply();
      return prepared.browser;
    } catch {
      return false;
    }
  }, [adaptBrowserSnapshot, prepareSnapshot]);

  // On mount: offer to resume snapshot
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (snapshotResumeAttemptedRef.current) return;
    snapshotResumeAttemptedRef.current = true;
    if (draftMode === "yahoo") {
      restoredLeagueSettingsRef.current = true;
      setSettingsConfigured(true);
      return;
    }
    const raw = sessionStorage.getItem("draft.snapshot.v2");
    if (raw) {
      snapshotWasPresentRef.current = true;
      const ok = window.confirm("Resume your last Draft Dashboard session?");
      if (ok) sessionResumedRef.current = loadSnapshot();
      else {
        sessionStorage.removeItem("draft.snapshot.v2");
        window.localStorage.removeItem("draftDashboard.session.v1");
        sessionStorage.setItem("draft.resume.declined", "true");
        clearCustomCsvSession();
      }
    }
  }, [draftMode, loadSnapshot]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      accountDefaultsAppliedForUserRef.current = null;
      return;
    }
    if (!sessionReady || draftMode !== "manual") return;
    if (accountDefaultsAppliedForUserRef.current === userId) return;
    accountDefaultsAppliedForUserRef.current = userId;
    if (restoredLeagueSettingsRef.current) return;

    let active = true;
    void supabase
      .from("user_settings")
      .select(
        "league_type, scoring_categories, goalie_scoring_categories, category_weights, roster_config, team_count, draft_order_type, ui_preferences, active_context",
      )
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setAccountSettingsKnown(true);
        if (error || !data || manualLeagueSettingsDirtyRef.current) return;
        restoredLeagueSettingsRef.current = true;
        setSettingsConfigured(true);
        const defaults = mapUserSettingsRowToLeagueSettings(data);
        setDraftSettings((previous) => ({
          ...previous,
          teamCount: defaults.teamCount,
          draftOrder: resizeDraftOrder(previous.draftOrder, defaults.teamCount),
          leagueType: defaults.leagueType,
          scoringCategories: defaults.scoringCategories,
          categoryWeights: defaults.categoryWeights,
          rosterConfig: {
            ...defaults.rosterConfig,
            bench: defaults.rosterConfig.bench ?? 0,
            utility: defaults.rosterConfig.utility ?? 0,
          },
          draftOrderMode:
            defaults.draftOrderType === "snake" ? "snake" : "standard",
          reversedRounds: [],
        }));
        setGoaliePointValues(defaults.goalieScoringCategories);
        const accountForwardGrouping = forwardGroupingForRoster(
          defaults.rosterConfig,
        );
        if (accountForwardGrouping) setForwardGrouping(accountForwardGrouping);
        setPreserveExactCategoryWeights(
          defaults.leagueType === "categories" &&
            Boolean(defaults.activeContext.provider) &&
            Boolean(defaults.activeContext.applied_settings_hash),
        );
      });
    return () => {
      active = false;
    };
  }, [draftMode, sessionReady, user?.id]);

  useEffect(() => {
    if (authLoading || !sessionReady || initialSetupChecked.current || (user && !accountSettingsKnown && !restoredLeagueSettingsRef.current)) return;
    initialSetupChecked.current = true;
    if (manualDraftingEnabled && (!sessionResumedRef.current || !settingsConfigured)) {
      setSettingsConfigured(false);
      setFullSettings(true);
      setSettingsOpen(true);
      setSettingsSection("league");
    }
  }, [authLoading, sessionReady, user, accountSettingsKnown, settingsConfigured, manualDraftingEnabled]);

  // Persist snapshot as state changes
  useEffect(() => {
    if (!sessionReady) return;
    saveSnapshot();
  }, [sessionReady, saveSnapshot]);

  // Get player projections data (skaters)
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0);
  const customSkaterSources = useMemo(() => buildCustomProjectionSources(
    customCsvList,
    "skater",
    [
      ["Games_Played", "GAMES_PLAYED"], ["Goals", "GOALS"], ["Assists", "ASSISTS"], ["Points", "POINTS"],
      ["Plus_Minus", "PLUS_MINUS"], ["Shots_on_Goal", "SHOTS_ON_GOAL"], ["Hits", "HITS"], ["Blocked_Shots", "BLOCKED_SHOTS"],
      ["Penalty_Minutes", "PENALTY_MINUTES"], ["PP_Points", "PP_POINTS"], ["PP_Goals", "PP_GOALS"], ["PP_Assists", "PP_ASSISTS"],
      ["SH_Points", "SH_POINTS"], ["SH_Goals", "SH_GOALS"], ["Time_on_Ice_Per_Game", "TIME_ON_ICE_PER_GAME"],
      ["Faceoffs_Won", "FACEOFFS_WON"], ["Faceoffs_Lost", "FACEOFFS_LOST"],
    ].map(([dbColumnName, key]) => ({ key: key as any, dbColumnName })),
  ), [customCsvList]);
  const customGoalieSources = useMemo(() => buildCustomProjectionSources(
    customCsvList,
    "goalie",
    [
      ["Games_Played", "GAMES_PLAYED"], ["Wins_Goalie", "WINS_GOALIE"], ["Losses_Goalie", "LOSSES_GOALIE"],
      ["Otl", "OTL_GOALIE"], ["Saves_Goalie", "SAVES_GOALIE"], ["Sa", "SHOTS_AGAINST_GOALIE"],
      ["Ga", "GOALS_AGAINST_GOALIE"], ["Save_Percentage", "SAVE_PERCENTAGE"], ["Goals_Against_Average", "GOALS_AGAINST_AVERAGE"],
      ["Shutouts_Goalie", "SHUTOUTS_GOALIE"],
    ].map(([dbColumnName, key]) => ({ key: key as any, dbColumnName })),
  ), [customCsvList]);
  const skaterData = useProcessedProjectionsData({
    activePlayerType: "skater",
    sourceControls,
    yahooDraftMode: "ALL",
    fantasyPointSettings: draftSettings.scoringCategories,
    supabaseClient: supabase,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    styles: EMPTY_PROJECTION_STYLES,
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: NOOP_PROJECTION_TOGGLE,
    teamCountForRoundSummaries: draftSettings.teamCount,
    customAdditionalSources: customSkaterSources,
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
    styles: EMPTY_PROJECTION_STYLES,
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: NOOP_PROJECTION_TOGGLE,
    teamCountForRoundSummaries: draftSettings.teamCount,
    customAdditionalSources: customGoalieSources,
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
    else {
      const legacy = window.localStorage.getItem("suggested.rosterVorpEnabled");
      if (legacy === "true" || legacy === "false")
        setNeedWeightEnabled(legacy === "true");
    }
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
    if (legacyResumeAttemptedRef.current) return; // prevent double-run in StrictMode
    legacyResumeAttemptedRef.current = true;
    if (draftMode === "yahoo" || snapshotWasPresentRef.current) {
      setSessionReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem("draftDashboard.session.v1");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          const ok = window.confirm("Resume draft from previous session?");
          if (ok) {
            sessionResumedRef.current = true;
            const restoredSettings = normalizeDraftSettingsOrder(
              {
                ...DEFAULT_DRAFT_SETTINGS,
                ...(saved.draftSettings || {}),
              },
              saved.isSnakeDraft ?? true,
            );
            setDraftSettings(restoredSettings);
            setSettingsConfigured(saved.configured !== false);
            restoredLeagueSettingsRef.current = true;
            manualLeagueSettingsDirtyRef.current = true;
            const restoredKeepers = migrateKeeperEntries(
              saved.keepers,
              saved.draftSettings?.teamCount ||
                DEFAULT_DRAFT_SETTINGS.teamCount,
            );
            setKeepers(restoredKeepers);
            setManualDraftedPlayers(
              materializeKeeperPicks(
                Array.isArray(saved.draftedPlayers) ? saved.draftedPlayers : [],
                restoredKeepers,
              ),
            );
            if (typeof saved.currentPick === "number")
              setCurrentPick(saved.currentPick);
            if (typeof saved.myTeamId === "string") setMyTeamId(saved.myTeamId);
            if (saved.customTeamNames)
              setCustomTeamNames(saved.customTeamNames);
            setFantraxLeagueOverride(saved.fantraxLeagueOverride ?? null);
            setEspnLeagueOverride(saved.espnLeagueOverride ?? null);
            setPreserveExactCategoryWeights(
              saved.preserveExactCategoryWeights === true ||
                Boolean(
                  (saved.fantraxLeagueOverride || saved.espnLeagueOverride) &&
                    saved.draftSettings?.leagueType === "categories",
                ),
            );
            if (
              saved.forwardGrouping === "fwd" ||
              saved.forwardGrouping === "split"
            )
              setForwardGrouping(saved.forwardGrouping);
            setPickTrades(
              migratePickTrades(saved.pickTrades ?? saved.pickOwnerOverrides, {
                draftOrder: restoredSettings.draftOrder,
                roundCount: rosterRoundCount(restoredSettings.rosterConfig),
                orderPattern: normalizeDraftOrderPattern(
                  {
                    mode: restoredSettings.draftOrderMode,
                    reversedRounds: restoredSettings.reversedRounds,
                  },
                  rosterRoundCount(restoredSettings.rosterConfig),
                  saved.isSnakeDraft ?? true,
                ),
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
  }, [draftMode]);

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
          if (entry.playerType === "goalie") delete next[entry.id];
          else next[entry.id] ||= { isSelected: true, weight: 1 };
        }
        return next;
      });
      setGoalieSourceControls((prev) => {
        const next = { ...prev };
        for (const entry of customCsvList) {
          if (entry.playerType === "skater") delete next[entry.id];
          else next[entry.id] ||= { isSelected: true, weight: 1 };
        }
        return next;
      });
    } catch {}
  }, [customCsvList]);

  // Persist session on change (only after resume decision)
  React.useEffect(() => {
    if (!sessionReady) return;
    if (!manualDraftingEnabled) return;
    if (typeof window === "undefined") return;
    const payload = {
      version: 1,
      configured: settingsConfigured,
      draftSettings,
      draftedPlayers: manualDraftedPlayers,
      currentPick,
      isSnakeDraft,
      myTeamId,
      customTeamNames,
      forwardGrouping,
      pickOwnerOverrides,
      pickTrades,
      keepers,
      fantraxLeagueOverride,
      espnLeagueOverride,
      preserveExactCategoryWeights,
    };
    try {
      window.localStorage.setItem(
        "draftDashboard.session.v1",
        JSON.stringify(payload),
      );
    } catch {}
  }, [
    sessionReady,
    settingsConfigured,
    draftSettings,
    manualDraftedPlayers,
    currentPick,
    isSnakeDraft,
    myTeamId,
    customTeamNames,
    forwardGrouping,
    keepers,
    fantraxLeagueOverride,
    espnLeagueOverride,
    preserveExactCategoryWeights,
    pickOwnerOverrides,
    pickTrades,
    manualDraftingEnabled,
  ]);

  // Calculate current turn and team
  const manualCurrentTurn = useMemo(() => {
    const round = Math.ceil(currentPick / draftSettings.teamCount);
    const pickInRound = ((currentPick - 1) % draftSettings.teamCount) + 1;

    const teamId = resolvePickOwner({
      round,
      pickInRound,
      draftOrder: draftSettings.draftOrder,
      orderPattern: draftOrderPattern,
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
    draftOrderPattern,
    myTeamId,
    pickTrades,
    keepers,
  ]);

  // Add team name update function
  const updateTeamName = useCallback((teamId: string, newName: string) => {
    if (!manualDraftingEnabled) return;
    setCustomTeamNames((prev) => ({
      ...prev,
      [teamId]: newName,
    }));
  }, [manualDraftingEnabled]);

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

  const yahooReconciliation = useMemo(
    () => reconcileYahooDraftState(yahooDraftSync.draftState, allPlayers),
    [allPlayers, yahooDraftSync.draftState],
  );
  const espnReconciliation = useMemo(
    () => reconcileEspnDraftState(espnDraftSync.draftState, allPlayers),
    [allPlayers, espnDraftSync.draftState],
  );

  useEffect(() => {
    const state = espnDraftSync.draftState;
    if (!state) return;
    const configuration = espnDraftDashboardConfiguration(state);
    if (!configuration.draftOrder.length) return;
    const configurationKey = `${state.session.id}:${state.league.settings.sourceHash}`;
    if (espnAppliedConfigurationRef.current !== configurationKey) {
      espnAppliedConfigurationRef.current = configurationKey;
      setDraftSettings((previous) => ({
        ...previous,
        teamCount: configuration.teamCount,
        draftOrder: configuration.draftOrder,
        rosterConfig: {
          C: 0,
          LW: 0,
          RW: 0,
          D: 0,
          G: 0,
          bench: 0,
          utility: 0,
          ...configuration.rosterConfig,
        },
        leagueType: configuration.leagueType,
        scoringCategories: configuration.scoringCategories,
        categoryWeights: configuration.categoryWeights,
        draftOrderMode: configuration.isSnakeDraft ? "snake" : "standard",
        reversedRounds: [],
      }));
      setGoaliePointValues(configuration.goalieScoringCategories);
      setCustomTeamNames(configuration.customTeamNames);
      setMyTeamId(configuration.myTeamId);
      const importedForwardGrouping = forwardGroupingForRoster(
        configuration.rosterConfig,
      );
      if (importedForwardGrouping) setForwardGrouping(importedForwardGrouping);
      setPreserveExactCategoryWeights(configuration.leagueType === "categories");
      setFantraxLeagueOverride(null);
      setEspnLeagueOverride({
        provider: "espn",
        namespace: `espn:${state.league.id}`,
        connectedAccountId: state.league.connectedAccountId,
        externalLeagueId: state.league.id,
        externalTeamId: state.session.externalTeamId,
        settingsHash: state.league.settings.sourceHash,
      });
    }
    setManualDraftedPlayers((previous) => {
      const next = espnReconciliation.draftedPlayers;
      const unchanged =
        previous.length === next.length &&
        previous.every((pick, index) => {
          const candidate = next[index];
          return (
            candidate != null &&
            pick.pickNumber === candidate.pickNumber &&
            pick.playerId === candidate.playerId &&
            pick.teamId === candidate.teamId &&
            pick.espnMappingStatus === candidate.espnMappingStatus
          );
        });
      return unchanged ? previous : next;
    });
    setCurrentPick((previous) =>
      previous === espnReconciliation.currentPick
        ? previous
        : espnReconciliation.currentPick,
    );
    setDraftHistory([]);
    setPickTrades((previous) => (previous.length ? [] : previous));
    setKeepers((previous) => (previous.length ? [] : previous));
  }, [espnDraftSync.draftState, espnReconciliation]);
  const currentTurn = useMemo(() => {
    if (draftMode === "manual") return manualCurrentTurn;
    const expected = yahooReconciliation.expectedNext;
    const teamId = expected.yahooTeamKey || manualCurrentTurn.teamId;
    return {
      round: expected.roundNumber,
      pickInRound: expected.pickInRound,
      teamId,
      isMyTurn: teamId === myTeamId,
    };
  }, [draftMode, manualCurrentTurn, myTeamId, yahooReconciliation.expectedNext]);
  const yahooDraftedPlayers = yahooReconciliation.draftedPlayers;
  const draftedPlayers: DraftedPlayer[] = selectDraftedPlayersForMode(
    draftMode,
    manualDraftedPlayers,
    yahooDraftedPlayers,
  );
  const draftPlayerNames = useMemo(() => {
    const names = new Map(allPlayers.map(player => [String(player.playerId), player.fullName]));
    for (const pick of draftedPlayers) {
      const name = pick.espnDisplayName || pick.yahooDisplayName;
      if (name && !names.has(pick.playerId)) names.set(pick.playerId, name);
    }
    return names;
  }, [allPlayers, draftedPlayers]);
  const noPickKeeperAssignments = useMemo<RosterAssignment[]>(
    () =>
      draftMode === "manual"
        ? keepers
            .filter((keeper) => !keeperUsesPick(keeper))
            .map((keeper) => ({
              playerId: keeper.playerId,
              teamId: keeper.teamId,
              isKeeper: true,
              keeperCost: "none" as const,
            }))
        : [],
    [draftMode, keepers],
  );
  const rosterAssignments = useMemo<RosterAssignment[]>(
    () => [...draftedPlayers, ...noPickKeeperAssignments],
    [draftedPlayers, noPickKeeperAssignments],
  );
  const unavailablePlayerIds = useMemo(
    () => new Set(rosterAssignments.map((assignment) => assignment.playerId)),
    [rosterAssignments],
  );
  const teamRosterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const assignment of rosterAssignments) {
      counts[assignment.teamId] = (counts[assignment.teamId] ?? 0) + 1;
    }
    return counts;
  }, [rosterAssignments]);
  const hasOrdinaryManualPick = manualDraftedPlayers.some(
    (player) => !player.isKeeper,
  );

  const personalRankByPlayerId = useMemo(() => {
    const rankByNhlPlayerId = new Map<number, number>();
    const rankByYahooPlayerId = new Map<number, number>();
    for (const entry of draftRanking.entries.data?.entries || []) {
      if (entry.nhlPlayerId != null) {
        rankByNhlPlayerId.set(Number(entry.nhlPlayerId), entry.rank);
      }
      if (entry.yahooPlayerId != null) {
        rankByYahooPlayerId.set(Number(entry.yahooPlayerId), entry.rank);
      }
    }
    const next: Record<string, number> = {};
    for (const player of allPlayers) {
      const byNhl = rankByNhlPlayerId.get(Number(player.playerId));
      const byYahoo =
        player.yahooPlayerId != null
          ? rankByYahooPlayerId.get(Number(player.yahooPlayerId))
          : undefined;
      const rank = byNhl ?? byYahoo;
      if (rank != null) next[String(player.playerId)] = rank;
    }
    return next;
  }, [allPlayers, draftRanking.entries.data?.entries]);

  useEffect(() => {
    if (draftMode === "yahoo") {
      setCurrentPick(yahooReconciliation.currentPick);
    }
  }, [draftMode, yahooReconciliation.currentPick]);

  useEffect(() => {
    const saved = restoredYahooPersistenceRef.current;
    if (!saved?.sessionId || !yahooFeatureEnabled) return;
    if (yahooSessionId === saved.sessionId) {
      restoredYahooPersistenceRef.current = null;
      return;
    }
    resumeYahooSession(saved.sessionId, saved.externalLeagueId);
    // Avoid scheduling a second resume while the first session GET is pending.
    restoredYahooPersistenceRef.current = null;
  }, [
    resumeYahooSession,
    yahooFeatureEnabled,
    yahooSessionId,
  ]);

  useEffect(() => {
    if (
      !yahooFeatureEnabled &&
      draftMode === "yahoo" &&
      yahooRequestState !== "idle" &&
      yahooRequestState !== "loading"
    ) {
      setDraftMode("manual");
      setCurrentPick(
        getNextOpenPick(1, Number.MAX_SAFE_INTEGER, manualDraftedPlayers),
      );
      clearYahooSession();
    }
  }, [
    draftMode,
    manualDraftedPlayers,
    clearYahooSession,
    yahooFeatureEnabled,
    yahooRequestState,
  ]);

  useEffect(() => {
    if (draftMode !== "yahoo" || !yahooTerminalSessionMissing) return;
    setDraftMode("manual");
    setCurrentPick(
      getNextOpenPick(1, Number.MAX_SAFE_INTEGER, manualDraftedPlayers),
    );
  }, [
    draftMode,
    manualDraftedPlayers,
    yahooTerminalSessionMissing,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftMode === "yahoo" && !yahooSessionId) return;
    saveYahooDraftPersistence(window.sessionStorage, {
      mode: yahooFeatureEnabled ? draftMode : "manual",
      sessionId: yahooFeatureEnabled ? yahooSessionId : null,
      externalLeagueId: yahooFeatureEnabled
        ? yahooSelectedLeagueId || null
        : null,
    });
  }, [
    draftMode,
    yahooFeatureEnabled,
    yahooSelectedLeagueId,
    yahooSessionId,
  ]);

  // Yahoo team keys are the identity used by every pick. Synchronize these
  // structural fields as soon as Yahoo becomes authoritative; roster/scoring
  // remain an explicit Apply action below.
  useEffect(() => {
    if (draftMode !== "yahoo" || !yahooDraftSync.draftState) return;
    const configuration = deriveYahooDraftDashboardConfiguration(
      yahooDraftSync.draftState,
    );
    if (!configuration.draftOrder.length) return;
    setDraftSettings((previous) => {
      const sameDraftOrder =
        previous.draftOrder.length === configuration.draftOrder.length &&
        previous.draftOrder.every(
          (teamKey, index) => teamKey === configuration.draftOrder[index],
        );
      const nextOrderMode = configuration.isSnakeDraft
        ? "snake"
        : "standard";
      if (
        previous.teamCount === configuration.teamCount &&
        sameDraftOrder &&
        previous.draftOrderMode === nextOrderMode
      ) {
        return previous;
      }
      return {
        ...previous,
        teamCount: configuration.teamCount,
        draftOrder: configuration.draftOrder,
        draftOrderMode: nextOrderMode,
        reversedRounds: [],
      };
    });
    setCustomTeamNames((previous) => {
      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(configuration.customTeamNames);
      if (
        previousKeys.length === nextKeys.length &&
        nextKeys.every(
          (teamKey) =>
            previous[teamKey] === configuration.customTeamNames[teamKey],
        )
      ) {
        return previous;
      }
      return configuration.customTeamNames;
    });
    setMyTeamId(
      configuration.myTeamId || configuration.draftOrder[0] || "Team 1",
    );
  }, [draftMode, yahooDraftSync.draftState]);

  const applyYahooSettings = useCallback(() => {
    if (!yahooDraftSync.draftState) return;
    const configuration = deriveYahooDraftDashboardConfiguration(yahooDraftSync.draftState);
    const scoringIncomplete = yahooSettingsRequireScoringConfirmation(
      yahooDraftSync.draftState,
    );
    const draftOrderInferred = yahooSettingsRequireDraftOrderConfirmation(
      yahooDraftSync.draftState,
    );
    const generalConfirmation = yahooSettingsRequireGeneralConfirmation(
      yahooDraftSync.draftState,
    );
    const settingsWarnings = yahooSettingsWarnings(yahooDraftSync.draftState);
    if (
      (scoringIncomplete || draftOrderInferred || generalConfirmation) &&
      typeof window !== "undefined" &&
      !window.confirm(
        [
          scoringIncomplete
            ? "Yahoo scoring is incomplete or includes unsupported stats; rankings will use only the supported Yahoo stats that were mapped."
            : "",
          draftOrderInferred
            ? "Yahoo did not explicitly confirm draft order, so snake order is assumed."
            : "",
          settingsWarnings.length
            ? `Yahoo also reported: ${settingsWarnings.join(" ")}`
            : "",
          "Apply these Yahoo league settings?",
        ]
          .filter(Boolean)
          .join(" "),
      )
    ) {
      return;
    }
    setDraftSettings((previous) => ({
      ...previous,
      teamCount: configuration.draftOrder.length
        ? configuration.teamCount
        : previous.teamCount,
      draftOrder: configuration.draftOrder.length
        ? configuration.draftOrder
        : previous.draftOrder,
      ...(configuration.rosterConfig
        ? { rosterConfig: configuration.rosterConfig as DraftSettings["rosterConfig"] }
        : {}),
      ...(configuration.leagueType
        ? { leagueType: configuration.leagueType }
        : {}),
      ...(configuration.scoringCategories
        ? { scoringCategories: configuration.scoringCategories }
        : {}),
      ...(configuration.categoryWeights
        ? { categoryWeights: configuration.categoryWeights }
        : {}),
      draftOrderMode:
        configuration.isSnakeDraft === false ? "standard" : "snake",
      reversedRounds: [],
    }));
    setCustomTeamNames(configuration.customTeamNames);
    if (configuration.myTeamId) setMyTeamId(configuration.myTeamId);
  }, [yahooDraftSync.draftState]);

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
    return allPlayers.filter(
      (player) => !unavailablePlayerIds.has(String(player.playerId)),
    );
  }, [allPlayers, unavailablePlayerIds]);

  // Track the 84-game proration toggle (shared via localStorage).
  const [prorate84, setProrate84] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const current = window.localStorage.getItem("projections.prorate84");
    return current == null
      ? window.localStorage.getItem("projections.prorate82") === "true"
      : current === "true";
  });
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail && typeof e.detail.value === "boolean") {
        setProrate84(e.detail.value);
      } else {
        // fallback read
        setProrate84(
          window.localStorage.getItem("projections.prorate84") === "true",
        );
      }
    };
    window.addEventListener("projections:prorate84", handler as any);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "projections.prorate84") {
        setProrate84(ev.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("projections:prorate84", handler as any);
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
      orderPattern: draftOrderPattern,
      trades: draftMode === "manual" ? pickTrades : [],
      keepers: draftMode === "manual" ? keepers : [],
      completedPickNumbers: draftedPlayers.map((player) => player.pickNumber),
      teamRosterCounts,
      rosterCapacity: rosterRoundCount(draftSettings.rosterConfig),
      maxPickNumber: currentPick + remainingDraftSpan,
    });
  }, [
    draftSettings.teamCount,
    draftSettings.draftOrder,
    draftSettings.rosterConfig,
    myTeamId,
    draftOrderPattern,
    currentPick,
    draftedPlayers,
    draftMode,
    pickTrades,
    keepers,
    teamRosterCounts,
  ]);

  const myFilledSlotsForVorp = useMemo(() => {
    const rosterPlayers = rosterAssignments
      .filter((assignment) => assignment.teamId === myTeamId)
      .map((assignment) => {
        const player = allPlayers.find(
          (candidate) => String(candidate.playerId) === assignment.playerId,
        );
        return {
          id: assignment.playerId,
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
    rosterAssignments,
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
    personalizeReplacement: false,
    prorate84,
  });

  const { playerMetrics: personalizedVorpMetrics } = useVORPCalculations({
    players: allPlayers,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType: draftSettings.leagueType || "points",
    baselineMode,
    categoryWeights: draftSettings.categoryWeights,
    forwardGrouping,
    myFilledSlots: myFilledSlotsForVorp,
    personalizeReplacement: draftProEligible && personalizeReplacement,
    prorate84,
  });

  const scheduleSettings = useMemo(() => normalizeScheduleSettings(draftSettings), [draftSettings]);
  const draftSchedule = useDraftSchedule(allPlayers, scheduleSettings.playoffWeeks, scheduleSettings.scheduleScope);
  const rosterScheduleOptimizer = useRosterScheduleOptimizer({
    gameKey: "477",
    endWeek: 27,
    players: allPlayers,
    rosterAssignments,
    myTeamId,
    rosterConfig: draftSettings.rosterConfig,
    vorpMetrics,
    calculateCandidates: false,
  });
  const dustRoster = useMemo(
    () => rosterAssignments
      .filter((assignment) => assignment.teamId === myTeamId)
      .map((assignment) => {
        const player = allPlayers.find((candidate) => String(candidate.playerId) === assignment.playerId);
        const positions = groupPlayerEligibility(
          normalizePlayerEligibility(player?.displayPosition, player?.eligiblePositions),
          forwardGrouping,
        );
        const override = positionOverrides[assignment.playerId]?.toUpperCase();
        return {
          playerId: assignment.playerId,
          playerName: player?.fullName,
          position: override && positions.includes(override) ? override : positions[0] ?? "Unassigned",
        };
      }),
    [allPlayers, forwardGrouping, myTeamId, positionOverrides, rosterAssignments],
  );

  const effectiveRosterConfig = useMemo(
    () => getEffectiveRosterConfig(draftSettings.rosterConfig, forwardGrouping),
    [draftSettings.rosterConfig, forwardGrouping],
  );

  const canUseProDust = Boolean(draftProAccess?.capabilities.includes("dust"));
  const [dustSort, setDustSort] = useState<"ordinary" | "schedule_fit">("ordinary");
  const [dustLineupMode, setDustLineupMode] = useState<"daily" | "weekly">("daily");
  const dustInput = useMemo(() => buildDraftProDustRequest({
    season: currentSeasonId == null ? null : String(currentSeasonId),
    lineupMode: dustLineupMode,
    sort: dustSort,
    inputOrigin: customCsvList.length ? "private_import" : "draft",
    allPlayers,
    availablePlayers,
    rosterAssignments,
    myTeamId,
    forwardGrouping,
    vorpMetrics,
    rosterSlots: effectiveRosterConfig,
  }), [allPlayers, availablePlayers, currentSeasonId, customCsvList.length, dustLineupMode, dustSort, effectiveRosterConfig, forwardGrouping, myTeamId, rosterAssignments, vorpMetrics]);
  const dustCandidateScopeLimited = availablePlayers.length > 500;
  const dustRequestAllowed = Boolean(dustInput && !customCsvList.length);
  const draftProDust = useDraftProDust(dustInput, canUseProDust && dustRequestAllowed);
  const draftProDustInsights = useMemo(() => new Map(
    draftProDust.result?.insights.map((insight) => [insight.playerId, {
      marginalDustGames: insight.marginalBenchGames,
      candidateScheduledGames: insight.candidateScheduledGames,
      activeGamesAdded: insight.activeGamesAdded,
      dustRate: insight.dustRate,
      risk: insight.risk,
      alternative: insight.alternatives[0] ? {
        playerId: insight.alternatives[0].playerId,
        playerName: insight.alternatives[0].playerName ?? insight.alternatives[0].playerId,
        dustReduction: insight.alternatives[0].dustReduction,
        valueDifference: insight.alternatives[0].valueDifference,
      } : undefined,
    }]) ?? [],
  ), [draftProDust.result]);

  const activeScoringCategories = useMemo(() =>
    draftSettings.leagueType === "categories"
      ? draftSettings.categoryWeights || {}
      : { ...draftSettings.scoringCategories, ...goaliePointValues },
    [draftSettings.leagueType, draftSettings.categoryWeights, draftSettings.scoringCategories, goaliePointValues],
  );

  // Team stats calculations
  const teamStats = useMemo((): TeamDraftStats[] => {
    return draftSettings.draftOrder.map((teamId) => {
      const teamPlayers = rosterAssignments.filter((p) => p.teamId === teamId);

      // Calculate projected points for this team (use merged pool)
      const projectedPoints = teamPlayers.reduce((total, draftedPlayer) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId,
        );
        return total + (player ? player.fantasyPoints.projected || 0 : 0);
      }, 0);

      // Group players by position for roster slots with UTIL separate and BENCH rules
      const rosterSlots: { [position: string]: RosterAssignment[] } = {};
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
            if (canFillPrimary) {
              rosterSlots[displayPos].push(draftedPlayer);
            } else if (
              rosterSlots["FWD"] &&
              rosterSlots["FWD"].length < (effectiveRosterConfig as any)["FWD"]
            ) {
              rosterSlots["FWD"].push(draftedPlayer);
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

      const CAT_KEYS = Object.keys(activeScoringCategories);
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
    rosterAssignments,
    allPlayers,
    customTeamNames,
    vorpMetrics,
    effectiveRosterConfig,
    positionOverrides,
    activeScoringCategories,
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
    getRosterPositions(forwardGrouping, effectiveRosterConfig).forEach((pos) => {
      const total = Math.max(1, Number(rc[pos] || 0));
      const filled = (rs[pos]?.length || 0) as number;
      const remaining = Math.max(0, total - filled);
      res[pos] = Math.min(1, remaining / total);
    });
    return res;
  }, [effectiveRosterConfig, forwardGrouping, myTeamStats]);

  const scenarioSchedule = useMemo(() => {
    if (!draftSchedule.selectedWeeks.length) return null;
    const weeks = draftSchedule.selectedWeeks.map((week) => week.week);
    return {
      startWeek: Math.min(...weeks),
      endWeek: Math.max(...weeks),
      lineupMode: dustLineupMode,
      rosterSlots: effectiveRosterConfig,
    };
  }, [draftSchedule.selectedWeeks, dustLineupMode, effectiveRosterConfig]);
  const scenarioAdapter = useMemo(() => adaptScenarioDashboard({
    players: allPlayers,
    availablePlayers,
    rosterAssignments,
    myTeamId,
    candidateIds: scenarioWorkspace.candidateIds,
    vorpMetrics,
    leagueType: draftSettings.leagueType || "points",
    scoring: { ...draftSettings.scoringCategories, ...goaliePointValues },
    categoryWeights: draftSettings.categoryWeights,
    positionNeeds: posNeeds,
    season: currentSeasonId == null ? null : String(currentSeasonId),
    schedule: scenarioSchedule,
    sourceControls,
    goalieSourceControls,
    customCsvList,
    savedImportContext: scenarioSavedImportContext,
  }), [allPlayers, availablePlayers, currentSeasonId, customCsvList, draftSettings.categoryWeights, draftSettings.leagueType, draftSettings.scoringCategories, goaliePointValues, goalieSourceControls, myTeamId, posNeeds, rosterAssignments, scenarioWorkspace.candidateIds, scenarioSavedImportContext, scenarioSchedule, sourceControls, vorpMetrics]);
  const openRosterImpact = useCallback((candidateIds: readonly string[] = []) => {
    setScenarioWorkspace((current) => showScenarioWorkspace(current, candidateIds));
    setSettingsSection("roster-impact");
    setSettingsOpen(true);
  }, []);
  const currentReportComplete = useMemo(() => {
    const expectedPicks = draftSettings.teamCount * rosterRoundCount(draftSettings.rosterConfig);
    return new Set([...draftedPlayers, ...keepers].map((player) => player.playerId)).size >= expectedPicks;
  }, [draftSettings.rosterConfig, draftSettings.teamCount, draftedPlayers, keepers]);
  const currentReportSnapshot = useMemo(() => ({
    ...getSavedBrowserSnapshot(),
    draftedPlayers: draftedPlayers as unknown as BrowserDraftSnapshot["draftedPlayers"],
  }), [draftedPlayers, getSavedBrowserSnapshot]);
  const reportReference = useMemo(() => {
    if (!currentReportComplete) return null;
    const myRosterCount = rosterAssignments.filter((assignment) => assignment.teamId === myTeamId).length;
    const expectedRosterSize = rosterRoundCount(draftSettings.rosterConfig);
    const teamId = draftSettings.draftOrder.find((team) => team !== myTeamId && rosterAssignments.filter((assignment) => assignment.teamId === team).length >= expectedRosterSize && myRosterCount >= expectedRosterSize);
    return teamId ? { teamId, teamName: `${customTeamNames[teamId] || teamId} roster`, complete: true } : null;
  }, [currentReportComplete, customTeamNames, draftSettings.draftOrder, draftSettings.rosterConfig, myTeamId, rosterAssignments]);
  const reportAdapter = useMemo(() => adaptReportDashboard({
    players: allPlayers,
    rosterAssignments,
    myTeamId,
    vorpMetrics,
    leagueType: draftSettings.leagueType || "points",
    scoring: { ...draftSettings.scoringCategories, ...goaliePointValues },
    goaliePointValues,
    categoryWeights: draftSettings.categoryWeights,
    season: currentSeasonId == null ? null : String(currentSeasonId),
    schedule: scenarioSchedule,
    sourceControls,
    goalieSourceControls,
    customCsvList,
    current: openedReportDraft ? null : { snapshot: currentReportSnapshot, complete: currentReportComplete, savedImportContext: scenarioSavedImportContext },
    openedDraft: openedReportDraft,
    reference: reportReference,
  }), [allPlayers, currentReportComplete, currentReportSnapshot, currentSeasonId, customCsvList, draftSettings.categoryWeights, draftSettings.leagueType, draftSettings.scoringCategories, goaliePointValues, goalieSourceControls, myTeamId, openedReportDraft, reportReference, rosterAssignments, scenarioSavedImportContext, scenarioSchedule, sourceControls, vorpMetrics]);

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
    const order = [
      ...getRosterPositions(forwardGrouping, effectiveRosterConfig),
      "UTIL",
    ];
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
  const nextManualActionablePick = useMemo(
    () =>
      findNextActionablePick({
        startPick: currentPick,
        maxPickNumber: totalPicks,
        draftOrder: draftSettings.draftOrder,
        orderPattern: draftOrderPattern,
        trades: pickTrades,
        keepers,
        completedPickNumbers: draftedPlayers.map((player) => player.pickNumber),
        teamRosterCounts,
        rosterCapacity: totalRosterSize,
      }),
    [
      currentPick,
      draftOrderPattern,
      draftSettings.draftOrder,
      draftedPlayers,
      keepers,
      pickTrades,
      teamRosterCounts,
      totalPicks,
      totalRosterSize,
    ],
  );
  const draftComplete =
    draftMode === "manual"
      ? nextManualActionablePick > totalPicks
      : draftedPlayers.length >= totalPicks;
  const [scoreboardPaused, setScoreboardPaused] = useState(false);
  const scoreboardSections = useMemo(() => {
    const recentPicks = [...draftedPlayers]
      .filter((pick) => pick.pickNumber < currentPick)
      .sort((a, b) => b.pickNumber - a.pickNumber)
      .slice(0, 5)
      .map((pick) => {
        const player = allPlayers.find((entry) => String(entry.playerId) === pick.playerId);
        const name = player?.fullName || pick.espnDisplayName || pick.yahooDisplayName || `Player #${pick.playerId}`;
        return `#${pick.pickNumber} ${name} — ${customTeamNames[pick.teamId] || pick.teamId}`;
      });
    return [
      draftComplete ? "Draft complete" : `On the clock: ${customTeamNames[currentTurn.teamId] || currentTurn.teamId}`,
      `Pick ${Math.min(currentPick, totalPicks)} of ${totalPicks}`,
      recentPicks.length ? `Last ${recentPicks.length} picks: ${recentPicks.join(" • ")}` : "Awaiting the first pick",
    ];
  }, [allPlayers, currentPick, currentTurn.teamId, customTeamNames, draftComplete, draftedPlayers, totalPicks]);
  const scoreboardText = scoreboardSections.join("   •   ");
  const startYahooDraftSync = useCallback(async () => {
    if (espnLiveActive) return;
    const started = await startYahooSession();
    if (!started) return;
    setDraftMode("yahoo");
    setDraftHistory([]);
  }, [espnLiveActive, startYahooSession]);

  const startEspnDraftSync = useCallback(async () => {
    if (draftMode !== "manual") return;
    const started = await espnDraftSync.start();
    if (started) setDraftHistory([]);
  }, [draftMode, espnDraftSync]);

  const stopEspnAndContinueManually = useCallback(async () => {
    await espnDraftSync.stop();
    setDraftHistory([]);
  }, [espnDraftSync]);

  const stopYahooAndContinueManually = useCallback(async () => {
    let stoppedState = null;
    try {
      stoppedState = await stopYahooSession();
    } catch {
      return;
    }
    if (!stoppedState) return;
    const stoppedReconciliation = reconcileYahooDraftState(
      stoppedState,
      allPlayers,
    );
    const continuation = continueManuallyFromYahoo(stoppedReconciliation);
    setManualDraftedPlayers(continuation.draftedPlayers);
    setPickTrades([]);
    setKeepers([]);
    setCurrentPick(continuation.currentPick);
    setDraftHistory([]);
    setDraftMode("manual");
    clearYahooSession();
  }, [
    clearYahooSession,
    stopYahooSession,
    allPlayers,
  ]);

  // Auto-open summary when draft completes
  useEffect(() => {
    if (draftComplete) setIsSummaryOpen(true);
  }, [draftComplete]);

  const playerEligibility = useMemo(() => new Map(allPlayers.map(player => [String(player.playerId), normalizePlayerEligibility(player.displayPosition, player.eligiblePositions)])), [allPlayers]);
  const settingsValidationInput = useMemo(() => ({ settings: draftSettings, myTeamId, goalieScoring: goaliePointValues, skaterSources: sourceControls, goalieSources: goalieSourceControls, draftedPlayers, keepers, trades: pickTrades, playerEligibility, forwardGrouping }), [draftSettings, myTeamId, goaliePointValues, sourceControls, goalieSourceControls, draftedPlayers, keepers, pickTrades, playerEligibility, forwardGrouping]);
  const settingsValidation = useMemo(() => validateDraftSettings(settingsValidationInput), [settingsValidationInput]);
  const closeSettings = () => {
    if (!settingsValidation.valid) return false;
    if (manualDraftingEnabled && !saveSnapshot()) return false;
    setSettingsConfigured(true);
    setSettingsSaveError(null);
    setSettingsOpen(false);
    setFullSettings(false);
    return true;
  };

  // Draft a player - Updated to track history for undo and prevent drafting beyond completion
  const draftPlayer = useCallback(
    (playerId: string) => {
      if (!manualDraftingEnabled) return;
      if (!settingsConfigured || !settingsValidation.valid) { openSettings("league"); return; }
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

      setManualDraftedPlayers((prev) => [...prev, newDraftedPlayer]);
      setCurrentPick((prev) => prev + 1);
    },
    [
      currentTurn,
      currentPick,
      draftedPlayers,
      draftComplete,
      settingsConfigured,
      settingsValidation.valid,
      openSettings,
      manualDraftingEnabled,
    ],
  );

  // Assign a drafted player to a specific eligible slot (C/LW/RW/FWD/D/G/UTILITY)
  const assignPlayerToSlot = useCallback((playerId: string, pos: string) => {
    if (!manualDraftingEnabled) return;
    setPositionOverrides((prev) => ({
      ...prev,
      [playerId]: pos.toUpperCase(),
    }));
  }, [manualDraftingEnabled]);

  // Skip reserved picks and picks owned by teams whose rosters are full.
  useEffect(() => {
    if (!manualDraftingEnabled) return;
    if (nextManualActionablePick !== currentPick) {
      setCurrentPick(nextManualActionablePick);
    }
  }, [currentPick, manualDraftingEnabled, nextManualActionablePick]);

  // Add undo functionality
  const undoLastPick = useCallback(() => {
    if (!manualDraftingEnabled) return;
    if (draftHistory.length > 0) {
      const lastState = draftHistory[draftHistory.length - 1];
      setManualDraftedPlayers(lastState.players);
      setCurrentPick(lastState.pickNumber);
      setDraftHistory((prev) => prev.slice(0, -1));
    }
  }, [draftHistory, manualDraftingEnabled]);

  const replaceDraftPick = useCallback(
    (pickNumber: number, replacementPlayerId: string) => {
      if (!manualDraftingEnabled) {
        return {
          ok: false as const,
          message: "Live sync controls completed picks.",
        };
      }
      const allPlayerIds = new Set(
        allPlayers.map((player) => String(player.playerId)),
      );
      const result = replaceManualDraftPick({
        draftedPlayers: manualDraftedPlayers,
        currentPick,
        targetPickNumber: pickNumber,
        replacementPlayerId,
        selectablePlayerIds: new Set(
          Array.from(allPlayerIds).filter(
            (playerId) => !unavailablePlayerIds.has(playerId),
          ),
        ),
      });
      if (!result.ok) return result;

      setDraftHistory((previous) => [
        ...previous,
        { players: [...manualDraftedPlayers], pickNumber: currentPick },
      ]);
      setManualDraftedPlayers(result.players);
      return { ok: true as const, message: "Draft pick replaced." };
    },
    [
      allPlayers,
      currentPick,
      manualDraftedPlayers,
      manualDraftingEnabled,
      unavailablePlayerIds,
    ],
  );

  // Add reset draft functionality
  const resetDraft = useCallback(() => {
    if (!manualDraftingEnabled) return;
    setSettingsConfigured(false);
    setSettingsOpen(true);
    setFullSettings(true);
    setSettingsSection("league");
    setManualDraftedPlayers([]);
    setKeepers([]);
    setPickTrades([]);
    setPositionOverrides({});
    setCurrentPick(1);
    setDraftHistory([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("draftDashboard.session.v1");
        sessionStorage.removeItem("draft.snapshot.v2");
      } catch {}
    }
  }, [manualDraftingEnabled]);

  const updateDraftSettings = useCallback(
    (newSettings: Partial<DraftSettings>) => {
      if (!manualDraftingEnabled) return;
      const next = { ...draftSettings, ...newSettings };
      const structureChanged = next.teamCount !== draftSettings.teamCount || JSON.stringify(next.draftOrder) !== JSON.stringify(draftSettings.draftOrder) || next.draftOrderMode !== draftSettings.draftOrderMode || JSON.stringify(next.reversedRounds) !== JSON.stringify(draftSettings.reversedRounds);
      if (structureChanged && (draftedPlayers.length || keepers.length || pickTrades.length)) {
        setSettingsSaveError("Team count and draft order are locked while picks, keepers, or trades exist. Current picks are unchanged.");
        return;
      }
      if (newSettings.rosterConfig) {
        const conflict = validateDraftSettings({ ...settingsValidationInput, settings: next }).errors.find(issue => issue.domain === "roster");
        if (conflict) { setSettingsSaveError(conflict.message); return; }
      }
      manualLeagueSettingsDirtyRef.current = true;
      if (newSettings.categoryWeights) setPreserveExactCategoryWeights(true);
      setSettingsSaveError(null);
      setDraftSettings(normalizeDraftSettingsOrder(next, isSnakeDraft));
      if (!next.draftOrder.includes(myTeamId)) setMyTeamId(next.draftOrder[0] || "Team 1");
    },
    [draftSettings, draftedPlayers.length, keepers.length, pickTrades.length, isSnakeDraft, manualDraftingEnabled, myTeamId, settingsValidationInput],
  );
  const resetSettings = () => {
    if (!manualDraftingEnabled) return;
    if (!window.confirm("Reset league, roster, scoring, and projection settings to defaults? Completed picks will be preserved. Incompatible changes will be blocked.")) return;
    const candidate = { ...DEFAULT_DRAFT_SETTINGS, ...(draftedPlayers.length || keepers.length || pickTrades.length ? { teamCount: draftSettings.teamCount, draftOrder: draftSettings.draftOrder, draftOrderMode: draftSettings.draftOrderMode, reversedRounds: draftSettings.reversedRounds, isKeeper: draftSettings.isKeeper } : {}) };
    const validation = validateDraftSettings({ ...settingsValidationInput, settings: candidate, myTeamId: candidate.draftOrder.includes(myTeamId) ? myTeamId : candidate.draftOrder[0], goalieScoring: getDefaultFantasyPointsConfig("goalie"), skaterSources: sourceControlDefaults.skater, goalieSources: sourceControlDefaults.goalie });
    if (!validation.valid) { setSettingsSaveError(validation.errors[0].message); return; }
    updateDraftSettings(candidate);
    setGoaliePointValues(getDefaultFantasyPointsConfig("goalie"));
    setSourceControls(sourceControlDefaults.skater);
    setGoalieSourceControls(sourceControlDefaults.goalie);
  };

  const applyFantraxLeagueSettings = useCallback(
    (
      league: FantraxConnectionLeague,
      _teamId: string | null,
      selection: DraftFantraxSelection,
    ) => {
      if (!manualDraftingEnabled) return;
      const imported = league.settings;
      setDraftSettings((previous) => {
        const teamCount = imported.teamCount ?? previous.teamCount;
        const mappedRoster = Object.keys(imported.rosterConfig).length
          ? {
              C: 0,
              LW: 0,
              RW: 0,
              D: 0,
              G: 0,
              bench: 0,
              utility: 0,
              ...imported.rosterConfig,
            }
          : previous.rosterConfig;
        return {
          ...previous,
          teamCount,
          draftOrder: resizeDraftOrder(previous.draftOrder, teamCount),
          leagueType: imported.leagueType,
          rosterConfig: mappedRoster,
          ...(imported.leagueType === "points"
            ? { scoringCategories: imported.skaterScoringCategories }
            : { categoryWeights: imported.categoryWeights }),
          ...(imported.draftOrderType !== "unknown"
            ? {
                draftOrderMode:
                  imported.draftOrderType === "snake" ? "snake" : "standard",
                reversedRounds: [],
              }
            : {}),
        };
      });
      if (imported.leagueType === "points") {
        setGoaliePointValues(imported.goalieScoringCategories);
      }
      setPreserveExactCategoryWeights(imported.leagueType === "categories");
      const importedForwardGrouping = forwardGroupingForRoster(
        imported.rosterConfig,
      );
      if (importedForwardGrouping) setForwardGrouping(importedForwardGrouping);
      setMyTeamId((current) =>
        resizeDraftOrder(draftSettings.draftOrder, imported.teamCount ?? draftSettings.teamCount).includes(
          current,
        )
          ? current
          : draftSettings.draftOrder[0] || "Team 1",
      );
      setFantraxLeagueOverride(selection);
      setEspnLeagueOverride(null);
      manualLeagueSettingsDirtyRef.current = false;
    },
    [draftSettings.draftOrder, draftSettings.teamCount, manualDraftingEnabled],
  );

  const confirmEspnLeagueSettings = useCallback(
    (league: EspnConnectionLeague, selection: EspnLeagueSelection) => {
      const replacesActiveWork =
        manualLeagueSettingsDirtyRef.current ||
        Boolean(fantraxLeagueOverride) ||
        (espnLeagueOverride != null &&
          espnLeagueOverride.externalLeagueId !== selection.externalLeagueId);
      return (
        !replacesActiveWork ||
        typeof window === "undefined" ||
        window.confirm(
          `Replace the active league settings with ${league.name} (${league.seasonKey})? Drafted players and manual work will remain.`,
        )
      );
    },
    [espnLeagueOverride, fantraxLeagueOverride],
  );

  const applyEspnLeagueSettings = useCallback(
    (
      league: EspnConnectionLeague,
      _teamId: string | null,
      selection: EspnLeagueSelection,
    ) => {
      if (!manualDraftingEnabled) return;
      const imported = league.settings;
      setDraftSettings((previous) => {
        const teamCount = imported.teamCount ?? previous.teamCount;
        const mappedRoster = Object.keys(imported.rosterConfig).length
          ? {
              C: 0,
              LW: 0,
              RW: 0,
              D: 0,
              G: 0,
              bench: 0,
              utility: 0,
              ...imported.rosterConfig,
            }
          : previous.rosterConfig;
        return {
          ...previous,
          teamCount,
          draftOrder: resizeDraftOrder(previous.draftOrder, teamCount),
          leagueType: imported.leagueType,
          rosterConfig: mappedRoster,
          ...(imported.leagueType === "points"
            ? { scoringCategories: imported.skaterScoringCategories }
            : { categoryWeights: imported.categoryWeights }),
          ...(imported.draftOrderType !== "unknown"
            ? {
                draftOrderMode:
                  imported.draftOrderType === "snake" ? "snake" : "standard",
                reversedRounds: [],
              }
            : {}),
        };
      });
      if (imported.leagueType === "points") {
        setGoaliePointValues(imported.goalieScoringCategories);
      }
      setPreserveExactCategoryWeights(imported.leagueType === "categories");
      const importedForwardGrouping = forwardGroupingForRoster(
        imported.rosterConfig,
      );
      if (importedForwardGrouping) setForwardGrouping(importedForwardGrouping);
      setMyTeamId((current) => {
        const order = resizeDraftOrder(
          draftSettings.draftOrder,
          imported.teamCount ?? draftSettings.teamCount,
        );
        return order.includes(current) ? current : order[0] || "Team 1";
      });
      setEspnLeagueOverride(selection);
      setFantraxLeagueOverride(null);
      manualLeagueSettingsDirtyRef.current = false;
    },
    [
      draftSettings.draftOrder,
      draftSettings.teamCount,
      manualDraftingEnabled,
    ],
  );

  // Handlers: traded picks and keepers
  const addTradedPick = useCallback(
    (round: number, pickInRound: number, newOwnerTeamId: string) => {
      if (!manualDraftingEnabled) {
        return { ok: false as const, message: "Yahoo live sync controls pick ownership." };
      }
      const result = upsertPickTrade(
        { round, pickInRound, currentTeamId: newOwnerTeamId },
        {
          draftOrder: draftSettings.draftOrder,
          roundCount: totalRosterSize,
          orderPattern: draftOrderPattern,
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
      draftOrderPattern,
      keepers,
      pickTrades,
      totalRosterSize,
      manualDraftingEnabled,
    ],
  );
  const removeTradedPick = useCallback((round: number, pickInRound: number) => {
    if (!manualDraftingEnabled) return;
    const key = `${round}-${pickInRound}`;
    setPickTrades((previous) =>
      previous.filter((trade) => `${trade.round}-${trade.pickInRound}` !== key),
    );
  }, [manualDraftingEnabled]);
  const importTradedPicks = useCallback(
    (input: string) => {
      if (!manualDraftingEnabled) {
        return { ok: false as const, message: "Yahoo live sync controls pick ownership." };
      }
      const parsed = parsePickTradeImport(input);
      if (!parsed.ok) {
        return { ok: false as const, message: parsed.errors.join(" ") };
      }
      const result = validatePickTradeBatch(parsed.candidates, {
        draftOrder: draftSettings.draftOrder,
        roundCount: totalRosterSize,
        orderPattern: draftOrderPattern,
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
      draftOrderPattern,
      keepers,
      pickTrades,
      totalRosterSize,
      manualDraftingEnabled,
    ],
  );
  const resetTradedPicks = useCallback(() => {
    if (manualDraftingEnabled) setPickTrades([]);
  }, [manualDraftingEnabled]);

  const addKeeper = useCallback(
    (candidate: KeeperCandidate) => {
      if (!manualDraftingEnabled) {
        return { ok: false as const, message: "Yahoo live sync controls keeper picks." };
      }
      if (candidate.cost === "none" && hasOrdinaryManualPick) {
        return {
          ok: false as const,
          message: "No-pick keepers are locked after the first ordinary pick.",
        };
      }
      const result = validateKeeperCandidate(
        candidate,
        {
          teamCount: draftSettings.teamCount,
          roundCount: totalRosterSize,
          teamIds: draftSettings.draftOrder,
          playerIds: allPlayers.map((player) => String(player.playerId)),
          keepers,
          draftedPlayers,
          rosterCapacity: totalRosterSize,
          teamRosterCounts,
        },
      );
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join(" ") };
      }
      const nextKeepers = [...keepers, result.keeper];
      setKeepers(nextKeepers);
      setManualDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
      return { ok: true as const, message: "Keeper added." };
    },
    [
      allPlayers,
      draftSettings,
      draftedPlayers,
      hasOrdinaryManualPick,
      keepers,
      manualDraftingEnabled,
      teamRosterCounts,
      totalRosterSize,
    ],
  );
  const importKeepers = useCallback(
    (input: string) => {
      if (!manualDraftingEnabled) {
        return { ok: false as const, message: "Yahoo live sync controls keeper picks." };
      }
      const parsed = parseKeeperImport(input);
      if (!parsed.ok) {
        return { ok: false as const, message: parsed.errors.join(" ") };
      }
      if (
        hasOrdinaryManualPick &&
        parsed.candidates.some((candidate) => candidate.cost === "none")
      ) {
        return {
          ok: false as const,
          message: "No-pick keepers are locked after the first ordinary pick.",
        };
      }
      const result = validateKeeperBatch(parsed.candidates, {
        teamCount: draftSettings.teamCount,
        roundCount: totalRosterSize,
        teamIds: draftSettings.draftOrder,
        playerIds: allPlayers.map((player) => String(player.playerId)),
        keepers,
        draftedPlayers,
        rosterCapacity: totalRosterSize,
        teamRosterCounts,
      });
      if (!result.ok) {
        return { ok: false as const, message: result.errors.join("\n") };
      }
      const nextKeepers = [...keepers, ...result.keepers];
      setKeepers(nextKeepers);
      setManualDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
      return {
        ok: true as const,
        message: `${result.keepers.length} keeper${result.keepers.length === 1 ? "" : "s"} imported.`,
      };
    },
    [
      allPlayers,
      draftSettings,
      draftedPlayers,
      hasOrdinaryManualPick,
      keepers,
      manualDraftingEnabled,
      teamRosterCounts,
      totalRosterSize,
    ],
  );
  const removeKeeper = useCallback(
    (playerId: string) => {
      if (!manualDraftingEnabled) {
        return { ok: false as const, message: "Live sync controls keepers." };
      }
      const target = keepers.find((keeper) => keeper.playerId === playerId);
      if (!target) {
        return { ok: false as const, message: "Keeper was not found." };
      }
      if (!keeperUsesPick(target) && hasOrdinaryManualPick) {
        return {
          ok: false as const,
          message: "No-pick keepers are locked after the first ordinary pick.",
        };
      }
      const nextKeepers = keepers.filter(
        (keeper) => keeper.playerId !== playerId,
      );
      setKeepers(nextKeepers);
      setManualDraftedPlayers(materializeKeeperPicks(draftedPlayers, nextKeepers));
      return { ok: true as const, message: "Keeper removed." };
    },
    [
      draftedPlayers,
      hasOrdinaryManualPick,
      keepers,
      manualDraftingEnabled,
    ],
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
        if (!manualDraftingEnabled) return;
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
  }, [manualDraftingEnabled, undoLastPick]);

  const hasLoadedPlayers = allPlayers.length > 0;
  const isLoading =
    !hasLoadedPlayers && (seasonLoading || skaterData.isLoading || goalieData.isLoading);
  const combinedSourceErrors = [skaterData.error, goalieData.error].filter(
    (message): message is string => Boolean(message),
  );
  const sourcesRefreshing = seasonLoading || skaterData.isLoading || goalieData.isLoading;
  const sourcesUnavailable = Boolean(
    combinedSourceErrors.length ||
    skaterData.sourceWarnings?.length ||
    goalieData.sourceWarnings?.length,
  );
  const syncError = yahooDraftSync.error || espnDraftSync.error;
  const errorMessage =
    !seasonLoading && !hasLoadedPlayers && combinedSourceErrors.length > 0
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
  const tableDataNotices = useMemo(() => {
    const notices = buildDraftProDustNotices({
      projectionDataNotices,
      canUseProDust,
      hasPrivateImport: Boolean(customCsvList.length),
      candidateScopeLimited: dustCandidateScopeLimited,
      dust: draftProDust,
    });
    if (canUseProDust && draftSchedule.scope === "playoffs") {
      notices.push("Draft Pro DUST badges use the full regular-season Week 1–30 schedule. The playoff selection applies to free schedule metrics and the weekly matrix.");
    }
    return notices;
  }, [canUseProDust, customCsvList.length, draftProDust, dustCandidateScopeLimited, draftSchedule.scope, projectionDataNotices]);
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

  // --- CSV Export: server-formatted blended projections ---
  const exportBlendedProjectionsCsv = useCallback(async () => {
    setExportCsvMessage(null);
    if (!allPlayers.length) {
      setExportCsvMessage("There are no projections available to export yet.");
      return;
    }
    setExportCsvState("loading");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in to export blended projections.");
      const statKeys = Array.from(new Set(allPlayers.flatMap((player) => Object.keys(player.combinedStats || {})))).sort().slice(0, 64);
      const rows = allPlayers.map((player) => ({
        playerId: player.playerId,
        fullName: player.fullName,
        team: player.displayTeam || "",
        positions: player.displayPosition || "",
        fantasyPointsProjected: player.fantasyPoints.projected,
        fantasyPointsPerGame: player.fantasyPoints.projectedPerGame,
        yahooAvgPick: player.yahooAvgPick ?? null,
        yahooAvgRound: player.yahooAvgRound ?? null,
        yahooPctDrafted: player.yahooPctDrafted ?? null,
        projectedRank: player.projectedRank ?? null,
        ...Object.fromEntries(statKeys.map((key) => [`${key}_proj`, player.combinedStats[key]?.projected ?? null])),
      }));
      const sourceWeights = Object.fromEntries([
        ...Object.entries(sourceControls || {}).filter(([, control]) => control.isSelected).map(([key, control]) => [key, control.weight]),
        ...Object.entries(goalieSourceControls || {}).filter(([, control]) => control.isSelected).map(([key, control]) => [key, control.weight]),
      ]);
      const exportRequest = await requestDraftProExport({
        hasPrivateImport: Boolean(customCsvList.length),
        canUseProExport,
        token,
        payload: {
          season: currentSeasonId == null ? "unknown" : String(currentSeasonId),
          leagueType: (draftSettings.leagueType || "points") as "points" | "categories",
          sourceWeights,
          scoring: draftSettings.leagueType === "categories" ? draftSettings.categoryWeights || {} : draftSettings.scoringCategories,
          goalieScoring: goaliePointValues,
          adjustments: { prorate84: window.localStorage.getItem("projections.prorate84") === "true" },
          rows,
        },
      });
      if (exportRequest.message) {
        setExportCsvMessage(exportRequest.message);
        return;
      }
      const response = exportRequest.response!;
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message || "Unable to create the CSV export.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "fhfhockey-blended-projections.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportCsvMessage("Blended projections CSV downloaded.");
    } catch (error) {
      setExportCsvMessage(error instanceof Error ? error.message : "Unable to create the CSV export.");
    } finally {
      setExportCsvState("idle");
    }
  }, [allPlayers, canUseProExport, currentSeasonId, customCsvList.length, draftSettings.categoryWeights, draftSettings.leagueType, draftSettings.scoringCategories, goaliePointValues, goalieSourceControls, sourceControls]);

  const handleForwardGroupingChange = (mode: "split" | "fwd") => {
    const conflict = validateDraftSettings({ ...settingsValidationInput, forwardGrouping: mode }).errors.find(issue => issue.domain === "roster");
    if (conflict) { setSettingsSaveError(conflict.message); return; }
    setSettingsSaveError(null);
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

  // Keep table rendering independent of settings navigation and visibility.
  const projectionsTable = useMemo(() => (
    <ProjectionsTable
            onRefresh={() => setDataRefreshKey((k) => k + 1)}
            currentSeasonId={currentSeasonId}
            players={availablePlayers}
            allPlayers={allPlayers}
            draftedPlayers={draftedPlayers}
            unavailablePlayerIds={unavailablePlayerIds}
            isLoading={isLoading}
            error={errorMessage}
            onDraftPlayer={draftPlayer}
            canDraft={manualDraftingEnabled && settingsConfigured && settingsValidation.valid}
            personalRankByPlayerId={personalRankByPlayerId}
            vorpMetrics={vorpMetrics}
            replacementByPos={replacementByPos}
            baselineMode={baselineMode}
            onBaselineModeChange={setBaselineMode}
            expectedRuns={
              expectedTakenByPos && typeof expectedN === "number"
                ? { byPos: expectedTakenByPos, N: expectedN }
                : undefined
            }
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
            dataNotices={tableDataNotices}
            scheduleMetrics={draftSchedule.playerMetrics}
            dustInsights={canUseProDust ? draftProDustInsights : undefined}
            emptyStateMessage={projectionEmptyStateMessage}
            onFavoriteIdsChange={setFavoriteIds}
            onOpenRosterImpact={canUseProScenarios ? openRosterImpact : undefined}
          />
  ), [
    currentSeasonId, availablePlayers, allPlayers, draftedPlayers,
    unavailablePlayerIds, isLoading, errorMessage, draftPlayer,
    manualDraftingEnabled, settingsConfigured, settingsValidation.valid,
    personalRankByPlayerId, vorpMetrics, replacementByPos, baselineMode,
    expectedTakenByPos, expectedN, needWeightEnabled, posNeeds, needAlpha,
    nextPickNumber, draftSettings.leagueType, draftSettings.categoryWeights,
    draftSettings.scoringCategories, forwardGrouping, availableGoalieStatKeys,
    goaliePointValues, skaterData.yahooMappingDiagnostics,
    goalieData.yahooMappingDiagnostics, sourceRankImpacts,
    skaterData.inclusionDiagnostics, goalieData.inclusionDiagnostics,
    draftSchedule.playerMetrics, tableDataNotices, canUseProDust, draftProDustInsights, projectionEmptyStateMessage, setFavoriteIds, canUseProScenarios, openRosterImpact,
  ]);

  return (
    <main
      className={styles.dashboardContainer}
      data-god-view-open={godViewOpen}
      data-settings-open={settingsOpen}
      data-full-settings={fullSettings}
      data-mobile-tab={activeMobileTab}
    >
      <DraftWorkspaceHeader
        seasonId={FANTASY_PROJECTION_SEASON_ID}
        health={sourcesRefreshing ? "loading" : sourcesUnavailable || syncError || !hasLoadedPlayers ? "warning" : "healthy"}
        healthLabel={
          sourcesRefreshing ? "Loading draft sources"
            : errorMessage ? "Draft source error"
            : sourcesUnavailable ? "Some sources unavailable"
            : syncError ? "Sync needs attention"
            : !hasLoadedPlayers ? "No projection data"
            : !manualDraftingEnabled ? `${espnLiveActive ? "ESPN" : "Yahoo"} live sync`
            : "Draft sources ready"
        }
        draftProEligible={draftProEligible}
        onSettings={() => openSettings("league")}
        onHealth={() => openSettings("integrations")}
      />
      <MobileDraftTabs
        activeTab={activeMobileTab}
        onChange={(tab) => {
          if (tab === "setup") {
            openSettings("league");
            return;
          }
          if (settingsOpen && !closeSettings()) return;
          setActiveMobileTab(tab);
        }}
      />

      <DraftSettingsShell
        settings={draftSettings}
        sourceControls={sourceControls}
        goalieSourceControls={goalieSourceControls}
        open={settingsOpen}
        full={fullSettings}
        configured={settingsConfigured}
        draftProEligible={draftProEligible}
        validation={settingsValidation}
        saveError={settingsSaveError}
        onToggle={() => { setSettingsOpen(false); setFullSettings(false); setIsSummaryOpen(true); }}
        onClose={() => { setSettingsOpen(false); setFullSettings(false); }}
        onFullSetup={() => setFullSettings(true)}
        onDone={closeSettings}
        onResetSettings={resetSettings}
        onImport={() => { setSettingsSection("league"); settingsEditorRef.current?.importBookmark(); }}
        onExport={() => settingsEditorRef.current?.exportBookmark()}
        section={settingsSection}
        onSectionChange={(section) => {
          setSettingsSection(section);
          if (section === "saved-drafts") setSavedDraftsMounted(true);
          if (section === "roster-impact") setScenarioWorkspace((current) => ({ ...current, mounted: true, open: true }));
          if (section === "reports") setReportsMounted(true);
        }}
      >
      <div
        id="mobile-draft-panel-setup"
        className={styles.setupPanel}
        data-mobile-panel
        data-mobile-active={activeMobileTab === "setup"}
        role={mobileWorkspaceEnabled ? "tabpanel" : undefined}
        aria-labelledby={
          mobileWorkspaceEnabled ? "mobile-draft-tab-setup" : undefined
        }
      >
        <div className={styles.setupCore}>
          <div hidden={settingsSection === "integrations" || settingsSection === "saved-drafts" || settingsSection === "roster-impact" || settingsSection === "reports"}>
          <DraftSettings
        matchupWeeks={draftSchedule.weeks}
        matchupWeeksError={draftSchedule.weeksError}
        ref={settingsEditorRef}
        validation={settingsValidation}
        variant="inline"
        activeSection={settingsSection === "integrations" || settingsSection === "saved-drafts" || settingsSection === "roster-impact" || settingsSection === "reports" ? "league" : settingsSection}
        settings={draftSettings}
        onSettingsChange={updateDraftSettings}
        draftOrderPattern={draftOrderPattern}
        onDraftOrderPatternChange={(pattern) => updateDraftSettings({ draftOrderMode: pattern.mode, reversedRounds: pattern.reversedRounds })}
        myTeamId={myTeamId}
        onMyTeamIdChange={(value) => {
          if (manualDraftingEnabled) setMyTeamId(value);
        }}
        undoLastPick={undoLastPick}
        resetDraft={resetDraft}
        draftHistory={draftHistory}
        draftedPlayers={draftedPlayers}
        currentPick={currentPick}
        customTeamNames={customTeamNames}
        onUpdateTeamName={updateTeamName}
        forwardGrouping={forwardGrouping}
        onForwardGroupingChange={(value) => {
          if (manualDraftingEnabled) {
            manualLeagueSettingsDirtyRef.current = true;
            handleForwardGroupingChange(value);
          }
        }}
        sourceControls={sourceControls}
        onSourceControlsChange={setSourceControls}
        goalieSourceControls={goalieSourceControls}
        onGoalieSourceControlsChange={setGoalieSourceControls}
        goalieScoringCategories={goaliePointValues}
        onGoalieScoringChange={(value) => {
          if (manualDraftingEnabled) {
            manualLeagueSettingsDirtyRef.current = true;
            setGoaliePointValues(value);
          }
        }}
        onOpenSummary={() => { setSettingsOpen(false); setFullSettings(false); setIsSummaryOpen(true); }}
        onOpenImportCsv={() => { setSettingsOpen(false); setFullSettings(false); setIsImportCsvOpen(true); }}
        customSourceLabel={customCsvLabel}
        customSourceMetadata={customSourceMetadata}
        customCsvEntries={customCsvList}
        availableSkaterStatKeys={availableSkaterStatKeys}
        availableGoalieStatKeys={availableGoalieStatKeys}
        onExportCsv={exportBlendedProjectionsCsv}
        exportCsvDisabled={exportCsvState === "loading"}
        exportCsvMessage={exportCsvMessage}
        exportCsvUpgradeHref="/account?section=draft-pro"
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
        availablePlayersForQuickFix={availablePlayers.map((player) => ({
          id: String(player.playerId),
          fullName: player.fullName,
        }))}
        onReplaceDraftPick={replaceDraftPick}
        playersForKeeperAutocomplete={allPlayers.map((p) => ({
          id: Number(p.playerId),
          fullName: p.fullName,
        }))}
        draftLocked={!manualDraftingEnabled}
        structuralSettingsLocked={hasOrdinaryManualPick}
        draftLockReason={`${espnLiveActive ? "ESPN" : "Yahoo"} live sync controls picks and league structure. Stop sync to edit manual draft settings.`}
        onBookmarkCreate={() => {}}
        onBookmarkImport={(data) => {
          if (!manualDraftingEnabled) return;
          const importError = bookmarkImportError(data, getCsvList().map(source => source.id));
          if (importError) { setSettingsSaveError(importError); return; }
          try {
            const importedCsv = data.customCsvList === undefined ? getCsvList() : adaptSavedDraftRows({ draftedPlayers: [], customCsvList: data.customCsvList }).customCsvList;
            const importedSettings = normalizeDraftSettingsOrder(
              {
                ...draftSettings,
                ...(data.settings || {}),
              },
              typeof data.isSnakeDraft === "boolean"
                ? data.isSnakeDraft
                : isSnakeDraft,
            );
            setCsvList(importedCsv);
            setDraftSettings(importedSettings);
            setSettingsConfigured(true);
            setSettingsSaveError(null);
            restoredLeagueSettingsRef.current = true;
            manualLeagueSettingsDirtyRef.current = true;
            const restoredKeepers = migrateKeeperEntries(
              data.keepers,
              data.settings?.teamCount || draftSettings.teamCount,
            );
            setKeepers(restoredKeepers);
            setManualDraftedPlayers(
              materializeKeeperPicks(
                Array.isArray(data.draftedPlayers) ? data.draftedPlayers : [],
                restoredKeepers,
              ),
            );
            setPickTrades(
              migratePickTrades(data.pickTrades ?? data.pickOwnerOverrides, {
                draftOrder: importedSettings.draftOrder,
                roundCount: rosterRoundCount(importedSettings.rosterConfig),
                orderPattern: normalizeDraftOrderPattern(
                  {
                    mode: importedSettings.draftOrderMode,
                    reversedRounds: importedSettings.reversedRounds,
                  },
                  rosterRoundCount(importedSettings.rosterConfig),
                  typeof data.isSnakeDraft === "boolean"
                    ? data.isSnakeDraft
                    : isSnakeDraft,
                ),
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
            const customSourceIds = importedCsv.map((entry) => entry.id);
            if (data.sourceControls)
              setSourceControls(
                sanitizeControls(sourceControlDefaults.skater, data.sourceControls, customSourceIds),
              );
            if (data.goalieSourceControls)
              setGoalieSourceControls(
                sanitizeControls(sourceControlDefaults.goalie, data.goalieSourceControls, customSourceIds),
              );
            if (data.goalieScoringCategories)
              setGoaliePointValues(data.goalieScoringCategories);
            if (data.fantraxLeagueOverride)
              setFantraxLeagueOverride(data.fantraxLeagueOverride);
            if (data.espnLeagueOverride)
              setEspnLeagueOverride(data.espnLeagueOverride);
            setPreserveExactCategoryWeights(
              data.preserveExactCategoryWeights === true ||
                Boolean(
                  (data.fantraxLeagueOverride || data.espnLeagueOverride) &&
                    data.settings?.leagueType === "categories",
                ),
            );
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
          </div>

      <div hidden={settingsSection !== "integrations"}>
      {!user && <p className={styles.warningBanner}>Sign in to connect a Yahoo, ESPN, or Fantrax league and start Live Sync. Manual drafting is available now.</p>}
      {(hasOrdinaryManualPick || keepers.length > 0 || pickTrades.length > 0) && <p className={styles.warningBanner}>League imports are locked while manual picks, keepers, or trades exist. Export your draft and reset it before replacing the league configuration.</p>}
      <FantraxLeagueSettingsPanel
        enabled={Boolean(user?.id)}
        disabled={!manualDraftingEnabled || hasOrdinaryManualPick || keepers.length > 0 || pickTrades.length > 0}
        onApply={applyFantraxLeagueSettings}
      />

      <EspnLeagueSettingsPanel
        enabled={Boolean(user?.id)}
        disabled={!manualDraftingEnabled || hasOrdinaryManualPick || keepers.length > 0 || pickTrades.length > 0}
        contextLabel="draft session"
        onApply={applyEspnLeagueSettings}
        onConfirmApply={confirmEspnLeagueSettings}
      />

      {showFallbackBanner && (
        <div className={styles.warningBanner}>
          {`Name-fallback used for ${fallbackBannerMessages.join(" and ")}.`}
          {lowCoverageSources.length > 0 &&
            ` Coverage remains below ${coverageThreshold.toFixed(0)}%.`}
        </div>
      )}

      <YahooLiveDraftPanel
          mode={draftMode}
          authenticated={Boolean(user?.id)}
          draftProEligible={draftProEligible}
          liveSyncEnabled={yahooDraftSync.enabled}
          requestState={yahooDraftSync.requestState}
          leagues={yahooDraftSync.leagues}
          selectedLeagueId={yahooDraftSync.selectedLeagueId}
          draftState={yahooDraftSync.draftState}
          reconciliation={yahooReconciliation}
          isLoading={yahooDraftSync.requestState === "loading"}
          isPolling={yahooDraftSync.isPolling}
          error={yahooDraftSync.error}
          externalDraftLock={espnLiveActive}
          hasPersonalRanking={Boolean(
            draftRanking.bootstrap.data?.ranking?.id || yahooDraftSync.ranking?.id,
          )}
          onLeagueChange={yahooDraftSync.setSelectedLeagueId}
          onConnect={() => void yahooDraftSync.connect()}
          onRefreshAccount={() => void yahooDraftSync.refreshAccount()}
          onRefreshDraft={() => void yahooDraftSync.refreshDraft()}
          onStart={() => void startYahooDraftSync()}
          onApplySettings={() => {
            if (manualDraftingEnabled && (hasOrdinaryManualPick || keepers.length || pickTrades.length)) {
              setSettingsSaveError("League imports are locked while manual picks, keepers, or trades exist.");
              return;
            }
            applyYahooSettings();
          }}
          onStopAndContinueManually={() =>
            void stopYahooAndContinueManually()
          }
        />

      <EspnLiveDraftPanel
        enabled={espnDraftSync.enabled}
        leagues={espnDraftSync.leagues}
        selectedLeagueId={espnDraftSync.selectedLeagueId}
        state={espnDraftSync.draftState}
        reconciliation={espnReconciliation}
        active={espnLiveActive}
        blocked={draftMode === "yahoo"}
        isLoading={espnDraftSync.isLoading}
        isPolling={espnDraftSync.isPolling}
        error={espnDraftSync.error}
        onLeagueChange={espnDraftSync.setSelectedLeagueId}
        onReload={() => void espnDraftSync.reload()}
        onStart={() => void startEspnDraftSync()}
        onPoll={() => void espnDraftSync.refresh()}
        onStop={() => void stopEspnAndContinueManually()}
        onClear={espnDraftSync.clear}
      />
      </div>
      {savedDraftsMounted ? <div className={styles.workspacePanel} hidden={settingsSection !== "saved-drafts"}>
        <SavedDraftsWorkspace
          getBrowserSnapshot={getSavedBrowserSnapshot}
          applyBrowserSnapshot={applySavedBrowserSnapshot}
          players={allPlayers.map((player) => ({ id: String(player.playerId), name: player.fullName }))}
          annotations={workspaceAnnotations}
          onAnnotationsChange={setWorkspaceAnnotations}
          onSavedImportContextChange={setScenarioSavedImportContext}
          onOpenedReportDraftChange={setOpenedReportDraft}
        />
      </div> : null}
      {scenarioWorkspace.mounted ? <div className={styles.workspacePanel} hidden={settingsSection !== "roster-impact"}>
        {scenarioAdapter.unavailableReason ? <p role="status">{scenarioAdapter.unavailableReason}</p> : null}
        <ScenarioComparisonWorkspace eligible={canUseProScenarios} input={scenarioAdapter.input} draftId={scenarioAdapter.draftId} />
      </div> : null}
      {reportsMounted ? <div className={styles.workspacePanel} hidden={settingsSection !== "reports"}>
        {reportAdapter.unavailableReason ? <p role="status">{reportAdapter.unavailableReason}</p> : null}
        <AnalyticalReportsPanel
          eligible={canUseProReports}
          input={reportAdapter.input}
          snapshot={reportAdapter.snapshot}
          draftId={reportAdapter.draftId}
          privateImportDraftId={reportAdapter.privateImportDraftId}
        />
      </div> : null}
        </div>
      </div>
      </DraftSettingsShell>

      <GodView
        queue={selectGodViewQueue({ startPick: currentPick, maxPickNumber: totalPicks,
          draftOrder: draftSettings.draftOrder, orderPattern: draftOrderPattern,
          trades: manualDraftingEnabled ? pickTrades : [], keepers: manualDraftingEnabled ? keepers : [],
          completedPickNumbers: draftedPlayers.map((player) => player.pickNumber), draftedPlayers, teamRosterCounts, rosterCapacity: totalRosterSize })}
        categories={activeScoringCategories} leagueType={draftSettings.leagueType || "points"}
        playerNames={draftPlayerNames}
        teams={teamStats} rosterConfig={effectiveRosterConfig} myTeamId={myTeamId} selectedTeamId={inspectedTeamId || myTeamId}
        round={currentTurn.round} currentPick={currentPick} totalPicks={totalPicks} format={draftOrderPattern.mode} access={draftProAccess}
        onSelectTeam={(teamId) => { setRosterViewRequest({ teamId }); if (mobileWorkspaceEnabled) setActiveMobileTab("roster"); }}
        onExpandGraph={() => setGraphExpandRequest((value) => value + 1)}
        onSummary={() => setIsSummaryOpen(true)} onOpenChange={setGodViewOpen}
      />
      <div className={styles.mainContent} style={{ "--board-track": `${draftSettings.teamCount + 4}fr`, "--standings-track": `${draftSettings.teamCount + 6}fr` } as React.CSSProperties}>
      {/* Recommendations and roster progress share the left workspace track. */}
      <section
        id="mobile-draft-panel-suggested"
        className={styles.suggestedSection}
        data-mobile-panel
        data-mobile-active={activeMobileTab === "suggested"}
        role={mobileWorkspaceEnabled ? "tabpanel" : undefined}
        aria-labelledby={
          mobileWorkspaceEnabled ? "mobile-draft-tab-suggested" : undefined
        }
        hidden={mobileWorkspaceEnabled && activeMobileTab !== "suggested"}
      >
        <SuggestedPicks
          compact={false}
          onReturnToDraft={closeSettings}
          players={availablePlayers}
          isLoading={isLoading}
          error={errorMessage}
          dustInsights={canUseProDust ? draftProDustInsights : undefined}
          vorpMetrics={vorpMetrics}
          personalizedVorpMetrics={personalizedVorpMetrics}
          draftProEligible={canUseProRecommendations}
          categoryWeights={draftSettings.categoryWeights}
          recommendationDataOrigin={customCsvList.length ? "local_csv" : "server"}
          onNeedWeightEnabledChange={setNeedWeightEnabled}
          dustSort={dustSort}
          onDustSortChange={setDustSort}
          canUseProDust={canUseProDust && dustRequestAllowed}
          dustLineupMode={dustLineupMode}
          onDustLineupModeChange={setDustLineupMode}
          needWeightEnabled={needWeightEnabled}
          needAlpha={needAlpha}
          posNeeds={posNeeds}
          currentPick={currentPick}
          teamCount={draftSettings.teamCount}
          baselineMode={baselineMode}
          nextPickNumber={nextPickNumber}
          onDraftPlayer={(id) => draftPlayer(id)}
          canDraft={manualDraftingEnabled && settingsConfigured && settingsValidation.valid}
          personalRankByPlayerId={personalRankByPlayerId}
          leagueType={draftSettings.leagueType || "points"}
          catNeeds={catNeeds}
          rosterProgress={rosterProgress}
          personalizeReplacement={personalizeReplacement}
          onPersonalizeReplacementChange={setPersonalizeReplacement}
          forwardGrouping={forwardGrouping}
          onComparePlayer={toggleSuggestedComparison}
          compareSelectedIds={suggestedCompareIds}
        />
        <div
          className={styles.scoreboard}
          role="region"
          aria-label={`Draft scoreboard. ${scoreboardText}`}
          data-paused={scoreboardPaused}
          style={{ "--scoreboard-duration": `${Math.max(30, scoreboardText.length * 0.15)}s` } as React.CSSProperties}
        >
          <div className={styles.scoreboardViewport}>
            <div className={styles.scoreboardTrack} aria-hidden="true">
              {[0, 1].map((copy) => (
                <div key={copy} className={styles.scoreboardCycle}>
                  {scoreboardSections.map((section, index) => <span key={index}>{section}</span>)}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.scoreboardPause}
            onClick={() => setScoreboardPaused((paused) => !paused)}
            aria-label={scoreboardPaused ? "Resume draft scoreboard" : "Pause draft scoreboard"}
            aria-pressed={scoreboardPaused}
          >
            {scoreboardPaused ? "▶" : "Ⅱ"}
          </button>
        </div>
      </section>

        <section
          id="mobile-draft-panel-board"
          className={styles.leftPanel}
          data-mobile-panel
          data-mobile-active={activeMobileTab === "board"}
          role={mobileWorkspaceEnabled ? "tabpanel" : undefined}
          aria-labelledby={
            mobileWorkspaceEnabled ? "mobile-draft-tab-board" : undefined
          }
          hidden={mobileWorkspaceEnabled && activeMobileTab !== "board"}
        >
          <DraftStatus
            round={currentTurn.round}
            rounds={rosterRoundCount(draftSettings.rosterConfig)}
            currentPick={currentPick}
            totalPicks={
              draftSettings.teamCount *
              rosterRoundCount(draftSettings.rosterConfig)
            }
            teamName={
              customTeamNames[currentTurn.teamId] || currentTurn.teamId
            }
            nextPick={currentTurn.isMyTurn ? currentPick : nextPickNumber}
            picksUntilNext={currentTurn.isMyTurn ? 0 : picksUntilNext}
          />
          <DraftBoard
            expandedMetrics={<>
              <LeagueStandings scheduleMetrics={draftSchedule.playerMetrics} schedulePeriod={draftSchedule.periodLabel} teams={teamStats} categories={activeScoringCategories} leagueType={draftSettings.leagueType || "points"} myTeamId={myTeamId} vorpMetrics={vorpMetrics} onUpdateTeamName={updateTeamName} canEdit={manualDraftingEnabled} isLoading={isLoading} error={errorMessage} />
              {draftProAccess?.eligible && draftProAccess.capabilities.includes("god_view") && <section className={styles.graphRosterMetrics} aria-label="Team roster progress"><h2>Roster Progress · Pro</h2><div>{teamStats.map((team) => <div key={team.teamId}><strong title={team.teamName}>{team.teamName}</strong><span>{Object.values(team.rosterSlots).reduce((sum, slots) => sum + slots.length, team.bench.length)} / {totalRosterSize}</span><span>Needs: {godViewRosterNeeds(godViewRosterProgress(effectiveRosterConfig, team)).map((slot) => slot.label).join(" · ") || "Filled"}</span></div>)}</div></section>}
            </>}
            expandRequest={graphExpandRequest}
            myTeamId={myTeamId}
            draftSettings={draftSettings}
            draftedPlayers={draftedPlayers}
            currentTurn={currentTurn}
            teamStats={teamStats}
            draftOrderPattern={draftOrderPattern}
            allPlayers={allPlayers}
            onUpdateTeamName={updateTeamName}
            canEditTeamNames={manualDraftingEnabled}
            pickTrades={manualDraftingEnabled ? pickTrades : []}
            keepers={manualDraftingEnabled ? keepers : []}
            vorpMetrics={vorpMetrics}
          />
        </section>

        <LeagueStandings scheduleMetrics={draftSchedule.playerMetrics} schedulePeriod={draftSchedule.periodLabel} teams={teamStats} categories={activeScoringCategories} leagueType={draftSettings.leagueType || "points"} myTeamId={myTeamId} vorpMetrics={vorpMetrics} onUpdateTeamName={updateTeamName} canEdit={manualDraftingEnabled} isLoading={isLoading} error={errorMessage} />

        <section
          id="mobile-draft-panel-roster"
          className={styles.centerPanel}
          data-mobile-panel
          data-mobile-active={activeMobileTab === "roster"}
          role={mobileWorkspaceEnabled ? "tabpanel" : undefined}
          aria-labelledby={
            mobileWorkspaceEnabled ? "mobile-draft-tab-roster" : undefined
          }
          hidden={mobileWorkspaceEnabled && activeMobileTab !== "roster"}
        >
          <MyRoster
            onSelectedTeamChange={setInspectedTeamId}
            viewRequest={rosterViewRequest}
            nextPickByTeam={Object.fromEntries(draftSettings.draftOrder.map((teamId) => [teamId, currentPick + findPicksUntilTeamTurn({ currentPick, teamId, draftOrder: draftSettings.draftOrder, orderPattern: draftOrderPattern, trades: manualDraftingEnabled ? pickTrades : [], keepers: manualDraftingEnabled ? keepers : [], completedPickNumbers: draftedPlayers.map((player) => player.pickNumber), teamRosterCounts, rosterCapacity: rosterRoundCount(draftSettings.rosterConfig), maxPickNumber: draftSettings.teamCount * rosterRoundCount(draftSettings.rosterConfig) })]))}
            scheduleState={rosterScheduleOptimizer}
            myTeamId={myTeamId}
            teamStatsList={teamStats}
            draftSettings={draftSettings}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            onDraftPlayer={(id) => draftPlayer(id)}
            onMovePlayer={assignPlayerToSlot}
            canDraft={manualDraftingEnabled && settingsConfigured && settingsValidation.valid}
            currentPick={currentPick}
            currentTurn={currentTurn}
            teamOptions={teamOptions}
            vorpMetrics={vorpMetrics}
            needWeightEnabled={needWeightEnabled}
            needAlpha={needAlpha}
            posNeeds={posNeeds}
            forwardGrouping={forwardGrouping}
            scheduleOverview={<DustMatrix
              state={rosterScheduleOptimizer}
              weeks={draftSchedule.weeks}
              roster={dustRoster}
              selectedWeeks={draftSchedule.selectedWeeks}
              period={draftSchedule.periodLabel}
              error={draftSchedule.weeksError}
            />}
          />
        </section>

        <section
          id="mobile-draft-panel-players"
          className={styles.rightPanel}
          data-mobile-panel
          data-mobile-active={activeMobileTab === "players"}
          role={mobileWorkspaceEnabled ? "tabpanel" : undefined}
          aria-labelledby={
            mobileWorkspaceEnabled ? "mobile-draft-tab-players" : undefined
          }
          hidden={mobileWorkspaceEnabled && activeMobileTab !== "players"}
        >
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
          {projectionsTable}

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
        pickTrades={manualDraftingEnabled ? pickTrades : []}
        keepers={manualDraftingEnabled ? keepers : []}
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
        onImported={({ headers, rows, playerType, label, resolution }) => {
          // Append to list with incremental id custom_csv_1..n
          const list = getCsvList();
          const nextIndex = Math.max(0, ...list.map((entry) => Number(entry.id.replace("custom_csv_", "")) || 0)) + 1;
          const id = `custom_csv_${nextIndex}`;
          const next = [
            ...list,
            {
              id,
              label,
              playerType,
              headers,
              rows,
              resolution: {
                ...resolution,
                lastUpdated: resolution.lastUpdated || Date.now(),
              },
            },
          ];
          setCsvList(next);
          // Enable the imported source only for the chosen player groups.
          if (playerType !== "goalie") setSourceControls((prev) => ({
            ...prev,
            [id]: prev[id] || { isSelected: true, weight: 1 },
          }));
          if (playerType !== "skater") setGoalieSourceControls((prev) => ({
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
    </main>
  );
};

export default DraftDashboard;

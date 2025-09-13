// components/DraftDashboard/DraftDashboard.tsx

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect
} from "react";
import {
  useProcessedProjectionsData,
  ProcessedPlayer // Add this import
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

import styles from "./DraftDashboard.module.scss";

// Data Models from PRD
export interface DraftSettings {
  teamCount: number;
  scoringCategories: Record<string, number>;
  leagueType?: "points" | "categories";
  categoryWeights?: Record<string, number>; // used in categories mode
  // Whether this is a keeper league. Controls visibility of Keepers & Traded Picks section.
  isKeeper?: boolean;
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
  categoryWeights: {
    GOALS: 1,
    ASSISTS: 1,
    PP_POINTS: 1,
    SHOTS_ON_GOAL: 1,
    HITS: 1,
    BLOCKED_SHOTS: 1
  },
  rosterConfig: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    bench: 4,
    utility: 1
  },
  draftOrder: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`)
};

const DraftDashboard: React.FC = () => {
  const currentSeason = useCurrentSeason();
  const currentSeasonId = currentSeason?.seasonId;

  // Draft State
  const [draftSettings, setDraftSettings] = useState<DraftSettings>(
    DEFAULT_DRAFT_SETTINGS
  );
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [currentPick, setCurrentPick] = useState<number>(1);
  const [isSnakeDraft, setIsSnakeDraft] = useState<boolean>(true);
  const [myTeamId, setMyTeamId] = useState<string>("Team 1");
  // NEW: baseline mode for VORP replacement source (persisted)
  const [baselineMode, setBaselineMode] = useState<"remaining" | "full">(
    "remaining"
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
      const saved = window.localStorage.getItem(
        "draftDashboard.forwardGrouping.v1"
      );
      return saved === "fwd" ? "fwd" : "split";
    }
  );
  // NEW: personalized replacement toggle
  const [personalizeReplacement, setPersonalizeReplacement] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      return (
        window.localStorage.getItem(
          "draftDashboard.personalizeReplacement.v1"
        ) === "true"
      );
    }
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "draftDashboard.personalizeReplacement.v1",
      String(personalizeReplacement)
    );
  }, [personalizeReplacement]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "draftDashboard.forwardGrouping.v1",
      forwardGrouping
    );
  }, [forwardGrouping]);

  // NEW: Traded pick ownership overrides and keeper entries
  const [pickOwnerOverrides, setPickOwnerOverrides] = useState<
    Record<string, string>
  >({});
  const [keepers, setKeepers] = useState<
    Array<{
      round: number;
      pickInRound: number;
      teamId: string;
      playerId: string;
    }>
  >([]);

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

  // Import CSV modal state
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  // New: Custom CSV source label (from session import)
  const [customCsvLabel, setCustomCsvLabel] = useState<string | undefined>(
    undefined
  );

  // Projection Data Setup
  const [sourceControls, setSourceControls] = useState(() => {
    const controls: Record<string, { isSelected: boolean; weight: number }> =
      {};
    PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === "skater"
    ).forEach((source) => {
      controls[source.id] = { isSelected: true, weight: 1 };
    });
    return controls;
  });

  // NEW: Goalie projection source controls
  const [goalieSourceControls, setGoalieSourceControls] = useState(() => {
    const controls: Record<string, { isSelected: boolean; weight: number }> =
      {};
    PROJECTION_SOURCES_CONFIG.filter(
      (src) => src.playerType === "goalie"
    ).forEach((source) => {
      controls[source.id] = { isSelected: true, weight: 1 };
    });
    return controls;
  });

  // NEW: Goalie scoring values (editable via settings)
  const [goaliePointValues, setGoaliePointValues] = useState<
    Record<string, number>
  >(() => getDefaultFantasyPointsConfig("goalie"));

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
    refreshKey: dataRefreshKey
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
    refreshKey: dataRefreshKey
  });

  // Debug logging to see what data we're getting
  console.log("Debug - DraftDashboard projections (skaters/goalies):", {
    skaters: skaterData.processedPlayers.length,
    goalies: goalieData.processedPlayers.length,
    isLoading: skaterData.isLoading || goalieData.isLoading,
    error: skaterData.error || goalieData.error
  });

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
      String(needWeightEnabled)
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
      String(needAlpha)
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
            if (Array.isArray(saved.draftedPlayers))
              setDraftedPlayers(saved.draftedPlayers);
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
            if (
              saved.pickOwnerOverrides &&
              typeof saved.pickOwnerOverrides === "object"
            )
              setPickOwnerOverrides(saved.pickOwnerOverrides);
            if (Array.isArray(saved.keepers)) setKeepers(saved.keepers);
          }
        }
      }
    } catch {
    } finally {
      // Allow persistence after resume decision (or if none existed)
      setSessionReady(true);
    }
  }, []);

  // New: Restore custom CSV label from sessionStorage on mount
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("draft.customCsv.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.label === "string" && parsed.label) {
          setCustomCsvLabel(parsed.label);
          // Ensure control exists so it renders in DraftSettings
          setSourceControls((prev) => ({
            ...prev,
            custom_csv: prev.custom_csv || { isSelected: true, weight: 1 }
          }));
        }
      }
    } catch {}
  }, []);

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
      keepers
    };
    try {
      window.localStorage.setItem(
        "draftDashboard.session.v1",
        JSON.stringify(payload)
      );
    } catch {}
  }, [
    sessionReady,
    draftSettings,
    draftedPlayers,
    currentPick,
    isSnakeDraft,
    myTeamId,
    customTeamNames
  ]);

  // Calculate current turn and team
  const currentTurn = useMemo(() => {
    const round = Math.ceil(currentPick / draftSettings.teamCount);
    const pickInRound = ((currentPick - 1) % draftSettings.teamCount) + 1;

    const key = `${round}-${pickInRound}`;
    let defaultTeamIndex: number;
    if (isSnakeDraft && round % 2 === 0) {
      defaultTeamIndex = draftSettings.teamCount - pickInRound;
    } else {
      defaultTeamIndex = pickInRound - 1;
    }
    const defaultTeamId = draftSettings.draftOrder[defaultTeamIndex];
    const ownerOverride = pickOwnerOverrides[key];
    const teamId = ownerOverride || defaultTeamId;

    return {
      round,
      pickInRound,
      teamId,
      isMyTurn: teamId === myTeamId
    };
  }, [
    currentPick,
    draftSettings.teamCount,
    draftSettings.draftOrder,
    isSnakeDraft,
    myTeamId,
    pickOwnerOverrides
  ]);

  // Add team name update function
  const updateTeamName = useCallback((teamId: string, newName: string) => {
    setCustomTeamNames((prev) => ({
      ...prev,
      [teamId]: newName
    }));
  }, []);

  // Compute all players array from both skater and goalie data
  const skaterPlayers: ProcessedPlayer[] = useMemo(
    () =>
      skaterData.processedPlayers.filter(
        (p): p is ProcessedPlayer => !("type" in p)
      ),
    [skaterData.processedPlayers]
  );
  const goaliePlayers: ProcessedPlayer[] = useMemo(
    () =>
      goalieData.processedPlayers.filter(
        (p): p is ProcessedPlayer => !("type" in p)
      ),
    [goalieData.processedPlayers]
  );

  // Build ProcessedPlayer list from session CSV (client-side only)
  const sessionCsvPlayers: ProcessedPlayer[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("draft.customCsv.v1");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        headers?: {
          original: string;
          standardized: string;
          selected: boolean;
        }[];
        rows?: Record<string, string | number | null>[];
      };
      const rows = parsed?.rows || [];
      if (!rows.length) return [];

      // Map standardized column names to StatDefinition keys
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
        Time_on_Ice_Per_Game: "TIME_ON_ICE_PER_GAME",
        Faceoffs_Won: "FACEOFFS_WON",
        Faceoffs_Lost: "FACEOFFS_LOST",
        Wins_Goalie: "WINS_GOALIE",
        Losses_Goalie: "LOSSES_GOALIE",
        Otl: "OTL_GOALIE",
        Saves_Goalie: "SAVES_GOALIE",
        Sa: "SHOTS_AGAINST_GOALIE",
        Ga: "GOALS_AGAINST_GOALIE",
        Goals_Against_Average: "GOALS_AGAINST_AVERAGE",
        Save_Percentage: "SAVE_PERCENTAGE",
        Shutouts_Goalie: "SHUTOUTS_GOALIE"
      };

      let nextId = -1;
      const out: ProcessedPlayer[] = [];

      for (const r of rows) {
        const fullName = String(r["Player_Name"] ?? "").trim();
        if (!fullName) continue;
        const displayTeam = (r["Team_Abbreviation"] ?? null) as any;
        const displayPosition = (r["Position"] ?? null) as any;
        const combinedStats: any = {};

        // Populate projected values from mapped columns
        Object.keys(r).forEach((col) => {
          const key = COL_TO_STAT[col];
          if (!key) return;
          const rawVal = r[col];
          const num = rawVal == null ? null : Number(rawVal);
          const projected = num != null && Number.isFinite(num) ? num : null;
          combinedStats[key] = {
            projected,
            actual: null,
            diffPercentage: null,
            projectedDetail: {
              value: projected,
              contributingSources: [
                {
                  name: customCsvLabel || "Custom CSV",
                  weight: 1,
                  value: projected
                }
              ],
              missingFromSelectedSources: [],
              statDefinition: { key } as any
            }
          };
        });

        // Compute fantasy points using appropriate scoring config
        const isGoalie = String(displayPosition || "")
          .toUpperCase()
          .split(",")
          .map((s) => s.trim())
          .includes("G");
        const pointsConfig: Record<string, number> = isGoalie
          ? goaliePointValues
          : draftSettings.scoringCategories;
        let fpProjected = 0;
        let hasAny = false;
        Object.keys(pointsConfig).forEach((statKey) => {
          const w = pointsConfig[statKey];
          if (!w) return;
          const v = combinedStats[statKey]?.projected;
          if (typeof v === "number") {
            fpProjected += v * w;
            hasAny = true;
          }
        });
        const gp = combinedStats.GAMES_PLAYED?.projected;
        const projectedPerGame =
          hasAny && typeof gp === "number" && gp > 0 ? fpProjected / gp : null;

        out.push({
          playerId: nextId--,
          fullName,
          displayTeam: displayTeam ? String(displayTeam) : null,
          displayPosition: displayPosition ? String(displayPosition) : null,
          combinedStats,
          fantasyPoints: {
            projected: hasAny ? fpProjected : null,
            actual: null,
            diffPercentage: null,
            projectedPerGame,
            actualPerGame: null
          },
          yahooPlayerId: undefined,
          yahooAvgPick: null,
          yahooAvgRound: null,
          yahooPctDrafted: null,
          projectedRank: null,
          actualRank: null
        });
      }

      return out;
    } catch {
      return [];
    }
  }, [customCsvLabel, draftSettings.scoringCategories, goaliePointValues]);

  const allPlayers: ProcessedPlayer[] = useMemo(
    () => [...skaterPlayers, ...goaliePlayers, ...sessionCsvPlayers],
    [skaterPlayers, goaliePlayers, sessionCsvPlayers]
  );

  // Targeted trace for a known missing name report
  useEffect(() => {
    const byName = allPlayers.find((p) =>
      p.fullName?.toLowerCase().includes("marchenko")
    );
    const byId = allPlayers.find((p) => String(p.playerId) === "8480893");
    if (byName || byId) {
      console.log("Trace - Found Marchenko in player pool:", byName || byId);
    } else {
      console.warn(
        "Trace - Marchenko not found in player pool (name/id checks)"
      );
    }
  }, [allPlayers]);

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
      availableGoalieStatKeys: Array.from(goalieKeys).sort()
    };
  }, [allPlayers]);

  const availablePlayers = useMemo(() => {
    const draftedPlayerIds = new Set(draftedPlayers.map((p) => p.playerId));
    return allPlayers.filter((p) => !draftedPlayerIds.has(String(p.playerId)));
  }, [allPlayers, draftedPlayers]);

  // Build TeamRosterSelect options from current draft order and custom names
  const teamOptions = useMemo(
    () =>
      draftSettings.draftOrder.map((id) => ({
        id,
        label: customTeamNames[id] || id
      })),
    [draftSettings.draftOrder, customTeamNames]
  );

  // Helper: compute picks until my next pick considering snake draft
  const picksUntilNext = useMemo(() => {
    const teamCount = draftSettings.teamCount;
    const myIdx = draftSettings.draftOrder.findIndex((id) => id === myTeamId);
    if (myIdx < 0 || teamCount <= 0) return teamCount; // fallback

    const pickToTeamIndex = (round: number, pickInRound: number) => {
      if (isSnakeDraft && round % 2 === 0) {
        return teamCount - pickInRound; // reversed
      }
      return pickInRound - 1;
    };

    const getRound = (pick: number) => Math.ceil(pick / teamCount);
    const getPickInRound = (pick: number) => ((pick - 1) % teamCount) + 1;

    let n = currentPick + 1;
    for (let guard = 0; guard < teamCount * 2; guard++, n++) {
      const r = getRound(n);
      const pir = getPickInRound(n);
      const idx = pickToTeamIndex(r, pir);
      if (idx === myIdx) {
        return n - currentPick;
      }
    }
    return teamCount; // safe default
  }, [
    draftSettings.teamCount,
    draftSettings.draftOrder,
    myTeamId,
    isSnakeDraft,
    currentPick
  ]);

  // NEW: VORP metrics computed on full player pool (not just available)
  const {
    playerMetrics: vorpMetrics,
    replacementByPos,
    expectedTakenByPos,
    expectedN
  } = useVORPCalculations({
    players: allPlayers,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType: draftSettings.leagueType || "points",
    baselineMode,
    categoryWeights: draftSettings.categoryWeights,
    forwardGrouping
  });

  // Team stats calculations
  const teamStats = useMemo((): TeamDraftStats[] => {
    return draftSettings.draftOrder.map((teamId) => {
      const teamPlayers = draftedPlayers.filter((p) => p.teamId === teamId);

      // Calculate projected points for this team (use merged pool)
      const projectedPoints = teamPlayers.reduce((total, draftedPlayer) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId
        );
        return total + (player ? player.fantasyPoints.projected || 0 : 0);
      }, 0);

      // Group players by position for roster slots with UTIL separate and BENCH rules
      const rosterSlots: { [position: string]: DraftedPlayer[] } = {};
      Object.keys(draftSettings.rosterConfig).forEach((pos) => {
        if (pos !== "bench") {
          rosterSlots[pos.toUpperCase()] = [];
        }
      });

      teamPlayers.forEach((draftedPlayer) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === draftedPlayer.playerId
        );

        if (player) {
          const primaryPosition =
            player.displayPosition?.split(",")[0]?.trim()?.toUpperCase() ||
            "UTIL";
          const isGoalie = primaryPosition === "G";

          const canFillPrimary =
            rosterSlots[primaryPosition] &&
            rosterSlots[primaryPosition].length <
              (draftSettings.rosterConfig as any)[primaryPosition];

          if (isGoalie) {
            // Goalies fill G slots first, never UTIL
            if (
              rosterSlots["G"] &&
              rosterSlots["G"].length < (draftSettings.rosterConfig as any)["G"]
            ) {
              rosterSlots["G"].push(draftedPlayer);
            } else {
              rosterSlots["BENCH"] ||= [];
              rosterSlots["BENCH"].push(draftedPlayer);
            }
          } else if (canFillPrimary) {
            rosterSlots[primaryPosition].push(draftedPlayer);
          } else if (
            rosterSlots["UTILITY"] &&
            rosterSlots["UTILITY"].length < draftSettings.rosterConfig.utility
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
        "BLOCKED_SHOTS"
      ] as const;
      const categoryTotals: Record<string, number> = {};
      CAT_KEYS.forEach((k) => (categoryTotals[k] = 0));
      teamPlayers.forEach((dp) => {
        const player = allPlayers.find(
          (p) => String(p.playerId) === dp.playerId
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
        teamVorp
      };
    });
  }, [draftSettings, draftedPlayers, allPlayers, customTeamNames, vorpMetrics]);

  // NEW: compute my team's positional needs normalized 0..1 (remaining slots / total slots)
  const myTeamStats = React.useMemo(
    () => teamStats.find((t) => t.teamId === myTeamId),
    [teamStats, myTeamId]
  );
  const posNeeds = React.useMemo(() => {
    const res: Record<string, number> = {};
    if (!myTeamStats) return res;
    const rc = draftSettings.rosterConfig as any;
    const rs = myTeamStats.rosterSlots || {};
    ["C", "LW", "RW", "D", "G"].forEach((pos) => {
      const total = Math.max(1, Number(rc[pos] || 0));
      const filled = (rs[pos]?.length || 0) as number;
      const remaining = Math.max(0, total - filled);
      res[pos] = Math.min(1, remaining / total);
    });
    return res;
  }, [myTeamStats, draftSettings.rosterConfig]);

  // Map of filled starters for personalized replacement (exclude bench & util logic handled earlier)
  const myFilledSlots = React.useMemo(() => {
    const out: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
    if (!myTeamStats) return out;
    const rs = myTeamStats.rosterSlots || {};
    ["C", "LW", "RW", "D", "G"].forEach((pos) => {
      out[pos] = rs[pos]?.length || 0;
    });
    return out;
  }, [myTeamStats]);

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
      "BLOCKED_SHOTS"
    ] as const;
    const means: Record<string, number> = {};
    CAT_KEYS.forEach((k) => (means[k] = 0));
    if (teams.length > 0) {
      CAT_KEYS.forEach((k) => {
        const sum = teams.reduce(
          (acc, t) => acc + (t.categoryTotals[k] || 0),
          0
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
    const rc: any = draftSettings.rosterConfig || {};
    const rs = myTeamStats?.rosterSlots || {};
    const items: { pos: string; filled: number; total: number }[] = [];
    const order: Array<"C" | "LW" | "RW" | "D" | "UTIL" | "G"> = [
      "C",
      "LW",
      "RW",
      "D",
      "UTIL",
      "G"
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
  }, [draftSettings.rosterConfig, myTeamStats]);

  // Calculate total roster size (rounds) and total picks
  const totalRosterSize = useMemo(
    () =>
      Object.values(draftSettings.rosterConfig).reduce((sum, c) => sum + c, 0),
    [draftSettings.rosterConfig]
  );
  const totalPicks = useMemo(
    () => draftSettings.teamCount * totalRosterSize,
    [draftSettings.teamCount, totalRosterSize]
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
        pickInRound: currentTurn.pickInRound
      };

      // Save current state to history before making changes
      setDraftHistory((prev) => [
        ...prev,
        {
          players: [...draftedPlayers],
          pickNumber: currentPick
        }
      ]);

      setDraftedPlayers((prev) => [...prev, newDraftedPlayer]);
      setCurrentPick((prev) => prev + 1);
    },
    [currentTurn, currentPick, draftedPlayers, draftComplete]
  );

  // Auto-skip picks that are already drafted (e.g., keepers)
  useEffect(() => {
    if (draftComplete) return;
    const alreadyDrafted = draftedPlayers.some(
      (p) => p.pickNumber === currentPick
    );
    if (alreadyDrafted) {
      setCurrentPick((prev) => prev + 1);
    }
  }, [currentPick, draftedPlayers, draftComplete]);

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
    setDraftedPlayers([]);
    setCurrentPick(1);
    setDraftHistory([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("draftDashboard.session.v1");
      } catch {}
    }
  }, []);

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
              (_, i) => `Team ${i + 1}`
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
    [myTeamId]
  );

  // Handlers: traded picks and keepers
  const addTradedPick = useCallback(
    (round: number, pickInRound: number, newOwnerTeamId: string) => {
      const key = `${round}-${pickInRound}`;
      setPickOwnerOverrides((prev) => ({ ...prev, [key]: newOwnerTeamId }));
    },
    []
  );
  const removeTradedPick = useCallback((round: number, pickInRound: number) => {
    const key = `${round}-${pickInRound}`;
    setPickOwnerOverrides((prev) => {
      const copy = { ...prev } as Record<string, string>;
      delete copy[key];
      return copy;
    });
  }, []);

  const addKeeper = useCallback(
    (round: number, pickInRound: number, teamId: string, playerId: string) => {
      const pickNumber = (round - 1) * draftSettings.teamCount + pickInRound;
      // Remove any existing drafted entry at this pick
      setDraftedPlayers((prev) => [
        ...prev.filter((p) => p.pickNumber !== pickNumber),
        { playerId, teamId, pickNumber, round, pickInRound }
      ]);
      setKeepers((prev) => [
        ...prev.filter(
          (k) => k.round !== round || k.pickInRound !== pickInRound
        ),
        { round, pickInRound, teamId, playerId }
      ]);
    },
    [draftSettings.teamCount]
  );
  const removeKeeper = useCallback(
    (round: number, pickInRound: number) => {
      const pickNumber = (round - 1) * draftSettings.teamCount + pickInRound;
      setDraftedPlayers((prev) =>
        prev.filter((p) => p.pickNumber !== pickNumber)
      );
      setKeepers((prev) =>
        prev.filter((k) => k.round !== round || k.pickInRound !== pickInRound)
      );
    },
    [draftSettings.teamCount]
  );

  // Add handy keyboard shortcuts for power users
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Avoid when focused inside inputs/textareas/contenteditable
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (target as any)?.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

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

  const isLoading = skaterData.isLoading || goalieData.isLoading;
  const errorMessage = skaterData.error || goalieData.error || null;

  const nextPickNumber = useMemo(
    () => currentPick + picksUntilNext,
    [currentPick, picksUntilNext]
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
        ...statKeys.map((k) => `${k}_proj`)
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
          p.projectedRank ?? ""
        ];
        const statVals = statKeys.map((k) => {
          const v = (p.combinedStats as any)?.[k]?.projected;
          return typeof v === "number" && Number.isFinite(v) ? v : "";
        });
        const row = [...rowBase, ...statVals].map(esc).join(",");
        lines.push(row);
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8"
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
        onForwardGroupingChange={setForwardGrouping}
        sourceControls={sourceControls}
        onSourceControlsChange={setSourceControls}
        goalieSourceControls={goalieSourceControls}
        onGoalieSourceControlsChange={setGoalieSourceControls}
        goalieScoringCategories={goaliePointValues}
        onGoalieScoringChange={setGoaliePointValues}
        onOpenSummary={() => setIsSummaryOpen(true)}
        onOpenImportCsv={() => setIsImportCsvOpen(true)}
        customSourceLabel={customCsvLabel}
        availableSkaterStatKeys={availableSkaterStatKeys}
        availableGoalieStatKeys={availableGoalieStatKeys}
        onExportCsv={exportBlendedProjectionsCsv}
        pickOwnerOverrides={pickOwnerOverrides}
        onAddTradedPick={addTradedPick}
        onRemoveTradedPick={removeTradedPick}
        keepers={keepers}
        onAddKeeper={addKeeper}
        onRemoveKeeper={removeKeeper}
        playersForKeeperAutocomplete={allPlayers.map((p) => ({
          id: Number(p.playerId),
          fullName: p.fullName
        }))}
        onBookmarkCreate={(key) => {
          // Optional: could surface a toast; for now just log
          // eslint-disable-next-line no-console
          console.log("Bookmark key created (len)", key.length);
        }}
        onBookmarkImport={(data) => {
          try {
            if (data.settings) setDraftSettings(data.settings);
            if (Array.isArray(data.draftedPlayers))
              setDraftedPlayers(data.draftedPlayers);
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
            // eslint-disable-next-line no-console
            console.error("Failed to apply imported bookmark", e);
          }
        }}
      />

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
        />
      </section>

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
            pickOwnerOverrides={pickOwnerOverrides}
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
            canDraft={true}
            currentPick={currentPick}
            currentTurn={currentTurn}
            teamOptions={teamOptions}
            vorpMetrics={vorpMetrics}
            needWeightEnabled={needWeightEnabled}
            needAlpha={needAlpha}
            posNeeds={posNeeds}
          />
        </section>

        <section className={styles.rightPanel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6
            }}
          >
            <div style={{ color: "#9aa4af", fontSize: 12 }}>
              {skaterData.isLoading || goalieData.isLoading
                ? "Refreshing…"
                : ""}
            </div>
            <button
              onClick={() => setDataRefreshKey((k) => k + 1)}
              style={{
                padding: "4px 8px",
                fontSize: 12,
                border: "1px solid var(--border-color, #334155)",
                background: "transparent",
                color: "#9aa4af",
                borderRadius: 4,
                cursor: "pointer"
              }}
              title="Force refresh projections from database"
            >
              Refresh Data
            </button>
          </div>
          <ProjectionsTable
            players={availablePlayers}
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
          />
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
      />

      <ImportCsvModal
        open={isImportCsvOpen}
        onClose={() => setIsImportCsvOpen(false)}
        onImported={({ headers, rows, sourceId, label }) => {
          // Persist label alongside rows for restoration
          try {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                "draft.customCsv.v1",
                JSON.stringify({ headers, rows, label })
              );
            }
          } catch {}
          // Add/enable the custom source control so it appears in settings
          setSourceControls((prev) => ({
            ...prev,
            [sourceId]: prev[sourceId] || { isSelected: true, weight: 1 }
          }));
          setCustomCsvLabel(label);
        }}
      />
    </div>
  );
};

export default DraftDashboard;

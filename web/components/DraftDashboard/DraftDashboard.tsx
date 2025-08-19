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

import styles from "./DraftDashboard.module.scss";

// Data Models from PRD
export interface DraftSettings {
  teamCount: number;
  scoringCategories: Record<string, number>;
  leagueType?: "points" | "categories";
  categoryWeights?: Record<string, number>; // used in categories mode
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

  // Projection Data Setup
  const [sourceControls] = useState(() => {
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
  const [goalieSourceControls] = useState(() => {
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
  const skaterData = useProcessedProjectionsData({
    activePlayerType: "skater",
    sourceControls,
    yahooDraftMode: "ALL",
    fantasyPointSettings: draftSettings.scoringCategories,
    supabaseClient: supabase,
    currentSeasonId: currentSeasonId ? String(currentSeasonId) : undefined,
    styles: {},
    showPerGameFantasyPoints: false,
    togglePerGameFantasyPoints: () => {}
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
    togglePerGameFantasyPoints: () => {}
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
          }
        }
      }
    } catch {
    } finally {
      // Allow persistence after resume decision (or if none existed)
      setSessionReady(true);
    }
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
      customTeamNames
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

    let teamIndex: number;
    if (isSnakeDraft && round % 2 === 0) {
      // Snake draft: reverse order on even rounds
      teamIndex = draftSettings.teamCount - pickInRound;
    } else {
      // Standard order
      teamIndex = pickInRound - 1;
    }

    return {
      round,
      pickInRound,
      teamId: draftSettings.draftOrder[teamIndex],
      isMyTurn: draftSettings.draftOrder[teamIndex] === myTeamId
    };
  }, [
    currentPick,
    draftSettings.teamCount,
    draftSettings.draftOrder,
    isSnakeDraft,
    myTeamId
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

  const allPlayers: ProcessedPlayer[] = useMemo(
    () => [...skaterPlayers, ...goaliePlayers],
    [skaterPlayers, goaliePlayers]
  );

  // Compute available players excluding drafted ones
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
    categoryWeights: draftSettings.categoryWeights
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

  // Update draft settings
  const updateDraftSettings = useCallback(
    (newSettings: Partial<DraftSettings>) => {
      setDraftSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
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

  return (
    <main className={styles.dashboardContainer}>
      {/* Settings Bar - Full Width */}
      <section className={styles.settingsSection}>
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
          // NEW: expose goalie scoring configuration controls
          goalieScoringCategories={goaliePointValues}
          onGoalieScoringChange={setGoaliePointValues}
          // NEW: pass handler to open draft summary from settings header
          onOpenSummary={() => setIsSummaryOpen(true)}
        />
      </section>

      {/* Suggested Picks - Full Width Cards Row */}
      <section className={styles.suggestedSection}>
        <SuggestedPicks
          players={availablePlayers}
          vorpMetrics={vorpMetrics}
          needWeightEnabled={needWeightEnabled}
          needAlpha={needAlpha}
          posNeeds={posNeeds}
          leagueType={draftSettings.leagueType || "points"}
          catNeeds={catNeeds}
          currentPick={currentPick}
          teamCount={draftSettings.teamCount}
          baselineMode={baselineMode}
          nextPickNumber={currentPick + picksUntilNext}
          defaultLimit={10}
          // NEW: roster progress bar data
          rosterProgress={rosterProgress}
          // NEW: enable drafting from suggestions
          onDraftPlayer={draftPlayer}
          canDraft={currentTurn.isMyTurn}
        />
      </section>

      {/* Three Panel Layout */}
      <section className={styles.mainContent}>
        {/* Left Panel (40%) - Draft Board + Leaderboard */}
        <div className={styles.leftPanel}>
          <DraftBoard
            draftSettings={draftSettings}
            draftedPlayers={draftedPlayers}
            currentTurn={currentTurn}
            teamStats={teamStats}
            isSnakeDraft={isSnakeDraft}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            onUpdateTeamName={updateTeamName}
          />
        </div>

        {/* Center Panel (20%) - My Roster */}
        <div className={styles.centerPanel}>
          <MyRoster
            myTeamId={myTeamId}
            teamStatsList={teamStats}
            draftSettings={draftSettings}
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            onDraftPlayer={draftPlayer}
            canDraft={currentTurn.isMyTurn}
            currentPick={currentPick}
            currentTurn={currentTurn}
            teamOptions={teamOptions}
            // NEW: recommendations context
            vorpMetrics={vorpMetrics}
            needWeightEnabled={needWeightEnabled}
            needAlpha={needAlpha}
            posNeeds={posNeeds}
          />
        </div>

        {/* Right Panel (40%) - Projections Table */}
        <div className={styles.rightPanel}>
          <ProjectionsTable
            players={allPlayers}
            draftedPlayers={draftedPlayers}
            isLoading={skaterData.isLoading || goalieData.isLoading}
            error={skaterData.error || goalieData.error}
            onDraftPlayer={draftPlayer}
            canDraft={currentTurn.isMyTurn}
            // NEW: pass vorp metrics map for per-player VORP column
            vorpMetrics={vorpMetrics}
            // NEW: pass replacement baselines for tooltip/context
            replacementByPos={replacementByPos}
            // NEW: baseline mode control
            baselineMode={baselineMode}
            onBaselineModeChange={setBaselineMode}
            // NEW: pass expected position runs
            expectedRuns={{
              byPos: expectedTakenByPos || {},
              N: expectedN || 0
            }}
            // NEW: Need-weighting controls and current team needs
            needWeightEnabled={needWeightEnabled}
            onNeedWeightChange={setNeedWeightEnabled}
            posNeeds={posNeeds}
            needAlpha={needAlpha}
            onNeedAlphaChange={setNeedAlpha}
            // NEW: Absolute next pick number for risk model
            nextPickNumber={currentPick + picksUntilNext}
            // NEW: League type for label/value switching
            leagueType={draftSettings.leagueType || "points"}
          />
        </div>
      </section>

      {/* Summary Modal */}
      <DraftSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        draftSettings={draftSettings}
        draftedPlayers={draftedPlayers}
        teamStats={teamStats}
        allPlayers={allPlayers}
        vorpMetrics={vorpMetrics}
      />
    </main>
  );
};

export default DraftDashboard;

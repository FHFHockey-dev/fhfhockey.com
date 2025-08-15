// components/DraftDashboard/DraftDashboard.tsx

import React, { useState, useCallback, useMemo } from "react";
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

import styles from "./DraftDashboard.module.scss";

// Data Models from PRD
export interface DraftSettings {
  teamCount: number;
  scoringCategories: Record<string, number>;
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

  // Get player projections data
  const projectionsData = useProcessedProjectionsData({
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

  // Debug logging to see what data we're getting
  console.log("Debug - DraftDashboard projectionsData:", {
    playerCount: projectionsData.processedPlayers.length,
    isLoading: projectionsData.isLoading,
    error: projectionsData.error
  });

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

  // (removed duplicate availablePlayers; compute after allPlayers)

  // Add team name update function
  const updateTeamName = useCallback((teamId: string, newName: string) => {
    setCustomTeamNames((prev) => ({
      ...prev,
      [teamId]: newName
    }));
  }, []);

  // Compute all players array once for children that need complete data
  const allPlayers: ProcessedPlayer[] = useMemo(
    () =>
      projectionsData.processedPlayers.filter(
        (player): player is ProcessedPlayer => !("type" in player)
      ),
    [projectionsData.processedPlayers]
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
  const { playerMetrics: vorpMetrics, replacementByPos } = useVORPCalculations({
    players: allPlayers,
    availablePlayers,
    draftSettings,
    picksUntilNext
  });

  // Team stats calculations
  const teamStats = useMemo((): TeamDraftStats[] => {
    return draftSettings.draftOrder.map((teamId) => {
      const teamPlayers = draftedPlayers.filter((p) => p.teamId === teamId);

      // Calculate projected points for this team
      const projectedPoints = teamPlayers.reduce((total, draftedPlayer) => {
        const player = projectionsData.processedPlayers.find(
          (p) => !("type" in p) && String(p.playerId) === draftedPlayer.playerId
        );
        return (
          total +
          (player && !("type" in player)
            ? player.fantasyPoints.projected || 0
            : 0)
        );
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

          if (!isGoalie && canFillPrimary) {
            rosterSlots[primaryPosition].push(draftedPlayer);
          } else if (
            !isGoalie &&
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

      return {
        teamId,
        teamName: customTeamNames[teamId] || teamId,
        owner: teamId,
        projectedPoints,
        categoryTotals: {},
        rosterSlots,
        bench,
        teamVorp
      };
    });
  }, [draftSettings, draftedPlayers, allPlayers, customTeamNames, vorpMetrics]);

  // Draft a player - Updated to track history for undo
  const draftPlayer = useCallback(
    (playerId: string) => {
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
    [currentTurn, currentPick, draftedPlayers]
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
  }, []);

  // Update draft settings
  const updateDraftSettings = useCallback(
    (newSettings: Partial<DraftSettings>) => {
      setDraftSettings((prev) => ({ ...prev, ...newSettings }));
    },
    []
  );

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
            canDraft={true}
            currentPick={currentPick}
            currentTurn={currentTurn}
            teamOptions={teamOptions}
          />
        </div>

        {/* Right Panel (40%) - Projections Table */}
        <div className={styles.rightPanel}>
          <ProjectionsTable
            players={availablePlayers}
            draftedPlayers={draftedPlayers}
            isLoading={projectionsData.isLoading}
            error={projectionsData.error}
            onDraftPlayer={draftPlayer}
            canDraft={true}
            // NEW: pass vorp metrics map for per-player VORP column
            vorpMetrics={vorpMetrics}
          />
        </div>
      </section>
    </main>
  );
};

export default DraftDashboard;

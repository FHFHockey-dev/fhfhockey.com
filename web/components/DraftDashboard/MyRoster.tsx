// components/DraftDashboard/MyRoster.tsx

import React, { useState, useMemo, useEffect } from "react";
import { DraftSettings, TeamDraftStats, DraftedPlayer } from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import TeamRosterSelect, { TeamOption } from "./TeamRosterSelect";
import styles from "./MyRoster.module.scss";
// NEW: imports for recommendations
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { usePlayerRecommendations } from "hooks/usePlayerRecommendations";

interface MyRosterProps {
  myTeamId: string;
  teamStatsList: TeamDraftStats[]; // receive all teams
  draftSettings: DraftSettings;
  availablePlayers: ProcessedPlayer[];
  allPlayers: ProcessedPlayer[];
  onDraftPlayer: (playerId: string) => void;
  canDraft: boolean;
  currentPick: number;
  currentTurn: {
    round: number;
    pickInRound: number;
    teamId: string;
    isMyTurn: boolean;
  };
  teamOptions: TeamOption[];
  // NEW: recommendations context
  vorpMetrics?: Map<string, PlayerVorpMetrics>;
  needWeightEnabled?: boolean;
  needAlpha?: number;
  posNeeds?: Record<string, number>;
}

const MyRoster: React.FC<MyRosterProps> = ({
  myTeamId,
  teamStatsList,
  draftSettings,
  availablePlayers,
  allPlayers,
  onDraftPlayer,
  canDraft,
  currentPick,
  currentTurn,
  teamOptions,
  // NEW props
  vorpMetrics,
  needWeightEnabled = false,
  needAlpha = 0.5,
  posNeeds = {}
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<
    number | undefined
  >();
  const [searchValue, setSearchValue] = useState("");
  const [selectedViewTeamId, setSelectedViewTeamId] =
    useState<string>(myTeamId);

  // Keep selection synced when myTeamId changes IF user is viewing their team
  useEffect(() => {
    setSelectedViewTeamId((prev) => (prev === myTeamId ? myTeamId : prev));
  }, [myTeamId]);

  const playerMap = useMemo(() => {
    const m = new Map<string, ProcessedPlayer>();
    allPlayers.forEach((p) => m.set(String(p.playerId), p));
    return m;
  }, [allPlayers]);

  // Build ADP map from all players (Yahoo average pick) for sorting the autocomplete
  const adpByPlayerId = useMemo(() => {
    const m: Record<number, number> = {};
    allPlayers.forEach((p) => {
      const adp = p.yahooAvgPick;
      if (adp != null && Number.isFinite(adp)) {
        m[p.playerId] = adp as number;
      }
    });
    return m;
  }, [allPlayers]);

  const selectedTeamStats = useMemo(
    () => teamStatsList.find((t) => t.teamId === selectedViewTeamId),
    [teamStatsList, selectedViewTeamId]
  );

  const selectedTeamName = useMemo(() => {
    return (
      teamOptions.find((o) => o.id === selectedViewTeamId)?.label ||
      selectedTeamStats?.teamName ||
      selectedViewTeamId
    );
  }, [teamOptions, selectedViewTeamId, selectedTeamStats]);

  // NEW: compute top recommendations
  const { recommendations } = usePlayerRecommendations({
    players: availablePlayers,
    vorpMetrics,
    posNeeds,
    needWeightEnabled,
    needAlpha,
    limit: 10,
    baselineMode: undefined,
    currentPick,
    teamCount: draftSettings?.teamCount
  });

  // Suggested Picks: sorting and selection (persisted)
  type RecSortField =
    | "rank"
    | "name"
    | "pos"
    | "projFp"
    | "vorp"
    | "vbd"
    | "adp"
    | "avail"
    | "fit";
  const [recSortField, setRecSortField] = useState<RecSortField>(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortField") as RecSortField) || "rank"
      );
    }
    return "rank";
  });
  const [recSortDir, setRecSortDir] = useState<"asc" | "desc">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("suggested.sortDir") as "asc" | "desc") || "desc"
      );
    }
    return "desc";
  });
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("suggested.sortField", recSortField);
      localStorage.setItem("suggested.sortDir", recSortDir);
    }
  }, [recSortField, recSortDir]);

  const sortedRecommendations = useMemo(() => {
    const arr = [...recommendations];
    const dirMul = recSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const aName = a.player.fullName || String(a.player.playerId);
      const bName = b.player.fullName || String(b.player.playerId);
      const aPos = (a.player.displayPosition || "").split(",")[0];
      const bPos = (b.player.displayPosition || "").split(",")[0];
      const aFp =
        (a.player as any).fantasyPoints ??
        (a.player as any).projFantasyPoints ??
        0;
      const bFp =
        (b.player as any).fantasyPoints ??
        (b.player as any).projFantasyPoints ??
        0;
      const aVorp = a.vorp ?? 0;
      const bVorp = b.vorp ?? 0;
      const aVbd = a.vbd ?? 0;
      const bVbd = b.vbd ?? 0;
      const aAdp = (a.player as any).yahooAvgPick ?? Infinity;
      const bAdp = (b.player as any).yahooAvgPick ?? Infinity;
      const aAvail = typeof a.availability === "number" ? a.availability : -1;
      const bAvail = typeof b.availability === "number" ? b.availability : -1;
      const aFit = a.fitScore ?? 0;
      const bFit = b.fitScore ?? 0;

      switch (recSortField) {
        case "rank":
          // keep incoming order (already ranked by hook)
          return 0;
        case "name":
          return dirMul * aName.localeCompare(bName);
        case "pos":
          return dirMul * aPos.localeCompare(bPos);
        case "projFp":
          return dirMul * (aFp - bFp);
        case "vorp":
          return dirMul * (aVorp - bVorp);
        case "vbd":
          return dirMul * (aVbd - bVbd);
        case "adp":
          return dirMul * ((aAdp as number) - (bAdp as number));
        case "avail":
          return dirMul * (aAvail - bAvail);
        case "fit":
          return dirMul * (aFit - bFit);
      }
    });
    return arr;
  }, [recommendations, recSortField, recSortDir]);

  const toggleSort = (field: RecSortField) => {
    setRecSortField((prev) => (prev === field ? prev : field));
    setRecSortDir((prev) =>
      recSortField === field ? (prev === "asc" ? "desc" : "asc") : "desc"
    );
  };

  const onRowKeyDown: React.KeyboardEventHandler<HTMLTableSectionElement> = (
    e
  ) => {
    const ids = sortedRecommendations.map((r) => String(r.player.playerId));
    if (ids.length === 0) return;
    const currentIndex = selectedRecId ? ids.indexOf(selectedRecId) : -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex =
        currentIndex < 0 ? 0 : Math.min(ids.length - 1, currentIndex + 1);
      setSelectedRecId(ids[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1);
      setSelectedRecId(ids[prevIndex]);
    } else if (e.key === "Enter") {
      // Intentional no-draft behavior; could open details in future
      e.preventDefault();
    }
  };

  const handlePlayerSelect = (player: any) => {
    setSelectedPlayerId(player?.id);
    setSearchValue(player?.fullName || "");
  };

  const handleDraftClick = () => {
    if (selectedPlayerId) {
      const player = availablePlayers.find(
        (p) => p.playerId === selectedPlayerId
      );
      if (player) {
        onDraftPlayer(String(selectedPlayerId));
        setSelectedPlayerId(undefined);
        setSearchValue("");
      }
    }
  };

  // Calculate roster progress including bench
  const totalRosterSpots = useMemo(
    () =>
      Object.values(draftSettings.rosterConfig).reduce((sum, c) => sum + c, 0),
    [draftSettings.rosterConfig]
  );

  const currentPlayerCount = useMemo(() => {
    if (!selectedTeamStats) return 0;
    const slotsCount = Object.values(selectedTeamStats.rosterSlots).reduce(
      (total, players) => total + players.length,
      0
    );
    const benchCount = selectedTeamStats.bench.length;
    return slotsCount + benchCount;
  }, [selectedTeamStats]);

  // Determine positions to show, respecting UTIL as its own card
  const positionsToShow = useMemo(() => {
    const basePositions = Object.keys(draftSettings.rosterConfig)
      .filter((pos) => pos !== "bench")
      .map((pos) =>
        pos.toUpperCase() === "UTILITY" ? "UTILITY" : pos.toUpperCase()
      );
    // Enforce desired order
    const order = ["C", "LW", "RW", "D", "G", "UTILITY"] as const;
    return order.filter((pos) => basePositions.includes(pos));
  }, [draftSettings.rosterConfig]);

  return (
    <div className={styles.myRosterContainer}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          {selectedViewTeamId === myTeamId ? <>Roster</> : <>Roster</>}
        </h2>
        <div className={styles.headerControls}>
          {selectedViewTeamId !== myTeamId && (
            <span className={styles.viewingPill}>Viewing</span>
          )}
          <TeamRosterSelect
            value={selectedViewTeamId}
            onChange={setSelectedViewTeamId}
            options={teamOptions}
            selectClassName={styles.teamSelect}
          />
          <button
            type="button"
            className={styles.quickMyTeamButton}
            onClick={() => setSelectedViewTeamId(myTeamId)}
            title="Jump to My Team"
          >
            My Team
          </button>
        </div>
      </div>

      {/* Draft Player Section */}
      <div className={styles.draftSection}>
        <div className={styles.playerSearch}>
          <PlayerAutocomplete
            playerId={selectedPlayerId}
            onPlayerIdChange={setSelectedPlayerId}
            onPlayerChange={handlePlayerSelect}
            showButton={false}
            inputClassName={styles.searchInput}
            listClassName={styles.searchResults}
            adpByPlayerId={adpByPlayerId}
            sortByAdp
            // Ensure same pool as projections by passing processed players
            playersOverride={allPlayers.map((p) => ({
              id: Number(p.playerId),
              fullName: p.fullName,
              sweaterNumber: undefined,
              teamId: undefined
            }))}
          />
        </div>

        <button
          className={styles.draftButton}
          onClick={handleDraftClick}
          disabled={!selectedPlayerId}
        >
          Add Player to {currentTurn.teamId}
        </button>
      </div>

      {/* Team Stats Summary */}
      {selectedTeamStats && (
        <div className={styles.teamSummary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Projected Points</div>
            <div className={styles.summaryValue}>
              {selectedTeamStats.projectedPoints.toFixed(1)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Players Drafted</div>
            <div className={styles.summaryValue}>{currentPlayerCount}</div>
          </div>
        </div>
      )}

      {/* Roster Progress */}
      <div className={styles.rosterProgress}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Roster Progress</span>
          <span className={styles.progressCount}>
            {currentPlayerCount} / {totalRosterSpots}
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${totalRosterSpots ? (currentPlayerCount / totalRosterSpots) * 100 : 0}%`
            }}
          />
        </div>
      </div>

      {/* Roster Slots */}
      <div className={styles.rosterSlots}>
        <h3 className={styles.sectionTitle}>Roster Composition</h3>
        <div className={styles.slotsList}>
          {positionsToShow.map((pos) => {
            const posKey = pos === "UTILITY" ? "utility" : pos; // for max count lookup
            const maxCount = (draftSettings.rosterConfig as any)[posKey] || 0;
            const currentPlayers: DraftedPlayer[] =
              selectedTeamStats?.rosterSlots[pos] || [];
            return (
              <div key={pos} className={styles.rosterSlot}>
                <div className={styles.slotHeader}>
                  <span className={styles.slotPosition}>{pos}</span>
                  <span className={styles.slotCount}>
                    {currentPlayers.length} / {maxCount}
                  </span>
                </div>
                <div className={styles.slotPlayers}>
                  {Array.from({ length: maxCount }, (_, index) => {
                    const drafted = currentPlayers[index];
                    const fullName = drafted
                      ? playerMap.get(drafted.playerId)?.fullName ||
                        drafted.playerId
                      : null;
                    return (
                      <div
                        key={index}
                        className={`${styles.slotPlayer} ${
                          drafted ? styles.filledSlot : styles.emptySlot
                        }`}
                      >
                        {drafted ? (
                          <div className={styles.playerInfo}>
                            <div className={styles.playerName}>{fullName}</div>
                          </div>
                        ) : (
                          <div className={styles.emptySlotText}>Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bench Section */}
      <div className={styles.benchSection}>
        <h3 className={styles.sectionTitle}>
          Bench ({selectedTeamStats?.bench.length || 0} /{" "}
          {draftSettings.rosterConfig.bench})
        </h3>
        <div className={styles.benchSlots}>
          {Array.from(
            { length: draftSettings.rosterConfig.bench },
            (_, index) => {
              const drafted = selectedTeamStats?.bench[index];
              const fullName = drafted
                ? playerMap.get(drafted.playerId)?.fullName || drafted.playerId
                : null;
              return (
                <div
                  key={index}
                  className={`${styles.benchSlot} ${drafted ? styles.filledSlot : styles.emptySlot}`}
                >
                  {drafted ? (
                    <div className={styles.playerInfo}>
                      <div className={styles.playerName}>{fullName}</div>
                    </div>
                  ) : (
                    <div className={styles.emptySlotText}>Empty</div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
};

export default MyRoster;

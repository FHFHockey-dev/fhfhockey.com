// components/DraftDashboard/MyRoster.tsx

import React, { useState, useMemo, useEffect } from "react";
import { DraftSettings, TeamDraftStats, DraftedPlayer } from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import TeamRosterSelect, { TeamOption } from "./TeamRosterSelect";
import styles from "./MyRoster.module.scss";

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
  teamOptions
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

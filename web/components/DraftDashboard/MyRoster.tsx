// components/DraftDashboard/MyRoster.tsx

import React, { useState, useMemo, useEffect } from "react";
import {
  DraftSettings,
  TeamDraftStats,
  RosterAssignment,
} from "./DraftDashboard";
// Import ProcessedPlayer from the correct location
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import TeamRosterSelect, { TeamOption } from "./TeamRosterSelect";
import styles from "./MyRoster.module.scss";
import type { RosterScheduleOptimizerState } from "hooks/useRosterScheduleOptimizer";
// NEW: imports for recommendations
import { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { usePlayerRecommendations } from "hooks/usePlayerRecommendations";
import {
  getEffectiveRosterConfig,
  groupPlayerEligibility,
  normalizePlayerEligibility
} from "lib/draftDashboard/forwardGrouping";

function PositionProgress({ label, filled, capacity }: { label: string; filled: number; capacity: number }) {
  return <div className={styles.positionHeader}>
    <h3>{label}</h3>
    <progress aria-label={`${label} roster spots filled`} value={Math.min(filled, capacity)} max={capacity || 1} />
    <span>{filled}/{capacity} · {filled > capacity ? `${filled - capacity} over` : `${capacity - filled} open`}</span>
  </div>;
}

interface MyRosterProps {
  onSelectedTeamChange?: (teamId: string) => void;
  viewRequest?: { teamId: string };
  schedulePeriod?: string;
  draftUnavailableReason?: string;
  nextPickByTeam: Record<string, number>;
  scheduleState: RosterScheduleOptimizerState;
  myTeamId: string;
  teamStatsList: TeamDraftStats[]; // receive all teams
  draftSettings: DraftSettings;
  availablePlayers: ProcessedPlayer[];
  allPlayers: ProcessedPlayer[];
  onDraftPlayer: (playerId: string) => void;
  onMovePlayer?: (playerId: string, targetPos: string) => void;
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
  // Forward grouping preference
  forwardGrouping?: "split" | "fwd";
  /** Optional slot for the schedule overview trigger and overlay. */
  scheduleOverview?: React.ReactNode;
}

const MyRoster: React.FC<MyRosterProps> = ({
  onSelectedTeamChange,
  viewRequest,
  schedulePeriod = "Full season baseline",
  draftUnavailableReason = "Manual drafting is unavailable",
  myTeamId,
  nextPickByTeam,
  scheduleState,
  teamStatsList,
  draftSettings,
  availablePlayers,
  allPlayers,
  onDraftPlayer,
  onMovePlayer,
  canDraft,
  currentPick,
  currentTurn,
  teamOptions,
  // NEW props
  vorpMetrics,
  needWeightEnabled = false,
  needAlpha = 0.5,
  posNeeds = {},
  forwardGrouping = "split",
  scheduleOverview
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<
    number | undefined
  >();
  const [searchValue, setSearchValue] = useState("");
  const [selectedViewTeamId, setSelectedViewTeamId] =
    useState<string>(myTeamId);

  useEffect(() => {
    if (viewRequest) setSelectedViewTeamId(viewRequest.teamId);
  }, [viewRequest]);

  useEffect(() => { onSelectedTeamChange?.(selectedViewTeamId); }, [selectedViewTeamId, onSelectedTeamChange]);

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
    teamCount: draftSettings?.teamCount,
    forwardGrouping
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

  const selectedNextPick = currentPlayerCount >= totalRosterSpots
    ? Infinity
    : currentTurn.teamId === selectedViewTeamId
      ? currentPick
      : nextPickByTeam[selectedViewTeamId];
  const rosterDustPercent = Math.round(
    (scheduleState.baseline?.dustRate ?? 0) * 100,
  );

  const effectiveRosterConfig = useMemo(
    () => getEffectiveRosterConfig(draftSettings.rosterConfig, forwardGrouping),
    [draftSettings.rosterConfig, forwardGrouping]
  );

  // Determine positions to show, respecting UTIL as its own card
  const positionsToShow = useMemo(() => {
    const basePositions = Object.keys(effectiveRosterConfig)
      .filter((pos) => pos !== "bench")
      .map((pos) =>
        pos.toUpperCase() === "UTILITY" ? "UTILITY" : pos.toUpperCase()
      );
    const orderSplit = ["C", "LW", "RW", "D", "G", "UTILITY"] as const;
    const orderFwd = ["FWD", "D", "G", "UTILITY"] as const;
    const order = forwardGrouping === "fwd" ? orderFwd : orderSplit;
    return [...order.filter((pos) => basePositions.includes(pos)), ...basePositions.filter((pos) => !order.includes(pos as never))].filter((pos) => (effectiveRosterConfig[pos === "UTILITY" ? "utility" : pos] || 0) > 0);
  }, [effectiveRosterConfig, forwardGrouping]);

  // Selection for roster player to show eligible targets
  const [selectedRoster, setSelectedRoster] = useState<
    | { playerId: string; currentPos: string }
    | null
  >(null);

  const eligibleTargetsForSelected = useMemo(() => {
    if (!selectedRoster) return new Set<string>();
    const p = playerMap.get(selectedRoster.playerId);
    if (!p) return new Set();
    const elig = groupPlayerEligibility(
      normalizePlayerEligibility(p.displayPosition, p.eligiblePositions),
      forwardGrouping
    );
    const targets = new Set<string>();
    elig.forEach((pos) => {
      if (pos === selectedRoster.currentPos) return;
      targets.add(pos);
    });
    // All skaters can move to UTILITY if present
    const hasUtility = (draftSettings.rosterConfig as any)?.utility > 0;
    const isGoalie = elig.includes("G");
    if (hasUtility && !isGoalie) targets.add("UTILITY");
    return targets;
  }, [selectedRoster, playerMap, draftSettings.rosterConfig, forwardGrouping]);

  return (
    <div className={styles.myRosterContainer}>
      {/* Header */}
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          My Roster
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
      <details className={styles.draftSection}>
        <summary>Add a player to the team on the clock</summary>
        <div className={styles.draftPopover}>
        <div className={styles.playerSearch}>
          <PlayerAutocomplete
            playerId={selectedPlayerId}
            onPlayerIdChange={setSelectedPlayerId}
            onPlayerChange={handlePlayerSelect}
            showButton={false}
            maxOptions={5}
            inputClassName={styles.searchInput}
            listClassName={styles.searchResults}
            adpByPlayerId={adpByPlayerId}
            sortByAdp
            // Ensure same pool as projections by passing processed players
            playersOverride={availablePlayers.map((p) => ({
              id: Number(p.playerId),
              fullName: p.fullName,
              sweaterNumber: undefined,
              teamId: undefined
            }))}
          />
        </div>

        <p className={styles.searchHint}>Up to 5 matches · type a name to narrow results.</p>
        <button
          className={styles.draftButton}
          onClick={handleDraftClick}
          disabled={!canDraft || !selectedPlayerId}
          title={
            canDraft
              ? undefined
              : draftUnavailableReason
          }
        >
          Add Player to {currentTurn.teamId}
        </button>
        </div>
      </details>

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
            <div className={styles.summaryLabel}>Rostered</div>
            <div className={styles.summaryValue}>{currentPlayerCount} / {totalRosterSpots}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Next pick</div>
            <div className={styles.summaryValue}>
              {Number.isFinite(selectedNextPick) && selectedNextPick <= totalRosterSpots * draftSettings.teamCount ? selectedNextPick : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Roster Progress */}
      <div className={styles.rosterProgress}>
        <div className={styles.progressBar} role="progressbar" aria-label="Roster progress" aria-valuenow={currentPlayerCount} aria-valuemin={0} aria-valuemax={totalRosterSpots}>
          <div
            className={styles.progressFill}
            style={{
              width: `${totalRosterSpots ? (currentPlayerCount / totalRosterSpots) * 100 : 0}%`
            }}
          />
        </div>
      </div>

      <div className={styles.rosterWorkspace} style={{ "--roster-row-tracks": (() => {
        const counts = [...positionsToShow.map((position) => Math.max(effectiveRosterConfig[position === "UTILITY" ? "utility" : position] || 0, selectedTeamStats?.rosterSlots[position]?.length || 0)), Math.max(draftSettings.rosterConfig.bench, selectedTeamStats?.bench.length || 0)];
        return Array.from({ length: Math.ceil(counts.length / 2) }, (_, index) => `${Math.max(counts[index * 2], counts[index * 2 + 1] || 0) + 1}fr`).join(" ");
      })() } as React.CSSProperties}>
      {/* Roster Slots */}
      <div className={styles.rosterSlots}>
        <div className={styles.slotsList}>
          {positionsToShow.map((pos) => {
            const posKey = pos === "UTILITY" ? "utility" : pos; // for max count lookup
            const maxCount = effectiveRosterConfig[posKey] || 0;
            const currentPlayers: RosterAssignment[] =
              selectedTeamStats?.rosterSlots[pos] || [];
            return (
              <div key={pos} className={styles.rosterSlot} data-position={pos} style={{ flexGrow: maxCount, "--slot-count": maxCount } as React.CSSProperties}>
                <PositionProgress label={pos === "UTILITY" ? "UTIL" : pos} filled={currentPlayers.length} capacity={maxCount} />
                <div
                  className={`${styles.slotPlayers} ${
                    pos === "FWD" ? styles.slotPlayersFwd : ""
                  }`}
                >
                  {Array.from({ length: Math.max(maxCount, currentPlayers.length) }, (_, index) => {
                    const drafted = currentPlayers[index];
                    const player = drafted ? playerMap.get(drafted.playerId) : undefined;
                    const eligibility = normalizePlayerEligibility(player?.displayPosition, player?.eligiblePositions).join("/");
                    const fullName = drafted
                      ? player?.fullName || drafted.playerId
                      : null;
                    return (
                      <button
                        type="button"
                        key={index}
                        aria-pressed={drafted ? selectedRoster?.playerId === drafted.playerId : undefined}
                        aria-label={`${pos} ${index + 1}: ${fullName || "Open"}`}
                        className={`${styles.slotPlayer} ${
                          drafted ? styles.filledSlot : styles.emptySlot
                        } ${
                          !drafted && eligibleTargetsForSelected.has(pos)
                            ? styles.eligibleTarget
                            : ""
                        }`}
                        onClick={() => {
                          if (!canDraft) return;
                          if (drafted) {
                            setSelectedRoster({
                              playerId: drafted.playerId,
                              currentPos: pos
                            });
                          } else if (selectedRoster && eligibleTargetsForSelected.has(pos)) {
                            onMovePlayer && onMovePlayer(selectedRoster.playerId, pos);
                            setSelectedRoster(null);
                          }
                        }}
                        aria-disabled={!canDraft || undefined}
                        title={
                          canDraft
                            ? undefined
                            : draftUnavailableReason
                        }
                      >
                        <span className={styles.rowPosition}>{pos === "UTILITY" ? "UTIL" : pos}</span>
                  {drafted ? (
                          <div className={styles.playerInfo}>
                            <div className={styles.playerName} title={fullName || undefined}>{fullName}</div>
                            {eligibility && <span className={styles.playerEligibility} title={`Eligible positions: ${eligibility}`}>{eligibility}</span>}
                            <span className={styles.nhlTeam}>{player?.displayTeam}</span>
                          </div>
                        ) : (
                          <div className={styles.emptySlotText}>Open</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bench Section */}
      <div className={styles.benchSection} data-position="BENCH" style={{ flexGrow: draftSettings.rosterConfig.bench }}>
        <PositionProgress label="BN" filled={selectedTeamStats?.bench.length || 0} capacity={draftSettings.rosterConfig.bench} />
        <div className={styles.benchSlots}>
          {Array.from(
            { length: Math.max(draftSettings.rosterConfig.bench, selectedTeamStats?.bench.length || 0) },
            (_, index) => {
              const drafted = selectedTeamStats?.bench[index];
              const player = drafted ? playerMap.get(drafted.playerId) : undefined;
              const eligibility = normalizePlayerEligibility(player?.displayPosition, player?.eligiblePositions).join("/");
              const fullName = drafted
                ? player?.fullName || drafted.playerId
                : null;
              return (
                <div
                  key={index}
                  className={`${styles.benchSlot} ${drafted ? styles.filledSlot : styles.emptySlot}`}
                >
                  <span className={styles.rowPosition}>BN</span>
                  {drafted ? (
                    <div className={styles.playerInfo}>
                      <div className={styles.playerName} title={fullName || undefined}>{fullName}</div>
                      {eligibility && <span className={styles.playerEligibility} title={`Eligible positions: ${eligibility}`}>{eligibility}</span>}
                      <span className={styles.nhlTeam}>{player?.displayTeam}</span>
                    </div>
                  ) : (
                    <div className={styles.emptySlotText}>Open</div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>
      </div>
      <div className={styles.rosterAnalysis}>
        <div className={styles.scheduleHeader}><h3>Schedule fit</h3><p>{schedulePeriod}</p></div>
        {selectedViewTeamId !== myTeamId ? (
          <p>Select My Team for schedule analysis.</p>
        ) : scheduleState.status === "ready" && scheduleState.baseline ? (
          <div className={styles.scheduleMetrics}>
            <span>
              Scheduled
              <strong>{scheduleState.baseline.totalScheduledGames}</strong>
            </span>
            <span>
              Active
              <strong>{scheduleState.baseline.totalStartableGames}</strong>
            </span>
            <span>
              Benched
              <strong>{scheduleState.baseline.totalBenchGames}</strong>
            </span>
            <button
              type="button"
              className={styles.dustMetric}
              aria-describedby="my-roster-dust-explainer"
              aria-label={`DUST ${rosterDustPercent} percent`}
            >
              <span>DUST <span aria-hidden="true">ⓘ</span></span>
              <strong>{rosterDustPercent}%</strong>
              <span
                id="my-roster-dust-explainer"
                className={styles.dustTooltip}
                role="tooltip"
              >
                DUST means Daily Unstartable Schedule Tax: the share of
                scheduled player games that do not fit into an active lineup.
                Lower is better. Player DUST +N badges show the additional
                Bench Games that drafting that player would create.
              </span>
            </button>
          </div>
        ) : (
          <p>
            {scheduleState.status === "loading"
              ? "Loading schedule…"
              : scheduleState.error
                ? "Schedule unavailable"
                : "No schedule data available"}
          </p>
        )}
        {scheduleOverview}
      </div>
    </div>
  );
};

export default MyRoster;

import React from "react";
import Link from "next/link";
import styles from "../../styles/TeamStatsPage.module.scss";

interface LineCombinationsGridProps {
  forwards: string[];
  defensemen: string[];
  goalies: string[];
  playerMap: Record<string, any>;
  cardClassName?: string;
}

export function LineCombinationsGrid({
  forwards,
  defensemen,
  goalies,
  playerMap,
  cardClassName = ""
}: LineCombinationsGridProps) {
  // Four forward lines, three pairs and two goalies fill the grid. Anyone
  // beyond that (13F/5D, 11F/7D, 19+ skaters) stays in their own group in a
  // labelled extras row: the source has no line or pair for them, so they
  // never take another group's slot and nobody is dropped.
  const shape = `${forwards.length}F/${defensemen.length}D`;
  const displayForwards = forwards.slice(0, 12);
  const displayDefensemen = defensemen.slice(0, 6);
  const displayGoalies = goalies.slice(0, 2);

  // Helper to assign LW/C/RW for a line of 3 forwards
  function assignLinePositions(line: string[]): string[] {
    // Filter out nulls just in case
    const filteredLine = line.filter(Boolean);
    // Get player info for each
    const infos = filteredLine.map((id) => playerMap[String(id)] || {});
    // Try to assign unique mapped_positions
    const positions = ["LW", "C", "RW"];
    const assigned: (string | null)[] = [null, null, null];
    const used = new Set();
    // First pass: assign unique mapped_positions
    positions.forEach((pos, i) => {
      const idx = infos.findIndex(
        (info, j) => info.mapped_position === pos && !used.has(j)
      );
      if (idx !== -1) {
        assigned[i] = filteredLine[idx];
        used.add(idx);
      }
    });
    // Second pass: fill remaining by eligible_positions
    positions.forEach((pos, i) => {
      if (!assigned[i]) {
        const idx = infos.findIndex((info, j) => {
          if (used.has(j)) return false;
          try {
            const eligible = Array.isArray(info.eligible_positions)
              ? info.eligible_positions
              : JSON.parse(info.eligible_positions || "[]");
            return eligible.includes(pos);
          } catch {
            return false;
          }
        });
        if (idx !== -1) {
          assigned[i] = filteredLine[idx];
          used.add(idx);
        }
      }
    });
    // Final pass: fill any left by order
    positions.forEach((_, i) => {
      if (!assigned[i]) {
        const idx = infos.findIndex((_, j) => !used.has(j));
        if (idx !== -1) {
          assigned[i] = filteredLine[idx];
          used.add(idx);
        }
      }
    });
    return assigned as string[];
  }

  // Helper to render a grid of player cards
  function renderGrid(
    players: string[],
    columns: number,
    rows: number,
    cardClassName: string
  ) {
    const totalCells = columns * rows;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const playerId = players[i] || null;
      if (!playerId) {
        cells.push(<div key={i} className={cardClassName} />);
      } else {
        const idStr = String(playerId);
        const info = playerMap[idStr] || {};
        cells.push(
          <div key={i} className={cardClassName}>
            <Link href={`/stats/player/${playerId}`}>
              <div className={styles.lineCombinationsPlayerName}>
                {(() => {
                  const name = info.nhl_player_name || idStr;
                  // Split on the last space to keep hyphenated names together
                  const match = name.match(/^(.*)\s([^\s]+)$/);
                  if (match) {
                    return (
                      <>
                        {match[1]}
                        <br />
                        {match[2]}
                      </>
                    );
                  } else {
                    return name;
                  }
                })()}
              </div>
            </Link>
            {info.eligible_positions && (
              <div className={styles.lineCombinationsEligiblePositions}>
                {(() => {
                  let eligible = info.eligible_positions;
                  if (typeof eligible === "string") {
                    try {
                      eligible = JSON.parse(eligible);
                    } catch {
                      eligible = [];
                    }
                  }
                  if (!Array.isArray(eligible)) eligible = [];
                  return eligible.join(", ");
                })()}
              </div>
            )}
          </div>
        );
      }
    }
    return cells;
  }

  function renderExtras(label: string, players: string[], columns: number) {
    if (players.length === 0) return null;
    return (
      <div
        role="group"
        aria-label={label}
        title="Dressed beyond the regular lines; no line or pair in the source"
      >
        <div className={styles.lineCombinationsSectionLabel}>{label}</div>
        <div
          className={styles.lineCombinationsSectionGrid}
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {renderGrid(
            players,
            columns,
            Math.ceil(players.length / columns),
            cardClassName
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.lineCombinationsFlexContainer}>
      {/* Forwards Section: 3x4 grid (A1–C4) */}
      <div
        className={
          styles.lineCombinationsSection + " " + styles.forwardsSection
        }
        role="group"
        aria-label="Forwards"
      >
        <div className={styles.lineCombinationsSectionLabel}>Forwards</div>
        <div
          className={
            styles.lineCombinationsSectionGrid + " " + styles.forwardsGrid
          }
        >
          {renderGrid(displayForwards, 3, 4, cardClassName)}
        </div>
        {renderExtras(`Extra F · ${shape}`, forwards.slice(12), 3)}
      </div>
      {/* Stack Defense and Goalies vertically */}
      <div className={styles.defenseGoaliesStack}>
        {/* Defense Section: 2x3 grid (D1–E3) */}
        <div
          className={
            styles.lineCombinationsSection + " " + styles.defenseSection
          }
          role="group"
          aria-label="Defense"
        >
          <div className={styles.lineCombinationsSectionLabel}>Defense</div>
          <div
            className={
              styles.lineCombinationsSectionGrid + " " + styles.defenseGrid
            }
          >
            {renderGrid(displayDefensemen, 2, 3, cardClassName)}
          </div>
          {renderExtras(`Extra D · ${shape}`, defensemen.slice(6), 2)}
        </div>
        {/* Goalies Section: 2x1 grid (D4, E4) */}
        <div
          className={
            styles.lineCombinationsSection + " " + styles.goaliesSection
          }
          role="group"
          aria-label="Goalies"
        >
          <div className={styles.lineCombinationsSectionLabel}>Goalies</div>
          <div
            className={
              styles.lineCombinationsSectionGrid + " " + styles.goaliesGrid
            }
          >
            {renderGrid(displayGoalies, 2, 1, cardClassName)}
          </div>
          {renderExtras("Extra G", goalies.slice(2), 2)}
        </div>
      </div>
    </div>
  );
}

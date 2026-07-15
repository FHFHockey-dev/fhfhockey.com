import { motion } from "framer-motion";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";

import type { DraftRankingEntry } from "hooks/useDraftRanking";

import styles from "./DraftRanker.module.scss";

type ReorderAction =
  | { action: "move_to_rank"; playerId: number; targetRank: number }
  | { action: "insert_above"; playerId: number; anchorPlayerId: number }
  | { action: "insert_below"; playerId: number; anchorPlayerId: number }
  | { action: "remove_to_bench"; playerId: number };

type Props = {
  entries: DraftRankingEntry[];
  isSaving: boolean;
  onReorder: (action: ReorderAction) => void;
};

const PAGE_SIZE = 50;

export default function DraftRankingTable({
  entries,
  isSaving,
  onReorder,
}: Props) {
  const [view, setView] = useState<"top" | "candidates">("top");
  const [page, setPage] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null);

  const visiblePool = useMemo(
    () =>
      entries.filter((entry) =>
        view === "top" ? entry.rank <= 250 : entry.rank > 250,
      ),
    [entries, view],
  );
  const pageCount = Math.max(1, Math.ceil(visiblePool.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageEntries = visiblePool.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function switchView(next: "top" | "candidates") {
    setView(next);
    setPage(1);
    setSelectedPlayerId(null);
  }

  function submitRank(event: FormEvent<HTMLFormElement>, playerId: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetRank = Number(form.get("rank"));
    if (
      Number.isInteger(targetRank) &&
      targetRank >= 1 &&
      targetRank <= entries.length
    ) {
      onReorder({ action: "move_to_rank", playerId, targetRank });
    }
  }

  function dropAbove(
    event: DragEvent<HTMLTableRowElement>,
    anchorPlayerId: number,
  ) {
    event.preventDefault();
    if (draggedPlayerId && draggedPlayerId !== anchorPlayerId) {
      onReorder({
        action: "insert_above",
        playerId: draggedPlayerId,
        anchorPlayerId,
      });
    }
    setDraggedPlayerId(null);
  }

  return (
    <section className={styles.tableCard} aria-labelledby="ranking-heading">
      <div className={styles.tableHeader}>
        <div>
          <p className={styles.eyebrow}>Your board</p>
          <h2 id="ranking-heading">Continuous player ranking</h2>
          <p>
            Your top 250 and candidate bench are one order. Moving across rank
            250 automatically promotes or displaces the boundary player.
          </p>
        </div>
        <div className={styles.viewTabs} aria-label="Ranking section">
          <button
            aria-pressed={view === "top"}
            onClick={() => switchView("top")}
            type="button"
          >
            Top 250
          </button>
          <button
            aria-pressed={view === "candidates"}
            onClick={() => switchView("candidates")}
            type="button"
          >
            Candidates ({Math.max(0, entries.length - 250)})
          </button>
        </div>
      </div>

      <p className={styles.selectionHelp} aria-live="polite">
        {selectedPlayerId
          ? "Player selected. Choose Above or Below beside another player."
          : "Drag a row, enter a rank, or select a player for accessible insert controls."}
      </p>

      <div className={styles.tableScroller}>
        <table>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Team / Pos</th>
              <th scope="col">Yahoo ADP</th>
              <th scope="col">Move to</th>
              <th scope="col">Insert controls</th>
            </tr>
          </thead>
          <tbody>
            {pageEntries.map((entry) => {
              const selected = selectedPlayerId === entry.playerId;
              return (
                <motion.tr
                  layout
                  key={entry.playerId}
                  draggable={!isSaving}
                  onDragStart={() => setDraggedPlayerId(entry.playerId)}
                  onDragEnd={() => setDraggedPlayerId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropAbove(event, entry.playerId)}
                  className={selected ? styles.selectedRow : undefined}
                >
                  <td className={styles.rankCell}>#{entry.rank}</td>
                  <td>
                    <div className={styles.playerCell}>
                      {entry.player?.headshot_url ? (
                        <img
                          alt=""
                          loading="lazy"
                          src={entry.player.headshot_url}
                        />
                      ) : (
                        <span
                          className={styles.headshotFallback}
                          aria-hidden="true"
                        >
                          {entry.player?.canonical_name?.slice(0, 1) ?? "?"}
                        </span>
                      )}
                      <div>
                        <strong>
                          {entry.player?.canonical_name ?? "Unknown player"}
                        </strong>
                        <small>
                          {entry.rank > 250 ? "Candidate bench" : "Top 250"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {entry.player?.current_organization_name ?? "Unsigned"}
                    <small className={styles.position}>
                      {entry.player?.canonical_position ?? "—"}
                    </small>
                  </td>
                  <td>{entry.seedAdp?.toFixed(1) ?? "—"}</td>
                  <td>
                    <form
                      className={styles.rankForm}
                      onSubmit={(event) => submitRank(event, entry.playerId)}
                    >
                      <label
                        className={styles.srOnly}
                        htmlFor={`rank-${entry.playerId}`}
                      >
                        New rank for {entry.player?.canonical_name}
                      </label>
                      <input
                        key={`${entry.playerId}-${entry.rank}`}
                        id={`rank-${entry.playerId}`}
                        name="rank"
                        type="number"
                        min={1}
                        max={entries.length}
                        defaultValue={entry.rank}
                        disabled={isSaving}
                      />
                      <button type="submit" disabled={isSaving}>
                        Move
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className={styles.insertActions}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        disabled={isSaving}
                        onClick={() =>
                          setSelectedPlayerId(selected ? null : entry.playerId)
                        }
                      >
                        {selected ? "Cancel" : "Select"}
                      </button>
                      {selectedPlayerId && !selected ? (
                        <>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              onReorder({
                                action: "insert_above",
                                playerId: selectedPlayerId,
                                anchorPlayerId: entry.playerId,
                              })
                            }
                          >
                            Above
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              onReorder({
                                action: "insert_below",
                                playerId: selectedPlayerId,
                                anchorPlayerId: entry.playerId,
                              })
                            }
                          >
                            Below
                          </button>
                        </>
                      ) : null}
                      {entry.rank <= 250 ? (
                        <button
                          className={styles.benchButton}
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            onReorder({
                              action: "remove_to_bench",
                              playerId: entry.playerId,
                            })
                          }
                        >
                          To bench
                        </button>
                      ) : null}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="Ranking pages">
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <span>
          Page {safePage} of {pageCount}
        </span>
        <button
          type="button"
          disabled={safePage === pageCount}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
        >
          Next
        </button>
      </nav>
    </section>
  );
}

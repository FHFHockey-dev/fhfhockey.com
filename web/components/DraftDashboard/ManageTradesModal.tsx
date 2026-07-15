import { useEffect, useRef, useState } from "react";

import type { KeeperEntry } from "lib/draftDashboard/keepers";
import type { PickTradeEntry } from "lib/draftDashboard/pickTrades";
import modalStyles from "./ModalShell.module.scss";
import styles from "./ManageTradesModal.module.scss";

type Result = { ok: boolean; message: string };

interface ManageTradesModalProps {
  open: boolean;
  onClose: () => void;
  draftOrder: string[];
  customTeamNames?: Record<string, string>;
  roundCount: number;
  trades: PickTradeEntry[];
  keepers?: KeeperEntry[];
  onSave: (
    round: number,
    pickInRound: number,
    currentTeamId: string
  ) => Result;
  onImport: (input: string) => Result;
  onRemove: (round: number, pickInRound: number) => void;
  onReset: () => void;
}

export default function ManageTradesModal({
  open,
  onClose,
  draftOrder,
  customTeamNames = {},
  roundCount,
  trades,
  keepers = [],
  onSave,
  onImport,
  onRemove,
  onReset
}: ManageTradesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [round, setRound] = useState(1);
  const [pickInRound, setPickInRound] = useState(1);
  const [owner, setOwner] = useState(draftOrder[1] || draftOrder[0] || "");
  const [bulkInput, setBulkInput] = useState("");
  const [feedback, setFeedback] = useState<Result | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("button, input, select, textarea")
        ?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const save = () => {
    const result = onSave(round, pickInRound, owner);
    setFeedback(result);
  };

  return (
    <div
      className={modalStyles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${modalStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-trades-title"
      >
        <header className={modalStyles.header}>
          <h2 id="manage-trades-title" className={modalStyles.title}>
            Manage Draft-Pick Trades
          </h2>
          <button
            type="button"
            className={modalStyles.closeButton}
            onClick={onClose}
            aria-label="Close trade manager"
          >
            ×
          </button>
        </header>
        <div className={`${modalStyles.body} ${styles.body}`}>
          <section className={styles.section} aria-labelledby="single-trade-title">
            <h3 id="single-trade-title">Add or edit one pick</h3>
            <div className={styles.formGrid}>
              <label>
                Round
                <input
                  type="number"
                  min={1}
                  max={roundCount}
                  value={round}
                  onChange={(event) => setRound(Number(event.target.value))}
                />
              </label>
              <label>
                Pick in round
                <input
                  type="number"
                  min={1}
                  max={draftOrder.length}
                  value={pickInRound}
                  onChange={(event) =>
                    setPickInRound(Number(event.target.value))
                  }
                />
              </label>
              <label>
                New owner
                <select
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                >
                  {draftOrder.map((teamId) => (
                    <option key={teamId} value={teamId}>
                      {customTeamNames[teamId] || teamId}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={save}>
                Save Trade
              </button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="bulk-trade-title">
            <h3 id="bulk-trade-title">Bulk import</h3>
            <label htmlFor="trade-bulk-input">
              JSON or CSV: round, pickInRound, currentTeamId
            </label>
            <textarea
              id="trade-bulk-input"
              rows={5}
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              placeholder={"round,pickInRound,currentTeamId\n2,1,Team 1"}
            />
            <button
              type="button"
              disabled={!bulkInput.trim()}
              onClick={() => {
                const result = onImport(bulkInput);
                setFeedback(result);
                if (result.ok) setBulkInput("");
              }}
            >
              Import Trades
            </button>
          </section>

          {feedback && (
            <div
              className={feedback.ok ? styles.success : styles.error}
              role={feedback.ok ? "status" : "alert"}
            >
              {feedback.message}
            </div>
          )}

          <section className={styles.section} aria-labelledby="saved-trades-title">
            <div className={styles.sectionHeader}>
              <h3 id="saved-trades-title">Saved trades</h3>
              {trades.length > 0 && (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => {
                    if (!confirmReset) {
                      setConfirmReset(true);
                      return;
                    }
                    onReset();
                    setConfirmReset(false);
                    setFeedback({ ok: true, message: "All trades reset." });
                  }}
                >
                  {confirmReset ? "Confirm Reset All" : "Reset All"}
                </button>
              )}
            </div>
            {trades.length === 0 ? (
              <p>No traded picks configured.</p>
            ) : (
              <ul className={styles.tradeList}>
                {trades.map((trade) => {
                  const keeper = keepers.find(
                    (entry) => entry.pickNumber === trade.pickNumber
                  );
                  return (
                    <li key={`${trade.round}-${trade.pickInRound}`}>
                      <div>
                        <strong>
                          Round {trade.round}, pick {trade.pickInRound}
                        </strong>{" "}
                        {customTeamNames[trade.originalTeamId] ||
                          trade.originalTeamId}{" "}
                        → {customTeamNames[trade.currentTeamId] || trade.currentTeamId}
                        {keeper && (
                          <span className={styles.warning}>
                            Keeper {keeper.playerId} currently owns this forfeited
                            pick for {keeper.teamId}.
                          </span>
                        )}
                      </div>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          onClick={() => {
                            setRound(trade.round);
                            setPickInRound(trade.pickInRound);
                            setOwner(trade.currentTeamId);
                            setFeedback(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(trade.round, trade.pickInRound)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <footer className={modalStyles.footer}>
          <div className={modalStyles.actions}>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

import type { DraftedPlayer } from "./DraftDashboard";
import modalStyles from "./ModalShell.module.scss";
import styles from "./QuickFixModal.module.scss";

type Result = { ok: boolean; message: string };

interface QuickFixModalProps {
  open: boolean;
  onClose: () => void;
  teamCount: number;
  roundCount: number;
  draftedPlayers: DraftedPlayer[];
  availablePlayers: Array<{ id: string; fullName: string }>;
  allPlayerNames: ReadonlyMap<string, string>;
  customTeamNames?: Record<string, string>;
  onReplace: (pickNumber: number, replacementPlayerId: string) => Result;
}

export default function QuickFixModal({
  open,
  onClose,
  teamCount,
  roundCount,
  draftedPlayers,
  availablePlayers,
  allPlayerNames,
  customTeamNames = {},
  onReplace,
}: QuickFixModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [round, setRound] = useState(1);
  const [pickInRound, setPickInRound] = useState(1);
  const [replacementQuery, setReplacementQuery] = useState("");
  const [feedback, setFeedback] = useState<Result | null>(null);

  const pickNumber = (round - 1) * teamCount + pickInRound;
  const target = draftedPlayers.find(
    (player) => player.pickNumber === pickNumber && !player.isKeeper,
  );
  const replacement = useMemo(() => {
    const query = replacementQuery.trim().toLocaleLowerCase();
    if (!query) return null;
    return (
      availablePlayers.find(
        (player) =>
          player.id.toLocaleLowerCase() === query ||
          player.fullName.toLocaleLowerCase() === query,
      ) ?? null
    );
  }, [availablePlayers, replacementQuery]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setFeedback(null);
    setReplacementQuery("");
    const latestOrdinaryPick = [...draftedPlayers]
      .filter((player) => !player.isKeeper)
      .sort((left, right) => right.pickNumber - left.pickNumber)[0];
    if (latestOrdinaryPick) {
      setRound(latestOrdinaryPick.round);
      setPickInRound(latestOrdinaryPick.pickInRound);
    }
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [draftedPlayers, open]);

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
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
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
        aria-labelledby="quick-fix-title"
        aria-describedby="quick-fix-description"
      >
        <header className={modalStyles.header}>
          <div>
            <h2 id="quick-fix-title" className={modalStyles.title}>
              Quick Fix Draft Pick
            </h2>
            <p id="quick-fix-description" className={styles.description}>
              Replace one completed manual pick without changing draft order or
              later selections.
            </p>
          </div>
          <button
            type="button"
            className={modalStyles.closeButton}
            onClick={onClose}
            aria-label="Close Quick Fix"
          >
            ×
          </button>
        </header>
        <div className={`${modalStyles.body} ${styles.body}`}>
          <div className={styles.pickFields}>
            <label>
              Round
              <input
                type="number"
                min={1}
                max={roundCount}
                value={round}
                onChange={(event) => {
                  setRound(Number(event.target.value));
                  setFeedback(null);
                }}
              />
            </label>
            <label>
              Pick
              <input
                type="number"
                min={1}
                max={teamCount}
                value={pickInRound}
                onChange={(event) => {
                  setPickInRound(Number(event.target.value));
                  setFeedback(null);
                }}
              />
            </label>
          </div>

          <div className={styles.currentPick} aria-live="polite">
            {target ? (
              <>
                <span>Current player</span>
                <strong>
                  {allPlayerNames.get(target.playerId) ||
                    `Player #${target.playerId}`}
                </strong>
                <span>Team</span>
                <strong>
                  {customTeamNames[target.teamId] || target.teamId}
                </strong>
              </>
            ) : (
              <p>No completed ordinary manual pick exists in that cell.</p>
            )}
          </div>

          <label className={styles.replacementField} htmlFor="quick-fix-player">
            Replacement player
            <input
              id="quick-fix-player"
              list="quick-fix-player-options"
              value={replacementQuery}
              onChange={(event) => {
                setReplacementQuery(event.target.value);
                setFeedback(null);
              }}
              placeholder="Start typing an available player"
              autoComplete="off"
            />
            <datalist id="quick-fix-player-options">
              {availablePlayers.map((player) => (
                <option key={player.id} value={player.fullName} />
              ))}
            </datalist>
          </label>

          {feedback && (
            <div
              className={feedback.ok ? styles.success : styles.error}
              role={feedback.ok ? "status" : "alert"}
            >
              {feedback.message}
            </div>
          )}
        </div>
        <footer className={`${modalStyles.footer} ${modalStyles.actions}`}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!target || !replacement}
            onClick={() => {
              if (!target || !replacement) return;
              const result = onReplace(target.pickNumber, replacement.id);
              setFeedback(result);
              if (result.ok) onClose();
            }}
          >
            Replace Player
          </button>
        </footer>
      </div>
    </div>
  );
}

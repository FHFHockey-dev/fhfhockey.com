import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";

import type { TrainerExtraction, TrainerType } from "lib/sources/tweetSwipeTrainer";
import type { TrainerCard as TrainerCardData } from "lib/sources/tweetSwipeTrainerServer";

import CorrectionEditor from "./CorrectionEditor";
import TrainerCard, { hasPlacements, mergePlacements, type CardPlacements } from "./TrainerCard";
import {
  fetchTrainerQueue,
  reparseCard,
  saveVerdict,
  TYPE_LABELS,
  TYPE_TABS,
  type TrainerCategoryOption,
  type TrainerTeamOption,
  type TrainerPlayerOption
} from "./trainerApi";
import styles from "./TweetSwipeTrainer.module.scss";

const SWIPE_X = 110;
// Fetch the next batch while this many cards are still ahead: parsing a batch takes a few seconds server-side.
const PREFETCH_AHEAD = 3;
const SWIPE_UP = 90;

// A drag only takes over after DRAG_START px, so a tap on a chip still opens its fix panel.
type Drag = { startX: number; startY: number; dx: number; dy: number; pointerId: number; active: boolean };
const DRAG_START = 10;
type Gesture = "correct" | "wrong" | "skip" | null;

function gestureFor(dx: number, dy: number): Gesture {
  if (dx >= SWIPE_X) return "correct";
  if (dx <= -SWIPE_X) return "wrong";
  if (dy <= -SWIPE_UP && Math.abs(dx) < SWIPE_X / 2) return "skip";
  return null;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export default function TweetSwipeTrainer() {
  const [type, setType] = useState<TrainerType | "auto">("auto");
  const [queueType, setQueueType] = useState<TrainerType | null>(null);
  const [cards, setCards] = useState<TrainerCardData[]>([]);
  const [index, setIndex] = useState(0);
  const [players, setPlayers] = useState<TrainerPlayerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<TrainerCategoryOption[]>([]);
  const [teams, setTeams] = useState<TrainerTeamOption[]>([]);
  const [remaining, setRemaining] = useState<Partial<Record<TrainerType, number>>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ correct: 0, wrong: 0, skipped: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seen = useRef<string[]>([]);
  const needsFreshRosters = useRef(false);
  const fetchGeneration = useRef(0);
  const suppressClick = useRef(false);
  const typeRail = useRef<HTMLDivElement>(null);
  const card = cards[index] ?? null;
  // Names placed on a card (backup goalie, extras) by card key. Any placement makes the verdict a correction.
  const [placements, setPlacements] = useState<Record<string, CardPlacements>>({});
  const cardPlacements = card ? placements[card.key] : undefined;
  const placed = hasPlacements(cardPlacements);

  const load = useCallback(async (nextType: TrainerType | "auto") => {
    const generation = ++fetchGeneration.current;
    setLoading(true);
    setExhausted(false);
    try {
      const payload = await fetchTrainerQueue({ type: nextType, exclude: seen.current, fresh: needsFreshRosters.current });
      if (generation !== fetchGeneration.current) return;
      needsFreshRosters.current = false;
      setCards(payload.cards);
      setIndex(0);
      setExhausted(payload.cards.length === 0);
      setQueueType(payload.type);
      setRemaining(payload.remainingByType);
      setPlayers(payload.players);
      setCategoryOptions(payload.categoryOptions);
      setTeams(payload.teams ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load tweets.");
    } finally {
      if (generation === fetchGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(type);
  }, [load, type]);

  // On phones the type rail scrolls sideways: keep the active segment visible, moving only horizontally.
  useEffect(() => {
    const rail = typeRail.current;
    const active = rail?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
    const left = active.offsetLeft - rail.offsetLeft;
    if (left < rail.scrollLeft || left + active.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollTo({ left: Math.max(0, left - 8), behavior: "smooth" });
    }
  }, [type]);

  // Keep the deck topped up so the next card is ready when TJ swipes.
  useEffect(() => {
    if (loading || prefetching || exhausted || !cards.length || cards.length - index > PREFETCH_AHEAD) return;
    const generation = fetchGeneration.current;
    setPrefetching(true);
    const deckKeys = cards.map((entry) => entry.key);
    fetchTrainerQueue({ type, exclude: [...seen.current, ...deckKeys], fresh: needsFreshRosters.current })
      .then((payload) => {
        if (generation !== fetchGeneration.current) return;
        needsFreshRosters.current = false;
        const fresh = payload.cards.filter((entry) => !deckKeys.includes(entry.key));
        if (!fresh.length) setExhausted(true);
        setCards((current) => [...current, ...fresh.filter((entry) => !current.some((existing) => existing.key === entry.key))]);
        setQueueType(payload.type);
        setRemaining(payload.remainingByType);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load more tweets."))
      .finally(() => setPrefetching(false));
  }, [cards, exhausted, index, loading, prefetching, type]);

  // Screen readers hear each verdict and where the deck stands; sighted users see the next card.
  const [announcement, setAnnouncement] = useState("");
  const lastVerdict = useRef<string | null>(null);
  useEffect(() => {
    if (!lastVerdict.current) return;
    setAnnouncement(
      cards[index]
        ? `${lastVerdict.current}. Card ${index + 1} of ${cards.length}.`
        : `${lastVerdict.current}. Loading more tweets.`
    );
    lastVerdict.current = null;
  }, [cards, index]);

  const advance = useCallback((current: TrainerCardData, verdict: string) => {
    lastVerdict.current = verdict;
    seen.current = [...seen.current, current.key].slice(-200);
    setEditing(false);
    setDrag(null);
    setIndex((value) => value + 1);
  }, []);

  const markCorrect = useCallback(
    (current: TrainerCardData) => {
      advance(current, "Saved as correct");
      setTally((value) => ({ ...value, correct: value.correct + 1 }));
      saveVerdict(current, "correct").catch((error) => {
        setTally((value) => ({ ...value, correct: value.correct - 1 }));
        setMessage(`Not saved: ${error instanceof Error ? error.message : "request failed"}. The tweet is back in the queue.`);
        seen.current = seen.current.filter((key) => key !== current.key);
      });
    },
    [advance]
  );

  const skip = useCallback(
    (current: TrainerCardData) => {
      advance(current, "Skipped");
      setTally((value) => ({ ...value, skipped: value.skipped + 1 }));
    },
    [advance]
  );

  // A name fixed on the card changes what the parser makes of the tweet: re-read it, so "Correct" judges the new reading.
  async function cardAliasSaved(current: TrainerCardData, text: string) {
    needsFreshRosters.current = true;
    setMessage(`${text} Re-reading the tweet with it…`);
    try {
      const refreshed = await reparseCard(current);
      setCards((deck) => deck.map((entry) => (entry.key === current.key ? refreshed : entry)));
      setMessage(`${text} The card now shows the new reading: check it, then Correct if it's right.`);
    } catch (error) {
      setMessage(`${text} Couldn't re-read the tweet (${error instanceof Error ? error.message : "request failed"}); reload before judging it.`);
    }
  }

  async function saveCorrection(correction: TrainerExtraction, notes: string) {
    if (!card) return;
    setBusy(true);
    try {
      await saveVerdict(card, "wrong", correction, notes || undefined);
      setTally((value) => ({ ...value, wrong: value.wrong + 1 }));
      setMessage("Correction saved to the answer key.");
      advance(card, "Correction saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the correction.");
    } finally {
      setBusy(false);
    }
  }

  // "Correct" with placements stores the parser's reading plus those names as TJ's answer (a correction).
  const saveWithPlacements = useCallback(
    (current: TrainerCardData, added: CardPlacements) => {
      advance(current, "Saved your placements as the answer");
      setTally((value) => ({ ...value, wrong: value.wrong + 1 }));
      saveVerdict(current, "wrong", mergePlacements(current.extraction, added)).catch((error) => {
        setTally((value) => ({ ...value, wrong: value.wrong - 1 }));
        setMessage(`Not saved: ${error instanceof Error ? error.message : "request failed"}. The tweet is back in the queue.`);
        seen.current = seen.current.filter((key) => key !== current.key);
      });
    },
    [advance]
  );

  const act = useCallback(
    (gesture: Gesture) => {
      if (!card || !gesture || busy) return;
      setMessage(null);
      if (gesture === "correct") {
        if (cardPlacements && hasPlacements(cardPlacements)) saveWithPlacements(card, cardPlacements);
        else markCorrect(card);
      } else if (gesture === "skip") skip(card);
      else {
        setDrag(null);
        setEditing(true);
      }
    },
    [busy, card, cardPlacements, markCorrect, saveWithPlacements, skip]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (editing) {
        if (event.key === "Escape") setEditing(false);
        return;
      }
      if (isTypingTarget(event.target)) return;
      const gesture: Gesture =
        event.key === "ArrowRight" ? "correct" : event.key === "ArrowLeft" ? "wrong" : event.key === "ArrowUp" ? "skip" : null;
      if (!gesture) return;
      event.preventDefault();
      act(gesture);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [act, editing]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Swipes are for touch. With a mouse, dragging selects text; desktop verdicts use the buttons or arrow keys.
    if (event.pointerType === "mouse") return;
    if (editing || event.button !== 0 || !(event.target instanceof HTMLElement)) return;
    // Player chips are buttons but a drag may start on them; other controls keep their own pointer behaviour.
    const control = event.target.closest("button, a, input, select, textarea, label");
    if (control && !control.hasAttribute("data-swipe-ok")) return;
    setDrag({ startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, pointerId: event.pointerId, active: false });
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) < DRAG_START) return;
    if (!drag.active) event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ ...drag, dx, dy, active: true });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const gesture = drag.active ? gestureFor(drag.dx, drag.dy) : null;
    // A finished drag must not also click the chip it started on.
    if (drag.active) suppressClick.current = true;
    setDrag(null);
    act(gesture);
  }

  const activeDrag = drag?.active ? drag : null;
  const pending = activeDrag ? gestureFor(activeDrag.dx, activeDrag.dy) : null;
  const transform = activeDrag
    ? `translate(${activeDrag.dx}px, ${Math.min(activeDrag.dy, 0)}px) rotate(${activeDrag.dx / 24}deg)`
    : undefined;
  const verdictButtons = (
    <>
      <button type="button" className={`${styles.actionButton} ${styles.actionWrong}`} onClick={() => act("wrong")} disabled={busy}>
        <span aria-hidden="true">←</span> Wrong
      </button>
      <button type="button" className={`${styles.actionButton} ${styles.actionSkip}`} onClick={() => act("skip")} disabled={busy}>
        <span aria-hidden="true">↑</span> Skip
      </button>
      <button type="button" className={`${styles.actionButton} ${styles.actionCorrect}`} onClick={() => act("correct")} disabled={busy}>
        {placed ? "Save with placements" : "Correct"} <span aria-hidden="true">→</span>
      </button>
    </>
  );
  const queueLabel = queueType ? TYPE_LABELS[queueType] : "…";

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Tweet parsing trainer</h1>
          <p>
            Judge one tweet at a time. Every verdict goes into the answer key that parser changes are scored against.
          </p>
        </div>
        <div className={styles.tally} aria-label="This session">
          <span><strong>{tally.correct}</strong> correct</span>
          <span><strong>{tally.wrong}</strong> corrected</span>
          <span><strong>{tally.skipped}</strong> skipped</span>
        </div>
        <Link href="/db/tweet-pattern-review" className={styles.ghostButton}>Full review page</Link>
      </header>

      <div ref={typeRail} className={styles.typeTabs} role="group" aria-label="Tweet type">
        {TYPE_TABS.map((tab) => {
          const count = tab.value === "auto" ? null : remaining[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              className={type === tab.value ? `${styles.typeTab} ${styles.typeTabActive}` : styles.typeTab}
              aria-pressed={type === tab.value}
              onClick={() => {
                seen.current = [];
                setType(tab.value);
              }}
            >
              {tab.label}
              {count != null ? <span className={styles.typeCount}>{count.toLocaleString()}</span> : null}
            </button>
          );
        })}
      </div>

      {message ? <p className={styles.statusMessage} role="status">{message}</p> : null}
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>

      <section className={styles.stage} aria-label="Tweet to judge">
        {loading ? <p className={styles.empty}>Loading tweets… the parser reads each one first, so this takes a few seconds.</p> : null}
        {!loading && !card && prefetching ? <p className={styles.empty}>Loading more tweets…</p> : null}
        {!loading && !card && !prefetching ? (
          <p className={styles.empty}>
            {type === "auto"
              ? "All caught up: every tweet type is labelled. New tweets join the queue as they're posted."
              : `All caught up on ${TYPE_LABELS[type as TrainerType].toLowerCase()} tweets. Pick another type above.`}
          </p>
        ) : null}

        {!loading && card ? (
          <>
            <p className={styles.queueLine}>
              {queueLabel} queue · card {index + 1} of {cards.length}
              {queueType && remaining[queueType] != null ? ` · ${remaining[queueType]!.toLocaleString()} left to label` : ""}
            </p>
            {!editing ? (
              <div className={styles.actionBar} role="group" aria-label="Verdict">
                {verdictButtons}
                <p className={styles.keyHint}>
                  {placed
                    ? "→ Save with placements: the reading shown plus the names you placed is the answer. "
                    : "→ Correct: the reading shown is right. "}
                  ← Wrong: fix it in the editor, then Save correction. ↑ Skip. Arrow keys work too; on a phone, swipe.
                </p>
              </div>
            ) : null}
            {editing ? (
              <TrainerCard
                card={card}
                players={players}
                onAliasSaved={(text) => void cardAliasSaved(card, text)}
                editor={
                  <CorrectionEditor
                    key={card.key}
                    card={card}
                    start={mergePlacements(card.extraction, cardPlacements)}
                    players={players}
                    categoryOptions={categoryOptions}
                    teams={teams}
                    busy={busy}
                    onCancel={() => setEditing(false)}
                    onSave={(correction, notes) => void saveCorrection(correction, notes)}
                    onAliasSaved={(text) => {
                      needsFreshRosters.current = true;
                      setMessage(text);
                    }}
                  />
                }
              />
            ) : (
              <div
                className={styles.swipeArea}
                style={{ transform }}
                data-gesture={pending ?? undefined}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                onClickCapture={(event) => {
                  if (!suppressClick.current) return;
                  suppressClick.current = false;
                  event.stopPropagation();
                  event.preventDefault();
                }}
              >
                {pending ? (
                  <span className={`${styles.gestureBadge} ${styles[`gesture_${pending}`]}`} aria-hidden="true">
                    {pending === "correct" ? "Correct" : pending === "wrong" ? "Wrong" : "Skip"}
                  </span>
                ) : null}
                <TrainerCard
                  key={card.key}
                  card={card}
                  players={players}
                  teams={teams}
                  onAliasSaved={(text) => void cardAliasSaved(card, text)}
                  placements={cardPlacements}
                  onPlacementsChange={(next) => setPlacements((map) => ({ ...map, [card.key]: next }))}
                />
              </div>
            )}
            {!editing ? (
              // Below 1100px a long card pushes the top row off-screen; repeat the verdict at the card's end.
              <div className={`${styles.actionBar} ${styles.actionBarEnd}`} role="group" aria-label="Verdict, end of card">
                {verdictButtons}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

    </main>
  );
}

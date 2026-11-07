import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";

import type { BeatReporterCandidate } from "lib/lines/beatReporterInference";
import type { BeatReporterReview as Review } from "lib/lines/beatReporters";
import supabase from "lib/supabase";

import styles from "./BeatReporterReview.module.scss";

type Verdict = "confirm" | "keep" | "not_beat" | "skip";
type Drag = { startX: number; startY: number; dx: number; dy: number; pointerId: number };
const SWIPE_X = 110;
const SWIPE_UP = 90;
const API = "/api/v1/db/beat-reporter-review";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(init?: { body: Record<string, unknown> }): Promise<T> {
  const response = await fetch(API, init
    ? { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(init.body) }
    : { headers: await authHeaders() });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message ?? "Request failed.");
  return payload as T;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export default function BeatReporterReview() {
  const [candidates, setCandidates] = useState<BeatReporterCandidate[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [history, setHistory] = useState<Array<{ handle: string; index: number; saved: boolean }>>([]);
  const [announcement, setAnnouncement] = useState("");
  const card = candidates[index] ?? null;
  const confirmed = reviews.filter((review) => review.verdict === "beat").length;

  useEffect(() => {
    call<{ candidates: BeatReporterCandidate[]; reviews: Review[]; teams: string[]; canWrite: boolean }>()
      .then((payload) => {
        setCandidates(payload.candidates);
        setReviews(payload.reviews);
        setTeams(payload.teams);
        setCanWrite(payload.canWrite);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load candidates."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPicking(false);
    setPicked(card?.suggestedTeams ?? []);
  }, [card]);

  const decide = useCallback(async (verdict: Verdict, teamAbbrevs?: string[]) => {
    if (!card || busy) return;
    if (verdict === "skip") {
      setHistory((current) => [...current, { handle: card.handle, index, saved: false }]);
      setIndex((current) => current + 1);
      setAnnouncement(`Skipped @${card.handle}.`);
      return;
    }
    const chosen = verdict === "keep" ? card.conflict?.assignedTeams ?? [] : verdict === "confirm" ? teamAbbrevs ?? card.suggestedTeams : [];
    if (verdict === "keep" && !chosen.length) return;
    if (verdict === "confirm" && !chosen.length) { setPicking(true); return; }
    setBusy(true);
    setMessage(null);
    try {
      const payload = await call<{ reviews: Review[] }>({
        body: { handle: card.handle, verdict: verdict === "not_beat" ? "not_beat" : "beat", teamAbbrevs: chosen, evidenceCount: card.postCount }
      });
      setReviews(payload.reviews);
      setHistory((current) => [...current, { handle: card.handle, index, saved: true }]);
      setIndex((current) => current + 1);
      setAnnouncement(verdict === "not_beat" ? `@${card.handle} marked not a beat reporter.` : `Confirmed @${card.handle} for ${chosen.join(", ")}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, card, index]);

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last || busy) return;
    setBusy(true);
    try {
      if (last.saved) setReviews((await call<{ reviews: Review[] }>({ body: { action: "undo", handle: last.handle } })).reviews);
      setHistory((current) => current.slice(0, -1));
      setIndex(last.index);
      setAnnouncement(`Back to @${last.handle}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Undo failed.");
    } finally {
      setBusy(false);
    }
  }, [busy, history]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (picking) {
        if (key === "escape") { event.preventDefault(); setPicking(false); }
        else if (key === "enter" && picked.length) { event.preventDefault(); void decide("confirm", picked); }
        return;
      }
      if (key === "arrowright" || key === "c") { event.preventDefault(); void decide("confirm"); }
      else if (key === "arrowleft" || key === "n") { event.preventDefault(); void decide("not_beat"); }
      else if (key === "w") { event.preventDefault(); setPicking(true); }
      else if (key === "k" && card?.conflict) { event.preventDefault(); void decide("keep"); }
      else if (key === "arrowup" || key === "s") { event.preventDefault(); void decide("skip"); }
      else if (key === "u" || key === "backspace") { event.preventDefault(); void undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, decide, picked, picking, undo]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (picking || (event.target as HTMLElement).closest("a, button")) return;
    setDrag({ startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, pointerId: event.pointerId });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, dx: event.clientX - drag.startX, dy: event.clientY - drag.startY });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const { dx, dy } = drag;
    setDrag(null);
    if (dx >= SWIPE_X) void decide("confirm");
    else if (dx <= -SWIPE_X) void decide("not_beat");
    else if (dy <= -SWIPE_UP && Math.abs(dx) < SWIPE_X / 2) void decide("skip");
  };

  const togglePicked = (team: string) => setPicked((current) => current.includes(team) ? current.filter((entry) => entry !== team) : [...current, team]);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Beat Reporter Review</h1>
          <p>Accounts that post lines and goalies, inferred from stored posts. Confirm who covers which team.</p>
        </div>
        <div className={styles.tally} aria-label="Progress">
          <span><strong>{confirmed}</strong> confirmed</span>
          <span><strong>{reviews.length - confirmed}</strong> not beat</span>
          <span><strong>{loading ? "…" : Math.max(0, candidates.length - index)}</strong> left</span>
        </div>
        <Link href="/db/tweet-pattern-review?mode=trainer" className={styles.ghostButton}>Swipe trainer</Link>
      </header>

      {!canWrite && !loading ? (
        <p className={styles.notice} role="status">Read-only here: decisions are saved to beatReporters.ts on a local dev server only.</p>
      ) : null}
      {message ? <p className={styles.error} role="alert">{message}</p> : null}
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>

      {loading ? <p className={styles.notice}>Loading candidates…</p> : null}
      {!loading && !card ? (
        <section className={styles.card}>
          <h2 className={styles.handle}>All caught up</h2>
          <p className={styles.muted}>{candidates.length ? "Every candidate in this batch has a decision or was skipped." : "No unreviewed candidates."} Commit lib/lines/beatReporters.ts when you&apos;re done.</p>
          {history.length ? <button type="button" className={styles.ghostButton} onClick={() => void undo()} disabled={busy}>Undo last</button> : null}
        </section>
      ) : null}

      {card ? (
        <>
          <div className={styles.actionBar}>
            <button type="button" className={styles.dangerButton} onClick={() => void decide("not_beat")} disabled={busy || !canWrite}>Not a beat reporter <kbd>←</kbd></button>
            <button type="button" className={styles.ghostButton} onClick={() => setPicking(true)} disabled={busy || !canWrite}>Wrong team <kbd>W</kbd></button>
            <button type="button" className={styles.ghostButton} onClick={() => void decide("skip")} disabled={busy}>Skip <kbd>↑</kbd></button>
            <button type="button" className={styles.primaryButton} onClick={() => void decide("confirm")} disabled={busy || !canWrite || !card.suggestedTeams.length}>
              {card.conflict ? "Move to" : "Confirm"} {card.suggestedTeams.join(" + ")} <kbd>→</kbd>
            </button>
            {card.conflict ? (
              <button type="button" className={styles.ghostButton} onClick={() => void decide("keep")} disabled={busy || !canWrite}>
                Keep {card.conflict.assignedTeams.join(" + ")} <kbd>K</kbd>
              </button>
            ) : null}
          </div>

          <section
            className={styles.card}
            aria-label={`Candidate @${card.handle}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            style={drag ? { transform: `translate(${drag.dx}px, ${Math.min(0, drag.dy)}px) rotate(${drag.dx / 30}deg)` } : undefined}
          >
            <div className={styles.cardHeader}>
              <div className={styles.byline}>
                <h2 className={styles.handle}>
                  <a href={`https://x.com/${card.handle}`} target="_blank" rel="noreferrer">@{card.handle}</a>
                </h2>
                {card.displayName ? <span className={styles.muted}>{card.displayName}</span> : null}
              </div>
              <div className={styles.score}>
                <span className={styles.scoreValue}>{pct(card.confidence)}</span>
                <span className={styles.muted}>confidence</span>
              </div>
            </div>

            {card.conflict ? (
              <p className={styles.conflict} role="status">
                Team conflict: confirmed for {card.conflict.assignedTeams.join(" + ")} on {card.conflict.reviewedAt.slice(0, 10)}, but only{" "}
                {pct(card.conflict.assignedShare)} of {card.conflict.postsSince} team-tagged posts since then are about them. Evidence below is from those posts.
              </p>
            ) : null}

            <dl className={styles.facts}>
              <div><dt>Inferred team</dt><dd>{card.suggestedTeams.join(" + ") || "None tagged"}</dd></div>
              <div><dt>Posts</dt><dd>{card.postCount}</dd></div>
              <div><dt>Candidate</dt><dd>{index + 1} of {candidates.length}</dd></div>
            </dl>

            <ul className={styles.teamBars} aria-label="Team-tagged posts">
              {card.teams.slice(0, 5).map((team) => (
                <li key={team.teamAbbrev}>
                  <span className={styles.teamAbbrev}>{team.teamAbbrev}</span>
                  <span className={styles.bar}><span style={{ width: pct(team.share) }} /></span>
                  <span className={styles.muted}>{team.count} · {pct(team.share)}</span>
                </li>
              ))}
            </ul>

            {picking ? (
              <div className={styles.picker} role="group" aria-label="Pick the team(s) this reporter covers">
                <p className={styles.muted}>Pick the team(s), then save. <kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels.</p>
                <div className={styles.teamGrid}>
                  {teams.map((team) => (
                    <button key={team} type="button" aria-pressed={picked.includes(team)} className={styles.teamChip} onClick={() => togglePicked(team)}>{team}</button>
                  ))}
                </div>
                <div className={styles.pickerActions}>
                  <button type="button" className={styles.ghostButton} onClick={() => setPicking(false)}>Cancel</button>
                  <button type="button" className={styles.primaryButton} onClick={() => void decide("confirm", picked)} disabled={busy || !picked.length}>Save {picked.join(" + ") || "team"}</button>
                </div>
              </div>
            ) : null}

            <ol className={styles.samples} aria-label="Evidence posts">
              {card.samples.map((sample, sampleIndex) => (
                <li key={`${sample.url ?? sampleIndex}`} className={styles.sample}>
                  <div className={styles.sampleMeta}>
                    <span className={styles.teamAbbrev}>{sample.teamAbbrev ?? "—"}</span>
                    <span>{sample.classification?.replace(/_/g, " ")}</span>
                    <span>{sample.date}</span>
                    {sample.url ? <a href={sample.url} target="_blank" rel="noreferrer">Open post</a> : null}
                  </div>
                  <p className={styles.sampleText}>{sample.text}</p>
                </li>
              ))}
            </ol>
          </section>
          <p className={styles.hint}>Swipe right to confirm, left for not a beat reporter, up to skip. <kbd>U</kbd> undoes.</p>
        </>
      ) : null}
    </main>
  );
}

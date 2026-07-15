import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { useAuth } from "contexts/AuthProviderContext";
import { useDraftPairwise, type DraftPairwisePlayer } from "hooks/useDraftPairwise";
import { useDraftRanking, type DraftRankingEntry } from "hooks/useDraftRanking";
import type { DraftPairQueueMode } from "lib/draft-ranker/queue";

import styles from "./HomepageDraftRanker.module.scss";

const MODES: Array<{ value: DraftPairQueueMode; label: string }> = [
  { value: "improve_ranking", label: "Improve my ranking" },
  { value: "find_sleepers", label: "Find sleepers" },
  { value: "place_rookies", label: "Place rookies" },
  { value: "review_goalies", label: "Review goalies" },
  { value: "resolve_close_calls", label: "Resolve close calls" },
  { value: "quick_five", label: "Quick five" },
];

function PlayerPortrait({ player }: { player: DraftPairwisePlayer }) {
  return player.headshotUrl ? (
    <Image
      src={player.headshotUrl}
      alt=""
      width={76}
      height={76}
      unoptimized
      className={styles.playerImage}
    />
  ) : (
    <span className={styles.playerFallback} aria-hidden="true">
      {player.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")}
    </span>
  );
}

function MatchupPlayer({
  player,
  label,
  disabled,
  onChoose,
}: {
  player: DraftPairwisePlayer;
  label: string;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <article className={styles.playerCard}>
      <PlayerPortrait player={player} />
      <div className={styles.playerIdentity}>
        <span className={styles.playerRank}>Current No. {player.rank}</span>
        <h3>{player.name}</h3>
        <p>
          {[player.position, player.organization].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button type="button" disabled={disabled} onClick={onChoose}>
        Draft {label} first
      </button>
      <details className={styles.evidence}>
        <summary>View evidence</summary>
        <span>
          Prior Yahoo ADP: {player.evidence.previouslyUndrafted
            ? "Previously undrafted"
            : player.evidence.yahooAdp?.toFixed(1)}
        </span>
      </details>
    </article>
  );
}

function Preview({
  entries,
  activePlayerIds,
  reviewedThroughRank,
}: {
  entries: DraftRankingEntry[];
  activePlayerIds: number[];
  reviewedThroughRank: number | null;
}) {
  const reduceMotion = useReducedMotion();
  const rows = useMemo(() => {
    if (!entries.length) return [];
    const activeRanks = entries
      .filter((entry) => activePlayerIds.includes(entry.playerId))
      .map((entry) => entry.rank);
    const center = activeRanks.length
      ? Math.round(activeRanks.reduce((sum, rank) => sum + rank, 0) / activeRanks.length)
      : reviewedThroughRank ?? 1;
    const start = Math.max(0, Math.min(entries.length - 10, center - 5));
    return entries.slice(start, start + 10);
  }, [activePlayerIds, entries, reviewedThroughRank]);

  return (
    <div className={styles.preview} aria-label="Live ten-player ranking preview">
      <div className={styles.previewHeader}>
        <span>Live board preview</span>
        <Link href="/draft-rankings">Open full ranking</Link>
      </div>
      <div className={styles.previewRows}>
        {rows.map((entry) => {
          const active = activePlayerIds.includes(entry.playerId);
          const reviewed = entry.rank === reviewedThroughRank;
          return (
            <motion.div
              layout
              key={entry.playerId}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 440, damping: 38 }
              }
              className={`${styles.previewRow} ${active ? styles.activePreviewRow : ""}`}
            >
              <span className={styles.previewRank}>{entry.rank}</span>
              <span className={styles.previewName}>
                {entry.player?.canonical_name ?? "Unknown player"}
              </span>
              <span className={styles.previewPosition}>
                {entry.player?.canonical_position ?? "—"}
              </span>
              {reviewed ? (
                <span className={styles.reviewBookmark} title="Reviewed through this area">
                  Reviewed
                </span>
              ) : active ? (
                <span className={styles.comparisonSource}>Comparison</span>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function RankingExperience({
  userId,
  mode,
}: {
  userId: string;
  mode: DraftPairQueueMode;
}) {
  const [paused, setPaused] = useState(false);
  const ranking = useDraftRanking(userId);
  const board = ranking.entries.data;
  const pairwise = useDraftPairwise({
    userId,
    rankingId: board?.ranking.id ?? null,
    expectedVersion: board?.ranking.lockVersion ?? null,
    mode,
    enabled: Boolean(board) && !paused,
  });
  const quickFiveDone = mode === "quick_five" && pairwise.answers >= 5;
  const prompt = pairwise.queue.data?.prompt;

  if (ranking.bootstrap.isLoading) {
    return <p className={styles.state}>Loading your private draft board…</p>;
  }
  if (!ranking.bootstrap.data?.initialized) {
    return (
      <div className={styles.emptyState}>
        <h3>Start with last season’s real Yahoo draft market</h3>
        <p>Create your private continuous ranking, then refine it one matchup at a time.</p>
        <Link href="/draft-rankings">Create my draft ranking</Link>
      </div>
    );
  }
  if (ranking.entries.isLoading) {
    return <p className={styles.state}>Loading ranked players…</p>;
  }
  if (ranking.entries.error || pairwise.queue.error) {
    return (
      <div className={styles.emptyState} role="alert">
        <h3>The next matchup could not be loaded.</h3>
        <button type="button" onClick={() => pairwise.queue.refetch()}>Try again</button>
      </div>
    );
  }
  if (quickFiveDone) {
    return (
      <div className={styles.emptyState}>
        <h3>Quick five complete</h3>
        <p>Your five choices are saved to your private ranking.</p>
        <Link href="/draft-rankings">Review the full board</Link>
      </div>
    );
  }
  if (paused) {
    return (
      <div className={styles.emptyState}>
        <h3>Comparison session paused</h3>
        <p>Your ranking and completed choices are already saved.</p>
        <button type="button" onClick={() => setPaused(false)}>Continue</button>
      </div>
    );
  }
  if (pairwise.queue.isLoading || !prompt) {
    return <p className={styles.state}>{pairwise.queue.isLoading ? "Selecting a useful matchup…" : "No eligible matchup is available in this mode."}</p>;
  }

  return (
    <div className={styles.experience}>
      <div className={styles.matchupColumn}>
        <div className={styles.questionHeader}>
          <div>
            <span>{prompt.category ?? "Personal ranking"}</span>
            <h3>Who should be drafted first?</h3>
            <p>{prompt.reason}</p>
          </div>
          <button type="button" className={styles.pauseButton} onClick={() => setPaused(true)}>
            Pause
          </button>
        </div>
        <div className={styles.playerGrid}>
          <MatchupPlayer
            player={prompt.players[0]}
            label={prompt.players[0].name}
            disabled={pairwise.respond.isPending}
            onChoose={() => pairwise.respond.mutate("low")}
          />
          <div className={styles.versus} aria-hidden="true">VS</div>
          <MatchupPlayer
            player={prompt.players[1]}
            label={prompt.players[1].name}
            disabled={pairwise.respond.isPending}
            onChoose={() => pairwise.respond.mutate("high")}
          />
        </div>
        <div className={styles.secondaryActions}>
          <button type="button" disabled={pairwise.respond.isPending} onClick={() => pairwise.respond.mutate("too_close")}>Too close</button>
          <button type="button" disabled={pairwise.respond.isPending} onClick={() => pairwise.respond.mutate("skip")}>Skip</button>
          {mode === "quick_five" ? <span>{Math.min(pairwise.answers, 5)} of 5 complete</span> : null}
        </div>
        {pairwise.respond.error ? <p className={styles.error} role="alert">That choice was not saved. Your prior ranking is unchanged.</p> : null}
      </div>
      <Preview
        entries={board?.entries ?? []}
        activePlayerIds={prompt.players.map((player) => player.playerId)}
        reviewedThroughRank={pairwise.queue.data?.reviewedThroughRank ?? null}
      />
    </div>
  );
}

export default function HomepageDraftRanker() {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<DraftPairQueueMode>("improve_ranking");
  return (
    <section className={styles.module} aria-labelledby="homepage-ranker-title">
      <header className={styles.moduleHeader}>
        <div>
          <span className={styles.eyebrow}>Account-backed · private by default</span>
          <h2 id="homepage-ranker-title">Personal <span>Draft Ranker</span></h2>
        </div>
        {user ? (
          <label>
            <span>Session mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as DraftPairQueueMode)}>
              {MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ) : null}
      </header>
      {isLoading ? <p className={styles.state}>Checking your account…</p> : user ? (
        <RankingExperience key={mode} userId={user.id} mode={mode} />
      ) : (
        <div className={styles.signedOut}>
          <div>
            <h3>Build the top 250 you actually believe in.</h3>
            <p>Choose who you would draft first. Sign in to save every decision and resume on any device.</p>
          </div>
          <div>
            <Link href="/auth?mode=sign-in">Sign in</Link>
            <Link href="/auth?mode=sign-up">Create account</Link>
          </div>
        </div>
      )}
    </section>
  );
}

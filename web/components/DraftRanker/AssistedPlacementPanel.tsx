import type { UseMutationResult } from "@tanstack/react-query";

import type {
  DraftPlacementResponse,
  DraftPlacementSession,
} from "hooks/useDraftPlacement";
import { DraftRankerClientError } from "lib/draft-ranker/client";
import type { DraftPlacementMutationInput } from "lib/draft-ranker/contracts";
import type { PlacementRoughRange } from "lib/draft-ranker/placementEngine";

import styles from "./DraftRanker.module.scss";

export type PlacementCandidate = {
  playerId: number;
  canonicalName: string;
  position: string | null;
  organizationName: string | null;
  headshotUrl: string | null;
};

type Props = {
  candidate: PlacementCandidate | null;
  rankingId: string;
  currentVersion: number;
  session: DraftPlacementSession | null;
  mutation: UseMutationResult<
    DraftPlacementResponse,
    Error,
    DraftPlacementMutationInput
  >;
  onFinished: () => void;
};

const roughRanges: Array<{
  value: PlacementRoughRange;
  label: string;
  detail: string;
}> = [
  { value: "top_50", label: "Top 50", detail: "Early-round anchor" },
  { value: "51_100", label: "51–100", detail: "Middle rounds" },
  { value: "101_150", label: "101–150", detail: "Later rounds" },
  { value: "151_200", label: "151–200", detail: "Deep leagues" },
  { value: "201_250", label: "201–250", detail: "Top-250 fringe" },
  { value: "outside_250", label: "Outside 250", detail: "Candidate bench" },
  { value: "unsure", label: "Not sure", detail: "Search the full board" },
];

function displayName(session: DraftPlacementSession): string {
  return session.player?.canonical_name ?? `Player ${session.playerId}`;
}

function playerMeta(
  position: string | null | undefined,
  organization: string | null | undefined,
): string {
  return [position, organization ?? "Unsigned"].filter(Boolean).join(" · ");
}

export default function AssistedPlacementPanel({
  candidate,
  rankingId,
  currentVersion,
  session,
  mutation,
  onFinished,
}: Props) {
  if (!candidate && !session) return null;

  const stale =
    mutation.error instanceof DraftRankerClientError &&
    mutation.error.body.code === "stale_ranking_version";
  const busy = mutation.isPending;

  async function start(
    playerId: number,
    roughRange: PlacementRoughRange,
  ) {
    try {
      await mutation.mutateAsync({
        action: "start",
        rankingId,
        playerId,
        expectedVersion: currentVersion,
        roughRange,
        operationId: crypto.randomUUID(),
      });
    } catch {
      // React Query exposes the actionable error in the panel.
    }
  }

  async function finish(action: "confirm" | "cancel") {
    if (!session) return;
    try {
      const result = await mutation.mutateAsync({
        action,
        sessionId: session.id,
        operationId: crypto.randomUUID(),
      });
      if (result.session?.status !== "active") onFinished();
    } catch {
      // React Query exposes the actionable error in the panel.
    }
  }

  async function revalidate() {
    if (!session) return;
    try {
      await mutation.mutateAsync({
        action: "cancel",
        sessionId: session.id,
        operationId: crypto.randomUUID(),
      });
      await mutation.mutateAsync({
        action: "start",
        rankingId: session.rankingId,
        playerId: session.playerId,
        expectedVersion: currentVersion,
        roughRange: session.state.roughRange,
        operationId: crypto.randomUUID(),
      });
    } catch {
      // React Query exposes the actionable error in the panel.
    }
  }

  if (!session && candidate) {
    return (
      <section
        className={styles.placementCard}
        aria-labelledby="placement-heading"
      >
        <div className={styles.placementHeader}>
          <div>
            <p className={styles.eyebrow}>Assisted placement</p>
            <h2 id="placement-heading">Where does {candidate.canonicalName} fit?</h2>
            <p>
              Pick a rough range. A short sequence of real head-to-head choices
              will narrow the exact spot; no answer directly hard-codes a rank.
              Most placements take 6–10 choices, with a hard cap of 12 (or 16
              when answers conflict).
            </p>
          </div>
          <button type="button" disabled={busy} onClick={onFinished}>
            Close
          </button>
        </div>
        <div className={styles.placementTarget}>
          {candidate.headshotUrl ? (
            <img src={candidate.headshotUrl} alt="" />
          ) : (
            <span aria-hidden="true">{candidate.canonicalName.slice(0, 1)}</span>
          )}
          <div>
            <strong>{candidate.canonicalName}</strong>
            <small>{playerMeta(candidate.position, candidate.organizationName)}</small>
          </div>
        </div>
        <fieldset className={styles.rangeChoices} disabled={busy}>
          <legend>Choose a starting range</legend>
          {roughRanges.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => start(candidate.playerId, range.value)}
            >
              <strong>{range.label}</strong>
              <small>{range.detail}</small>
            </button>
          ))}
        </fieldset>
        {mutation.error ? (
          <p className={styles.error} role="alert">
            {mutation.error.message}
          </p>
        ) : null}
      </section>
    );
  }

  if (!session) return null;

  const targetName = displayName(session);
  const progressMax = session.state.contradictionCount > 0 ? 16 : 12;
  const plausible =
    session.state.plausibleLow && session.state.plausibleHigh
      ? session.state.plausibleLow === session.state.plausibleHigh
        ? `#${session.state.plausibleLow}`
        : `#${session.state.plausibleLow}–${session.state.plausibleHigh}`
      : null;

  return (
    <section
      className={styles.placementCard}
      aria-labelledby="placement-heading"
    >
      <div className={styles.placementHeader}>
        <div>
          <p className={styles.eyebrow}>
            {session.state.ready ? "Suggested placement" : "Who goes first?"}
          </p>
          <h2 id="placement-heading">Place {targetName}</h2>
          <p aria-live="polite">
            {session.state.ready
              ? `Suggested rank #${session.state.suggestedRank}${plausible ? ` · plausible range ${plausible}` : ""}`
              : `Comparison ${session.state.questionCount + 1} of at most ${progressMax}`}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => finish("cancel")}>
          Cancel placement
        </button>
      </div>

      {stale ? (
        <div className={styles.placementConflict} role="alert">
          <div>
            <strong>Your board changed during placement.</strong>
            <p>
              Revalidate against the current order before confirming a rank.
            </p>
          </div>
          <button type="button" disabled={busy} onClick={revalidate}>
            {busy ? "Revalidating…" : "Revalidate placement"}
          </button>
        </div>
      ) : session.state.ready ? (
        <div className={styles.placementReady}>
          <div className={styles.suggestedRank}>
            <span>Suggested rank</span>
            <strong>#{session.state.suggestedRank}</strong>
            <small>{session.state.confidence} confidence</small>
          </div>
          <div className={styles.neighborStack} aria-label="Suggested neighbors">
            {session.neighbors?.above ? (
              <div>
                <span>#{session.neighbors.above.rank}</span>
                <strong>
                  {session.neighbors.above.player?.canonical_name ?? "Unknown player"}
                </strong>
              </div>
            ) : null}
            <div className={styles.targetInsert}>
              <span>#{session.state.suggestedRank}</span>
              <strong>{targetName}</strong>
            </div>
            {session.neighbors?.below ? (
              <div>
                <span>#{session.neighbors.below.rank + 1}</span>
                <strong>
                  {session.neighbors.below.player?.canonical_name ?? "Unknown player"}
                </strong>
              </div>
            ) : null}
          </div>
          <div className={styles.placementConfirmActions}>
            <button type="button" disabled={busy} onClick={() => finish("confirm")}>
              {busy ? "Saving…" : `Confirm rank #${session.state.suggestedRank}`}
            </button>
            <button type="button" disabled={busy} onClick={() => finish("cancel")}>
              Cancel
            </button>
          </div>
        </div>
      ) : session.anchorPlayer && session.currentAnchor ? (
        <>
          <div className={styles.comparisonProgress}>
            <progress
              aria-label="Placement progress"
              max={progressMax}
              value={session.state.questionCount + 1}
            />
          </div>
          <div className={styles.matchupCards}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                mutation.mutate({
                  action: "answer",
                  sessionId: session.id,
                  outcome: "target_over_anchor",
                  operationId: crypto.randomUUID(),
                })
              }
            >
              <span>Draft first</span>
              <strong>{targetName}</strong>
              <small>
                {playerMeta(
                  session.player?.canonical_position,
                  session.player?.current_organization_name,
                )}
              </small>
            </button>
            <span className={styles.versus}>OR</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                mutation.mutate({
                  action: "answer",
                  sessionId: session.id,
                  outcome: "anchor_over_target",
                  operationId: crypto.randomUUID(),
                })
              }
            >
              <span>Draft first · currently #{session.currentAnchor.rank}</span>
              <strong>{session.anchorPlayer.canonical_name}</strong>
              <small>
                {playerMeta(
                  session.anchorPlayer.canonical_position,
                  session.anchorPlayer.current_organization_name,
                )}
              </small>
            </button>
          </div>
          <div className={styles.secondaryAnswers}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                mutation.mutate({
                  action: "answer",
                  sessionId: session.id,
                  outcome: "too_close",
                  operationId: crypto.randomUUID(),
                })
              }
            >
              Too close to call
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                mutation.mutate({
                  action: "answer",
                  sessionId: session.id,
                  outcome: "skip",
                  operationId: crypto.randomUUID(),
                })
              }
            >
              Skip this matchup
            </button>
          </div>
        </>
      ) : (
        <p className={styles.error} role="alert">
          This placement has no valid comparison anchor. Cancel and start again.
        </p>
      )}

      {mutation.error && !stale ? (
        <p className={styles.error} role="alert">
          {mutation.error.message}
        </p>
      ) : null}
    </section>
  );
}

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "contexts/AuthProviderContext";
import { useDraftRanking } from "hooks/useDraftRanking";
import { useDraftPlacement } from "hooks/useDraftPlacement";
import { DraftRankerClientError } from "lib/draft-ranker/client";

import DraftPlayerSearch from "./DraftPlayerSearch";
import DraftDiscovery from "./DraftDiscovery";
import { DraftContributionConsent } from "./DraftContributionConsent";
import DraftRankingExport from "./DraftRankingExport";
import DraftRankingTable from "./DraftRankingTable";
import styles from "./DraftRanker.module.scss";

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Draft Ranker could not be loaded.";
}

export default function DraftRankerPage() {
  const { user, isLoading } = useAuth();
  const ranker = useDraftRanking(user?.id ?? null);
  const [placementCandidate, setPlacementCandidate] =
    useState<PlacementCandidate | null>(null);
  const placementRankingId = ranker.bootstrap.data?.ranking?.id ?? "";
  const placement = useDraftPlacement(
    placementRankingId,
    Boolean(user && placementRankingId),
  );

  if (isLoading) {
    return <div className={styles.stateCard}>Loading your account…</div>;
  }
  if (!user) {
    return (
      <div className={styles.stateCard}>
        <h1>Build your personal NHL draft board</h1>
        <p>Your rankings are private and saved to your FHFH account.</p>
        <div className={styles.authActions}>
          <Link href="/auth?mode=sign-in">Sign in</Link>
          <Link href="/auth?mode=sign-up">Create account</Link>
        </div>
      </div>
    );
  }
  if (ranker.bootstrap.isLoading) {
    return <div className={styles.stateCard}>Loading your draft board…</div>;
  }
  if (ranker.bootstrap.error) {
    const disabled =
      ranker.bootstrap.error instanceof DraftRankerClientError &&
      ranker.bootstrap.error.body.code === "draft_ranker_disabled";
    return (
      <div className={styles.stateCard} role="alert">
        <h1>
          {disabled ? "Draft Ranker preview" : "We couldn’t load your board"}
        </h1>
        <p>
          {disabled
            ? "This account-backed feature is still behind its rollout flag."
            : messageFor(ranker.bootstrap.error)}
        </p>
        {!disabled ? (
          <button type="button" onClick={() => ranker.bootstrap.refetch()}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const bootstrap = ranker.bootstrap.data;
  if (!bootstrap?.initialized) {
    return (
      <div className={styles.stateCard}>
        <p className={styles.eyebrow}>2026–27 season</p>
        <h1>Start with Yahoo’s final 2025 draft market</h1>
        <p>
          We’ll create your private board from every verified, rankable player
          with usable Yahoo ADP—not just the first 250. You can change every
          rank.
        </p>
        <button
          type="button"
          disabled={ranker.initialize.isPending}
          onClick={() => ranker.initialize.mutate()}
        >
          {ranker.initialize.isPending
            ? "Building board…"
            : "Create my draft board"}
        </button>
        {ranker.initialize.error ? (
          <p className={styles.error} role="alert">
            {messageFor(ranker.initialize.error)}
          </p>
        ) : null}
      </div>
    );
  }

  if (ranker.entries.isLoading || !ranker.entries.data) {
    return <div className={styles.stateCard}>Loading ranked players…</div>;
  }
  if (ranker.entries.error) {
    return (
      <div className={styles.stateCard} role="alert">
        <h1>We couldn’t load the ranked players</h1>
        <p>{messageFor(ranker.entries.error)}</p>
        <button type="button" onClick={() => ranker.entries.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const staleConflict =
    ranker.reorder.error instanceof DraftRankerClientError &&
    ranker.reorder.error.body.code === "stale_ranking_version";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Account-backed · private by default</p>
          <h1>My 2026–27 NHL Draft Rankings</h1>
          <p>
            A continuous board of {ranker.entries.data.entries.length} players,
            seeded from last season’s Yahoo ADP and owned by you.
          </p>
        </div>
        <dl>
          <div>
            <dt>Ranked</dt>
            <dd>{Math.min(250, ranker.entries.data.entries.length)}</dd>
          </div>
          <div>
            <dt>Candidates</dt>
            <dd>{Math.max(0, ranker.entries.data.entries.length - 250)}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{ranker.entries.data.ranking.lockVersion}</dd>
          </div>
        </dl>
      </header>

      {staleConflict ? (
        <div className={styles.conflict} role="alert">
          This board changed in another session. We refreshed it before applying
          another edit.
        </div>
      ) : ranker.reorder.error ? (
        <div className={styles.errorBanner} role="alert">
          {messageFor(ranker.reorder.error)}
        </div>
      ) : null}

      <DraftPlayerSearch
        rankingId={ranker.entries.data.ranking.id}
        rankedPlayerIds={ranker.entries.data.entries.map(
          (entry) => entry.playerId,
        )}
        onPlacePlayer={(player) => {
          placement.mutation.reset();
          setPlacementCandidate(player);
        }}
      />

      <DraftDiscovery
        rankingId={ranker.entries.data.ranking.id}
        enabled={bootstrap.discoveryEnabled}
        onCompare={(player) => {
          placement.mutation.reset();
          setPlacementCandidate(player);
        }}
      />

      {bootstrap.pairwiseEnabled ? <DraftContributionConsent /> : null}

      <AssistedPlacementPanel
        candidate={placementCandidate}
        rankingId={ranker.entries.data.ranking.id}
        currentVersion={ranker.entries.data.ranking.lockVersion}
        session={
          placement.mutation.data?.session?.status === "active"
            ? placement.mutation.data.session
            : (placement.state.data?.session ?? null)
        }
        mutation={placement.mutation}
        onFinished={() => {
          setPlacementCandidate(null);
          placement.mutation.reset();
        }}
      />

      <DraftRankingTable
        entries={ranker.entries.data.entries}
        isSaving={ranker.reorder.isPending}
        onReorder={(action) => ranker.reorder.mutate(action)}
      />

      <DraftRankingExport rankingId={ranker.entries.data.ranking.id} />
    </div>
  );
}
import AssistedPlacementPanel, {
  type PlacementCandidate,
} from "./AssistedPlacementPanel";

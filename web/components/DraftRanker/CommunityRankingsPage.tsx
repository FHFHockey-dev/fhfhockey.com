import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useAuth } from "contexts/AuthProviderContext";
import {
  useCommunityDraftRankings,
  type CommunityRankingRow,
} from "hooks/useCommunityDraftRankings";

import styles from "./CommunityRankings.module.scss";

const PAGE_SIZE = 50;

const EVIDENCE_LABELS: Record<CommunityRankingRow["evidenceState"], string> = {
  market_seeded: "Market seeded",
  building: "Building evidence",
  emerging: "Emerging",
  established: "Established",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function signedDelta(value: number | null) {
  if (value == null) return "—";
  if (value === 0) return "Same";
  return value > 0 ? `You: ${value} later` : `You: ${Math.abs(value)} earlier`;
}

function PlayerIdentity({ row }: { row: CommunityRankingRow }) {
  return (
    <div className={styles.playerIdentity}>
      {row.player.headshotUrl ? (
        <Image
          src={row.player.headshotUrl}
          alt=""
          width={38}
          height={38}
          unoptimized
        />
      ) : (
        <span aria-hidden="true">{row.player.position ?? "NHL"}</span>
      )}
      <div>
        <strong>{row.player.canonicalName}</strong>
        <small>
          {[row.player.organizationName ?? "Unsigned", row.player.position]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </div>
    </div>
  );
}

function EvidenceCell({ row }: { row: CommunityRankingRow }) {
  return (
    <div className={styles.evidenceCell}>
      <span data-state={row.evidenceState}>
        {EVIDENCE_LABELS[row.evidenceState]}
      </span>
      <small>{row.confidenceLabel}</small>
    </div>
  );
}

function RankingTable({ rows }: { rows: CommunityRankingRow[] }) {
  return (
    <div className={styles.tableScroller}>
      <table>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">2025 Yahoo ADP</th>
            <th scope="col">Evidence</th>
            <th scope="col">Sample</th>
            <th scope="col">My board</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              <td className={styles.rankCell}>
                <strong>{row.communityRank ?? `~${row.estimatedRank}`}</strong>
                {row.rankChange ? (
                  <small data-direction={row.rankChange > 0 ? "up" : "down"}>
                    {row.rankChange > 0 ? "+" : ""}
                    {row.rankChange}
                  </small>
                ) : null}
              </td>
              <td>
                <PlayerIdentity row={row} />
              </td>
              <td>
                {row.previouslyUndrafted ? (
                  <span className={styles.undrafted}>Previously undrafted</span>
                ) : (
                  (row.previousYahooAdp?.toFixed(1) ?? "—")
                )}
              </td>
              <td>
                <EvidenceCell row={row} />
              </td>
              <td className={styles.sampleCell}>
                {row.comparisonCount ? (
                  <>
                    <strong>{row.independentUsers} users</strong>
                    <small>
                      {row.comparisonCount} comparisons ·{" "}
                      {row.distinctOpponents} opponents
                    </small>
                  </>
                ) : (
                  <small>Awaiting opted-in comparisons</small>
                )}
              </td>
              <td className={styles.personalCell}>
                {row.personalRank ? (
                  <>
                    <strong>#{row.personalRank}</strong>
                    <small>{signedDelta(row.personalDelta)}</small>
                  </>
                ) : (
                  <Link href="/draft-rankings">Build my board</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CommunityRankingsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const ranking = useCommunityDraftRankings(user?.id ?? null, page, PAGE_SIZE);

  if (ranking.isLoading) {
    return (
      <div className={styles.stateCard}>Loading the audited snapshot…</div>
    );
  }
  if (ranking.error || !ranking.data) {
    return (
      <div className={styles.stateCard} role="alert">
        <h1>Community Rankings are unavailable</h1>
        <p>
          {ranking.error instanceof Error
            ? ranking.error.message
            : "Try again shortly."}
        </p>
        <button type="button" onClick={() => ranking.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (!ranking.data.snapshot) {
    return (
      <div className={styles.stateCard}>
        <h1>FHFH Community Rankings</h1>
        <p>{ranking.data.message}</p>
      </div>
    );
  }
  const { snapshot, pagination } = ranking.data;
  const pages = Math.ceil(pagination.total / pagination.limit);
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>2026–27 · aggregate and anonymous</p>
          <h1>FHFH Community Rankings</h1>
          <p>
            Opponent-strength rankings built only from opted-in, prompt-issued
            comparisons. Direct personal edits are never counted as votes.
          </p>
        </div>
        <div className={styles.snapshotMeta}>
          <span>Snapshot {formatDate(snapshot.snapshotAsOf)}</span>
          <span>{snapshot.acceptedComparisonCount} eligible comparisons</span>
          <span>{snapshot.modelVersion}</span>
        </div>
      </header>

      {ranking.data.message ? (
        <section className={styles.coldStart} aria-label="Evidence status">
          <strong>Market-seeded cold start</strong>
          <p>{ranking.data.message}</p>
        </section>
      ) : null}

      <section
        className={styles.rankingCard}
        aria-labelledby="community-table-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Public top 250</p>
            <h2 id="community-table-title">Current ranking</h2>
          </div>
          <span>{pagination.total} players</span>
        </div>
        <RankingTable rows={ranking.data.rows} />
        <nav className={styles.pagination} aria-label="Community ranking pages">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous 50
          </button>
          <span>
            Page {page} of {Math.max(1, pages)}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next 50
          </button>
        </nav>
      </section>

      {ranking.data.emerging.length ? (
        <section
          className={styles.rankingCard}
          aria-labelledby="emerging-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Outside the cutoff</p>
              <h2 id="emerging-title">Emerging candidates</h2>
            </div>
          </div>
          <RankingTable rows={ranking.data.emerging} />
        </section>
      ) : null}

      <section className={styles.methodology}>
        <h2>What the labels mean</h2>
        <div>
          <p>
            <strong>Market seeded</strong> uses verified prior Yahoo ADP and
            makes no community-consensus claim.
          </p>
          <p>
            <strong>Emerging</strong> requires at least 5 users, 10 comparisons,
            and 5 opponents.
          </p>
          <p>
            <strong>Established</strong> requires 20 users, 40 comparisons, 10
            opponents, cutoff coverage, and a conservative top-250 estimate.
          </p>
        </div>
      </section>
    </main>
  );
}

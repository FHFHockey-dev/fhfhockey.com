import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
  NextPage,
} from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";

import {
  selectFirstArrivalBuckets,
  type FirstArrivalCandidate,
} from "lib/sources/lineSourceFirstArrival";
import serverClient from "lib/supabase/server";

import styles from "./index.module.scss";

type TwitterEmbedSource = {
  handle: string;
  label: string;
  url: string;
};

export type LocalTweetCard = {
  key: string;
  sourceKey: string;
  tweetId: string;
  authorName: string;
  authorHandle: string;
  sourceAccount: string | null;
  sourceLabel: string;
  tweetUrl: string;
  sourceUrl: string | null;
  wrapperText: string;
  quotedAuthorName: string | null;
  quotedAuthorHandle: string | null;
  quotedTweetUrl: string | null;
  quotedText: string;
  status: string;
  snapshotDate: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  gameId: number | null;
  signalType: string | null;
  tweetPostedAt: string | null;
  observedAt: string | null;
  rowStatus: string;
  bucketKey: string | null;
  alternativeSources: Array<{
    sourceKey: string;
    sourceAccount: string | null;
    tweetUrl: string;
    observedAt: string | null;
  }>;
};

const twitterEmbedSources = [
  {
    handle: "CcCMiddleton",
    label: "Posts by CcCMiddleton",
    url: "https://twitter.com/CcCMiddleton?ref_src=twsrc%5Etfw",
  },
  {
    handle: "GameDayGoalies",
    label: "Posts by GameDayGoalies",
    url: "https://x.com/GameDayGoalies",
  },
  {
    handle: "GameDayNewsNHL",
    label: "Posts by GameDayNewsNHL",
    url: "https://x.com/GameDayNewsNHL",
  },
  {
    handle: "GameDayLines",
    label: "Posts by GameDayLines",
    url: "https://x.com/GameDayLines",
  },
] satisfies TwitterEmbedSource[];

const PAGE_REFRESH_INTERVAL_MS = 60_000;
const retweetingSourceHandles = new Set([
  "cccmiddleton",
  "gamedaygoalies",
  "gamedaynewsnhl",
  "gamedaylines",
]);

type LinesCccPageRow = {
  capture_key: string;
  snapshot_date: string;
  team_id: number | null;
  team_abbreviation: string | null;
  game_id: number | null;
  classification: string | null;
  tweet_posted_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  author_name: string | null;
  source_handle: string | null;
  quoted_author_name: string | null;
  quoted_author_handle: string | null;
  tweet_posted_label: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  nhl_filter_status: string;
  observed_at: string | null;
  status: string;
};

type LineSourceSnapshotPageRow = {
  capture_key: string;
  snapshot_date: string;
  team_id: number | null;
  team_abbreviation: string | null;
  game_id: number | null;
  classification: string | null;
  tweet_posted_at: string | null;
  source_key: string;
  source_account: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  author_name: string | null;
  source_handle: string | null;
  quoted_author_name: string | null;
  quoted_author_handle: string | null;
  tweet_posted_label: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  nhl_filter_status: string;
  observed_at: string | null;
  status: string;
};

type PageProps = {
  localTweetCards: LocalTweetCard[];
  loadError: string | null;
};

type RetweetAttributionRow = {
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  source_key?: string | null;
  source_account?: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  author_name: string | null;
  source_handle: string | null;
  quoted_author_name: string | null;
  quoted_author_handle: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
};

function normalizeTwitterHandle(
  handle: string | null | undefined,
): string | null {
  const normalized = handle?.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

function isRetweetingSourceHandle(handle: string | null | undefined): boolean {
  const normalized = normalizeTwitterHandle(handle);
  return normalized ? retweetingSourceHandles.has(normalized) : false;
}

function parseHandleFromTweetUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const { pathname } = new URL(url);
    const handle = pathname.match(/^\/([^/]+)\/status(?:es)?\/\d+/i)?.[1];
    return handle &&
      handle.toLowerCase() !== "i" &&
      !isRetweetingSourceHandle(handle)
      ? handle
      : null;
  } catch {
    return null;
  }
}

function getRetweetedAttribution(row: RetweetAttributionRow) {
  const isRetweetingSource =
    isRetweetingSourceHandle(row.source_handle) ||
    isRetweetingSourceHandle(row.source_account) ||
    isRetweetingSourceHandle(row.source_key);
  const explicitQuotedAuthorHandle = isRetweetingSourceHandle(
    row.quoted_author_handle,
  )
    ? null
    : row.quoted_author_handle;
  const quotedAuthorHandle =
    explicitQuotedAuthorHandle ?? parseHandleFromTweetUrl(row.quoted_tweet_url);
  const quotedAuthorName = isRetweetingSourceHandle(row.quoted_author_name)
    ? null
    : row.quoted_author_name;

  if (
    !isRetweetingSource ||
    (!quotedAuthorHandle && !quotedAuthorName && !row.quoted_tweet_url)
  ) {
    return null;
  }

  const quotedText = row.quoted_enriched_text ?? row.quoted_raw_text ?? "";

  return {
    tweetId: row.quoted_tweet_id ?? row.tweet_id ?? "unknown-tweet",
    authorName: quotedAuthorName ?? quotedAuthorHandle ?? "Unknown author",
    authorHandle: quotedAuthorHandle ?? "unknown",
    tweetUrl: row.quoted_tweet_url ?? row.source_url ?? row.tweet_url ?? "#",
    sourceUrl: row.quoted_tweet_url ?? row.source_url ?? null,
    wrapperText:
      quotedText || row.enriched_text || row.raw_text || "(no wrapper text)",
  };
}

function getFallbackAttribution(row: RetweetAttributionRow) {
  const sourceHandle = isRetweetingSourceHandle(row.source_handle)
    ? null
    : row.source_handle;
  const authorName = isRetweetingSourceHandle(row.author_name)
    ? null
    : row.author_name;

  return {
    authorName: authorName ?? sourceHandle ?? "Unknown author",
    authorHandle: sourceHandle ?? "unknown",
  };
}

export function mapLinesCccRowToCard(row: LinesCccPageRow): LocalTweetCard {
  const retweetedAttribution = getRetweetedAttribution({
    ...row,
    source_account: "CcCMiddleton",
  });
  const fallbackAttribution = getFallbackAttribution(row);

  return {
    key: row.capture_key,
    sourceKey: "ccc",
    tweetId:
      retweetedAttribution?.tweetId ??
      row.tweet_id ??
      row.quoted_tweet_id ??
      "unknown-tweet",
    authorName:
      retweetedAttribution?.authorName ?? fallbackAttribution.authorName,
    authorHandle:
      retweetedAttribution?.authorHandle ?? fallbackAttribution.authorHandle,
    sourceAccount: "CcCMiddleton",
    sourceLabel: row.tweet_posted_label ?? "Unknown date",
    tweetUrl:
      retweetedAttribution?.tweetUrl ??
      row.tweet_url ??
      row.quoted_tweet_url ??
      "#",
    sourceUrl: retweetedAttribution?.sourceUrl ?? row.source_url ?? null,
    wrapperText:
      retweetedAttribution?.wrapperText ??
      row.enriched_text ??
      row.raw_text ??
      "(no wrapper text)",
    quotedAuthorName: retweetedAttribution
      ? null
      : (row.quoted_author_name ?? null),
    quotedAuthorHandle: retweetedAttribution
      ? null
      : (row.quoted_author_handle ?? null),
    quotedTweetUrl: retweetedAttribution
      ? null
      : (row.quoted_tweet_url ?? null),
    quotedText: retweetedAttribution
      ? ""
      : (row.quoted_enriched_text ?? row.quoted_raw_text ?? ""),
    status: row.nhl_filter_status,
    snapshotDate: row.snapshot_date,
    teamId: row.team_id,
    teamAbbreviation: row.team_abbreviation,
    gameId: row.game_id,
    signalType: row.classification,
    tweetPostedAt: row.tweet_posted_at,
    observedAt: row.observed_at ?? null,
    rowStatus: row.status,
    bucketKey: null,
    alternativeSources: [],
  };
}

export function mapLineSourceSnapshotRowToCard(
  row: LineSourceSnapshotPageRow,
): LocalTweetCard {
  const retweetedAttribution = getRetweetedAttribution(row);
  const fallbackAttribution = getFallbackAttribution(row);

  return {
    key: row.capture_key,
    sourceKey: row.source_key,
    tweetId:
      retweetedAttribution?.tweetId ??
      row.tweet_id ??
      row.quoted_tweet_id ??
      "unknown-tweet",
    authorName:
      retweetedAttribution?.authorName ?? fallbackAttribution.authorName,
    authorHandle:
      retweetedAttribution?.authorHandle ?? fallbackAttribution.authorHandle,
    sourceAccount: row.source_account ?? row.source_key,
    sourceLabel: row.tweet_posted_label ?? "Unknown date",
    tweetUrl:
      retweetedAttribution?.tweetUrl ??
      row.source_url ??
      row.tweet_url ??
      row.quoted_tweet_url ??
      "#",
    sourceUrl: retweetedAttribution?.sourceUrl ?? row.source_url ?? null,
    wrapperText:
      retweetedAttribution?.wrapperText ??
      row.enriched_text ??
      row.raw_text ??
      "(no wrapper text)",
    quotedAuthorName: retweetedAttribution
      ? null
      : (row.quoted_author_name ?? null),
    quotedAuthorHandle: retweetedAttribution
      ? null
      : (row.quoted_author_handle ?? null),
    quotedTweetUrl: retweetedAttribution
      ? null
      : (row.quoted_tweet_url ?? null),
    quotedText: retweetedAttribution
      ? ""
      : (row.quoted_enriched_text ?? row.quoted_raw_text ?? ""),
    status: row.nhl_filter_status,
    snapshotDate: row.snapshot_date,
    teamId: row.team_id,
    teamAbbreviation: row.team_abbreviation,
    gameId: row.game_id,
    signalType: row.classification,
    tweetPostedAt: row.tweet_posted_at,
    observedAt: row.observed_at ?? null,
    rowStatus: row.status,
    bucketKey: null,
    alternativeSources: [],
  };
}

function toFirstArrivalCandidate(
  card: LocalTweetCard,
): FirstArrivalCandidate<LocalTweetCard> {
  return {
    value: card,
    captureKey: card.key,
    sourceKey: card.sourceKey,
    tweetId: card.tweetId === "unknown-tweet" ? null : card.tweetId,
    snapshotDate: card.snapshotDate,
    teamId: card.teamId,
    teamAbbreviation: card.teamAbbreviation,
    gameId: card.gameId,
    signalType: card.signalType,
    tweetPostedAt: card.tweetPostedAt,
    observedAt: card.observedAt,
    status: card.rowStatus,
    nhlFilterStatus: card.status,
  };
}

export function selectFirstArrivalTweetCards(
  cards: LocalTweetCard[],
): LocalTweetCard[] {
  return selectFirstArrivalBuckets(cards.map(toFirstArrivalCandidate)).map(
    ({ bucketKey, winner, nonWinners }) => ({
      ...winner.value,
      bucketKey,
      alternativeSources: nonWinners.map(({ value }) => ({
        sourceKey: value.sourceKey,
        sourceAccount: value.sourceAccount,
        tweetUrl: value.tweetUrl,
        observedAt: value.observedAt,
      })),
    }),
  );
}

function getCardCanonicalUrl(card: LocalTweetCard): string | null {
  return card.quotedTweetUrl ?? card.sourceUrl ?? card.tweetUrl ?? null;
}

function getCardDedupeKey(card: LocalTweetCard): string {
  return (
    getCardCanonicalUrl(card) ??
    (card.tweetId !== "unknown-tweet" ? card.tweetId : card.key)
  );
}

function isAcceptedObservedCard(card: LocalTweetCard): boolean {
  return card.rowStatus === "observed" && card.status === "accepted";
}

function getObservedAtMs(card: LocalTweetCard): number | null {
  const observedAtMs = Date.parse(card.observedAt ?? "");
  return Number.isFinite(observedAtMs) ? observedAtMs : null;
}

function getCardPriority(card: LocalTweetCard): number {
  return [
    card.rowStatus === "observed" ? 8 : 0,
    card.status === "accepted" ? 4 : 0,
    card.quotedTweetUrl && card.quotedText ? 2 : 0,
    card.wrapperText ? 1 : 0,
  ].reduce((total, value) => total + value, 0);
}

function shouldReplaceCard(
  existing: LocalTweetCard,
  candidate: LocalTweetCard,
): boolean {
  const existingAcceptedObserved = isAcceptedObservedCard(existing);
  const candidateAcceptedObserved = isAcceptedObservedCard(candidate);
  if (existingAcceptedObserved !== candidateAcceptedObserved) {
    return candidateAcceptedObserved;
  }

  const existingObservedAt = getObservedAtMs(existing);
  const candidateObservedAt = getObservedAtMs(candidate);
  if (existingAcceptedObserved && candidateAcceptedObserved) {
    if (existingObservedAt == null) return candidateObservedAt != null;
    if (candidateObservedAt == null) return false;
    if (candidateObservedAt !== existingObservedAt) {
      return candidateObservedAt < existingObservedAt;
    }
  }

  const priorityDifference =
    getCardPriority(candidate) - getCardPriority(existing);
  if (priorityDifference !== 0) {
    return priorityDifference > 0;
  }

  if (
    existingObservedAt != null &&
    candidateObservedAt != null &&
    candidateObservedAt !== existingObservedAt
  ) {
    return candidateObservedAt < existingObservedAt;
  }

  return candidate.key < existing.key;
}

export function dedupeTweetCards(cards: LocalTweetCard[]): LocalTweetCard[] {
  const bestByTweet = new Map<string, LocalTweetCard>();
  for (const card of cards) {
    const key = getCardDedupeKey(card);
    const existing = bestByTweet.get(key);
    if (!existing || shouldReplaceCard(existing, card)) {
      bestByTweet.set(key, card);
    }
  }
  return Array.from(bestByTweet.values()).sort((left, right) => {
    const acceptedObservedDifference =
      Number(isAcceptedObservedCard(right)) -
      Number(isAcceptedObservedCard(left));
    if (acceptedObservedDifference !== 0) return acceptedObservedDifference;
    return (getObservedAtMs(right) ?? 0) - (getObservedAtMs(left) ?? 0);
  });
}

const TwitterEmbedsPage: NextPage<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ localTweetCards, loadError }) => {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void router.replace(router.asPath, undefined, { scroll: false });
      }
    }, PAGE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <>
      <Head>
        <title>Twitter Embeds | FHFH</title>
      </Head>
      <main className={styles.page}>
        <h1>Twitter Embeds</h1>
        <section
          className={styles.timelineSource}
          aria-label="X timeline source"
        >
          {twitterEmbedSources.map((source) => (
            <a href={source.url} key={source.url}>
              {source.label}
            </a>
          ))}
        </section>

        <section
          className={styles.localCards}
          aria-label="Local tweet examples"
        >
          {loadError ? (
            <p className={styles.stateNote}>
              Failed to load one or more lineup sources: {loadError}
            </p>
          ) : null}
          {!loadError && localTweetCards.length === 0 ? (
            <p className={styles.stateNote}>
              No accepted lineup-source rows found yet.
            </p>
          ) : null}
          {localTweetCards.map((tweet) => (
            <article className={styles.tweetCard} key={tweet.key}>
              <header className={styles.tweetHeader}>
                <div>
                  <strong>{tweet.authorName}</strong>{" "}
                  <a href={`https://twitter.com/${tweet.authorHandle}`}>
                    @{tweet.authorHandle}
                  </a>
                </div>
                <a href={tweet.tweetUrl}>{tweet.sourceLabel}</a>
              </header>
              <p className={styles.wrapperText}>{tweet.wrapperText}</p>
              {tweet.quotedText || tweet.quotedTweetUrl ? (
                <div className={styles.quoteCard}>
                  {tweet.quotedAuthorName && tweet.quotedAuthorHandle ? (
                    <div className={styles.quoteHeader}>
                      <strong>{tweet.quotedAuthorName}</strong>{" "}
                      <a
                        href={`https://twitter.com/${tweet.quotedAuthorHandle}`}
                      >
                        @{tweet.quotedAuthorHandle}
                      </a>
                    </div>
                  ) : null}
                  {tweet.quotedText ? <p>{tweet.quotedText}</p> : null}
                  {tweet.quotedTweetUrl ? (
                    <a href={tweet.quotedTweetUrl}>Quoted tweet</a>
                  ) : null}
                </div>
              ) : null}
              <footer className={styles.tweetFooter}>
                {tweet.status}
                {tweet.sourceAccount ? ` · via ${tweet.sourceAccount}` : ""}
                {" · "}tweet id {tweet.tweetId}
              </footer>
              {tweet.alternativeSources.length > 0 ? (
                <details className={styles.alternativeSources}>
                  <summary>
                    {tweet.alternativeSources.length} later source
                    {tweet.alternativeSources.length === 1 ? "" : "s"} in this
                    signal bucket
                  </summary>
                  <ul>
                    {tweet.alternativeSources.map((source, index) => (
                      <li
                        key={`${source.sourceKey}-${source.tweetUrl}-${index}`}
                      >
                        <a href={source.tweetUrl}>
                          {source.sourceAccount ?? source.sourceKey}
                        </a>
                        {source.observedAt
                          ? ` · observed ${new Date(source.observedAt).toLocaleString()}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </section>
      </main>
    </>
  );
};

export default TwitterEmbedsPage;

export const getServerSideProps: GetServerSideProps<PageProps> = async ({
  res,
}) => {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=60",
  );

  const [cccResult, gdlResult] = await Promise.all([
    serverClient
      .from("lines_ccc" as any)
      .select(
        "capture_key, snapshot_date, team_id, team_abbreviation, game_id, classification, tweet_posted_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, author_name, source_handle, quoted_author_name, quoted_author_handle, tweet_posted_label, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, nhl_filter_status, observed_at, status",
      )
      .eq("status", "observed")
      .eq("nhl_filter_status", "accepted")
      .order("observed_at", { ascending: false })
      .limit(48),
    serverClient
      .from("line_source_snapshots" as any)
      .select(
        "capture_key, snapshot_date, team_id, team_abbreviation, game_id, classification, tweet_posted_at, source_key, source_account, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, author_name, source_handle, quoted_author_name, quoted_author_handle, tweet_posted_label, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, nhl_filter_status, observed_at, status",
      )
      .eq("source_group", "gdl_suite")
      .eq("status", "observed")
      .eq("nhl_filter_status", "accepted")
      .order("observed_at", { ascending: false })
      .limit(72),
  ]);

  const loadError = [cccResult.error?.message, gdlResult.error?.message]
    .filter(Boolean)
    .join(" | ");
  const cards = [
    ...((cccResult.data ?? []) as unknown as LinesCccPageRow[]).map(
      mapLinesCccRowToCard,
    ),
    ...((gdlResult.data ?? []) as unknown as LineSourceSnapshotPageRow[]).map(
      mapLineSourceSnapshotRowToCard,
    ),
  ];

  return {
    props: {
      localTweetCards: selectFirstArrivalTweetCards(cards).slice(0, 18),
      loadError: loadError || null,
    },
  };
};

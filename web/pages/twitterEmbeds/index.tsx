import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
  NextPage,
} from "next";
import Head from "next/head";

import serverClient from "lib/supabase/server";

import styles from "./index.module.scss";

type TwitterEmbedSource = {
  handle: string;
  label: string;
  url: string;
};

type LocalTweetCard = {
  key: string;
  tweetId: string;
  authorName: string;
  authorHandle: string;
  sourceLabel: string;
  tweetUrl: string;
  wrapperText: string;
  quotedAuthorName: string | null;
  quotedAuthorHandle: string | null;
  quotedTweetUrl: string | null;
  quotedText: string;
  status: string;
  observedAt: string | null;
  rowStatus: string;
};

const twitterEmbedSources = [
  {
    handle: "CcCMiddleton",
    label: "Posts by CcCMiddleton",
    url: "https://twitter.com/CcCMiddleton?ref_src=twsrc%5Etfw",
  },
] satisfies TwitterEmbedSource[];

type LinesCccPageRow = {
  capture_key: string;
  tweet_id: string | null;
  tweet_url: string | null;
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

function mapLinesCccRowToCard(row: LinesCccPageRow): LocalTweetCard {
  return {
    key: row.capture_key,
    tweetId: row.tweet_id ?? row.quoted_tweet_id ?? "unknown-tweet",
    authorName: row.author_name ?? row.source_handle ?? "Unknown author",
    authorHandle: row.source_handle ?? "unknown",
    sourceLabel: row.tweet_posted_label ?? "Unknown date",
    tweetUrl: row.tweet_url ?? row.quoted_tweet_url ?? "#",
    wrapperText: row.enriched_text ?? row.raw_text ?? "(no wrapper text)",
    quotedAuthorName: row.quoted_author_name ?? null,
    quotedAuthorHandle: row.quoted_author_handle ?? null,
    quotedTweetUrl: row.quoted_tweet_url ?? null,
    quotedText: row.quoted_enriched_text ?? row.quoted_raw_text ?? "",
    status: row.nhl_filter_status,
    observedAt: row.observed_at ?? null,
    rowStatus: row.status,
  };
}

function getCardDedupeKey(card: LocalTweetCard): string {
  return card.tweetId !== "unknown-tweet" ? card.tweetId : card.key;
}

function getCardPriority(card: LocalTweetCard): number {
  return [
    card.rowStatus === "observed" ? 8 : 0,
    card.status === "accepted" ? 4 : 0,
    card.quotedTweetUrl && card.quotedText ? 2 : 0,
    card.wrapperText ? 1 : 0,
  ].reduce((total, value) => total + value, 0);
}

function dedupeTweetCards(cards: LocalTweetCard[]): LocalTweetCard[] {
  const bestByTweet = new Map<string, LocalTweetCard>();
  for (const card of cards) {
    const key = getCardDedupeKey(card);
    const existing = bestByTweet.get(key);
    if (!existing || getCardPriority(card) > getCardPriority(existing)) {
      bestByTweet.set(key, card);
    }
  }
  return Array.from(bestByTweet.values()).sort((left, right) => {
    const priorityDifference = getCardPriority(right) - getCardPriority(left);
    if (priorityDifference !== 0) return priorityDifference;
    return (
      Date.parse(right.observedAt ?? "") - Date.parse(left.observedAt ?? "")
    );
  });
}

const TwitterEmbedsPage: NextPage<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ localTweetCards, loadError }) => {
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
              Failed to load `lines_ccc`: {loadError}
            </p>
          ) : null}
          {!loadError && localTweetCards.length === 0 ? (
            <p className={styles.stateNote}>No `lines_ccc` rows found yet.</p>
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
                {tweet.status} · tweet id {tweet.tweetId}
              </footer>
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

  const { data, error } = await serverClient
    .from("lines_ccc" as any)
    .select(
      "capture_key, tweet_id, tweet_url, quoted_tweet_id, quoted_tweet_url, author_name, source_handle, quoted_author_name, quoted_author_handle, tweet_posted_label, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, nhl_filter_status, observed_at, status",
    )
    .order("observed_at", { ascending: false })
    .limit(24);

  return {
    props: {
      localTweetCards: dedupeTweetCards(
        ((data ?? []) as unknown as LinesCccPageRow[]).map(
          mapLinesCccRowToCard,
        ),
      ).slice(0, 12),
      loadError: error?.message ?? null,
    },
  };
};

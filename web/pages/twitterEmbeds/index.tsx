import type { NextPage } from "next";
import Head from "next/head";
import Script from "next/script";
import { useEffect, useRef } from "react";

import styles from "./index.module.scss";

type TwitterEmbedSource = {
  handle: string;
  label: string;
  type: "timeline" | "tweet";
  url: string;
};

type LocalTweetCard = {
  id: string;
  authorName: string;
  authorHandle: string;
  sourceLabel: string;
  tweetUrl: string;
  wrapperText: string;
  quotedAuthorName?: string;
  quotedAuthorHandle?: string;
  quotedTweetUrl?: string;
  quotedText: string;
  status: "accepted" | "rejected_non_nhl";
};

const twitterEmbedSources = [
  {
    handle: "CcCMiddleton",
    label: "Posts by CcCMiddleton",
    type: "timeline",
    url: "https://twitter.com/CcCMiddleton?ref_src=twsrc%5Etfw",
  }
] satisfies TwitterEmbedSource[];

const localTweetCards = [
  {
    id: "2047489659752886286",
    authorName: "LinesLinesLines",
    authorHandle: "CcCMiddleton",
    sourceLabel: "April 24, 2026",
    tweetUrl: "https://twitter.com/CcCMiddleton/status/2047489659752886286",
    wrapperText: "Kings lines",
    quotedAuthorName: "Zach Dooley",
    quotedAuthorHandle: "DooleyLAK",
    quotedTweetUrl: "https://twitter.com/DooleyLAK/status/2047489041999020180",
    quotedText:
      "Tonight's @LAKings Line Rushes -\n\nPanarin - Kopitar - Kempe\nMoore - Byfield - Laferriere\nArmia - Laughton - Kuzmenko\nMalott - Helenius - Wright\n\nAnderson - Doughty\nEdmundson - Clarke\nDumoulin - Ceci\n\nForsberg\nKuemper",
    status: "accepted"
  },
  {
    id: "2028990278749831669",
    authorName: "LinesLinesLines",
    authorHandle: "CcCMiddleton",
    sourceLabel: "March 4, 2026",
    tweetUrl: "https://twitter.com/CcCMiddleton/status/2028990278749831669",
    wrapperText: "Predators lines",
    quotedText:
      "Predators lines\n(Bit of a guess!)\n\nStamkos-O'Reilly-Marchessault\nForsberg-Haula-Evangelista\nBunting-Jost-Smith\nL'Heureux-Weisblatt-Wood\n\nSkjei-Josi\nHague-Perbix\nBlankenburg-Barron\n\nAnnunen",
    status: "accepted"
  },
  {
    id: "2047446876992205035",
    authorName: "LinesLinesLines",
    authorHandle: "CcCMiddleton",
    sourceLabel: "April 23, 2026",
    tweetUrl: "https://twitter.com/CcCMiddleton/status/2047446876992205035",
    wrapperText: "ECHL Americans lines",
    quotedText:
      "ECHL Americans lines\n\n92 McAuley - 7 Hargrove - 27 Duarte\n29 Watts - 91 Gildon - 9 Katic\n77 Sillinger - 55 Hookey - 18 Blaisdell\n26 Asuchak - 44 Dubois - 11 Barbashev\n\n8 Prefontaine - 23 Sedley\n86 Anania - 40 Toure\n22 Costantini - 2 Warmuth\n\n32 Mirwald",
    status: "rejected_non_nhl"
  }
] satisfies LocalTweetCard[];

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement | null) => void;
      };
    };
  }
}

const TwitterEmbedsPage: NextPage = () => {
  const embedsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    window.twttr?.widgets?.load(embedsRef.current);

    const root = embedsRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const blockquote = entry.target as HTMLElement;
          blockquote.classList.add("twitter-tweet");
          window.twttr?.widgets?.load(blockquote);
          observer.unobserve(blockquote);
        }
      },
      {
        rootMargin: "300px"
      }
    );

    root.querySelectorAll<HTMLElement>("blockquote.tweet").forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Head>
        <title>Twitter Embeds | FHFH</title>
      </Head>
      <main className={styles.page} ref={embedsRef}>
        <h1>Twitter Embeds</h1>
        <section className={styles.timelineSource} aria-label="X timeline source">
          {twitterEmbedSources.map((source) =>
            source.type === "timeline" ? (
              <a
                className="twitter-timeline"
                href={source.url}
                key={source.url}
              >
                Tweets by {source.handle}
              </a>
            ) : (
              <blockquote className="twitter-tweet" key={source.url}>
                <a href={source.url}>{source.label}</a>
              </blockquote>
            )
          )}
        </section>

        <section className={styles.localCards} aria-label="Local tweet examples">
          {localTweetCards.map((tweet) => (
            <blockquote
              className={`tweet full-sized-tweet ${styles.tweetCard}`}
              data-tweet-id={tweet.quotedTweetUrl ? tweet.quotedTweetUrl.match(/status\/(\d+)/)?.[1] : tweet.id}
              key={tweet.id}
            >
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
              <div className={styles.quoteCard}>
                {tweet.quotedAuthorName && tweet.quotedAuthorHandle ? (
                  <div className={styles.quoteHeader}>
                    <strong>{tweet.quotedAuthorName}</strong>{" "}
                    <a href={`https://twitter.com/${tweet.quotedAuthorHandle}`}>
                      @{tweet.quotedAuthorHandle}
                    </a>
                  </div>
                ) : null}
                <p>{tweet.quotedText}</p>
                {tweet.quotedTweetUrl ? (
                  <a href={tweet.quotedTweetUrl}>Quoted tweet</a>
                ) : null}
              </div>
              <footer className={styles.tweetFooter}>
                {tweet.status} · tweet id {tweet.id}
              </footer>
            </blockquote>
          ))}
        </section>
      </main>
      <Script
        src="https://platform.twitter.com/widgets.js"
        charSet="utf-8"
        onLoad={() => window.twttr?.widgets?.load(embedsRef.current)}
        strategy="afterInteractive"
      />
    </>
  );
};

export default TwitterEmbedsPage;

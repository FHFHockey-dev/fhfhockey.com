import type { LineGame, SourceFeedItem } from "lib/lines/types";
import { AUTHORITY_COPY, CONTEXT_COPY, ORIGINAL_SOURCE_PENDING, bindingCopy, formatTime, originalPostUrl, sourceAuthor } from "./reviewReasonCopy";
import styles from "./ProjectedLineups.module.scss";

function sortTime(item: SourceFeedItem): number { return Date.parse(item.publishedAt ?? item.ingestedAt) || 0; }

/** Raw captures as received: plain text first, one row per original. Relays fold into it unnamed (TJ, 2026-11-06). */
export default function SourceFeed({ items, games, teamAbbreviation }: { items: SourceFeedItem[]; games: LineGame[]; teamAbbreviation: string }) {
  if (!items.length) return <p className={styles.muted}>No source posts yet.</p>;
  const sorted = [...items].sort((a, b) => sortTime(b) - sortTime(a) || a.id.localeCompare(b.id));
  return <>
    <p className={styles.muted}>Posts exactly as received. Reposts fold into the original post and never count as a second source.</p>
    <ol className={styles.feed} aria-label={`${teamAbbreviation} source posts`}>
      {sorted.map((item) => {
        const author = sourceAuthor(item.originalAuthor);
        const href = originalPostUrl(author, item.originalIdentity, item.sourceUrl);
        return <li key={item.id} className={styles.feedItem}>
        <p className={styles.itemTitle}>
          {author ? <span>@{author}</span> : <span>{ORIGINAL_SOURCE_PENDING}</span>}
          {author && <span className={styles.tier}>{AUTHORITY_COPY[item.authorityTier]}</span>}
        </p>
        <p className={styles.rawText}>{item.text}</p>
        <p className={styles.muted}>
          {item.publishedAt ? <>Posted <time dateTime={item.publishedAt}>{formatTime(item.publishedAt)}</time></> : "Post time unknown"}
          {" · "}Received <time dateTime={item.ingestedAt}>{formatTime(item.ingestedAt)}</time>
        </p>
        <p className={styles.muted}>{bindingCopy(item.binding, games)}{item.context ? ` · ${CONTEXT_COPY[item.context]}` : ""}</p>
        {href && <a className={styles.source} href={href} target="_blank" rel="noreferrer">Open original post<span className={styles.srOnly}> by @{author} (opens in a new tab)</span></a>}
      </li>;
      })}
    </ol>
  </>;
}

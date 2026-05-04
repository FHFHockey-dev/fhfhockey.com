import type { CSSProperties } from "react";
import Image from "next/legacy/image";

import styles from "./NewsCard.module.scss";

import {
  formatNewsFeedLabel,
  getNewsItemTeamColors,
  type NewsFeedItem,
} from "lib/newsFeed";

type NewsCardProps = {
  item: Pick<
    NewsFeedItem,
    | "headline"
    | "blurb"
    | "category"
    | "subcategory"
    | "team_abbreviation"
    | "source_label"
    | "source_account"
    | "source_url"
    | "published_at"
    | "created_at"
    | "card_status"
    | "players"
  >;
  compact?: boolean;
  sourceDisplayNameOverride?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Draft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSourceAttribution(
  sourceLabel: string | null | undefined,
  sourceAccount: string | null | undefined,
  sourceDisplayNameOverride?: string | null,
): string | null {
  const account = sourceAccount?.trim() || null;
  const label = sourceDisplayNameOverride?.trim() || sourceLabel?.trim() || null;
  if (!label && !account) return null;
  if (!label) return account;
  if (!account) return label;
  if (label.toLowerCase() === account.toLowerCase()) return label;
  return `${label} · ${account}`;
}

export default function NewsCard({
  item,
  compact = false,
  sourceDisplayNameOverride = null,
}: NewsCardProps) {
  const team = getNewsItemTeamColors(item.team_abbreviation);
  const publishedAt = item.published_at ?? item.created_at ?? null;
  const sourceAttribution = formatSourceAttribution(
    item.source_label,
    item.source_account,
    sourceDisplayNameOverride,
  );
  const categoryLabel = formatNewsFeedLabel(item.category);
  const subcategoryLabel = item.subcategory
    ? formatNewsFeedLabel(item.subcategory)
    : null;

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ""}`.trim()}
      style={
        {
          "--news-accent": team.primary,
          "--news-team-surface": team.secondary,
        } as CSSProperties
      }
    >
      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.metaStrong}>
            {item.team_abbreviation ?? "NHL"}
          </span>
          <span>{categoryLabel}</span>
          {subcategoryLabel ? <span>{subcategoryLabel}</span> : null}
          {item.card_status !== "published" ? (
            <span className={styles.draftState}>{item.card_status}</span>
          ) : null}
        </div>

        <h2 className={styles.headline}>{item.headline}</h2>

        {item.players.length > 0 ? (
          <div className={styles.playerRow}>
            {item.players.map((player) => (
              <span key={`${item.headline}-${player.player_name}`} className={styles.playerChip}>
                {player.player_name}
              </span>
            ))}
          </div>
        ) : null}

        <p className={styles.blurb}>{item.blurb}</p>

        <div className={styles.footer}>
          <span>{formatDate(publishedAt)}</span>
          {sourceAttribution ? <span>{sourceAttribution}</span> : null}
          {item.source_url ? (
            <a className={styles.sourceLink} href={item.source_url}>
              Source
            </a>
          ) : null}
        </div>
      </div>

      <aside className={styles.teamPane}>
        <div className={styles.teamLogo}>
          <Image
            src={team.logoUrl}
            alt={item.team_abbreviation ? `${item.team_abbreviation} logo` : "NHL logo"}
            width={64}
            height={64}
            objectFit="contain"
          />
        </div>
        <div className={styles.teamLabel}>{team.shortName}</div>
      </aside>
    </article>
  );
}

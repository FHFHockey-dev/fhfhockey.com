import type { CSSProperties } from "react";
import Image from "next/legacy/image";

import ExternalNewsLink from "components/common/ExternalNewsLink";
import styles from "./NewsCard.module.scss";

import {
  formatNewsFeedLabel,
  getPublicNewsItemDetails,
  getPublicNewsSourceAttribution,
  getNewsItemTeamColors,
  normalizeNewsCategory,
  sanitizePublicNewsText,
  type NewsFeedItem,
} from "lib/newsFeed";
import {
  isLineupNewsCategory,
  readLineupCardFromMetadata,
  type NewsLineupCardData,
} from "lib/newsLineupCard";

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
    | "metadata"
    | "players"
  > & { tweet_url?: string | null };
  compact?: boolean;
  rail?: boolean;
  sourceDisplayNameOverride?: string | null;
  onLineupGoalieSlotClick?: (slotIndex: number) => void;
};

const NEWS_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "Draft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return NEWS_TIMESTAMP_FORMATTER.format(date);
}

function LineupSlot({
  name,
  label,
  variant,
  isStarter = false,
  onClick,
}: {
  name: string | null;
  label: string;
  variant: "forward" | "defense" | "goalie";
  isStarter?: boolean;
  onClick?: () => void;
}) {
  const className = [
    styles.lineupSlot,
    styles[`lineupSlot${variant[0].toUpperCase()}${variant.slice(1)}`],
    isStarter ? styles.lineupSlotStarter : "",
    onClick ? styles.lineupSlotEditable : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <span className={styles.lineupSlotLabel}>
        {isStarter ? "START" : label}
      </span>
      <span className={styles.lineupSlotName}>{name || "TBD"}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`Set ${label} goalie`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function LineupGrid({
  lineup,
  onGoalieSlotClick,
}: {
  lineup: NewsLineupCardData;
  onGoalieSlotClick?: (slotIndex: number) => void;
}) {
  return (
    <div className={styles.lineupGrid} aria-label="Projected lineup">
      {Array.from({ length: 4 }).flatMap((_, rowIndex) => {
        const forwardLine = lineup.forwards[rowIndex] ?? [];
        const rightSide =
          rowIndex < 3
            ? (lineup.defensePairs[rowIndex] ?? []).map((name, index) => (
                <LineupSlot
                  key={`d-${rowIndex}-${index}`}
                  name={name}
                  label={`D${rowIndex + 1}`}
                  variant="defense"
                />
              ))
            : lineup.goalies
                .slice(0, 2)
                .map((name, index) => (
                  <LineupSlot
                    key={`g-${index}`}
                    name={name}
                    label={index === 0 ? "G1" : "G2"}
                    variant="goalie"
                    onClick={
                      onGoalieSlotClick
                        ? () => onGoalieSlotClick(index)
                        : undefined
                    }
                    isStarter={Boolean(
                      lineup.startingGoalie &&
                      name.toLowerCase() ===
                        lineup.startingGoalie.toLowerCase(),
                    )}
                  />
                ));

        return [
          ...Array.from({ length: 3 }).map((__, index) => (
            <LineupSlot
              key={`f-${rowIndex}-${index}`}
              name={forwardLine[index] ?? null}
              label={`F${rowIndex + 1}`}
              variant="forward"
            />
          )),
          ...Array.from({ length: 2 }).map(
            (__, index) =>
              rightSide[index] ?? (
                <LineupSlot
                  key={`empty-${rowIndex}-${index}`}
                  name={null}
                  label={rowIndex < 3 ? `D${rowIndex + 1}` : `G${index + 1}`}
                  variant={rowIndex < 3 ? "defense" : "goalie"}
                  onClick={
                    rowIndex === 3 && onGoalieSlotClick
                      ? () => onGoalieSlotClick(index)
                      : undefined
                  }
                />
              ),
          ),
        ];
      })}
    </div>
  );
}

function formatSourceAttribution(
  sourceLabel: string | null | undefined,
  sourceAccount: string | null | undefined,
  sourceDisplayNameOverride?: string | null,
): string | null {
  const account = sourceAccount?.trim() || null;
  const label =
    sourceDisplayNameOverride?.trim() || sourceLabel?.trim() || null;
  if (!label && !account) return null;
  if (!label) return account;
  if (!account) return label;
  if (label.toLowerCase() === account.toLowerCase()) return label;
  return `${label} · ${account}`;
}

export default function NewsCard({
  item,
  compact = false,
  rail = false,
  sourceDisplayNameOverride = null,
  onLineupGoalieSlotClick,
}: NewsCardProps) {
  const team = getNewsItemTeamColors(item.team_abbreviation);
  const publishedAt = item.published_at ?? item.created_at ?? null;
  const publicSource = getPublicNewsSourceAttribution({
    item: { ...item, tweet_url: item.tweet_url ?? null },
  });
  const sourceAttribution = formatSourceAttribution(
    publicSource.displayName,
    publicSource.account,
    sanitizePublicNewsText(sourceDisplayNameOverride),
  );
  const categoryLabel = formatNewsFeedLabel(item.category);
  const subcategoryLabel = item.subcategory
    ? formatNewsFeedLabel(item.subcategory)
    : null;
  const lineup = isLineupNewsCategory(item.category, item.subcategory)
    ? readLineupCardFromMetadata(item.metadata)
    : null;
  const details = getPublicNewsItemDetails(item);

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ""} ${rail ? styles.rail : ""} ${
        lineup ? styles.lineupCard : ""
      }`.trim()}
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

        <h2 className={styles.headline}>
          {sanitizePublicNewsText(item.headline)}
        </h2>

        {lineup ? (
          <LineupGrid
            lineup={lineup}
            onGoalieSlotClick={onLineupGoalieSlotClick}
          />
        ) : null}

        {!lineup && item.players.length > 0 ? (
          <div className={styles.playerRow}>
            {item.players.map((player) => (
              <span
                key={`${item.headline}-${player.player_name}`}
                className={styles.playerChip}
              >
                {player.player_name}
              </span>
            ))}
          </div>
        ) : null}

        {!lineup ? <p className={styles.blurb}>{details}</p> : null}

        <div className={styles.footer}>
          <span>{formatDate(publishedAt)}</span>
          {sourceAttribution ? <span>{sourceAttribution}</span> : null}
          {publicSource.url ? (
            <ExternalNewsLink
              className={styles.sourceLink}
              href={publicSource.url}
              label={`View original post for ${sanitizePublicNewsText(item.headline)}`}
            />
          ) : null}
        </div>
      </div>

      <aside className={styles.teamPane}>
        <div className={styles.teamLogo}>
          <Image
            src={team.logoUrl}
            alt={
              item.team_abbreviation
                ? `${item.team_abbreviation} logo`
                : "NHL logo"
            }
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

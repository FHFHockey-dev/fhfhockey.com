import { useId, type CSSProperties } from "react";
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
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
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

const RAIL_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "Draft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return NEWS_TIMESTAMP_FORMATTER.format(date);
}

function formatRailDate(value: string | null | undefined): string {
  if (!value) return "Draft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return RAIL_TIMESTAMP_FORMATTER.format(date);
}

function normalizeComparableNewsText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRailText(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizePublicNewsText(value)
    .replace(/^RT\s+@[A-Z0-9_]+:\s*/i, "")
    .replace(/(?:https?:\/\/|pic\.twitter\.com\/)\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readAutomationSummary(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const automation = metadata?.automation;
  if (!automation || typeof automation !== "object") return "";
  return sanitizeRailText(
    (automation as Record<string, unknown>).summary,
  );
}

function isGenericRailHeadline(args: {
  value: string;
  team: string;
  category: string;
  subcategory: string;
}): boolean {
  const normalized = normalizeComparableNewsText(args.value);
  const team = normalizeComparableNewsText(args.team);
  const category = normalizeComparableNewsText(args.category);
  const subcategory = normalizeComparableNewsText(args.subcategory);
  const knownLabels = new Set(
    [
      team,
      category,
      subcategory,
      `${team} ${category}`,
      `${team} ${subcategory}`,
      `${category} ${team}`,
      `${subcategory} ${team}`,
      "news update",
      "official signing",
    ].filter(Boolean),
  );

  if (!normalized || knownLabels.has(normalized)) return true;

  return [category, subcategory].some((label) => {
    if (!label || !normalized.endsWith(` ${label}`)) return false;
    const subject = normalized.slice(0, -(label.length + 1)).trim();
    return subject.split(" ").filter(Boolean).length <= 4;
  });
}

function newsTextAddsDetail(headline: string, candidate: string): boolean {
  const normalizedHeadline = normalizeComparableNewsText(headline);
  const normalizedCandidate = normalizeComparableNewsText(candidate);
  if (!normalizedCandidate || normalizedCandidate === normalizedHeadline) {
    return false;
  }
  if (
    normalizedCandidate.length <= normalizedHeadline.length &&
    normalizedHeadline.includes(normalizedCandidate)
  ) {
    return false;
  }

  const headlineTokens = new Set(normalizedHeadline.split(" ").filter(Boolean));
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  const sharedTokens = candidateTokens.filter((token) =>
    headlineTokens.has(token),
  ).length;
  const overlap =
    candidateTokens.length > 0 ? sharedTokens / candidateTokens.length : 1;

  return !(
    normalizedCandidate.length <= normalizedHeadline.length * 1.15 &&
    overlap >= 0.8
  );
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
  expanded = false,
  onExpandedChange,
  sourceDisplayNameOverride = null,
  onLineupGoalieSlotClick,
}: NewsCardProps) {
  const generatedDetailsId = useId().replace(/:/g, "");
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
  const originalHeadline = sanitizePublicNewsText(item.headline);
  const teamLabel = item.team_abbreviation ?? "NHL";
  const railHeadline = details || originalHeadline || "News update";
  const railDetail =
    [
      readAutomationSummary(item.metadata),
      sanitizeRailText(item.blurb),
      originalHeadline,
    ].find(
      (candidate) =>
        candidate &&
        !isGenericRailHeadline({
          value: candidate,
          team: teamLabel,
          category: item.category,
          subcategory: item.subcategory ?? "",
        }) &&
        newsTextAddsDetail(railHeadline, candidate),
    ) ?? null;
  const detailsId = `news-details-${generatedDetailsId}`;
  const hasDisclosure = Boolean(rail && onExpandedChange);

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ""} ${rail ? styles.rail : ""} ${
        lineup ? styles.lineupCard : ""
      } ${expanded ? styles.expanded : ""} ${
        rail && !hasDisclosure ? styles.railNoDisclosure : ""
      }`.trim()}
      style={
        {
          "--news-accent": team.primary,
          "--news-team-primary": team.primary,
          "--news-team-secondary": team.secondary,
          "--news-team-stripe": team.stripe,
          "--news-team-surface": team.surface,
        } as CSSProperties
      }
    >
      <div
        id={hasDisclosure ? detailsId : undefined}
        className={styles.content}
      >
        <div className={styles.meta}>
          <span className={styles.metaStrong}>
            {teamLabel}
          </span>
          <span className={styles.mobileMetaDivider} aria-hidden="true">
            ·
          </span>
          <span className={styles.categoryLabel}>{categoryLabel}</span>
          {subcategoryLabel ? (
            <span className={styles.subcategoryLabel}>{subcategoryLabel}</span>
          ) : null}
          {item.card_status !== "published" ? (
            <span className={styles.draftState}>{item.card_status}</span>
          ) : null}
        </div>

        <h2
          className={styles.headline}
          aria-label={rail ? railHeadline : undefined}
        >
          {rail ? (
            <>
              <span className={styles.railDesktopHeadline} aria-hidden="true">
                {originalHeadline}
              </span>
              <span className={styles.railMobileHeadline} aria-hidden="true">
                {railHeadline}
              </span>
            </>
          ) : (
            originalHeadline
          )}
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

        {hasDisclosure ? (
          railDetail ? (
            <div className={styles.railDetails} hidden={!expanded}>
              <p>{railDetail}</p>
            </div>
          ) : null
        ) : null}

        <div className={styles.footer}>
          <span className={styles.desktopTimestamp}>
            {formatDate(publishedAt)}
          </span>
          <span className={styles.mobileTimestamp}>
            {formatRailDate(publishedAt)}
          </span>
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
        {!rail ? <div className={styles.teamLabel}>{team.shortName}</div> : null}
      </aside>

      {hasDisclosure ? (
        <button
          type="button"
          className={styles.railDisclosureButton}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${teamLabel} news: ${railHeadline}`}
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      ) : null}
    </article>
  );
}

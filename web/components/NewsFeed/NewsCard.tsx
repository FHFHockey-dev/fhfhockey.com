import { useEffect, useId, useState, type CSSProperties } from "react";
import Image from "next/legacy/image";

import ExternalNewsLink from "components/common/ExternalNewsLink";
import NewsLineupGrid from "./NewsLineupGrid";
import { readNewsLineupPresentation } from "lib/newsLineupPresentation";
import styles from "./NewsCard.module.scss";

import {
  formatNewsClaimLabel,
  formatNewsFeedLabel,
  getPublicNewsItemDetails,
  getPublicNewsClaimPresentation,
  getPublicNewsSourceAttribution,
  getNewsItemTeamColors,
  normalizeNewsCategory,
  sanitizePublicNewsText,
  type NewsFeedItem,
} from "lib/newsFeed";
import { isLineupNewsCategory } from "lib/newsLineupCard";

// The reader's unresolved reason is an internal contract label and cannot say which check failed.
const UNVERIFIED_DETAILS_COPY = "Player details not verified";

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
  > & { tweet_url?: string | null; observed_at?: string | null; team_id?: number | null };
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

const SHOW_PIPELINE_TIMES = process.env.NODE_ENV !== "production";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return NEWS_TIMESTAMP_FORMATTER.format(date);
}

const NEWS_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Fan-facing post time: "18m ago" / "3h ago" for posts from today (New York
 * date), the rail date otherwise (TJ, 2026-11-15). `now` is null until the
 * card mounts, so server and first client render agree on the absolute time.
 */
export function formatNewsFanTime(value: string | null | undefined, now: number | null): string {
  const absolute = formatRailDate(value);
  if (!value || now == null) return absolute;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return absolute;
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 0) return absolute;
  if (NEWS_DAY_FORMATTER.format(time) !== NEWS_DAY_FORMATTER.format(now)) return absolute;
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatRailDate(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
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
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const team = getNewsItemTeamColors(item.team_abbreviation);
  const publishedAt = item.published_at;
  const publicSource = getPublicNewsSourceAttribution({
    item: { ...item, tweet_url: item.tweet_url ?? null },
  });
  const sourceAttribution = formatSourceAttribution(
    publicSource.displayName,
    publicSource.account,
    sanitizePublicNewsText(sourceDisplayNameOverride),
  );
  const lineup = isLineupNewsCategory(item.category, item.subcategory)
    // Only the internal review editor (which owns the goalie-slot handler) previews its own draft lineup.
    ? readNewsLineupPresentation({ metadata: item.metadata, subcategory: item.subcategory, teamId: item.team_id ?? null,
        reviewDraft: Boolean(onLineupGoalieSlotClick) })
    : null;
  const presentation = getPublicNewsClaimPresentation(item);
  // Only lineup cards carry a category chip; source reports used to repeat
  // "report" up to three times per card (TJ, 2026-11-15).
  // Lineup cards: one title ("FLA practice lines") instead of a
  // "LINE COMBINATION · PRACTICE LINES" chip pair, a "line combination
  // update" headline and a "Practice snapshot" line (TJ, 2026-11-15).
  const categoryLabel = null;
  const subcategoryLabel = null;
  const details = getPublicNewsItemDetails(lineup ? item : { ...item, metadata: null, headline: "Source passage unavailable" });
  const claimedPlayers = [...new Set(presentation.claims.map((claim) => claim.playerName))];
  const lineupTitle = lineup
    ? `${team.abbreviation ?? item.team_abbreviation ?? "NHL"} ${
        item.subcategory ? normalizeNewsCategory(item.subcategory).toLowerCase() : "lines"
      }`
    : null;
  const originalHeadline = lineupTitle ?? (claimedPlayers.join(", ") || team.name);
  const teamLabel = team.abbreviation ?? item.team_abbreviation ?? "NHL";
  const HeadlineTag = rail ? "h3" : "h2";
  const railHeadline = details || originalHeadline || "News update";
  const railDetail = lineup ?
    [
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
    ) ?? null : null;
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
          "--lineup-team-primary": team.lineupPrimary,
          "--lineup-team-secondary": team.lineupSecondary,
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
          {/* Lineup titles already start with the team ("SJS practice lines"). */}
          {!lineupTitle ? (
            <span className={styles.metaStrong}>
              {teamLabel}
            </span>
          ) : null}
          {categoryLabel ? (
            <span className={styles.mobileMetaDivider} aria-hidden="true">
              ·
            </span>
          ) : null}
          {categoryLabel ? (
            <span className={styles.categoryLabel}>{categoryLabel}</span>
          ) : null}
          {subcategoryLabel ? (
            <span className={styles.subcategoryLabel}>{subcategoryLabel}</span>
          ) : null}
          {item.card_status !== "published" ? (
            <span className={styles.draftState}>{item.card_status}</span>
          ) : null}
        </div>

        {/* Rail cards sit under the homepage's "Latest News" h2. */}
        <HeadlineTag
          className={styles.headline}
          aria-label={rail ? (lineup ? originalHeadline : railHeadline) : undefined}
        >
          {rail ? (
            lineup ? (
              <span aria-hidden="true">{originalHeadline}</span>
            ) : (
              // The post itself is the headline on every width; no second
              // copy in the blurb.
              <span aria-hidden="true">{railHeadline}</span>
            )
          ) : (
            originalHeadline
          )}
        </HeadlineTag>

        {lineup ? (
          // Phones fold the line boxes behind the card's + (TJ, 2026-11-15).
          <div className={styles.lineupBody}>
            <NewsLineupGrid
              lineup={lineup}
              hideContext
              mini={rail}
              onGoalieSlotClick={onLineupGoalieSlotClick}
            />
          </div>
        ) : null}

        {!lineup && presentation.claims.length > 0 ? (
          <div className={styles.playerRow}>
            {presentation.claims.map((claim, index) => (
              <span
                key={`${claim.playerId}-${index}`}
                className={styles.playerChip}
              >
                {/* Only claims that passed the reader's check render here. */}
                <svg className={styles.verifiedTick} viewBox="0 0 24 24" width="10" height="10"
                  fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {claim.playerName} · {formatNewsClaimLabel(claim)}
                <span className={styles.visuallyHidden}> (verified)</span>
              </span>
            ))}
          </div>
        ) : null}

        {(!lineup || !lineup.rows.length) && !(rail && !lineup) ? (
          <p className={styles.blurb}>{details}</p>
        ) : null}
        {!lineup && presentation.unresolvedReason ? (
          <p className={styles.unverifiedNote}>{UNVERIFIED_DETAILS_COPY}</p>
        ) : null}

        {hasDisclosure ? (
          railDetail ? (
            <div className={styles.railDetails} hidden={!expanded}>
              <p>{railDetail}</p>
            </div>
          ) : null
        ) : null}

        <div className={styles.footer}>
          {/* One time for fans: when the post was seen. The pipeline's
              published/observed pair is debug detail (dev only). */}
          <span>{formatNewsFanTime(item.observed_at ?? publishedAt, now)}</span>
          {SHOW_PIPELINE_TIMES ? (
            <span className={styles.devTimestamps}>
              Published {formatDate(publishedAt)} · Observed {formatRailDate(item.observed_at)}
            </span>
          ) : null}
          <span>{sourceAttribution || "Source unavailable"}</span>
          {publicSource.url ? (
            <ExternalNewsLink
              className={styles.sourceLink}
              href={publicSource.url}
              label={`View original post for ${originalHeadline}`}
            />
          ) : null}
        </div>
      </div>

      {/* A named image, not <aside>: a logo pane inside each card isn't a
          landmark, and the full team name reads better than "CGY logo". */}
      <div className={styles.teamPane} role="img" aria-label={team.name}>
        <div className={styles.teamLogo}>
          <Image
            src={team.logoUrl}
            alt=""
            width={64}
            height={64}
            objectFit="contain"
          />
        </div>
        {!rail ? <div className={styles.teamLabel}>{team.shortName}</div> : null}
      </div>

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

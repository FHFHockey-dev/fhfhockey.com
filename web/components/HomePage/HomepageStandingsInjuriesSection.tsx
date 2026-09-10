import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import moment from "moment-timezone";
import Link from "next/link";

import ExternalNewsLink from "components/common/ExternalNewsLink";
import PanelStatus from "components/common/PanelStatus";
import { buildHomepageModulePresentation } from "lib/dashboard/freshness";
import OptimizedImage from "components/common/OptimizedImage";
import { fallbackNHLLogo, getTeamLogoSvg } from "lib/images";
import {
  formatNewsFeedLabel,
  getPublicNewsItemDetails,
  normalizeNewsCategory,
  sanitizePublicNewsText,
  type NewsFeedItem,
} from "lib/newsFeed";
import styles from "styles/Home.module.scss";

type HomepageStandingsInjuriesSectionProps = {
  standings: any[];
  injuries: any[];
  recentTransactions?: any[];
  recentInjuryNews?: NewsFeedItem[];
  snapshotGeneratedAt: string | null;
  standingsError: string | null;
  injuriesError: string | null;
};

const HOMEPAGE_UPDATES_PER_PAGE = 10;
const HOMEPAGE_TIME_ZONE = "America/New_York";

function formatHomepageDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const parsed = moment(value);
  return parsed.isValid()
    ? parsed.tz(HOMEPAGE_TIME_ZONE).format("M/D/YY")
    : "N/A";
}

function formatHomepageTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = moment(value);
  if (!parsed.isValid()) return "";
  const hasTime = /T\d{2}:\d{2}/.test(value);
  return parsed
    .tz(HOMEPAGE_TIME_ZONE)
    .format(hasTime ? "MMM D, h:mm A" : "MMM D, YYYY");
}

function abbreviatePlayerName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
}

function getPlayerNameFromHeadline(value: string): string | null {
  const headline = sanitizePublicNewsText(value);
  const nameToken = String.raw`[\p{Lu}][\p{L}’'.-]+`;
  const patterns = [
    new RegExp(
      String.raw`\b(?:have|has)\s+signed\s+(${nameToken}\s+${nameToken})(?=\s+(?:to|with|for|on|and|$))`,
      "u",
    ),
    new RegExp(
      String.raw`\band\s+(${nameToken}\s+${nameToken})\s+(?:avoid|avoids|has|have|signed|agreed)\b`,
      "u",
    ),
    new RegExp(
      String.raw`(?:^|:\s*)(${nameToken}\s+${nameToken})\s+has\s+signed\b`,
      "u",
    ),
  ];

  for (const pattern of patterns) {
    const match = headline.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function getHomepageTransactionAction(
  transaction: any,
  details: string,
): string {
  const category = normalizeNewsCategory(transaction.category);
  const searchableText = sanitizePublicNewsText(
    [
      transaction.headline,
      transaction.blurb,
      details,
      transaction.subcategory,
    ]
      .filter(Boolean)
      .join(" "),
  ).toLowerCase();

  if (searchableText.includes("arbitration")) return "arbitration";
  if (searchableText.includes("extension")) return "extension";
  if (searchableText.includes("retire")) return "retirement";
  if (searchableText.includes("waiver")) return "waivers";
  if (searchableText.includes("recall")) return "recall";
  if (searchableText.includes("contract negotiation")) {
    return "contract negotiation";
  }

  switch (category) {
    case "TRADE":
      return "trade";
    case "SIGNING":
      return "signing";
    case "RETIREMENT":
      return "retirement";
    case "WAIVER":
    case "WAIVERS":
      return "waivers";
    case "ROSTER MOVE":
      return "roster move";
    case "NEWS UPDATE":
      return "update";
    case "TRANSACTION":
      return "transaction";
    default:
      return formatNewsFeedLabel(category || "transaction").toLowerCase();
  }
}

function isGenericHomepageTransactionTitle(
  value: string,
  teamAbbreviation: string,
  category: string,
): boolean {
  const normalized = sanitizePublicNewsText(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const team = teamAbbreviation.toLowerCase();
  const action = formatNewsFeedLabel(category).toLowerCase();

  return new Set([
    "",
    action,
    `${team} ${action}`,
    `${team} transaction`,
    `${team} signing`,
    "official signing",
    "news update",
    "transaction",
  ]).has(normalized);
}

export function buildHomepageTransactionTitle(transaction: any): string {
  const teamAbbreviation = transaction.team_abbreviation ?? "NHL";
  const category = normalizeNewsCategory(transaction.category);
  const details = getPublicNewsItemDetails(transaction);
  const playerName =
    (Array.isArray(transaction.players)
      ? transaction.players.find((player: any) => player?.player_name)
          ?.player_name
      : null) ?? getPlayerNameFromHeadline(transaction.headline);

  if (playerName) {
    return `${abbreviatePlayerName(playerName)} ${getHomepageTransactionAction(
      transaction,
      details,
    )}`;
  }

  const headline = sanitizePublicNewsText(transaction.headline);
  if (
    headline &&
    !isGenericHomepageTransactionTitle(
      headline,
      teamAbbreviation,
      category,
    )
  ) {
    return headline;
  }

  if (
    details &&
    !isGenericHomepageTransactionTitle(
      details,
      teamAbbreviation,
      category,
    )
  ) {
    return details;
  }

  return headline || `${teamAbbreviation} ${formatNewsFeedLabel(category)}`;
}

function newsItemToHomepageInjury(item: NewsFeedItem) {
  const playerNames = item.players
    .map((player) => player.player_name)
    .filter(Boolean);
  const onlyPlayer = item.players.length === 1 ? item.players[0] : null;
  const category = normalizeNewsCategory(item.category);

  return {
    key: `news-${item.id}`,
    date: item.published_at ?? item.created_at,
    team: item.team_abbreviation ?? "NHL",
    player: {
      id: onlyPlayer?.player_id ?? null,
      displayName: playerNames.join(", ") || item.headline,
    },
    status: formatNewsFeedLabel(item.subcategory ?? item.category),
    description: getPublicNewsItemDetails(item),
    sourceUrl: item.source_url,
    sourceAttribution: item.source_account ?? item.source_label,
    statusState:
      category === "RETURN" || category === "RETURNING"
        ? "returning"
        : "injured",
  };
}

export function buildHomepageInjuryUpdates(args: {
  injuries: any[];
  recentInjuryNews: NewsFeedItem[];
}) {
  const newsRows = args.recentInjuryNews.map(newsItemToHomepageInjury);
  const canonicalRows = (Array.isArray(args.injuries) ? args.injuries : []).map(
    (injury, index) => ({
      ...injury,
      key:
        injury.key ??
        `status-${injury.player?.id ?? injury.player?.displayName ?? "unknown"}-${injury.date ?? "unknown"}-${index}`,
    }),
  );

  return [...newsRows, ...canonicalRows];
}

function formatPointPercentage(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3).replace(/^0/, "") : "—";
}

export default function HomepageStandingsInjuriesSection({
  standings,
  injuries,
  recentTransactions = [],
  recentInjuryNews = [],
  snapshotGeneratedAt,
  standingsError,
  injuriesError,
}: HomepageStandingsInjuriesSectionProps) {
  const [updatesPage, setUpdatesPage] = useState(0);
  const [pageSize, setPageSize] = useState(HOMEPAGE_UPDATES_PER_PAGE);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const standingsRef = useRef<HTMLDivElement>(null);
  const updatesRef = useRef<HTMLDivElement>(null);
  const [activeUpdatesTab, setActiveUpdatesTab] = useState<
    "all" | "transactions" | "injuries"
  >("all");
  const [expandedUpdateKey, setExpandedUpdateKey] = useState<string | null>(
    null,
  );

  const selectUpdatesTab = (tab: "all" | "transactions" | "injuries") => {
    setActiveUpdatesTab(tab);
    setUpdatesPage(0);
    setExpandedUpdateKey(null);
  };

  const toggleUpdate = (key: string) => {
    setExpandedUpdateKey((current) => (current === key ? null : key));
  };

  const sortedStandings = useMemo(() => {
    if (!Array.isArray(standings)) return [];

    return [...standings].sort((a, b) => {
      const left = Number.parseInt(a?.leagueSequence, 10) || 0;
      const right = Number.parseInt(b?.leagueSequence, 10) || 0;
      return left - right;
    });
  }, [standings]);

  const injuryUpdates = useMemo(
    () => buildHomepageInjuryUpdates({ injuries, recentInjuryNews }),
    [injuries, recentInjuryNews],
  );

  const updates = useMemo(() => {
    const rows = [
      ...(activeUpdatesTab === "transactions" ? [] : injuryUpdates.map((injury) => ({
        ...injury,
        kind: "injury",
        statusState: injury.statusState ??
          (/return|healthy/i.test(injury.status ?? "") ? "returning" : "injured"),
      }))),
      ...(activeUpdatesTab === "injuries" ? [] : recentTransactions.map((transaction) => ({
        key: `transaction-${transaction.id}`,
        kind: "transaction",
        date: transaction.published_at ?? transaction.created_at,
        team: transaction.team_abbreviation,
        player: { displayName: buildHomepageTransactionTitle(transaction) },
        status: normalizeNewsCategory(transaction.category),
        statusState: "transaction",
        description: getPublicNewsItemDetails(transaction),
        sourceUrl: transaction.source_url,
        sourceAttribution: transaction.source_account ?? transaction.source_label,
      }))),
    ];
    return rows.sort((a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
    );
  }, [activeUpdatesTab, injuryUpdates, recentTransactions]);
  const pageCount = Math.max(1, Math.ceil(updates.length / pageSize));
  const currentPage = Math.min(updatesPage, pageCount - 1);
  const currentPageUpdates = updates.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  useEffect(() => {
    const standingsPanel = standingsRef.current;
    const updatesPanel = updatesRef.current;
    if (!standingsPanel || !updatesPanel || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // The panels share a row only on desktop; stacked panels use compact pages.
      const sideBySide = Math.abs(
        standingsPanel.getBoundingClientRect().top - updatesPanel.getBoundingClientRect().top,
      ) < 2;
      const height = standingsPanel.getBoundingClientRect().height;
      const chromeHeight = Array.from(updatesPanel.children).reduce((sum, child) =>
        child.classList.contains(styles.tableWrapper) ? sum : sum + child.getBoundingClientRect().height,
      0);
      setPanelHeight(sideBySide && height > 0 ? height : null);
      setPageSize(sideBySide && height > 0
        ? Math.max(1, Math.floor((height - chromeHeight - 26) / 48))
        : HOMEPAGE_UPDATES_PER_PAGE);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(standingsPanel);
    Array.from(updatesPanel.children).forEach((child) => {
      if (!child.classList.contains(styles.tableWrapper)) observer.observe(child);
    });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeUpdatesTab, updates.length]);

  const standingsPresentation = buildHomepageModulePresentation({
    source: "homepage-standings",
    error: standingsError,
    isEmpty: sortedStandings.length === 0 && !standingsError,
    timestamp: snapshotGeneratedAt,
    maxAgeHours: 18,
    emptyMessage: "Standings are unavailable right now.",
    staleMessage: "Standings may be out of date.",
  });
  const injuriesPresentation = buildHomepageModulePresentation({
    source: "homepage-injuries",
    error: injuriesError,
    isEmpty: injuryUpdates.length === 0 && !injuriesError,
    timestamp: snapshotGeneratedAt,
    maxAgeHours: 18,
    emptyMessage: "No recent injury updates found.",
    staleMessage: "Injury updates may be out of date.",
  });

  return (
    <section
      className={styles.standingsInjuriesContainer}
      aria-label="NHL standings and roster updates"
    >
      <div ref={standingsRef} className={styles.standingsContainer}>
        <div className={styles.standingsHeader}>
          <h2>
            NHL <span>Standings</span>
          </h2>
          <span className={styles.panelMeta}>
            {sortedStandings.length} teams
          </span>
        </div>
        {standingsPresentation.panelState && (
          <PanelStatus
            state={standingsPresentation.panelState}
            message={standingsPresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        )}
        <div className={styles.tableWrapper}>
          {sortedStandings.length > 0 ? (
            <table className={styles.standingsTable}>
              <caption className={styles.visuallyHidden}>
                NHL League Standings
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">GP</th>
                  <th scope="col">W</th>
                  <th scope="col">L</th>
                  <th scope="col">OTL</th>
                  <th scope="col">PTS</th>
                  <th scope="col">P%</th>
                  <th scope="col">STRK</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((teamRecord) => {
                  const teamAbbreviation = teamRecord.teamAbbreviation ?? "NHL";
                  const teamContent = (
                    <>
                      <OptimizedImage
                        className={styles.standingsTeamLogo}
                        src={teamRecord.teamLogo}
                        alt={`${teamRecord.teamName} logo`}
                        width={22}
                        height={22}
                        priority={false}
                        fallbackSrc={fallbackNHLLogo}
                      />
                      <span className={styles.standingsTeamNameSpan}>
                        {teamRecord.teamName}
                      </span>
                    </>
                  );

                  return (
                    <tr key={`${teamAbbreviation}-${teamRecord.teamName}`}>
                      <th scope="row">{teamRecord.leagueSequence}</th>
                      <td>
                        {teamAbbreviation !== "NHL" ? (
                          <Link
                            href={`/stats/team/${teamAbbreviation}`}
                            className={styles.teamLink}
                          >
                            {teamContent}
                          </Link>
                        ) : (
                          <span className={styles.teamLink}>{teamContent}</span>
                        )}
                      </td>
                      <td>{teamRecord.gamesPlayed ?? 0}</td>
                      <td>{teamRecord.wins ?? 0}</td>
                      <td>{teamRecord.losses ?? 0}</td>
                      <td>{teamRecord.otLosses ?? 0}</td>
                      <td>{teamRecord.points ?? 0}</td>
                      <td>
                        {formatPointPercentage(teamRecord.pointPercentage)}
                      </td>
                      <td>{teamRecord.streak ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      <div ref={updatesRef} className={styles.injuriesContainer}
        style={{ "--updates-height": panelHeight ? `${panelHeight}px` : "auto" } as CSSProperties}>
        <div className={styles.injuriesHeader}>
          <h2>
            Recent <span>Transactions &amp; Injuries</span>
          </h2>
          <Link href="/news" className={styles.panelViewAll}>
            View all
          </Link>
        </div>
        <div
          className={styles.updateTabs}
          role="tablist"
          aria-label="Roster updates"
        >
          <button type="button" role="tab" aria-selected={activeUpdatesTab === "all"}
            className={activeUpdatesTab === "all" ? styles.activeTab : ""}
            onClick={() => selectUpdatesTab("all")}>All updates</button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUpdatesTab === "transactions"}
            className={
              activeUpdatesTab === "transactions" ? styles.activeTab : ""
            }
            onClick={() => selectUpdatesTab("transactions")}
          >
            Transactions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUpdatesTab === "injuries"}
            className={activeUpdatesTab === "injuries" ? styles.activeTab : ""}
            onClick={() => selectUpdatesTab("injuries")}
          >
            Injuries
          </button>
        </div>

        {activeUpdatesTab !== "transactions" && injuriesPresentation.panelState ? (
          <PanelStatus
            state={injuriesPresentation.panelState}
            message={injuriesPresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        ) : null}

        <div className={styles.tableWrapper}>
          {currentPageUpdates.length > 0 ? (
            <table className={styles.injuryTable} aria-live="polite">
              <caption className={styles.visuallyHidden}>
                {activeUpdatesTab === "transactions" ? "Recent NHL transactions from the published news feed" : activeUpdatesTab === "injuries" ? "Recent NHL Injury Updates" : "Recent NHL transactions and injury updates"}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.dateColumn}>
                    Date
                  </th>
                  <th scope="col" className={styles.teamColumn}>
                    Team
                  </th>
                  <th scope="col" className={styles.nameColumn}>
                    Update
                  </th>
                  <th scope="col" className={styles.statusColumn}>
                    Type
                  </th>
                  <th scope="col" className={styles.descriptionColumn}>
                    <span className={styles.desktopDetailsLabel}>Details</span>
                    <span className={styles.mobileSourceLabel}>Source</span>
                    <span className={styles.mobileExpandLabel}>
                      <span className={styles.visuallyHidden}>Expand</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentPageUpdates.map((injury) => {
                  const teamAbbrev = injury.team?.toUpperCase() ?? "NHL";
                  const playerId = injury.player?.id;
                  const rowClassName =
                    injury.statusState === "returning"
                      ? styles.returningRow
                      : injury.statusState === "injured"
                        ? styles.injuredRow
                        : styles.transactionRow;
                  const playerName = injury.player?.displayName ?? "N/A";
                  const updateKey = `${injury.kind}-${injury.key}`;
                  const detailId = `${updateKey.replace(
                    /[^a-zA-Z0-9_-]/g,
                    "-",
                  )}-details`;
                  const isExpanded = expandedUpdateKey === updateKey;
                  const summaryRowClassName = [
                    rowClassName,
                    isExpanded ? styles.expandedUpdateSummaryRow : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <Fragment key={injury.key}>
                      <tr className={summaryRowClassName}>
                        <td className={styles.dateColumn}>
                          {formatHomepageDate(injury.date)}
                        </td>
                        <td className={styles.teamColumn}>
                          <OptimizedImage
                            className={styles.injuryTeamLogo}
                            src={getTeamLogoSvg(teamAbbrev)}
                            alt={`${teamAbbrev} logo`}
                            width={24}
                            height={24}
                            priority={false}
                            fallbackSrc={fallbackNHLLogo}
                          />
                        </td>
                        <td className={styles.nameColumn}>
                          {playerId ? (
                            <Link href={`/stats/player/${playerId}`}>
                              {playerName}
                            </Link>
                          ) : (
                            playerName
                          )}
                        </td>
                        <td className={styles.statusColumn}>
                          {injury.status ?? "N/A"}
                        </td>
                        <td className={styles.descriptionColumn}>
                          <span className={styles.desktopUpdateDetails}>
                            <span className={styles.descriptionContent} title={injury.description ?? undefined}>
                              {injury.description ?? "N/A"}
                            </span>
                            {injury.sourceUrl ? (
                              <ExternalNewsLink
                                href={injury.sourceUrl}
                                className={styles.externalNewsLink}
                                label={`View original post for ${playerName}`}
                              />
                            ) : null}
                          </span>
                          <button
                            type="button"
                            className={styles.expandUpdateButton}
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            onClick={() => toggleUpdate(updateKey)}
                          >
                            <span aria-hidden="true">
                              {isExpanded ? "−" : "+"}
                            </span>
                            <span className={styles.visuallyHidden}>
                              {isExpanded ? "Collapse" : "Expand"} update for{" "}
                              {playerName}
                            </span>
                          </button>
                        </td>
                      </tr>
                      <tr
                        id={detailId}
                        className={styles.expandedUpdateRow}
                        hidden={!isExpanded}
                      >
                        <td colSpan={5} className={styles.expandedUpdateCell}>
                          <span>{injury.description ?? "N/A"}</span>
                          <span className={styles.expandedUpdateMeta}>
                            {formatHomepageTimestamp(injury.date)}
                            {injury.sourceAttribution
                              ? ` · ${injury.sourceAttribution}`
                              : ""}
                          </span>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : <p className={styles.inlineEmptyState}>
            {activeUpdatesTab === "transactions" ? "No published transaction updates are available right now." : "No recent updates are available right now."}
          </p>}
        </div>

        {updates.length > 0 ? (
          <div className={styles.pagination}>
            <button
              onClick={() => setUpdatesPage(Math.max(currentPage - 1, 0))}
              disabled={currentPage === 0}
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              onClick={() => setUpdatesPage(Math.min(currentPage + 1, pageCount - 1))}
              disabled={
                currentPage >= pageCount - 1
              }
            >
              Next
            </button>
          </div>
        ) : null}
        <Link href="/news" className={styles.updatesBottomAction}>
          <span>View all transactions &amp; injuries</span>
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </section>
  );
}

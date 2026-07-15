import { useMemo, useState } from "react";
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

const ROWS_PER_PAGE = 32;
const HOMEPAGE_TIME_ZONE = "America/New_York";

function formatHomepageDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const parsed = moment(value);
  return parsed.isValid()
    ? parsed.tz(HOMEPAGE_TIME_ZONE).format("M/D/YY")
    : "N/A";
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
  const [injuryPage, setInjuryPage] = useState(0);
  const [activeUpdatesTab, setActiveUpdatesTab] = useState<
    "transactions" | "injuries"
  >(() => (recentTransactions.length > 0 ? "transactions" : "injuries"));

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

  const currentPageInjuries = useMemo(() => {
    if (!Array.isArray(injuryUpdates)) return [];

    return injuryUpdates.slice(
      injuryPage * ROWS_PER_PAGE,
      (injuryPage + 1) * ROWS_PER_PAGE,
    );
  }, [injuryUpdates, injuryPage]);

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
      <div className={styles.standingsContainer}>
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

      <div className={styles.injuriesContainer}>
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
          <button
            type="button"
            role="tab"
            aria-selected={activeUpdatesTab === "transactions"}
            className={
              activeUpdatesTab === "transactions" ? styles.activeTab : ""
            }
            onClick={() => setActiveUpdatesTab("transactions")}
          >
            Transactions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeUpdatesTab === "injuries"}
            className={activeUpdatesTab === "injuries" ? styles.activeTab : ""}
            onClick={() => setActiveUpdatesTab("injuries")}
          >
            Injuries
          </button>
        </div>

        {activeUpdatesTab === "injuries" && injuriesPresentation.panelState ? (
          <PanelStatus
            state={injuriesPresentation.panelState}
            message={injuriesPresentation.message ?? ""}
            className={styles.moduleStatusPanel}
          />
        ) : null}

        <div className={styles.tableWrapper}>
          {activeUpdatesTab === "transactions" ? (
            recentTransactions.length > 0 ? (
              <table className={styles.transactionTable} aria-live="polite">
                <caption className={styles.visuallyHidden}>
                  Recent NHL transactions from the published news feed
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Team</th>
                    <th scope="col">Player / update</th>
                    <th scope="col">Type</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => {
                    const teamAbbrev = transaction.team_abbreviation ?? "NHL";
                    const playerNames = Array.isArray(transaction.players)
                      ? transaction.players
                          .map((player: any) => player?.player_name)
                          .filter(Boolean)
                          .join(", ")
                      : "";
                    const details = getPublicNewsItemDetails(transaction);
                    const sourceLabel =
                      playerNames || transaction.headline || "news update";

                    return (
                      <tr key={transaction.id}>
                        <td className={styles.dateColumn}>
                          {formatHomepageDate(
                            transaction.published_at ?? transaction.created_at,
                          )}
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
                          {playerNames || transaction.headline}
                        </td>
                        <td className={styles.statusColumn}>
                          {transaction.category}
                        </td>
                        <td className={styles.descriptionColumn}>
                          <span className={styles.descriptionContent}>
                            {details}
                          </span>
                          {transaction.source_url ? (
                            <ExternalNewsLink
                              href={transaction.source_url}
                              className={styles.externalNewsLink}
                              label={`View original post for ${sourceLabel}`}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className={styles.inlineEmptyState}>
                No published transaction updates are available right now.
              </p>
            )
          ) : currentPageInjuries.length > 0 ? (
            <table className={styles.injuryTable} aria-live="polite">
              <caption className={styles.visuallyHidden}>
                Recent NHL Injury Updates
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
                    Player
                  </th>
                  <th scope="col" className={styles.statusColumn}>
                    Status
                  </th>
                  <th scope="col" className={styles.descriptionColumn}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentPageInjuries.map((injury) => {
                  const teamAbbrev = injury.team?.toUpperCase() ?? "NHL";
                  const playerId = injury.player?.id;
                  const rowClassName =
                    injury.statusState === "returning"
                      ? styles.returningRow
                      : injury.statusState === "injured"
                        ? styles.injuredRow
                        : "";
                  const playerName = injury.player?.displayName ?? "N/A";

                  return (
                    <tr
                      key={injury.key}
                      className={rowClassName}
                    >
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
                        <span className={styles.descriptionContent}>
                          {injury.description ?? "N/A"}
                        </span>
                        {injury.sourceUrl ? (
                          <ExternalNewsLink
                            href={injury.sourceUrl}
                            className={styles.externalNewsLink}
                            label={`View original post for ${playerName}`}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>

        {activeUpdatesTab === "injuries" && injuryUpdates.length > ROWS_PER_PAGE ? (
          <div className={styles.pagination}>
            <button
              onClick={() => setInjuryPage((prev) => Math.max(prev - 1, 0))}
              disabled={injuryPage === 0}
            >
              Previous
            </button>
            <span>
              Page {injuryPage + 1} of{" "}
              {Math.ceil(injuryUpdates.length / ROWS_PER_PAGE)}
            </span>
            <button
              onClick={() => setInjuryPage((prev) => prev + 1)}
              disabled={
                injuryUpdates.length <= (injuryPage + 1) * ROWS_PER_PAGE
              }
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

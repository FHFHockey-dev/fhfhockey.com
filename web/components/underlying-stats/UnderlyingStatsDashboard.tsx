import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format, parseISO } from "date-fns";

import OptimizedImage from "../common/OptimizedImage";
import { computeTeamPowerScore } from "../../lib/dashboard/teamContext";
import { getLocalTeamLogoPath } from "../../lib/images";
import { UNDERLYING_STATS_SURFACE_LINKS } from "../../lib/navigation/siteSurfaceLinks";
import { teamsInfo } from "../../lib/teamsInfo";
import type { UnderlyingStatsLandingDashboard as DashboardData } from "../../lib/underlying-stats/teamLandingDashboard";
import type { UnderlyingStatsLandingRating } from "../../lib/underlying-stats/teamLandingRatings";
import type { UlsRouteStatus } from "../../lib/underlying-stats/ulsRouteStatus";
import UnderlyingStatsDashboardCard from "./UnderlyingStatsDashboardCard";
import UnderlyingStatsNavBar from "./UnderlyingStatsNavBar";
import UlsStatusPanel from "./UlsStatusPanel";
import styles from "./UnderlyingStatsDashboard.module.scss";

const UnderlyingStatsQuadrantMap = dynamic(
  () => import("./UnderlyingStatsQuadrantMap"),
  { ssr: false }
);

type UnderlyingStatsDashboardProps = {
  activeTeamAbbr: string | null;
  children: ReactNode;
  dashboard: DashboardData;
  dateOptions: string[];
  error: string | null;
  isLoading: boolean;
  onDateChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onTeamPin: (teamAbbr: string) => void;
  onTeamPreview: (teamAbbr: string | null) => void;
  pinnedTeamAbbr: string | null;
  rankingsActions?: ReactNode;
  ratings: UnderlyingStatsLandingRating[];
  routeStatus: UlsRouteStatus | null;
  selectedDate: string;
  topTeams: UnderlyingStatsLandingRating[];
};

type FreshnessState = "failed" | "fresh" | "pending" | "unavailable";

const formatDateLabel = (isoDate: string): string => {
  try {
    return format(parseISO(isoDate), "MMM d, yyyy");
  } catch {
    return isoDate;
  }
};

const formatSigned = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

// League-average ratings sit at 100; map roughly 70-130 onto the bar.
const ratingBarWidth = (value: number): string =>
  `${Math.min(100, Math.max(4, ((value - 70) / 60) * 100)).toFixed(0)}%`;

const getTeamName = (teamAbbr: string): string =>
  teamsInfo[teamAbbr as keyof typeof teamsInfo]?.name ?? teamAbbr;

function TeamLogo({
  size,
  teamAbbr
}: {
  size: number;
  teamAbbr: string;
}) {
  return (
    <OptimizedImage
      src={getLocalTeamLogoPath(teamAbbr)}
      alt=""
      width={size}
      height={size}
      className={styles.teamLogo}
    />
  );
}

export default function UnderlyingStatsDashboard({
  activeTeamAbbr,
  children,
  dashboard,
  dateOptions,
  error,
  isLoading,
  onDateChange,
  onTeamPin,
  onTeamPreview,
  pinnedTeamAbbr,
  rankingsActions,
  ratings,
  routeStatus,
  selectedDate,
  topTeams
}: UnderlyingStatsDashboardProps) {
  const [mobileMoverLane, setMobileMoverLane] = useState<"rising" | "sliding">(
    "rising"
  );
  const [activeWorkspace, setActiveWorkspace] = useState<"rankings" | "chart">("rankings");
  const rankingsTabRef = useRef<HTMLButtonElement>(null);
  const chartTabRef = useRef<HTMLButtonElement>(null);
  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextWorkspace = event.key === "Home"
      ? "rankings"
      : event.key === "End"
        ? "chart"
        : event.key === "ArrowRight" || event.key === "ArrowLeft"
          ? activeWorkspace === "rankings" ? "chart" : "rankings"
          : null;
    if (nextWorkspace) {
      event.preventDefault();
      setActiveWorkspace(nextWorkspace);
      (nextWorkspace === "rankings" ? rankingsTabRef : chartTabRef).current?.focus();
    }
  };
  const activeTeam = activeTeamAbbr
    ? ratings.find((team) => team.teamAbbr === activeTeamAbbr) ?? null
    : null;
  const pinnedTeamId = pinnedTeamAbbr
    ? teamsInfo[pinnedTeamAbbr as keyof typeof teamsInfo]?.id ?? null
    : null;
  const latestSnapshotDate =
    routeStatus?.teamRatings.latestSnapshotDate ?? dateOptions[0] ?? selectedDate;
  const freshness: FreshnessState = error
    ? "failed"
    : isLoading
      ? "pending"
      : routeStatus?.teamRatings.status === "ready" && ratings.length > 0
        ? "fresh"
        : routeStatus?.teamRatings.status === "pending"
          ? "pending"
          : "unavailable";
  const freshnessLabel: Record<FreshnessState, string> = {
    failed: "Failed",
    fresh: "Fresh",
    pending: "Pending",
    unavailable: "Unavailable"
  };

  const renderMoverLane = (
    direction: "rising" | "sliding",
    items: DashboardData["risers"] | DashboardData["fallers"]
  ) => {
    const isRising = direction === "rising";

    return (
      <div
        className={`${styles.moverLane} ${
          mobileMoverLane !== direction ? styles.moverLaneMobileHidden : ""
        }`}
        data-direction={direction}
      >
        <h3 className={styles.moverLaneTitle}>
          <span aria-hidden="true">{isRising ? "↑" : "↓"}</span>
          {isRising ? "Rising now" : "Sliding now"}
        </h3>
        <div
          className={`${styles.moverList} ${
            items.length ? "" : styles.moverListEmpty
          }`}
        >
          {items.length ? (
            items.slice(0, 5).map((item) => (
              <button
                key={`${direction}-${item.teamAbbr}`}
                type="button"
                className={`${styles.moverItem} ${
                  activeTeamAbbr === item.teamAbbr ? styles.itemActive : ""
                }`}
                aria-label={`Pin ${item.teamName}`}
                aria-pressed={pinnedTeamAbbr === item.teamAbbr}
                onClick={() => onTeamPin(item.teamAbbr)}
                onFocus={() => onTeamPreview(item.teamAbbr)}
                onBlur={() => onTeamPreview(null)}
                onMouseEnter={() => onTeamPreview(item.teamAbbr)}
                onMouseLeave={() => onTeamPreview(null)}
              >
                <span className={styles.moverTopline}>
                  <span className={styles.moverIdentity}>
                    <TeamLogo teamAbbr={item.teamAbbr} size={30} />
                    <span>
                      <strong>{item.teamAbbr}</strong>
                      <small>{item.teamName}</small>
                    </span>
                  </span>
                  <span className={styles.moverMetrics}>
                    <strong>{item.power.toFixed(1)}</strong>
                    <span>{formatSigned(item.trend)}</span>
                  </span>
                </span>
                {item.bullets[0] ? (
                  <span className={styles.moverReason}>{item.bullets[0]}</span>
                ) : null}
                {item.archetypes.length ? (
                  <span className={styles.tagRow}>
                    {item.archetypes.slice(0, 2).map((tag) => (
                      <span key={`${item.teamAbbr}-${tag}`} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className={styles.moverEmpty}>
              No {isRising ? "risers" : "fallers"} in this snapshot.
            </p>
          )}
        </div>
      </div>
    );
  };

  const isLatestSnapshotToday =
    latestSnapshotDate === format(new Date(), "yyyy-MM-dd");
  const showFullRankings = () => {
    setActiveWorkspace("rankings");
    rankingsTabRef.current?.focus();
    rankingsTabRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };

  return (
    <>
      <header className={styles.commandPlane}>
        <div className={styles.commandTopline}>
          <div className={styles.commandCopy}>
            <h1 className={styles.pageTitle}>Underlying Stats</h1>
            <p className={styles.pageDescription}>
              Dig beneath the scores. Explore the process, sustainability, and
              schedule context driving NHL team performance.
            </p>
          </div>

          <div className={styles.commandMeta} aria-label="Snapshot metadata">
            <label className={styles.snapshotControl} htmlFor="date-select">
              <span>Snapshot date</span>
              <select
                id="date-select"
                value={selectedDate}
                onChange={onDateChange}
                disabled={!dateOptions.length}
              >
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.metaItem}>
              <span>Teams</span>
              <strong>{ratings.length ? `${ratings.length} NHL Teams` : "—"}</strong>
            </div>
            <div className={styles.metaItem} data-freshness={freshness}>
              <span>Data freshness</span>
              <strong>
                <i aria-hidden="true" />
                {freshnessLabel[freshness]}
              </strong>
              <small>
                {latestSnapshotDate
                  ? isLatestSnapshotToday
                    ? "Updated today"
                    : `Latest ${formatDateLabel(latestSnapshotDate)}`
                  : "No snapshot yet"}
              </small>
            </div>
            <details className={styles.aboutDisclosure}>
              <summary>About this dashboard</summary>
              <div className={styles.aboutContent}>
                <p>
                  Use this page to diagnose current team quality, the process
                  supporting it, and where results may be running ahead of or
                  behind the underlying profile.
                </p>
                <p>
                  Use Trends for movement, Splits for matchup context, Starter
                  Board for start decisions, and Lines for deployment.
                </p>
                <div className={styles.aboutLinks}>
                  {UNDERLYING_STATS_SURFACE_LINKS.map((link) => (
                    <Link key={link.href} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
                <h2 className={styles.aboutHeading}>Data readiness</h2>
                <UlsStatusPanel status={routeStatus} variant="landing" />
              </div>
            </details>
          </div>
        </div>

        {isLoading ? (
          <p className={styles.pageStatus} data-status="pending">
            Loading the selected snapshot while the current view stays in place…
          </p>
        ) : error ? (
          <p className={styles.pageStatus} data-status="failed">
            {error}
          </p>
        ) : null}
      </header>

      <UnderlyingStatsNavBar pinnedTeamId={pinnedTeamId} showDetails />

      <UnderlyingStatsDashboardCard
        className={styles.powerLeadersPanel}
        title="Power leaders"
        info="Power Score blends offense, defense, pace, and a small special-teams adjustment."
        description="The top three teams by our Power Score."
        actions={
          <button
            type="button"
            className={styles.viewRankingsButton}
            onClick={showFullRankings}
          >
            <span className={styles.viewRankingsLong}>View full rankings</span>
            <span className={styles.viewRankingsShort}>View all</span>
          </button>
        }
      >
        <div className={styles.powerLeadersRail}>
          {topTeams.length ? (
            topTeams.map((team, index) => (
              <button
                key={team.teamAbbr}
                type="button"
                className={`${styles.powerLeader} ${
                  activeTeamAbbr === team.teamAbbr ? styles.itemActive : ""
                }`}
                aria-label={`Pin ${getTeamName(team.teamAbbr)}`}
                aria-pressed={pinnedTeamAbbr === team.teamAbbr}
                onClick={() => onTeamPin(team.teamAbbr)}
                onFocus={() => onTeamPreview(team.teamAbbr)}
                onBlur={() => onTeamPreview(null)}
                onMouseEnter={() => onTeamPreview(team.teamAbbr)}
                onMouseLeave={() => onTeamPreview(null)}
              >
                <span className={styles.leaderTopline}>
                  <span className={styles.rankBadge}>{index + 1}</span>
                  <span className={styles.leaderIdentity}>
                    <TeamLogo teamAbbr={team.teamAbbr} size={48} />
                    <span>
                      <strong className={styles.leaderAbbr}>{team.teamAbbr}</strong>
                      <small>{getTeamName(team.teamAbbr)}</small>
                    </span>
                  </span>
                  <span className={styles.leaderPower}>
                    {computeTeamPowerScore(team).toFixed(1)}
                    <small>Power Score</small>
                  </span>
                </span>
                <span className={styles.leaderDetails}>
                  <span className={styles.leaderStat}>
                    <small>Offense</small>
                    <strong>{team.offRating.toFixed(0)}</strong>
                    <i style={{ width: ratingBarWidth(team.offRating) }} aria-hidden="true" />
                  </span>
                  <span className={styles.leaderStat}>
                    <small>Defense</small>
                    <strong>{team.defRating.toFixed(0)}</strong>
                    <i style={{ width: ratingBarWidth(team.defRating) }} aria-hidden="true" />
                  </span>
                  <span className={styles.leaderWhy}>
                    <small>Why they&apos;re here</small>
                    <span>{team.narrative[0] ?? "No rating note for this snapshot yet."}</span>
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className={styles.moduleEmpty}>No power leaders are available.</p>
          )}
        </div>
      </UnderlyingStatsDashboardCard>

      <section className={styles.workspace} aria-label="Team rankings and chart">
        <div className={styles.workspaceBar}>
          <div className={styles.workspaceTabs} role="tablist" aria-label="Primary analytics views">
            <button
              ref={rankingsTabRef}
              id="rankings-tab"
              type="button"
              role="tab"
              aria-controls="rankings-panel"
              aria-selected={activeWorkspace === "rankings"}
              tabIndex={activeWorkspace === "rankings" ? 0 : -1}
              onClick={() => setActiveWorkspace("rankings")}
              onKeyDown={handleWorkspaceKeyDown}
            >
              Team Rankings
            </button>
            <button
              ref={chartTabRef}
              id="chart-tab"
              type="button"
              role="tab"
              aria-controls="chart-panel"
              aria-selected={activeWorkspace === "chart"}
              tabIndex={activeWorkspace === "chart" ? 0 : -1}
              onClick={() => setActiveWorkspace("chart")}
              onKeyDown={handleWorkspaceKeyDown}
            >
              Chart
            </button>
          </div>
          {activeWorkspace === "rankings" && rankingsActions ? (
            <div className={styles.workspaceActions}>{rankingsActions}</div>
          ) : null}
        </div>
      <div id="rankings-panel" role="tabpanel" aria-labelledby="rankings-tab" hidden={activeWorkspace !== "rankings"}>
        {children}
      </div>
      <div id="chart-panel" role="tabpanel" aria-labelledby="chart-tab" hidden={activeWorkspace !== "chart"}>
        {activeWorkspace === "chart" ? (
          <section className={styles.primaryWorkspace} aria-label="Primary analytics">
            <UnderlyingStatsDashboardCard
              className={styles.quadrantCard}
              kicker="League map"
              title="Process quadrant"
              info="Offensive process combines expected-goal and shot generation. Defensive process rewards suppressing those same inputs."
              description="Offensive process on the x-axis and defensive process on the y-axis. Preview a team, then pin it for cross-dashboard context."
              actions={
                <div className={styles.cardMeta}>
                  <span>{selectedDate ? formatDateLabel(selectedDate) : "Latest"}</span>
                  {activeTeam ? (
                    <strong>
                      {activeTeam.teamAbbr} · {computeTeamPowerScore(activeTeam).toFixed(1)}
                    </strong>
                    ) : null}
                </div>
              }
            >
              {dashboard.quadrant.points.length ? (
                <UnderlyingStatsQuadrantMap
                  activeTeamAbbr={activeTeamAbbr}
                  pinnedTeamAbbr={pinnedTeamAbbr}
                  averageDefenseProcess={dashboard.quadrant.averageDefenseProcess}
                  averageOffenseProcess={dashboard.quadrant.averageOffenseProcess}
                  onTeamPin={onTeamPin}
                  onTeamPreview={onTeamPreview}
                  points={dashboard.quadrant.points}
                />
              ) : (
                <p className={styles.moduleEmpty}>
                  No quadrant data is available for this snapshot.
                </p>
              )}
              <div className={styles.chartFooter}>
                <span>
                  League avg · offense {dashboard.quadrant.averageOffenseProcess.toFixed(2)} · defense{" "}
                  {dashboard.quadrant.averageDefenseProcess.toFixed(2)}
                </span>
                <span>{selectedDate ? `Snapshot ${formatDateLabel(selectedDate)}` : "Latest snapshot"}</span>
              </div>
            </UnderlyingStatsDashboardCard>

            <UnderlyingStatsDashboardCard
              className={styles.moversCard}
              kicker="Movement"
              title="Team movers"
              info="Movement compares the current rating with the team's recent snapshot baseline."
              description="Recent rating movement with the existing reasons and profile tags."
              actions={<span className={styles.windowBadge}>Recent snapshots</span>}
            >
              <div className={styles.mobileMoverToggle} role="tablist" aria-label="Mover direction">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileMoverLane === "rising"}
                  onClick={() => setMobileMoverLane("rising")}
                >
                  Rising
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileMoverLane === "sliding"}
                  onClick={() => setMobileMoverLane("sliding")}
                >
                  Sliding
                </button>
              </div>
              <div className={styles.moverLanes}>
                {renderMoverLane("rising", dashboard.risers)}
                {renderMoverLane("sliding", dashboard.fallers)}
              </div>
            </UnderlyingStatsDashboardCard>
          </section>

        ) : null}
      </div>
      </section>
    </>
  );
}

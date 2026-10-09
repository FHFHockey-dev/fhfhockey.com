import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { format, parseISO } from "date-fns";

import OwnershipSparkline from "../TransactionTrends/OwnershipSparkline";
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

const formatSos = (value: number | null): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "—";

const formatRank = (value: number | null): string =>
  typeof value === "number" && Number.isFinite(value) ? `${value}` : "—";

const formatPct = (value: number | null): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "—";

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

  return (
    <>
      <header className={styles.commandPlane}>
        <div className={styles.commandTopline}>
          <div className={styles.commandCopy}>
            <p className={styles.eyebrow}>Team intelligence</p>
            <h1 className={styles.pageTitle}>Underlying Stats Dashboard</h1>
            <p className={styles.pageDescription}>
              Compare NHL team strength and explore the process behind each rating.
            </p>
            <span className={styles.lensBadge}>
              Primary lens: <strong>Team diagnosis</strong>
            </span>
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
              <span>Latest snapshot</span>
              <strong>
                {latestSnapshotDate
                  ? formatDateLabel(latestSnapshotDate)
                  : "Unavailable"}
              </strong>
            </div>
            <div className={styles.metaItem}>
              <span>Teams</span>
              <strong>{ratings.length || "—"}</strong>
            </div>
            <div className={styles.metaItem} data-freshness={freshness}>
              <span>Freshness</span>
              <strong>
                {freshnessLabel[freshness]}
                <i aria-hidden="true" />
              </strong>
            </div>
          </div>
        </div>

        <div className={styles.commandNavRow}>
          <details className={styles.readinessDisclosure}>
            <summary>Data readiness</summary>
            <div className={styles.readinessContent}>
              <UlsStatusPanel status={routeStatus} variant="landing" />
            </div>
          </details>
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
            </div>
          </details>
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

      <UnderlyingStatsNavBar pinnedTeamId={pinnedTeamId} />

      <UnderlyingStatsDashboardCard
        className={styles.powerLeadersPanel}
        title="Power leaders"
        info="Power Score blends offense, defense, pace, and a small special-teams adjustment."
        description="The top three teams in the selected live snapshot."
      >
        <div className={styles.powerLeadersRail}>
          {topTeams.length ? (
            topTeams.map((team, index) => (
              <button
                key={team.teamAbbr}
                type="button"
                className={`${styles.powerLeader} ${
                  index === 0 ? styles.powerLeaderFirst : ""
                } ${activeTeamAbbr === team.teamAbbr ? styles.itemActive : ""}`}
                aria-label={`Pin ${getTeamName(team.teamAbbr)}`}
                aria-pressed={pinnedTeamAbbr === team.teamAbbr}
                onClick={() => onTeamPin(team.teamAbbr)}
                onFocus={() => onTeamPreview(team.teamAbbr)}
                onBlur={() => onTeamPreview(null)}
                onMouseEnter={() => onTeamPreview(team.teamAbbr)}
                onMouseLeave={() => onTeamPreview(null)}
              >
                <span className={styles.rankWatermark}>{index + 1}</span>
                <span className={styles.leaderTopline}>
                  <span className={styles.leaderIdentity}>
                    <TeamLogo teamAbbr={team.teamAbbr} size={48} />
                    <span>
                      <strong>{team.teamAbbr}</strong>
                      <small>{getTeamName(team.teamAbbr)}</small>
                    </span>
                  </span>
                  <span className={styles.leaderPower}>
                    {computeTeamPowerScore(team).toFixed(1)}
                    <small>Power</small>
                  </span>
                </span>
                <span className={styles.leaderCoreMetrics}>
                  <span>
                    <small>Off</small>
                    <strong>{team.offRating.toFixed(0)}</strong>
                  </span>
                  <span>
                    <small>Def</small>
                    <strong>{team.defRating.toFixed(0)}</strong>
                  </span>
                  <span className={styles.leaderTrend}>
                    <small>Trend</small>
                    <OwnershipSparkline
                      points={team.trendSeries ?? []}
                      variant={team.trend10 >= 0 ? "rise" : "fall"}
                      width={104}
                      height={24}
                      baseline
                      svgClassName={styles.sparkline}
                      pathClassName={styles.sparklinePath}
                      baselineClassName={styles.sparklineBaseline}
                      emptyClassName={styles.sparklineEmpty}
                    />
                  </span>
                </span>
                <span className={styles.leaderContextMetrics}>
                  <span>
                    <small>Future SoS</small>
                    <strong>
                      {formatRank(team.sosFutureRank)} · {formatSos(team.sosFuture)}
                    </strong>
                  </span>
                  <span>
                    <small>PP</small>
                    <strong>
                      {formatRank(team.ppRank)} · {formatPct(team.ppPct)}
                    </strong>
                  </span>
                  <span>
                    <small>PK</small>
                    <strong>
                      {formatRank(team.pkRank)} · {formatPct(team.pkPct)}
                    </strong>
                  </span>
                </span>
                {team.narrative.length ? (
                  <span className={styles.leaderNarrative}>
                    {team.narrative.slice(0, 2).map((bullet) => (
                      <span key={`${team.teamAbbr}-${bullet}`}>• {bullet}</span>
                    ))}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className={styles.moduleEmpty}>No power leaders are available.</p>
          )}
        </div>
      </UnderlyingStatsDashboardCard>

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
    </>
  );
}

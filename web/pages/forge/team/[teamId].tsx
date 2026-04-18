import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import ForgeRouteNav from "components/forge-dashboard/ForgeRouteNav";
import { useTeamSchedule } from "hooks/useTeamSchedule";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  buildForgeHref,
  parseForgeDateParam,
  parseForgeResolvedDateParam
} from "lib/dashboard/forgeLinks";
import {
  normalizeCtpiResponse,
  normalizeStartChartResponse,
  normalizeTeamRatings,
  type NormalizedCtpiTeamRow,
  type NormalizedTeamRatingRow
} from "lib/dashboard/normalizers";
import {
  buildSlateMatchupEdgeMap,
  computeCtpiDelta,
  computeTeamPowerScore
} from "lib/dashboard/teamContext";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeDashboard.module.scss";

function getTodayEt(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const y = parts.find((part) => part.type === "year")?.value ?? "1970";
  const m = parts.find((part) => part.type === "month")?.value ?? "01";
  const d = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

const formatMetric = (value: number | null | undefined, digits = 1): string =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

export default function ForgeTeamDetailPage() {
  const router = useRouter();
  const todayEt = useMemo(() => getTodayEt(), []);
  const date = parseForgeDateParam(router.query.date, todayEt);
  const routeResolvedDate = parseForgeResolvedDateParam(router.query.resolvedDate);
  const teamIdParam =
    typeof router.query.teamId === "string" ? router.query.teamId : "";
  const teamAbbr = teamIdParam.toUpperCase();
  const teamMeta = teamsInfo[teamAbbr];
  const [teamRating, setTeamRating] = useState<NormalizedTeamRatingRow | null>(null);
  const [ctpiRow, setCtpiRow] = useState<NormalizedCtpiTeamRow | null>(null);
  const [matchupEdge, setMatchupEdge] = useState<{
    opponentAbbr: string;
    edge: number;
  } | null>(null);
  const [resolvedDate, setResolvedDate] = useState<string | null>(null);
  const [contextMessages, setContextMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    games: scheduleGames,
    loading: scheduleLoading,
    error: scheduleError,
    record
  } = useTeamSchedule(teamAbbr, undefined, teamMeta ? String(teamMeta.id) : undefined);

  useEffect(() => {
    let active = true;

    if (!teamMeta) {
      setLoading(false);
      setError("Unknown team.");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    setContextMessages([]);

    Promise.allSettled([
      fetchCachedJson<unknown>(`/api/team-ratings?date=${encodeURIComponent(date)}`, {
        ttlMs: 60_000
      }),
      fetchCachedJson<unknown>("/api/v1/trends/team-ctpi", {
        ttlMs: 60_000
      }),
      fetchCachedJson<unknown>(`/api/v1/start-chart?date=${encodeURIComponent(date)}`, {
        ttlMs: 60_000
      })
    ])
      .then(([ratingsResult, ctpiResult, slateResult]) => {
        if (!active) return;

        const nextMessages: string[] = [];
        let matchingRating: NormalizedTeamRatingRow | null = null;
        let ctpi: NormalizedCtpiTeamRow | null = null;
        let nextMatchupEdge: { opponentAbbr: string; edge: number } | null = null;

        if (ratingsResult.status === "fulfilled") {
          const ratings = normalizeTeamRatings(ratingsResult.value);
          matchingRating =
            ratings.find((row) => row.teamAbbr.toUpperCase() === teamAbbr) ?? null;
          if (matchingRating?.date && matchingRating.date !== date) {
            nextMessages.push(
              `Using latest available team ratings from ${matchingRating.date}.`
            );
          }
        } else {
          nextMessages.push("Team ratings unavailable for this date.");
        }

        if (ctpiResult.status === "fulfilled") {
          ctpi =
            normalizeCtpiResponse(ctpiResult.value).teams.find(
              (row) => row.team.toUpperCase() === teamAbbr
            ) ?? null;
          if (!ctpi) {
            nextMessages.push("CTPI unavailable for this date.");
          }
        } else {
          nextMessages.push("CTPI unavailable for this date.");
        }

        if (slateResult.status === "fulfilled") {
          const slateGames = normalizeStartChartResponse(slateResult.value).games;
          const matchupMap = buildSlateMatchupEdgeMap(slateGames);
          nextMatchupEdge = matchupMap.get(teamAbbr) ?? null;
          if (!nextMatchupEdge) {
            nextMessages.push("Matchup edge unavailable for this date.");
          }
        } else {
          nextMessages.push("Matchup edge unavailable for this date.");
        }

        setTeamRating(matchingRating);
        setResolvedDate(matchingRating?.date ?? null);
        setCtpiRow(ctpi);
        setMatchupEdge(nextMatchupEdge);
        setContextMessages(nextMessages);

        if (!matchingRating && !ctpi && !nextMatchupEdge) {
          setError("No team context is available for the selected date.");
        }
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load team detail."
        );
        setTeamRating(null);
        setCtpiRow(null);
        setMatchupEdge(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, teamAbbr, teamMeta]);

  const powerScore = useMemo(
    () => (teamRating ? computeTeamPowerScore(teamRating) : null),
    [teamRating]
  );
  const ctpiDelta = useMemo(
    () => (ctpiRow ? computeCtpiDelta(ctpiRow) : null),
    [ctpiRow]
  );
  const upcomingGames = useMemo(() => {
    const now = new Date(date);
    return scheduleGames
      .filter((game) => new Date(game.gameDate) >= now)
      .slice(0, 5);
  }, [date, scheduleGames]);

  return (
    <>
      <Head>
        <title>{teamMeta ? `${teamMeta.name} | FORGE Team Detail` : "FORGE Team Detail"}</title>
        <meta
          name="description"
          content="Dedicated FORGE team detail page with power, CTPI, matchup, and schedule context."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.shell}>
            <header className={styles.routePageHeader}>
              <div className={styles.routePageIntro}>
                <p className={styles.routePageEyebrow}>Team Detail</p>
                <h1 className={styles.routePageTitle}>
                  {teamMeta ? teamMeta.name : teamAbbr || "Unknown Team"}
                </h1>
                <p className={styles.routePageSubtitle}>
                  Team rating-blend context, current slate context, and upcoming schedule live together here so
                  team clicks from the dashboard land somewhere operational instead of generic.
                </p>
              </div>
              <div className={styles.routePageNavStack}>
                <ForgeRouteNav
                  current="teamDetail"
                  teamHref={
                    teamMeta
                      ? buildForgeHref(`/forge/team/${teamAbbr}`, {
                          date,
                          resolvedDate: resolvedDate ?? routeResolvedDate
                        })
                      : null
                  }
                  date={date}
                  resolvedDate={resolvedDate ?? routeResolvedDate}
                  team={teamAbbr}
                />
                <div className={styles.routePageMeta}>
                  <span className={styles.contextChip}>Date: {resolvedDate ?? date}</span>
                  <Link
                    href={buildForgeHref("/forge/dashboard", {
                      date,
                      resolvedDate: resolvedDate ?? routeResolvedDate,
                      team: teamAbbr
                    })}
                    className={styles.navLink}
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </header>

            {loading ? (
              <section className={styles.sectionBand}>
                <p className={styles.panelState}>Loading team detail...</p>
              </section>
            ) : null}

            {!loading && error ? (
              <section className={styles.sectionBand}>
                <p className={styles.panelState}>Error: {error}</p>
              </section>
            ) : null}

            {!loading && !error && teamMeta ? (
              <>
                <section className={styles.sectionBand}>
                  <div className={styles.bandHeader}>
                    <div className={styles.bandIntro}>
                      <p className={styles.bandEyebrow}>Snapshot</p>
                      <h2 className={styles.bandTitle}>Current Team Context</h2>
                    </div>
                  </div>
                  {contextMessages.length > 0 ? (
                    <div className={styles.bandStatusStack}>
                      {contextMessages.map((message) => (
                        <p
                          key={message}
                          className={`${styles.panelState} ${
                            message.startsWith("Using latest")
                              ? styles.panelStateStale
                              : ""
                          }`}
                        >
                          {message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.detailMetricGrid}>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>Rating Blend</span>
                      <strong>{formatMetric(powerScore)}</strong>
                      <span>Trend {formatSigned(teamRating?.trend10)}</span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>CTPI</span>
                      <strong>{formatMetric(ctpiRow?.ctpi_0_to_100, 0)}</strong>
                      <span>Momentum {formatSigned(ctpiDelta)}</span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>Matchup Edge</span>
                      <strong>{formatSigned(matchupEdge?.edge)}</strong>
                      <span>
                        {matchupEdge ? `vs ${matchupEdge.opponentAbbr}` : "No same-day matchup"}
                      </span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>Sub Ratings</span>
                      <strong>
                        OFF {formatMetric(teamRating?.offRating)} / DEF {formatMetric(teamRating?.defRating)}
                      </strong>
                      <span>PACE {formatMetric(teamRating?.paceRating)}</span>
                    </article>
                  </div>
                </section>

                <section className={styles.sectionBand}>
                  <div className={styles.bandHeader}>
                    <div className={styles.bandIntro}>
                      <p className={styles.bandEyebrow}>Schedule</p>
                      <h2 className={styles.bandTitle}>Upcoming Games and Record</h2>
                    </div>
                  </div>
                  {scheduleLoading ? (
                    <p className={styles.panelState}>Loading team schedule...</p>
                  ) : scheduleError ? (
                    <p className={styles.panelState}>Schedule error: {scheduleError}</p>
                  ) : (
                    <div className={styles.previewColumns}>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>Record</p>
                        <div className={styles.previewList}>
                          <div className={styles.previewRowStatic}>
                            <strong>
                              {record
                                ? `${record.wins}-${record.losses}-${record.otLosses}`
                                : "--"}
                            </strong>
                            <span>{record ? `${record.points} pts` : "Record unavailable"}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>Next Five</p>
                        <div className={styles.previewList}>
                          {upcomingGames.map((game) => {
                            const isHome = game.homeTeam.abbrev === teamAbbr;
                            const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
                            return (
                              <div key={game.id} className={styles.previewRowStatic}>
                                <strong>{isHome ? `vs ${opponent}` : `@ ${opponent}`}</strong>
                                <span>{game.gameDate}</span>
                              </div>
                            );
                          })}
                          {upcomingGames.length === 0 ? (
                            <p className={styles.panelState}>No upcoming schedule rows available.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className={styles.sectionBand}>
                  <div className={styles.bandHeader}>
                    <div className={styles.bandIntro}>
                      <p className={styles.bandEyebrow}>Drill-ins</p>
                      <h2 className={styles.bandTitle}>Open the Adjacent Views</h2>
                    </div>
                  </div>
                  <div className={styles.previewActions}>
                    <Link
                      href={buildForgeHref("/forge/dashboard", {
                        date,
                        resolvedDate: resolvedDate ?? routeResolvedDate,
                        team: teamAbbr
                      })}
                      className={styles.slateActionLink}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={buildForgeHref("/start-chart", {
                        date,
                        resolvedDate: resolvedDate ?? routeResolvedDate
                      })}
                      className={styles.slateActionLink}
                    >
                      Start Chart
                    </Link>
                    <Link
                      href={buildForgeHref("/trends", { date })}
                      className={styles.slateActionLink}
                    >
                      Trends
                    </Link>
                    <Link href="/underlying-stats" className={styles.slateActionLink}>
                      Underlying Stats
                    </Link>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});

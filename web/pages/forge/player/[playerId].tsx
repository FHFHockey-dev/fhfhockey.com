import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO, startOfWeek } from "date-fns";

import ForgeRouteNav from "components/forge-dashboard/ForgeRouteNav";
import useSchedule from "components/GameGrid/utils/useSchedule";
import { useTeamSchedule } from "hooks/useTeamSchedule";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  buildForgeHref,
  parseForgeDateParam,
  parseForgeResolvedDateParam,
} from "lib/dashboard/forgeLinks";
import {
  fetchOwnershipContextMap,
  type PlayerOwnershipContext,
} from "lib/dashboard/playerOwnership";
import {
  scoreTopAddsCandidate,
  type TopAddsMode,
} from "lib/dashboard/topAddsRanking";
import { buildTopAddsScheduleContextMap } from "lib/dashboard/topAddsScheduleContext";
import { getLatestStartedSeasonForDate } from "lib/NHL/server";
import {
  type ProjectionTeamIdentity,
  validateProjectionTeamIdentityForSeason,
} from "lib/NHL/seasonAwareScheduleTeam";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeDashboard.module.scss";

type ForgePlayerDetailPageProps = {
  scheduleSeasonId: string | null;
};

const UNAVAILABLE_SCHEDULE_SEASON = "unavailable";
const SCHEDULE_SEASON_UNAVAILABLE_COPY =
  "Selected-date schedule season unavailable.";

type ForgePlayersResponse = {
  asOfDate: string | null;
  requestedDate?: string | null;
  requestedSeasonId?: number | null;
  resolvedSeasonId?: number | null;
  horizonGames?: number | null;
  degradedProjectionSummary?: {
    note: string | null;
  } | null;
  data: Array<{
    player_id: number;
    player_name: string | null;
    team_name: string | null;
    teamIdentity?: ProjectionTeamIdentity | null;
    position: string | null;
    pts: number;
    ppp: number;
    sog: number;
    hit: number;
    blk: number;
    uncertainty: number | null;
    degradedProjectionContext?: {
      summary: string | null;
      isDegraded: boolean;
    } | null;
  }>;
};

function getTodayEt(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((part) => part.type === "year")?.value ?? "1970";
  const m = parts.find((part) => part.type === "month")?.value ?? "01";
  const d = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function resolveTeamMeta(
  teamIdentity: ProjectionTeamIdentity | null | undefined,
  teamName: string | null | undefined,
  resolvedSeasonId: number | null,
) {
  if (resolvedSeasonId === null) return undefined;
  const validatedIdentity = validateProjectionTeamIdentityForSeason(
    teamIdentity,
    resolvedSeasonId,
  );
  const source = validatedIdentity?.source;
  const canonical = validatedIdentity?.canonical;
  if (!source || !canonical || source.name !== teamName) return undefined;

  const current = teamsInfo[canonical.abbreviation];
  return current?.id === canonical.id &&
    current.abbrev === canonical.abbreviation &&
    current.name === canonical.name
    ? current
    : undefined;
}

const formatMetric = (value: number | null | undefined, digits = 1): string =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

export default function ForgePlayerDetailPage({
  scheduleSeasonId,
}: ForgePlayerDetailPageProps) {
  const router = useRouter();
  const todayEt = useMemo(() => getTodayEt(), []);
  const playerId = Number(router.query.playerId);
  const date = parseForgeDateParam(router.query.date, todayEt);
  const routeResolvedDate = parseForgeResolvedDateParam(
    router.query.resolvedDate,
  );
  const mode = router.query.mode === "week" ? "week" : "tonight";
  const [projectionRow, setProjectionRow] = useState<
    ForgePlayersResponse["data"][number] | null
  >(null);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [projectionResolvedSeasonId, setProjectionResolvedSeasonId] = useState<
    number | null
  >(null);
  const [ownershipContext, setOwnershipContext] =
    useState<PlayerOwnershipContext | null>(null);
  const [detailMessages, setDetailMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!Number.isFinite(playerId)) {
      setLoading(false);
      setError("Invalid player id.");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    setDetailMessages([]);

    Promise.allSettled([
      fetchCachedJson<ForgePlayersResponse>(
        `/api/v1/forge/players?date=${encodeURIComponent(date)}&horizon=${
          mode === "week" ? "5" : "1"
        }`,
        { ttlMs: 60_000 },
      ),
      fetchOwnershipContextMap([playerId], date, 5),
    ])
      .then(([playersResult, ownershipResult]) => {
        if (!active) return;
        const nextMessages: string[] = [];

        if (playersResult.status === "rejected") {
          setError("Player opportunity context is unavailable for this date.");
          setProjectionRow(null);
          setAsOfDate(null);
          setProjectionResolvedSeasonId(null);
          setOwnershipContext(null);
          return;
        }

        const playersPayload = playersResult.value;
        const expectedHorizon = mode === "week" ? 5 : 1;
        const resolvedSeasonId = playersPayload?.resolvedSeasonId;
        const resolvedSeasonText = String(resolvedSeasonId);
        const resolvedSeasonStart = Number(resolvedSeasonText.slice(0, 4));
        const resolvedSeasonEnd = Number(resolvedSeasonText.slice(4));
        const responseOwnsSelection =
          playersPayload?.requestedDate === date &&
          playersPayload?.horizonGames === expectedHorizon &&
          Number.isSafeInteger(resolvedSeasonId) &&
          /^\d{8}$/.test(resolvedSeasonText) &&
          resolvedSeasonEnd === resolvedSeasonStart + 1;

        if (!responseOwnsSelection) {
          setError(
            "Projection response does not match the selected date and horizon.",
          );
          setProjectionRow(null);
          setAsOfDate(null);
          setProjectionResolvedSeasonId(null);
          setOwnershipContext(null);
          return;
        }

        const row =
          (playersPayload?.data ?? []).find(
            (candidate) => candidate.player_id === playerId,
          ) ?? null;

        if (!row) {
          setError("Player not found in the current FORGE opportunity set.");
          setProjectionRow(null);
          setAsOfDate(playersPayload?.asOfDate ?? null);
          setProjectionResolvedSeasonId(null);
          setOwnershipContext(null);
          return;
        }

        if (playersPayload?.asOfDate && playersPayload.asOfDate !== date) {
          nextMessages.push(
            `Using latest available projections from ${playersPayload.asOfDate}.`,
          );
        }
        if (playersPayload?.degradedProjectionSummary?.note) {
          nextMessages.push(playersPayload.degradedProjectionSummary.note);
        }
        if (row.degradedProjectionContext?.summary) {
          nextMessages.push(row.degradedProjectionContext.summary);
        }

        setProjectionRow(row);
        setAsOfDate(playersPayload?.asOfDate ?? null);
        setProjectionResolvedSeasonId(Number(resolvedSeasonId));

        if (ownershipResult.status === "fulfilled") {
          setOwnershipContext(ownershipResult.value[playerId] ?? null);
        } else {
          setOwnershipContext(null);
          nextMessages.push("Ownership context unavailable for this player.");
        }

        setDetailMessages(nextMessages);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load player detail.",
        );
        setProjectionRow(null);
        setAsOfDate(null);
        setProjectionResolvedSeasonId(null);
        setOwnershipContext(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, mode, playerId]);

  const teamMeta = useMemo(
    () =>
      resolveTeamMeta(
        projectionRow?.teamIdentity,
        projectionRow?.team_name,
        projectionResolvedSeasonId,
      ),
    [
      projectionResolvedSeasonId,
      projectionRow?.teamIdentity,
      projectionRow?.team_name,
    ],
  );
  const {
    games: scheduleGames,
    loading: scheduleLoading,
    error: scheduleError,
    scheduleTeam,
  } = useTeamSchedule(
    teamMeta?.abbrev ?? "",
    scheduleSeasonId ?? UNAVAILABLE_SCHEDULE_SEASON,
    teamMeta ? String(teamMeta.id) : undefined,
    date,
  );
  const weekStartDate = useMemo(
    () =>
      format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [date],
  );
  const [weekSchedule, weekNumGamesPerDay, weekScheduleLoading] = useSchedule(
    weekStartDate,
    false,
  );
  const weekScheduleRequestKey = `${weekStartDate}:${
    scheduleSeasonId ?? UNAVAILABLE_SCHEDULE_SEASON
  }`;
  const previousWeekScheduleRequestKeyRef = useRef(weekScheduleRequestKey);
  const weekScheduleRequestChanged =
    previousWeekScheduleRequestKeyRef.current !== weekScheduleRequestKey;

  useEffect(() => {
    previousWeekScheduleRequestKeyRef.current = weekScheduleRequestKey;
  }, [weekScheduleRequestKey]);

  const weekContext = useMemo(() => {
    if (
      !teamMeta ||
      mode !== "week" ||
      scheduleSeasonId === null ||
      weekScheduleLoading ||
      weekScheduleRequestChanged
    ) {
      return null;
    }
    return (
      buildTopAddsScheduleContextMap(
        weekSchedule,
        weekNumGamesPerDay,
        date,
        Number(scheduleSeasonId),
      )[teamMeta.abbrev] ?? null
    );
  }, [
    date,
    mode,
    scheduleSeasonId,
    teamMeta,
    weekNumGamesPerDay,
    weekSchedule,
    weekScheduleLoading,
    weekScheduleRequestChanged,
  ]);

  const opportunityScore = useMemo(() => {
    if (!projectionRow || !ownershipContext) return null;

    return scoreTopAddsCandidate(
      {
        playerId,
        name: projectionRow.player_name ?? `Player ${playerId}`,
        team: teamMeta?.abbrev ?? projectionRow.team_name ?? null,
        teamAbbr: teamMeta?.abbrev ?? null,
        position: projectionRow.position ?? null,
        headshot: null,
        ownership: ownershipContext.ownership ?? 0,
        ownershipTimeline: ownershipContext.sparkline,
        delta: ownershipContext.delta ?? 0,
        projectionPts: projectionRow.pts ?? 0,
        ppp: projectionRow.ppp ?? 0,
        sog: projectionRow.sog ?? 0,
        hit: projectionRow.hit ?? 0,
        blk: projectionRow.blk ?? 0,
        uncertainty: projectionRow.uncertainty,
        scheduleGamesRemaining: weekContext?.gamesRemaining ?? null,
        scheduleOffNightsRemaining: weekContext?.offNightsRemaining ?? null,
        scheduleLabel: weekContext?.summaryLabel ?? null,
      },
      mode as TopAddsMode,
    );
  }, [
    mode,
    ownershipContext,
    playerId,
    projectionRow,
    teamMeta?.abbrev,
    weekContext,
  ]);
  const playerDetailReturnHref = useMemo(
    () =>
      Number.isFinite(playerId)
        ? buildForgeHref(`/forge/player/${playerId}`, {
            date,
            mode,
            resolvedDate: asOfDate ?? routeResolvedDate,
          })
        : null,
    [asOfDate, date, mode, playerId, routeResolvedDate],
  );

  const upcomingGames = useMemo(() => {
    const now = new Date(date);
    return scheduleGames
      .filter((game) => new Date(game.gameDate) >= now)
      .slice(0, mode === "week" ? 5 : 3);
  }, [date, mode, scheduleGames]);

  return (
    <>
      <Head>
        <title>
          {projectionRow?.player_name
            ? `${projectionRow.player_name} | FORGE Player Detail`
            : "FORGE Player Detail"}
        </title>
        <meta
          name="description"
          content="Projection and ownership-focused FORGE player detail page for opportunity-card drill-ins."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.shell}>
            <header className={styles.routePageHeader}>
              <div className={styles.routePageIntro}>
                <p className={styles.routePageEyebrow}>Player Detail</p>
                <h1 className={styles.routePageTitle}>
                  {projectionRow?.player_name ?? `Player ${playerId}`}
                </h1>
                <p className={styles.routePageSubtitle}>
                  Opportunity cards route here so the user gets projection,
                  ownership, and weekly team context without being dropped
                  straight into the trends stack.
                </p>
              </div>
              <div className={styles.routePageNavStack}>
                <ForgeRouteNav
                  current="playerDetail"
                  teamHref={
                    teamMeta
                      ? buildForgeHref(`/forge/team/${teamMeta.abbrev}`, {
                          date,
                          resolvedDate: asOfDate ?? routeResolvedDate,
                          mode,
                        })
                      : null
                  }
                  playerHref={
                    Number.isFinite(playerId)
                      ? buildForgeHref(`/forge/player/${playerId}`, {
                          date,
                          mode,
                          resolvedDate: asOfDate ?? routeResolvedDate,
                        })
                      : null
                  }
                  date={date}
                  mode={mode}
                  resolvedDate={asOfDate ?? routeResolvedDate}
                />
                <div className={styles.routePageMeta}>
                  <span className={styles.contextChip}>
                    {mode === "week" ? "This Week" : "Tonight"} •{" "}
                    {asOfDate ?? date}
                  </span>
                  <span className={styles.contextChip}>
                    Schedule season: {scheduleSeasonId ?? "unavailable"}
                  </span>
                  <Link
                    href={buildForgeHref("/forge/dashboard", {
                      date,
                      resolvedDate: asOfDate ?? routeResolvedDate,
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
                <p className={styles.panelState}>Loading player detail...</p>
              </section>
            ) : null}

            {!loading && error ? (
              <section className={styles.sectionBand}>
                <p className={styles.panelState}>Error: {error}</p>
              </section>
            ) : null}

            {!loading && !error && projectionRow ? (
              <>
                <section className={styles.sectionBand}>
                  <div className={styles.bandHeader}>
                    <div className={styles.bandIntro}>
                      <p className={styles.bandEyebrow}>Opportunity Snapshot</p>
                      <h2 className={styles.bandTitle}>
                        Projection and Ownership
                      </h2>
                    </div>
                  </div>
                  {detailMessages.length > 0 ? (
                    <div className={styles.bandStatusStack}>
                      {detailMessages.map((message) => (
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
                      <span className={styles.previewSubheading}>
                        Projection
                      </span>
                      <strong>{formatMetric(projectionRow.pts)} pts</strong>
                      <span>PPP {formatMetric(projectionRow.ppp)}</span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>Volume</span>
                      <strong>SOG {formatMetric(projectionRow.sog)}</strong>
                      <span>
                        Hits+Blk{" "}
                        {formatMetric(
                          (projectionRow.hit ?? 0) + (projectionRow.blk ?? 0),
                        )}
                      </span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>
                        Ownership
                      </span>
                      <strong>
                        {ownershipContext?.ownership == null
                          ? "--"
                          : `${ownershipContext.ownership.toFixed(0)}%`}
                      </strong>
                      <span>
                        5D {formatSigned(ownershipContext?.delta)} pts
                      </span>
                    </article>
                    <article className={styles.detailMetricCard}>
                      <span className={styles.previewSubheading}>
                        Add Model Score
                      </span>
                      <strong>{formatMetric(opportunityScore?.total)}</strong>
                      <span>
                        Risk {formatMetric(opportunityScore?.riskPenaltyScore)}
                      </span>
                    </article>
                  </div>
                </section>

                <section className={styles.sectionBand}>
                  <div className={styles.bandHeader}>
                    <div className={styles.bandIntro}>
                      <p className={styles.bandEyebrow}>Team Context</p>
                      <h2 className={styles.bandTitle}>Upcoming Schedule</h2>
                    </div>
                  </div>
                  {scheduleSeasonId === null ? (
                    <p className={styles.panelState}>
                      {SCHEDULE_SEASON_UNAVAILABLE_COPY}
                    </p>
                  ) : scheduleLoading ? (
                    <p className={styles.panelState}>
                      Loading team schedule...
                    </p>
                  ) : scheduleError ? (
                    <p className={styles.panelState}>
                      Schedule error: {scheduleError}
                    </p>
                  ) : (
                    <div className={styles.previewColumns}>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>
                          Player Context
                        </p>
                        <div className={styles.previewList}>
                          <div className={styles.previewRowStatic}>
                            <strong>
                              {teamMeta &&
                              projectionRow.teamIdentity?.source.name ===
                                projectionRow.team_name
                                ? projectionRow.teamIdentity.source.name
                                : (projectionRow.team_name ??
                                  teamMeta?.name ??
                                  "--")}
                            </strong>
                            <span>
                              {projectionRow.position ?? "--"} •{" "}
                              {mode === "week"
                                ? "Weekly stream mode"
                                : "Single-slate mode"}
                              {mode === "week" && weekContext?.summaryLabel
                                ? ` • ${weekContext.summaryLabel}`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>Next Games</p>
                        <div className={styles.previewList}>
                          {upcomingGames.map((game) => {
                            const isHome = scheduleTeam
                              ? game.homeTeam.id === scheduleTeam.id
                              : game.homeTeam.abbrev === teamMeta?.abbrev;
                            const opponent = isHome
                              ? game.awayTeam.abbrev
                              : game.homeTeam.abbrev;
                            return (
                              <div
                                key={game.id}
                                className={styles.previewRowStatic}
                              >
                                <strong>
                                  {isHome ? `vs ${opponent}` : `@ ${opponent}`}
                                </strong>
                                <span>{game.gameDate}</span>
                              </div>
                            );
                          })}
                          {upcomingGames.length === 0 ? (
                            <p className={styles.panelState}>
                              No upcoming games available.
                            </p>
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
                      <h2 className={styles.bandTitle}>Open the Deep Views</h2>
                    </div>
                  </div>
                  <div className={styles.previewActions}>
                    <Link
                      href={buildForgeHref(`/trends/player/${playerId}`, {
                        date,
                        origin: "forge-player-detail",
                        returnTo: playerDetailReturnHref,
                      })}
                      className={styles.slateActionLink}
                    >
                      Trends Player Page
                    </Link>
                    {teamMeta ? (
                      <Link
                        href={buildForgeHref(`/forge/team/${teamMeta.abbrev}`, {
                          date,
                          mode,
                          resolvedDate: asOfDate ?? routeResolvedDate,
                        })}
                        className={styles.slateActionLink}
                      >
                        Team Detail
                      </Link>
                    ) : null}
                    <Link
                      href={buildForgeHref("/forge/dashboard", {
                        date,
                        mode,
                        resolvedDate: asOfDate ?? routeResolvedDate,
                      })}
                      className={styles.slateActionLink}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href={buildForgeHref("/start-chart", {
                        date,
                        mode,
                        resolvedDate: asOfDate ?? routeResolvedDate,
                      })}
                      className={styles.slateActionLink}
                    >
                      Start Chart
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

export const getServerSideProps: GetServerSideProps<
  ForgePlayerDetailPageProps
> = async ({ query }) => {
  const date = parseForgeDateParam(query.date, getTodayEt());

  try {
    const season = await getLatestStartedSeasonForDate(date);
    return {
      props: {
        scheduleSeasonId: season === null ? null : String(season.id),
      },
    };
  } catch {
    console.warn("Forge player detail schedule season lookup failed.");
    return {
      props: {
        scheduleSeasonId: null,
      },
    };
  }
};

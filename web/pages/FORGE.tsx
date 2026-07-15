import Link from "next/link";
import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import ForgeRouteNav from "components/forge-dashboard/ForgeRouteNav";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import { buildForgeHref, parseForgeDateParam } from "lib/dashboard/forgeLinks";
import {
  normalizeStartChartResponse,
  normalizeSustainabilityResponse,
} from "lib/dashboard/normalizers";
import {
  rankTopAddsCandidates,
  type TopAddsCandidateInput,
} from "lib/dashboard/topAddsRanking";
import { teamsInfo } from "lib/teamsInfo";
import { evaluateMixedEffectiveDates } from "lib/dashboard/freshness";
import { deriveYahooSeason } from "lib/dashboard/playerOwnership";
import styles from "styles/ForgeDashboard.module.scss";

type ForgePlayersResponse = {
  asOfDate: string | null;
  modelMetadata?: {
    modelVersion: string | null;
    scenarioCount: number | null;
    calibrationHints: {
      sourceDate: string | null;
      sampleCount30d: number | null;
      pointsMae30d: number | null;
      pointsIntervalHitRate: number | null;
    } | null;
  };
  disclosures?: string[];
  degradedProjectionSummary?: {
    note: string | null;
  } | null;
  data: Array<{
    player_id: number;
    player_name: string | null;
    team_name: string | null;
    position: string | null;
    pts: number;
    ppp: number;
    sog: number;
    hit: number;
    blk: number;
    uncertainty: number | null;
    degradedProjectionContext?: TopAddsCandidateInput["degradedProjectionContext"];
    confidenceDrivers?: TopAddsCandidateInput["confidenceDrivers"];
  }>;
};

type OwnershipTrendRow = {
  playerId: number | null;
  name: string;
  latest: number;
  delta: number;
  teamAbbrev?: string | null;
  teamFullName?: string | null;
  headshot?: string | null;
};

type OwnershipTrendsResponse = {
  success: boolean;
  risers: OwnershipTrendRow[];
  fallers: OwnershipTrendRow[];
};

type PreviewPanelMessage = {
  tone: "warning" | "notice";
  text: string;
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

function resolveTeamAbbr(
  teamAbbrev: string | null | undefined,
  teamName: string | null | undefined,
): string | null {
  if (teamAbbrev && teamAbbrev.trim().length > 0) {
    return teamAbbrev.trim().toUpperCase();
  }

  const normalizedName = (teamName ?? "").trim().toLowerCase();
  const match = Object.values(teamsInfo).find(
    (team) => team.name.toLowerCase() === normalizedName,
  );
  return match?.abbrev ?? null;
}

function formatSigned(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function formatConfidenceDrivers(
  drivers: TopAddsCandidateInput["confidenceDrivers"],
): string {
  if (!drivers) return "Confidence inputs unavailable";
  const role = [drivers.role.evenStrength, drivers.role.unitTier]
    .filter(Boolean)
    .join("/");
  const ppShare =
    drivers.powerPlay.allocatedShare != null
      ? `${(drivers.powerPlay.allocatedShare * 100).toFixed(0)}% PP share`
      : "PP share unavailable";
  const matchup =
    drivers.matchup.opponentStarterCertainty != null
      ? `${(drivers.matchup.opponentStarterCertainty * 100).toFixed(0)}% goalie certainty`
      : "goalie matchup uncertain";
  const rest =
    drivers.rest.teamRestDays != null
      ? `${drivers.rest.teamRestDays}d rest`
      : "rest unavailable";
  return `${role || "Role unavailable"} • ${ppShare} • ${matchup} • ${rest}`;
}

function withPreviewTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Preview request timed out."));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((timeoutError: unknown) => {
        window.clearTimeout(timeoutId);
        reject(timeoutError);
      });
  });
}

const ForgeLandingPage: NextPage = () => {
  const router = useRouter();
  const todayEt = useMemo(() => getTodayEt(), []);
  const date = useMemo(
    () => parseForgeDateParam(router.query.date, todayEt),
    [router.query.date, todayEt],
  );
  const [slateDateUsed, setSlateDateUsed] = useState<string | null>(null);
  const [previewDates, setPreviewDates] = useState<Record<string, string | null>>({});
  const [slateGames, setSlateGames] = useState<
    Array<ReturnType<typeof normalizeStartChartResponse>["games"][number]>
  >([]);
  const [topAdds, setTopAdds] = useState<
    Array<TopAddsCandidateInput & { score: { total: number } }>
  >([]);
  const [sustainablePreview, setSustainablePreview] = useState<
    Array<{
      playerId: number;
      playerName: string | null;
      score: number;
      pressure: number;
    }>
  >([]);
  const [riskPreview, setRiskPreview] = useState<
    Array<{
      playerId: number;
      playerName: string | null;
      score: number;
      pressure: number;
    }>
  >([]);
  const [slatePreviewMessage, setSlatePreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [addsPreviewMessage, setAddsPreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [sustainabilityPreviewMessage, setSustainabilityPreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectionTrust, setProjectionTrust] = useState<{
    modelVersion: string | null;
    scenarioCount: number | null;
    calibrationHints: ForgePlayersResponse["modelMetadata"] extends infer T
      ? T extends { calibrationHints: infer H }
        ? H
        : null
      : null;
    disclosures: string[];
  } | null>(null);
  const mixedDateAudit = useMemo(
    () =>
      evaluateMixedEffectiveDates([
        { source: "slate", label: "Slate", date: previewDates.slate },
        { source: "top-adds", label: "Top Adds", date: previewDates.topAdds },
        { source: "trust", label: "Trust preview", date: previewDates.trust },
        { source: "fade", label: "Fade preview", date: previewDates.fade }
      ]),
    [previewDates]
  );

  useEffect(() => {
    if (!router.isReady) return;

    let active = true;
    setLoading(true);
    setError(null);
    setSlatePreviewMessage(null);
    setAddsPreviewMessage(null);
    setSustainabilityPreviewMessage(null);
    setProjectionTrust(null);
    setPreviewDates({});

    Promise.allSettled([
      withPreviewTimeout(
        fetchCachedJson<unknown>(
          `/api/v1/start-chart?date=${encodeURIComponent(date)}`,
          {
            ttlMs: 60_000,
          },
        ),
      ),
      withPreviewTimeout(
        fetchCachedJson<ForgePlayersResponse>(
          `/api/v1/forge/players?date=${encodeURIComponent(date)}&horizon=1`,
          { ttlMs: 60_000 },
        ),
      ),
      withPreviewTimeout(
        fetchCachedJson<OwnershipTrendsResponse>(
          `/api/v1/transactions/ownership-trends?window=5&limit=40&season=${deriveYahooSeason(date)}`,
          { ttlMs: 60_000 },
        ),
      ),
      withPreviewTimeout(
        fetchCachedJson<unknown>(
          `/api/v1/sustainability/trends?snapshot_date=${encodeURIComponent(date)}&window_code=l10&pos=all&direction=cold&limit=3`,
          { ttlMs: 90_000 },
        ),
      ),
      withPreviewTimeout(
        fetchCachedJson<unknown>(
          `/api/v1/sustainability/trends?snapshot_date=${encodeURIComponent(date)}&window_code=l10&pos=all&direction=hot&limit=3`,
          { ttlMs: 90_000 },
        ),
      ),
    ])
      .then((results) => {
        if (!active) return;

        const [
          slateResult,
          playersResult,
          ownershipResult,
          sustainableResult,
          riskResult,
        ] = results;

        let availablePreviewCount = 0;
        const nextPreviewDates: Record<string, string | null> = {};

        if (playersResult.status === "fulfilled") {
          nextPreviewDates.topAdds = playersResult.value.asOfDate;
          setProjectionTrust({
            modelVersion:
              playersResult.value.modelMetadata?.modelVersion ?? null,
            scenarioCount:
              playersResult.value.modelMetadata?.scenarioCount ?? null,
            calibrationHints:
              playersResult.value.modelMetadata?.calibrationHints ?? null,
            disclosures: playersResult.value.disclosures ?? [],
          });
        }

        if (slateResult.status === "fulfilled") {
          const slate = normalizeStartChartResponse(slateResult.value);
          setSlateDateUsed(slate.dateUsed);
          nextPreviewDates.slate = slate.dateUsed;
          setSlateGames(slate.games.slice(0, 3));
          if (slate.games.length > 0) {
            availablePreviewCount += 1;
          }
          if (slate.dateUsed && slate.dateUsed !== date) {
            setSlatePreviewMessage({
              tone: "warning",
              text: `Using latest available slate from ${slate.dateUsed}.`,
            });
          }
        } else {
          setSlateDateUsed(null);
          setSlateGames([]);
          setSlatePreviewMessage({
            tone: "notice",
            text: "Game preview unavailable. Open goalie starts for a live retry.",
          });
        }

        if (
          playersResult.status === "fulfilled" &&
          ownershipResult.status === "fulfilled"
        ) {
          const playersPayload = playersResult.value;
          const ownershipPayload = ownershipResult.value;
          const ownershipRows = [
            ...(ownershipPayload?.risers ?? []),
            ...(ownershipPayload?.fallers ?? []),
          ];
          const ownershipById = new Map<number, OwnershipTrendRow>();
          ownershipRows.forEach((row) => {
            if (row.playerId != null) {
              ownershipById.set(row.playerId, row);
            }
          });

          const previewCandidates: TopAddsCandidateInput[] = (
            playersPayload?.data ?? []
          ).flatMap((row) => {
            const ownershipRow = ownershipById.get(row.player_id);
            if (!ownershipRow) return [];
            if (ownershipRow.latest < 25 || ownershipRow.latest > 75) return [];

            return [
              {
                playerId: row.player_id,
                name: row.player_name ?? ownershipRow.name,
                team:
                  ownershipRow.teamAbbrev ??
                  ownershipRow.teamFullName ??
                  row.team_name,
                teamAbbr: resolveTeamAbbr(
                  ownershipRow.teamAbbrev ?? null,
                  row.team_name,
                ),
                position: row.position ?? null,
                headshot: ownershipRow.headshot ?? null,
                ownership: ownershipRow.latest,
                delta: ownershipRow.delta,
                projectionPts: row.pts ?? 0,
                ppp: row.ppp ?? 0,
                sog: row.sog ?? 0,
                hit: row.hit ?? 0,
                blk: row.blk ?? 0,
                uncertainty: row.uncertainty,
                degradedProjectionContext:
                  row.degradedProjectionContext ?? null,
                confidenceDrivers: row.confidenceDrivers ?? null,
                scheduleGamesRemaining: null,
                scheduleOffNightsRemaining: null,
                scheduleLabel: null,
                ownershipTimeline: [] as Array<{ date: string; value: number }>,
              } satisfies TopAddsCandidateInput,
            ];
          });

          const rankedAdds = rankTopAddsCandidates(
            previewCandidates,
            "tonight",
          ).slice(0, 3);
          setTopAdds(rankedAdds);
          if (rankedAdds.length > 0) {
            availablePreviewCount += 1;
          }
          if (playersPayload?.asOfDate && playersPayload.asOfDate !== date) {
            setAddsPreviewMessage({
              tone: "warning",
              text: `Using latest available add data from ${playersPayload.asOfDate}.`,
            });
          } else if (playersPayload?.degradedProjectionSummary?.note) {
            setAddsPreviewMessage({
              tone: "warning",
              text: playersPayload.degradedProjectionSummary.note,
            });
          } else if (rankedAdds.length === 0) {
            setAddsPreviewMessage({
              tone: "notice",
              text: "No add preview rows match the current ownership band.",
            });
          }
        } else {
          setTopAdds([]);
          setAddsPreviewMessage({
            tone: "notice",
            text: "Top Adds preview unavailable. Open the dashboard for live retry.",
          });
        }

        const sustainable =
          sustainableResult.status === "fulfilled"
            ? normalizeSustainabilityResponse(sustainableResult.value)
            : null;
        const risk =
          riskResult.status === "fulfilled"
            ? normalizeSustainabilityResponse(riskResult.value)
            : null;
        nextPreviewDates.trust = sustainable?.snapshot_date ?? null;
        nextPreviewDates.fade = risk?.snapshot_date ?? null;

        const nextSustainablePreview =
          sustainable?.rows
            .filter((row) => row.player_name)
            .slice(0, 3)
            .map((row) => ({
              playerId: row.player_id,
              playerName: row.player_name,
              score: row.s_100,
              pressure: row.luck_pressure,
            })) ?? [];
        const nextRiskPreview =
          risk?.rows
            .filter((row) => row.player_name)
            .slice(0, 3)
            .map((row) => ({
              playerId: row.player_id,
              playerName: row.player_name,
              score: row.s_100,
              pressure: row.luck_pressure,
            })) ?? [];

        setSustainablePreview(nextSustainablePreview);
        setRiskPreview(nextRiskPreview);

        if (nextSustainablePreview.length > 0 || nextRiskPreview.length > 0) {
          availablePreviewCount += 1;
        }

        const staleInsightDates = [
          sustainable?.snapshot_date,
          risk?.snapshot_date,
        ].filter((value): value is string => Boolean(value && value !== date));
        if (staleInsightDates.length > 0) {
          setSustainabilityPreviewMessage({
            tone: "warning",
            text: `Using latest available trust and fade data from ${staleInsightDates[0]}.`,
          });
        } else if (
          sustainableResult.status === "rejected" ||
          riskResult.status === "rejected"
        ) {
          setSustainabilityPreviewMessage({
            tone: "notice",
            text: "Trust and fade preview is partial. Open the dashboard for the full view.",
          });
        }

        if (availablePreviewCount === 0) {
          setError(null);
        }
        setPreviewDates(nextPreviewDates);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load FORGE landing previews.",
        );
        setSlateGames([]);
        setTopAdds([]);
        setSustainablePreview([]);
        setRiskPreview([]);
        setPreviewDates({});
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, router.isReady]);

  return (
    <>
      <Head>
        <title>FORGE | FHFHockey</title>
        <meta
          name="description"
          content="Preview plain-English fantasy hockey forecasts for tonight's games, waiver adds, and player trust calls."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.shell}>
            <header className={styles.routePageHeader}>
              <div className={styles.routePageIntro}>
                <p className={styles.routePageEyebrow}>Fantasy Forecast</p>
                <h1 className={styles.routePageTitle}>FORGE Dashboard</h1>
                <p className={styles.routePageSubtitle}>
                  Start here when you want the short version: which games
                  matter, who is worth adding, and which hot streaks deserve
                  trust.
                </p>
              </div>
              <div className={styles.routePageNavStack}>
                <ForgeRouteNav current="landing" date={date} />
                <div className={styles.routePageMeta}>
                  <span className={styles.contextChip}>
                    Games date: {slateDateUsed ?? date}
                  </span>
                  <Link
                    href={buildForgeHref("/forge/command-center", { date })}
                    className={styles.navLink}
                  >
                    Open Command Center
                  </Link>
                </div>
              </div>
            </header>

            {error ? (
              <section className={styles.sectionBand}>
                <p className={styles.panelState}>Error: {error}</p>
              </section>
            ) : null}

            {!loading && projectionTrust ? (
              <section
                className={styles.sectionBand}
                aria-label="Skater projection confidence"
              >
                <article className={styles.previewPanel}>
                  <header className={styles.panelHeader}>
                    <h2 className={styles.panelTitle}>
                      Skater Projection Confidence
                    </h2>
                    <span className={styles.panelMeta}>
                      {projectionTrust.modelVersion ??
                        "Model version unavailable"}
                    </span>
                  </header>
                  <p className={styles.panelState}>
                    {projectionTrust.scenarioCount != null
                      ? `${projectionTrust.scenarioCount} role scenarios represented.`
                      : "Scenario count unavailable."}
                    {projectionTrust.calibrationHints?.sampleCount30d != null
                      ? ` 30-day points sample: ${projectionTrust.calibrationHints.sampleCount30d}; MAE ${projectionTrust.calibrationHints.pointsMae30d?.toFixed(2) ?? "--"}.`
                      : " Calibration awaits enough matched outcomes."}
                  </p>
                  {projectionTrust.disclosures.slice(0, 2).map((note) => (
                    <p key={note} className={styles.panelState}>
                      {note}
                    </p>
                  ))}
                </article>
              </section>
            ) : null}

            {!loading && mixedDateAudit.isMixed ? (
              <p className={`${styles.panelState} ${styles.panelStateStale}`} role="status">
                {mixedDateAudit.message}
              </p>
            ) : null}

            <section
              className={styles.sectionBand}
              aria-label="FORGE landing previews"
            >
              <div className={styles.bandHeader}>
                <div className={styles.bandIntro}>
                  <p className={styles.bandEyebrow}>Quick Read</p>
                  <h2 className={styles.bandTitle}>
                    Tonight, Waivers, Trust Calls
                  </h2>
                  <p className={styles.bandSummary}>
                    Use this page for a quick scan. Open the dashboard when you
                    want filters, goalie detail, and the full player lists.
                  </p>
                </div>
              </div>

              {loading ? (
                <p className={styles.panelState}>Loading FORGE previews...</p>
              ) : null}

              {!loading && !error ? (
                <div className={styles.previewGrid}>
                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>
                        Tonight&apos;s Games
                      </h3>
                      <span className={styles.panelMeta}>
                        {slateDateUsed ?? date}
                      </span>
                    </header>
                    {slatePreviewMessage ? (
                      <p
                        className={`${styles.panelState} ${
                          slatePreviewMessage.tone === "warning"
                            ? styles.panelStateStale
                            : ""
                        }`}
                      >
                        {slatePreviewMessage.text}
                      </p>
                    ) : null}
                    <div className={styles.previewList}>
                      {slateGames.length > 0 ? (
                        slateGames.map((game) => {
                          const awayTeam =
                            Object.values(teamsInfo).find(
                              (team) => team.id === game.awayTeamId,
                            )?.abbrev ?? "AWY";
                          const homeTeam =
                            Object.values(teamsInfo).find(
                              (team) => team.id === game.homeTeamId,
                            )?.abbrev ?? "HME";
                          return (
                            <Link
                              key={game.id}
                              href={buildForgeHref("/start-chart", {
                                date,
                                resolvedDate: slateDateUsed,
                              })}
                              className={styles.previewRow}
                            >
                              <strong>
                                {awayTeam} @ {homeTeam}
                              </strong>
                              <span>
                                Away goalie likely{" "}
                                {game.awayGoalies[0]?.start_probability != null
                                  ? `${(game.awayGoalies[0].start_probability * 100).toFixed(0)}%`
                                  : "--"}{" "}
                                • Home goalie likely{" "}
                                {game.homeGoalies[0]?.start_probability != null
                                  ? `${(game.homeGoalies[0].start_probability * 100).toFixed(0)}%`
                                  : "--"}
                              </span>
                            </Link>
                          );
                        })
                      ) : (
                        <p className={styles.panelState}>
                          No slate preview available.
                        </p>
                      )}
                    </div>
                    <div className={styles.previewActions}>
                      <Link
                        href={buildForgeHref("/start-chart", {
                          date,
                          resolvedDate: slateDateUsed,
                        })}
                        className={styles.slateActionLink}
                      >
                        See Goalie Starts
                      </Link>
                    </div>
                  </article>

                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Best Waiver Adds</h3>
                      <span className={styles.panelMeta}>25% - 75% owned</span>
                    </header>
                    {addsPreviewMessage ? (
                      <p
                        className={`${styles.panelState} ${
                          addsPreviewMessage.tone === "warning"
                            ? styles.panelStateStale
                            : ""
                        }`}
                      >
                        {addsPreviewMessage.text}
                      </p>
                    ) : null}
                    <div className={styles.previewList}>
                      {topAdds.length > 0 ? (
                        topAdds.map((row) => (
                          <Link
                            key={row.playerId}
                            href={buildForgeHref(
                              `/forge/player/${row.playerId}`,
                              {
                                date,
                                mode: "tonight",
                              },
                            )}
                            className={styles.previewRow}
                          >
                            <strong>{row.name}</strong>
                            <span>
                              {row.teamAbbr ?? row.team ?? "--"} • Own{" "}
                              {row.ownership.toFixed(0)}% • 5D{" "}
                              {formatSigned(row.delta, " pts")} • Add score{" "}
                              {row.score.total.toFixed(1)}
                            </span>
                            <span>
                              {formatConfidenceDrivers(row.confidenceDrivers)}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <p className={styles.panelState}>
                          No add preview available.
                        </p>
                      )}
                    </div>
                    <div className={styles.previewActions}>
                      <Link
                        href={buildForgeHref("/forge/command-center", { date })}
                        className={styles.slateActionLink}
                      >
                        See All Adds
                      </Link>
                    </div>
                  </article>

                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Trust Or Fade</h3>
                      <span className={styles.panelMeta}>Last 10</span>
                    </header>
                    {sustainabilityPreviewMessage ? (
                      <p
                        className={`${styles.panelState} ${
                          sustainabilityPreviewMessage.tone === "warning"
                            ? styles.panelStateStale
                            : ""
                        }`}
                      >
                        {sustainabilityPreviewMessage.text}
                      </p>
                    ) : null}
                    <div className={styles.previewColumns}>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>Safer Risers</p>
                        <div className={styles.previewList}>
                          {sustainablePreview.map((row) => (
                            <Link
                              key={`stable-${row.playerId}`}
                              href={buildForgeHref(
                                `/trends/player/${row.playerId}`,
                                {
                                  date,
                                },
                              )}
                              className={styles.previewRow}
                            >
                              <strong>
                                {row.playerName ?? `Player ${row.playerId}`}
                              </strong>
                              <span>
                                Trust score {row.score.toFixed(1)} • Luck risk{" "}
                                {formatSigned(row.pressure)}
                              </span>
                            </Link>
                          ))}
                          {sustainablePreview.length === 0 ? (
                            <p className={styles.panelState}>
                              No safer risers to show yet.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>
                          Fade Candidates
                        </p>
                        <div className={styles.previewList}>
                          {riskPreview.map((row) => (
                            <Link
                              key={`risk-${row.playerId}`}
                              href={buildForgeHref(
                                `/trends/player/${row.playerId}`,
                                {
                                  date,
                                },
                              )}
                              className={styles.previewRow}
                            >
                              <strong>
                                {row.playerName ?? `Player ${row.playerId}`}
                              </strong>
                              <span>
                                Trust score {row.score.toFixed(1)} • Luck risk{" "}
                                {formatSigned(row.pressure)}
                              </span>
                            </Link>
                          ))}
                          {riskPreview.length === 0 ? (
                            <p className={styles.panelState}>
                              No fade candidates to show yet.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className={styles.previewActions}>
                      <Link
                        href={buildForgeHref("/forge/command-center", { date })}
                        className={styles.slateActionLink}
                      >
                        See Player Calls
                      </Link>
                    </div>
                  </article>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default ForgeLandingPage;

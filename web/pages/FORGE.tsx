import Link from "next/link";
import type { NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import ForgeRouteNav from "components/forge-dashboard/ForgeRouteNav";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import {
  normalizeStartChartResponse,
  normalizeSustainabilityResponse
} from "lib/dashboard/normalizers";
import {
  rankTopAddsCandidates,
  type TopAddsCandidateInput
} from "lib/dashboard/topAddsRanking";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeDashboard.module.scss";

type ForgePlayersResponse = {
  asOfDate: string | null;
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
    day: "2-digit"
  }).formatToParts(now);

  const y = parts.find((part) => part.type === "year")?.value ?? "1970";
  const m = parts.find((part) => part.type === "month")?.value ?? "01";
  const d = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveTeamAbbr(
  teamAbbrev: string | null | undefined,
  teamName: string | null | undefined
): string | null {
  if (teamAbbrev && teamAbbrev.trim().length > 0) {
    return teamAbbrev.trim().toUpperCase();
  }

  const normalizedName = (teamName ?? "").trim().toLowerCase();
  const match = Object.values(teamsInfo).find(
    (team) => team.name.toLowerCase() === normalizedName
  );
  return match?.abbrev ?? null;
}

function formatSigned(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

const ForgeLandingPage: NextPage = () => {
  const date = useMemo(() => getTodayEt(), []);
  const [slateDateUsed, setSlateDateUsed] = useState<string | null>(null);
  const [slateGames, setSlateGames] = useState<
    Array<ReturnType<typeof normalizeStartChartResponse>["games"][number]>
  >([]);
  const [topAdds, setTopAdds] = useState<Array<TopAddsCandidateInput & { score: { total: number } }>>([]);
  const [sustainablePreview, setSustainablePreview] = useState<
    Array<{ playerId: number; playerName: string | null; score: number; pressure: number }>
  >([]);
  const [riskPreview, setRiskPreview] = useState<
    Array<{ playerId: number; playerName: string | null; score: number; pressure: number }>
  >([]);
  const [slatePreviewMessage, setSlatePreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [addsPreviewMessage, setAddsPreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [sustainabilityPreviewMessage, setSustainabilityPreviewMessage] =
    useState<PreviewPanelMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSlatePreviewMessage(null);
    setAddsPreviewMessage(null);
    setSustainabilityPreviewMessage(null);

    Promise.allSettled([
      fetchCachedJson<unknown>(`/api/v1/start-chart?date=${encodeURIComponent(date)}`, {
        ttlMs: 60_000
      }),
      fetchCachedJson<ForgePlayersResponse>(
        `/api/v1/forge/players?date=${encodeURIComponent(date)}&horizon=1`,
        { ttlMs: 60_000 }
      ),
      fetchCachedJson<OwnershipTrendsResponse>(
        "/api/v1/transactions/ownership-trends?window=5&limit=40",
        { ttlMs: 60_000 }
      ),
      fetchCachedJson<unknown>(
        `/api/v1/sustainability/trends?snapshot_date=${encodeURIComponent(date)}&window_code=l10&pos=all&direction=cold&limit=3`,
        { ttlMs: 90_000 }
      ),
      fetchCachedJson<unknown>(
        `/api/v1/sustainability/trends?snapshot_date=${encodeURIComponent(date)}&window_code=l10&pos=all&direction=hot&limit=3`,
        { ttlMs: 90_000 }
      )
    ])
      .then((results) => {
        if (!active) return;

        const [
          slateResult,
          playersResult,
          ownershipResult,
          sustainableResult,
          riskResult
        ] = results;

        let availablePreviewCount = 0;

        if (slateResult.status === "fulfilled") {
          const slate = normalizeStartChartResponse(slateResult.value);
          setSlateDateUsed(slate.dateUsed);
          setSlateGames(slate.games.slice(0, 3));
          if (slate.games.length > 0) {
            availablePreviewCount += 1;
          }
          if (slate.dateUsed && slate.dateUsed !== date) {
            setSlatePreviewMessage({
              tone: "warning",
              text: `Using latest available slate from ${slate.dateUsed}.`
            });
          }
        } else {
          setSlateDateUsed(null);
          setSlateGames([]);
          setSlatePreviewMessage({
            tone: "notice",
            text: "Slate preview unavailable. Open Start Chart for a live retry."
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
            ...(ownershipPayload?.fallers ?? [])
          ];
          const ownershipById = new Map<number, OwnershipTrendRow>();
          const ownershipByName = new Map<string, OwnershipTrendRow>();
          ownershipRows.forEach((row) => {
            if (row.playerId != null) {
              ownershipById.set(row.playerId, row);
            }
            ownershipByName.set(normalizeName(row.name), row);
          });

          const previewCandidates: TopAddsCandidateInput[] = (playersPayload?.data ?? []).flatMap(
            (row) => {
              const ownershipRow =
                ownershipById.get(row.player_id) ??
                ownershipByName.get(normalizeName(row.player_name));
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
                    row.team_name
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
                  scheduleGamesRemaining: null,
                  scheduleOffNightsRemaining: null,
                  scheduleLabel: null,
                  ownershipTimeline: [] as Array<{ date: string; value: number }>
                } satisfies TopAddsCandidateInput
              ];
            }
          );

          const rankedAdds = rankTopAddsCandidates(
            previewCandidates,
            "tonight"
          ).slice(0, 3);
          setTopAdds(rankedAdds);
          if (rankedAdds.length > 0) {
            availablePreviewCount += 1;
          }
          if (playersPayload?.asOfDate && playersPayload.asOfDate !== date) {
            setAddsPreviewMessage({
              tone: "warning",
              text: `Using latest available add context from ${playersPayload.asOfDate}.`
            });
          } else if (rankedAdds.length === 0) {
            setAddsPreviewMessage({
              tone: "notice",
              text: "No add preview rows match the current ownership band."
            });
          }
        } else {
          setTopAdds([]);
          setAddsPreviewMessage({
            tone: "notice",
            text: "Top Adds preview unavailable. Open the dashboard for live retry."
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

        const nextSustainablePreview =
          sustainable?.rows.slice(0, 3).map((row) => ({
            playerId: row.player_id,
            playerName: row.player_name,
            score: row.s_100,
            pressure: row.luck_pressure
          })) ?? [];
        const nextRiskPreview =
          risk?.rows.slice(0, 3).map((row) => ({
            playerId: row.player_id,
            playerName: row.player_name,
            score: row.s_100,
            pressure: row.luck_pressure
          })) ?? [];

        setSustainablePreview(nextSustainablePreview);
        setRiskPreview(nextRiskPreview);

        if (nextSustainablePreview.length > 0 || nextRiskPreview.length > 0) {
          availablePreviewCount += 1;
        }

        const staleInsightDates = [sustainable?.snapshot_date, risk?.snapshot_date]
          .filter((value): value is string => Boolean(value && value !== date));
        if (staleInsightDates.length > 0) {
          setSustainabilityPreviewMessage({
            tone: "warning",
            text: `Using latest available sustainability snapshot from ${staleInsightDates[0]}.`
          });
        } else if (
          sustainableResult.status === "rejected" ||
          riskResult.status === "rejected"
        ) {
          setSustainabilityPreviewMessage({
            tone: "notice",
            text: "Sustainability preview is partial. Open the dashboard for the full signal view."
          });
        }

        if (availablePreviewCount === 0) {
          setError("FORGE previews are temporarily unavailable.");
        }
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load FORGE landing previews."
        );
        setSlateGames([]);
        setTopAdds([]);
        setSustainablePreview([]);
        setRiskPreview([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  return (
    <>
      <Head>
        <title>FORGE | FHFHockey</title>
        <meta
          name="description"
          content="Preview the FORGE dashboard, top adds, slate context, and sustainability signals before drilling into deeper views."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.shell}>
            <header className={styles.routePageHeader}>
              <div className={styles.routePageIntro}>
                <p className={styles.routePageEyebrow}>FORGE Landing</p>
                <h1 className={styles.routePageTitle}>FORGE</h1>
                <p className={styles.routePageSubtitle}>
                  Preview the slate, the most actionable adds, and the strongest
                  sustainability reads before you drop into the full control
                  surface.
                </p>
              </div>
              <div className={styles.routePageNavStack}>
                <ForgeRouteNav current="landing" />
                <div className={styles.routePageMeta}>
                  <span className={styles.contextChip}>Preview date: {slateDateUsed ?? date}</span>
                  <Link href="/forge/dashboard" className={styles.navLink}>
                    Open Full Dashboard
                  </Link>
                </div>
              </div>
            </header>

            {error ? (
              <section className={styles.sectionBand}>
                <p className={styles.panelState}>Error: {error}</p>
              </section>
            ) : null}

            <section className={styles.sectionBand} aria-label="FORGE landing previews">
              <div className={styles.bandHeader}>
                <div className={styles.bandIntro}>
                  <p className={styles.bandEyebrow}>Preview Grid</p>
                  <h2 className={styles.bandTitle}>Slate, Adds, Sustainability</h2>
                  <p className={styles.bandSummary}>
                    This page stays slim on purpose. It previews the live surfaces,
                    then pushes you toward the full dashboard or the deeper drill-ins.
                  </p>
                </div>
              </div>

              {loading ? <p className={styles.panelState}>Loading FORGE previews...</p> : null}

              {!loading && !error ? (
                <div className={styles.previewGrid}>
                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Slate Preview</h3>
                      <span className={styles.panelMeta}>{slateDateUsed ?? date}</span>
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
                            Object.values(teamsInfo).find((team) => team.id === game.awayTeamId)?.abbrev ??
                            "AWY";
                          const homeTeam =
                            Object.values(teamsInfo).find((team) => team.id === game.homeTeamId)?.abbrev ??
                            "HME";
                          return (
                            <Link
                              key={game.id}
                              href={`/start-chart?date=${slateDateUsed ?? date}`}
                              className={styles.previewRow}
                            >
                              <strong>{awayTeam} @ {homeTeam}</strong>
                              <span>
                                Away start {game.awayGoalies[0]?.start_probability != null
                                  ? `${(game.awayGoalies[0].start_probability * 100).toFixed(0)}%`
                                  : "--"} • Home start {game.homeGoalies[0]?.start_probability != null
                                  ? `${(game.homeGoalies[0].start_probability * 100).toFixed(0)}%`
                                  : "--"}
                              </span>
                            </Link>
                          );
                        })
                      ) : (
                        <p className={styles.panelState}>No slate preview available.</p>
                      )}
                    </div>
                    <div className={styles.previewActions}>
                      <Link href="/start-chart" className={styles.slateActionLink}>
                        Open Start Chart
                      </Link>
                    </div>
                  </article>

                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Top Player Adds</h3>
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
                            href={`/forge/player/${row.playerId}?date=${date}&mode=tonight`}
                            className={styles.previewRow}
                          >
                            <strong>{row.name}</strong>
                            <span>
                              {(row.teamAbbr ?? row.team ?? "--")} • Own {row.ownership.toFixed(0)}% •
                              5D {formatSigned(row.delta, " pts")} • Score {row.score.total.toFixed(1)}
                            </span>
                          </Link>
                        ))
                      ) : (
                        <p className={styles.panelState}>No add preview available.</p>
                      )}
                    </div>
                    <div className={styles.previewActions}>
                      <Link href="/forge/dashboard" className={styles.slateActionLink}>
                        Open Dashboard Adds
                      </Link>
                    </div>
                  </article>

                  <article className={styles.previewPanel}>
                    <header className={styles.panelHeader}>
                      <h3 className={styles.panelTitle}>Sustainability Preview</h3>
                      <span className={styles.panelMeta}>L10</span>
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
                        <p className={styles.previewSubheading}>Trustworthy</p>
                        <div className={styles.previewList}>
                          {sustainablePreview.map((row) => (
                            <Link
                              key={`stable-${row.playerId}`}
                              href={`/trends/player/${row.playerId}`}
                              className={styles.previewRow}
                            >
                              <strong>{row.playerName ?? `Player ${row.playerId}`}</strong>
                              <span>S {row.score.toFixed(1)} • Pressure {formatSigned(row.pressure)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                      <div className={styles.previewSubsection}>
                        <p className={styles.previewSubheading}>Overheated</p>
                        <div className={styles.previewList}>
                          {riskPreview.map((row) => (
                            <Link
                              key={`risk-${row.playerId}`}
                              href={`/trends/player/${row.playerId}`}
                              className={styles.previewRow}
                            >
                              <strong>{row.playerName ?? `Player ${row.playerId}`}</strong>
                              <span>S {row.score.toFixed(1)} • Pressure {formatSigned(row.pressure)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={styles.previewActions}>
                      <Link href="/forge/dashboard" className={styles.slateActionLink}>
                        Open Dashboard Insight
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { addDays, format } from "date-fns";
import { useRouter } from "next/router";
import supabase from "lib/supabase/client";
import {
  PlayerInfoRow,
  PlayerPredictionDatum,
  SkoMetricRow,
  SkoPredictionRow,
  SparklinePoint,
  MetricSummary,
  PlayerSearchResult
} from "lib/trends/skoTypes";
import {
  buildSparklinePath,
  formatNumber,
  formatPercent,
  lookupTeamLabel,
  formatIsoDate
} from "lib/trends/skoUtils";
import styles from "./index.module.scss";

const MAX_PLAYERS = 30;
const SPARKLINE_WINDOW_DAYS = 45;
const SEARCH_MIN_LENGTH = 2;

type StepForwardResponse = {
  success: boolean;
  asOfDate?: string;
  message?: string;
  error?: string;
  logs?: string;
};

function Sparkline({ data }: { data: SparklinePoint[] }) {
  const paths = useMemo(() => buildSparklinePath(data), [data]);

  if (!paths) {
    return <div className={styles.placeholder}>—</div>;
  }

  return (
    <svg
      className={styles.sparklineSvg}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline
        className={styles.sparklineBaseline}
        points={`0,${paths.baselineY} 100,${paths.baselineY}`}
      />
      <polygon className={styles.sparklineShade} points={paths.area} />
      <polyline className={styles.sparklinePath} points={paths.line} />
    </svg>
  );
}

export default function TrendsIndexPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [latestRunDate, setLatestRunDate] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string | null>(null);
  const [stepping, setStepping] = useState(false);
  const [players, setPlayers] = useState<PlayerPredictionDatum[]>([]);
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchData = useCallback(
    async (targetDate?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        let resolvedDate = targetDate ?? null;
        let knownLatest = latestRunDate;

        if (!knownLatest) {
          const { data: latestRows, error: latestErr } = await supabase
            .from("predictions_sko")
            .select("as_of_date")
            .order("as_of_date", { ascending: false })
            .limit(1);
          if (latestErr) throw latestErr;
          knownLatest = latestRows?.[0]?.as_of_date ?? null;
          setLatestRunDate(knownLatest);
        }

        if (!resolvedDate) {
          resolvedDate = knownLatest;
        }

        if (!resolvedDate) {
          setAsOfDate(null);
          setPlayers([]);
          setMetrics([]);
          setLatestRunDate(knownLatest);
          return;
        }

        setAsOfDate(resolvedDate);

        const { data: predictionRows, error: predictionErr } = await supabase
          .from("predictions_sko")
          .select(
            "player_id, sko, pred_points, pred_points_per_game, stability_multiplier, as_of_date"
          )
          .eq("as_of_date", resolvedDate)
          .order("sko", { ascending: false })
          .limit(MAX_PLAYERS);

        if (predictionErr) throw predictionErr;
        const predictions = (predictionRows ?? []) as SkoPredictionRow[];
        const playerIds = Array.from(
          new Set(predictions.map((row) => row.player_id))
        ).filter(Boolean);

        let playerInfo: Record<number, PlayerInfoRow> = {};
        if (playerIds.length) {
          const { data: playerRows, error: playerErr } = await supabase
            .from("players")
            .select("id, fullName, position, team_id")
            .in("id", playerIds)
            .limit(playerIds.length);
          if (playerErr) throw playerErr;
          playerInfo = Object.fromEntries(
            ((playerRows ?? []) as PlayerInfoRow[]).map((row) => [
              Number(row.id),
              row
            ])
          );
        }

        let sparklineMap: Record<number, SparklinePoint[]> = {};
        if (playerIds.length) {
          const cutoffDate = new Date(resolvedDate);
          cutoffDate.setDate(cutoffDate.getDate() - SPARKLINE_WINDOW_DAYS);
          const cutoffIso = cutoffDate.toISOString().slice(0, 10);

          const { data: sparkRows, error: sparkErr } = await supabase
            .from("predictions_sko")
            .select("player_id, as_of_date, sko")
            .in("player_id", playerIds)
            .gte("as_of_date", cutoffIso)
            .order("player_id", { ascending: true })
            .order("as_of_date", { ascending: true });
          if (sparkErr) throw sparkErr;

          sparklineMap = (sparkRows ?? []).reduce<
            Record<number, SparklinePoint[]>
          >((acc, row: any) => {
            const pid = Number(row.player_id);
            if (!acc[pid]) acc[pid] = [];
            acc[pid].push({
              date: row.as_of_date,
              value:
                row.sko === null || row.sko === undefined ? null : Number(row.sko)
            });
            if (acc[pid].length > 24) {
              acc[pid] = acc[pid].slice(acc[pid].length - 24);
            }
            return acc;
          }, {});
        }

        const playerPredictions: PlayerPredictionDatum[] = predictions.map(
          (row) => {
            const info = playerInfo[row.player_id];
            const teamLabel = info?.team_id ? lookupTeamLabel(info.team_id) : null;
            return {
              playerId: row.player_id,
              playerName: info?.fullName ?? `Player #${row.player_id}`,
              position: info?.position ?? null,
              team: teamLabel,
              sko: row.sko ?? null,
              predPoints: row.pred_points ?? null,
              stability: row.stability_multiplier ?? null,
              asOfDate: row.as_of_date,
              sparkline: sparklineMap[row.player_id] ?? []
            };
          }
        );

        const { data: metricRows, error: metricErr } = await supabase
          .from("predictions_sko_metrics")
          .select(
            "stat_key, model_name, sample_size, mae, mape, rmse, margin_of_error, hit_rate_within_moe, created_at, run_id, horizon_games"
          )
          .order("created_at", { ascending: false })
          .limit(64);
        if (metricErr) throw metricErr;

        const latestRunId = metricRows?.[0]?.run_id ?? null;
        const summaries = (metricRows ?? [])
          .filter((row: any) =>
            !latestRunId ? true : row.run_id === latestRunId
          )
          .reduce<Record<string, MetricSummary>>((acc, row) => {
            const metric = row as SkoMetricRow;
            if (!acc[metric.stat_key]) {
              acc[metric.stat_key] = {
                statKey: metric.stat_key,
                mae: metric.mae,
                mape: metric.mape,
                hitRate: metric.hit_rate_within_moe,
                marginOfError: metric.margin_of_error,
                sampleSize: metric.sample_size,
                modelName: metric.model_name
              };
            }
            return acc;
          }, {});

        setMetrics(
          Object.values(summaries).sort((a, b) =>
            a.statKey.localeCompare(b.statKey)
          )
        );
        setPlayers(playerPredictions);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("Trends fetch error", err);
        setError(err?.message ?? "Failed to load sKO data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [latestRunDate]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(asOfDate);
  }, [asOfDate, fetchData]);

  const handleStepForward = useCallback(async () => {
    if (!asOfDate) return;
    const nextDate = addDays(new Date(asOfDate), 1);
    const nextIso = nextDate.toISOString().slice(0, 10);
    setStepping(true);
    setStepStatus(null);
    try {
      const response = await fetch("/api/trends/sko/step-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: asOfDate, endDate: nextIso })
      });
      const payload = (await response.json()) as StepForwardResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Step forward failed");
      }
      const resolved = payload.asOfDate ?? nextIso;
      const baseMessage =
        payload.message ?? `Stepped forward to ${formatIsoDate(resolved)}`;
      const finalMessage = payload.logs
        ? (() => {
            const tail = payload.logs
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(-1)[0];
            return tail ? `${baseMessage} · ${tail}` : baseMessage;
          })()
        : baseMessage;
      setStepStatus(finalMessage);
      await fetchData(resolved);
    } catch (err: any) {
      const message = err?.message ?? "Unable to step forward";
      setError(message);
      setStepStatus(message);
    } finally {
      setStepping(false);
    }
  }, [asOfDate, fetchData]);

  const executeSearch = useCallback(
    async (query: string) => {
      if (query.length < SEARCH_MIN_LENGTH) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const { data, error: searchErr } = await supabase
          .from("players")
          .select("id, fullName, position, team_id")
          .ilike("fullName", `%${query}%`)
          .order("fullName", { ascending: true })
          .limit(20);
        if (searchErr) throw searchErr;
        const results = ((data ?? []) as PlayerSearchResult[]).map((row) => ({
          ...row,
          fullName: row.fullName ?? `Player #${row.id}`
        }));
        setSearchResults(results);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("Player search error", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);
      setShowResults(true);
      executeSearch(value.trim());
    },
    [executeSearch]
  );

  const handlePlayerSelect = useCallback(
    (player: PlayerSearchResult) => {
      setShowResults(false);
      setSearchTerm("");
      setSearchResults([]);
      const params = new URLSearchParams();
      if (player.fullName) params.set("name", player.fullName);
      router.push(`/trends/player/${player.id}?${params.toString()}`);
    },
    [router]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const latestMetrics = useMemo(() => metrics, [metrics]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            Trends — Sustainability K-Value Outlook
          </h1>
          <p className={styles.subtitle}>
            Expected production blended with recent steadiness. Higher sKO
            values reflect both strong projection and stability over the past
            few weeks. Hover for more detail and use the sparkline to see
            trajectory.
          </p>
        </div>
        <div className={styles.metaBlock}>
          <span className={styles.asOf}>
            {latestRunDate
              ? `Latest run: ${format(new Date(latestRunDate), "MMM d, yyyy")}`
              : ""}
          </span>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchContainer} ref={searchContainerRef}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search skaters…"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setShowResults(true)}
          />
          {showResults ? (
            <div className={styles.searchResults}>
              {searching ? (
                <div className={styles.emptyResult}>Searching…</div>
              ) : searchTerm.length < SEARCH_MIN_LENGTH ? (
                <div className={styles.emptyResult}>
                  Type at least {SEARCH_MIN_LENGTH} letters
                </div>
              ) : searchResults.length ? (
                searchResults.map((player) => (
                  <div
                    key={player.id}
                    className={styles.searchResultItem}
                    onClick={() => handlePlayerSelect(player)}
                  >
                    <span>{player.fullName}</span>
                    <span>
                      {[lookupTeamLabel(player.team_id) ?? "", player.position ?? ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyResult}>No skaters found.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.stepper}>
          <span className={styles.stepperLabel}>Viewing</span>
          <span className={styles.stepperDate}>
            {asOfDate ? format(new Date(asOfDate), "MMM d, yyyy") : "—"}
          </span>
          <button
            type="button"
            className={styles.stepperButton}
            onClick={handleStepForward}
            disabled={!asOfDate || stepping}
          >
            {stepping ? "Running…" : "Step +1 day"}
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {stepStatus ? <div className={styles.tableActions}>{stepStatus}</div> : null}

      {latestMetrics.length ? (
        <div className={styles.metrics}>
          {latestMetrics.map((metric) => (
            <div key={metric.statKey} className={styles.metricCard}>
              <div className={styles.metricTitle}>
                {metric.statKey.toUpperCase()}
              </div>
              <div className={styles.metricValue}>
                {formatNumber(metric.mae, 2)} MAE
              </div>
              <div className={styles.metricDetail}>
                {formatPercent(metric.hitRate)} inside MoE · MoE ±
                {formatNumber(metric.marginOfError, 2)}
              </div>
              <div className={styles.metricDetail}>
                MAPE {formatNumber(metric.mape, 1)}% · {metric.sampleSize}{" "}
                samples
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading latest sKO projections…</div>
        ) : !players.length ? (
          <div className={styles.placeholder}>
            No predictions available yet.
          </div>
        ) : (
          <table className={styles.playerTable}>
            <thead>
              <tr>
                <th>Player</th>
                <th>sKO</th>
                <th>Projected Pts</th>
                <th>Stability ×</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={player.playerId}
                  className={styles.clickableRow}
                  onClick={() =>
                    router.push(
                      `/trends/player/${player.playerId}?name=${encodeURIComponent(
                        player.playerName
                      )}`
                    )
                  }
                >
                  <td className={styles.playerCell}>
                    <span className={styles.playerName}>
                      {player.playerName}
                    </span>
                    <span className={styles.playerMeta}>
                      {[player.team ?? "", player.position ?? ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td>{formatNumber(player.sko, 1)}</td>
                  <td>{formatNumber(player.predPoints, 1)}</td>
                  <td>{formatNumber(player.stability, 2)}</td>
                  <td className={styles.sparklineCell}>
                    <Sparkline data={player.sparkline} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

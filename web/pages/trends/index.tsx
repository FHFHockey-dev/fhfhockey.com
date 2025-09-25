import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useRouter } from "next/router";
import supabase from "lib/supabase/client";
import {
  SkoMetricRow,
  MetricSummary,
  PlayerSearchResult
} from "lib/trends/skoTypes";
import { formatIsoDate } from "lib/trends/skoUtils";
import styles from "./index.module.scss";
import PredictionsHeader from "components/Predictions/PredictionsHeader";
import MetricCards from "components/Predictions/MetricCards";
import SearchBox from "components/Predictions/SearchBox";
import Stepper from "components/Predictions/Stepper";
import PredictionsLeaderboard from "components/Predictions/PredictionsLeaderboard";
import SkoExplainer from "components/Predictions/SkoExplainer";
import InfoPopover from "components/Predictions/InfoPopover";

const MAX_PLAYERS = 30; // passed to leaderboard component

type StepForwardResponse = {
  success: boolean;
  asOfDate?: string;
  message?: string;
  error?: string;
  logs?: string;
};

export default function TrendsIndexPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [latestRunDate, setLatestRunDate] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string | null>(null);
  const [stepping, setStepping] = useState(false);
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // no-op

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
          setMetrics([]);
          setLatestRunDate(knownLatest);
          return;
        }

        setAsOfDate(resolvedDate);

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
      const tailLog = payload.logs
        ? payload.logs
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(-1)[0]
        : null;

      if (!response.ok || !payload.success) {
        const message = payload.error || "Step forward failed";
        const finalMessage = tailLog ? `${message} · ${tailLog}` : message;
        setError(message);
        setStepStatus(finalMessage);
        return;
      }

      const resolved = payload.asOfDate ?? nextIso;
      const baseMessage =
        payload.message ?? `Stepped forward to ${formatIsoDate(resolved)}`;
      const finalMessage = tailLog
        ? `${baseMessage} · ${tailLog}`
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

  const handlePlayerSelect = useCallback(
    (player: PlayerSearchResult) => {
      const params = new URLSearchParams();
      if (player.fullName) params.set("name", player.fullName);
      router.push(`/trends/player/${player.id}?${params.toString()}`);
    },
    [router]
  );

  const latestMetrics = useMemo(() => metrics, [metrics]);

  return (
    <div className={styles.page}>
      <PredictionsHeader
        latestRunDate={latestRunDate}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      <div className={styles.controls}>
        <SearchBox onSelect={handlePlayerSelect} />

        <Stepper
          dateLabel={asOfDate ? format(new Date(asOfDate), "MMM d, yyyy") : "—"}
          onStep={handleStepForward}
          disabled={!asOfDate || stepping}
          busy={stepping}
        />

        <InfoPopover />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {stepStatus ? (
        <div className={styles.tableActions}>{stepStatus}</div>
      ) : null}

      <SkoExplainer />

      <MetricCards metrics={latestMetrics} />

      <PredictionsLeaderboard asOfDate={asOfDate} limit={MAX_PLAYERS} />
    </div>
  );
}

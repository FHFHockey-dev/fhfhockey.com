import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePredictionsSko,
  type PredictionRow
} from "lib/hooks/usePredictionsSko";
import supabase from "lib/supabase/client";
import type {
  PlayerInfoRow,
  PlayerPredictionDatum,
  SparklinePoint
} from "lib/trends/skoTypes";
import { lookupTeamLabel } from "lib/trends/skoUtils";
import PlayerTable from "./PlayerTable";
import styles from "./Predictions.module.scss";
import { format } from "date-fns";

type Props = {
  baseDate: string | null;
  limit?: number; // initial page size
  sparklineDays?: number;
  forecastValue?: number;
};

export default function PredictionsLeaderboard({
  baseDate,
  limit = 30,
  sparklineDays = 60,
  forecastValue = 1
}: Props) {
  const [rowLimit, setRowLimit] = useState(limit);

  useEffect(() => {
    setRowLimit(limit);
  }, [limit]);
  // Headline rows for a single date
  const {
    data: rows,
    loading,
    error
  } = usePredictionsSko({
    baseAsOfDate: baseDate ?? undefined,
    limit: rowLimit,
    order: "desc",
    statKey: "points",
    forecastScope: "day",
    forecastValue
  });

  const playerIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.player_id))).filter(Boolean),
    [rows]
  );

  // Player info (names/teams/positions)
  const [playerInfo, setPlayerInfo] = useState<Record<number, PlayerInfoRow>>(
    {}
  );
  useEffect(() => {
    let active = true;
    (async () => {
      if (!playerIds.length) {
        if (active) setPlayerInfo({});
        return;
      }
      const { data, error: playerErr } = await supabase
        .from("players")
        .select("id, fullName, position, team_id")
        .in("id", playerIds)
        .limit(playerIds.length);
      if (!active) return;
      if (playerErr) {
        // eslint-disable-next-line no-console
        console.error("PredictionsLeaderboard player info error", playerErr);
        setPlayerInfo({});
        return;
      }
      const map = Object.fromEntries(
        ((data ?? []) as PlayerInfoRow[]).map((row) => [Number(row.id), row])
      );
      setPlayerInfo(map);
    })();
    return () => {
      active = false;
    };
  }, [playerIds.join(",")]);

  // Sparkline window
  const forecastDate = useMemo(() => {
    if (rows.length) return rows[0].as_of_date;
    if (!baseDate) return undefined;
    const d = new Date(baseDate);
    d.setDate(d.getDate() + forecastValue);
    return d.toISOString().slice(0, 10);
  }, [rows, baseDate, forecastValue]);

  const cutoffIso = useMemo(() => {
    if (!forecastDate) return undefined;
    const d = new Date(forecastDate);
    d.setDate(d.getDate() - sparklineDays);
    return d.toISOString().slice(0, 10);
  }, [forecastDate, sparklineDays]);

  const enableSpark = !!forecastDate && playerIds.length > 0;
  const { data: sparkRows } = usePredictionsSko(
    enableSpark
      ? {
          since: cutoffIso,
          until: forecastDate ?? undefined,
          statKey: "points",
          forecastScope: "day",
          forecastValue,
          playerIds: playerIds.length ? playerIds : undefined,
          order: "asc",
          limit: 2000
        }
      : {}
  );
  const previousSparkMap = useRef<Record<number, SparklinePoint[]>>({});
  const sparklineMap = useMemo(() => {
    if (!enableSpark) return previousSparkMap.current;
    if (!sparkRows.length) return previousSparkMap.current; // preserve last non-empty
    const acc: Record<number, SparklinePoint[]> = {};
    // Group rows by player->date, then pick the 'best' (sko present else highest pred_points)
    const byPlayerDate: Record<string, PredictionRow[]> = {};
    for (const r of sparkRows) {
      const key = `${r.player_id}|${r.as_of_date}`;
      if (!byPlayerDate[key]) byPlayerDate[key] = [];
      byPlayerDate[key].push(r as PredictionRow);
    }
    for (const key of Object.keys(byPlayerDate)) {
      const [pidStr, date] = key.split("|");
      const pid = Number(pidStr);
      const rowsForDay = byPlayerDate[key];
      // Prefer a row with non-null sko. If multiple, take the one with latest created_at.
      let chosen = rowsForDay
        .filter((r) => r.sko != null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .pop();
      if (!chosen) {
        // fallback: highest pred_points
        chosen = rowsForDay
          .filter((r) => r.pred_points != null)
          .sort((a, b) => (a.pred_points ?? 0) - (b.pred_points ?? 0))
          .pop();
      }
      if (!chosen) chosen = rowsForDay[0];
      if (!acc[pid]) acc[pid] = [];

      const value =
        chosen.pred_mean ?? chosen.pred_points ?? chosen.sko ?? null;
      const low = chosen.pred_low ?? null;
      const high = chosen.pred_high ?? null;
      acc[pid].push({ date, value, low, high });
      if (acc[pid].length > 45) acc[pid] = acc[pid].slice(acc[pid].length - 45);
    }
    // Dev debug: log one example player's sparkline to inspect variability
    if (process.env.NODE_ENV === "development") {
      const firstPid = Object.keys(acc)[0];
      if (firstPid) {
        // eslint-disable-next-line no-console
        console.log("[sparkline-debug] pid", firstPid, acc[Number(firstPid)]);
      }
      // Additional summary for first few players to inspect variability
      const summaries = Object.entries(acc)
        .slice(0, 5)
        .map(([pid, arr]) => {
          const values = arr
            .map((p) => p.value)
            .filter((v): v is number => v != null && !Number.isNaN(v));
          if (!values.length) {
            return { pid, n: arr.length, empty: true };
          }
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min;
          const uniq = new Set(values.map((v) => v.toFixed(4))).size;
          return { pid, n: arr.length, min, max, range, uniq };
        });
      // eslint-disable-next-line no-console
      console.log("[sparkline-summary]", summaries);
    }
    previousSparkMap.current = acc;
    return acc;
  }, [sparkRows, enableSpark]);

  const tableData: PlayerPredictionDatum[] = useMemo(() => {
    return rows.map((row: PredictionRow) => {
      const info = playerInfo[row.player_id];
      const teamLabel = info?.team_id ? lookupTeamLabel(info.team_id) : null;
      return {
        playerId: row.player_id,
        playerName: info?.fullName ?? `Player #${row.player_id}`,
        position: info?.position ?? null,
        team: teamLabel,
        sko: row.sko ?? null,
        predPoints: row.pred_mean ?? row.pred_points ?? null,
        stability: row.stability_multiplier ?? null,
        asOfDate: row.as_of_date,
        sparkline: sparklineMap[row.player_id] ?? [],
        predLow: row.pred_low ?? null,
        predHigh: row.pred_high ?? null
      };
    });
  }, [rows, playerInfo, sparklineMap]);

  const canLoadMore = rows.length >= rowLimit; // if we filled the page, allow asking for more

  const handleLoadMore = () => {
    // If user clicks repeatedly we grow by the initial limit chunk.
    // Provide a hard ceiling safeguard (e.g., 1000) to avoid accidental runaway.
    setRowLimit((prev) => Math.min(1000, prev + limit));
  };

  if (error) return <div className={styles.error}>{error}</div>;
  if (loading && !rows.length)
    return (
      <div className={styles.loading}>Loading latest sKO projections…</div>
    );
  if (!rows.length)
    return (
      <div className={styles.placeholder}>No predictions available yet.</div>
    );

  const headlineDate = forecastDate
    ? format(new Date(forecastDate), "MMM d, yyyy")
    : null;
  const baseLabel = baseDate ? format(new Date(baseDate), "MMM d, yyyy") : null;

  return (
    <div className={styles.tableWrapper}>
      <div className={styles.tableHeader}>
        <div>
          <h2 className={styles.tableTitle}>
            {headlineDate ? `Top Outlook · ${headlineDate}` : "Top Outlook"}
          </h2>
          <p className={styles.tableSubtitle}>
            {baseLabel
              ? `Simulated on ${baseLabel} · Forecast day +${forecastValue}`
              : `Forecast day +${forecastValue}`}
          </p>
        </div>
      </div>
      <PlayerTable players={tableData} />
      <div className={styles.tableFooter}>
        {canLoadMore ? (
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={handleLoadMore}
          >
            Load more players
          </button>
        ) : null}
        {rowLimit < 1000 && rows.length > 15 ? (
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={() => setRowLimit(1000)}
          >
            Show all
          </button>
        ) : null}
      </div>
    </div>
  );
}

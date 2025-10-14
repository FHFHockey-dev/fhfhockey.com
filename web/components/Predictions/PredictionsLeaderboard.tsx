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

type Props = {
  asOfDate: string | null;
  limit?: number;
  sparklineDays?: number;
};

export default function PredictionsLeaderboard({
  asOfDate,
  limit = 30,
  sparklineDays = 45
}: Props) {
  // Headline rows for a single date
  const {
    data: rows,
    loading,
    error
  } = usePredictionsSko({
    asOfDate: asOfDate ?? undefined,
    limit,
    order: "desc"
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
  const cutoffIso = useMemo(() => {
    if (!asOfDate) return undefined;
    const d = new Date(asOfDate);
    d.setDate(d.getDate() - sparklineDays);
    return d.toISOString().slice(0, 10);
  }, [asOfDate, sparklineDays]);

  const enableSpark = !!asOfDate && playerIds.length > 0;
  const { data: sparkRows } = usePredictionsSko(
    enableSpark
      ? {
          since: cutoffIso,
          until: asOfDate ?? undefined,
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

      // Derive value (same fallback logic)
      let value: number | null = null;
      if (chosen.sko != null && !Number.isNaN(chosen.sko)) {
        value = Number(chosen.sko);
      } else if (
        chosen.pred_points != null &&
        chosen.stability_multiplier != null &&
        !Number.isNaN(chosen.pred_points) &&
        !Number.isNaN(chosen.stability_multiplier)
      ) {
        value =
          Number(chosen.pred_points) * Number(chosen.stability_multiplier);
      } else if (
        chosen.pred_points != null &&
        !Number.isNaN(chosen.pred_points)
      ) {
        value = Number(chosen.pred_points);
      }
      acc[pid].push({ date, value });
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
        predPoints: row.pred_points ?? null,
        stability: row.stability_multiplier ?? null,
        asOfDate: row.as_of_date,
        sparkline: sparklineMap[row.player_id] ?? []
      };
    });
  }, [rows, playerInfo, sparklineMap]);

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // no-op; adding retryKey to dependency list of hooks above would trigger refetch if needed
  }, [retryKey]);

  if (error)
    return (
      <div className={styles.errorWrapper}>
        <div className={styles.errorMessage}>
          <strong>Unable to load projections</strong>
          <div className={styles.errorDetail}>{error}</div>
        </div>
        <div className={styles.errorActions}>
          <button
            onClick={() => {
              // bumping retryKey will cause parent callers using usePredictionsSko to re-run (they observe query string changes)
              setRetryKey((k) => k + 1);
              // naive retry by reloading the page-level API endpoint
              fetch(`/api/v1/ml/get-predictions-sko?limit=${limit}`).catch(
                () => {}
              );
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (loading && !rows.length)
    return (
      <div className={styles.loading}>Loading latest sKO projections…</div>
    );
  if (!rows.length)
    return (
      <div className={styles.placeholder}>No predictions available yet.</div>
    );

  return (
    <div className={styles.tableWrapper}>
      <PlayerTable players={tableData} />
    </div>
  );
}

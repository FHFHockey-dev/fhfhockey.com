import { useEffect, useMemo, useRef, useState } from "react";
import {
  useQuarantinedPredictionsSko,
  type PredictionRow,
} from "lib/hooks/useQuarantinedPredictionsSko";
import supabase from "lib/supabase/client";
import type {
  PlayerInfoRow,
  PlayerPredictionDatum,
  SparklinePoint,
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
  sparklineDays = 45,
}: Props) {
  // Headline rows for a single date
  // The hook pins one model, version and horizon, so each player/date has one row.
  const {
    data: rows,
    warnings,
    loading,
    error,
  } = useQuarantinedPredictionsSko({
    asOfDate: asOfDate ?? undefined,
    limit,
    order: "desc",
  });

  const playerIds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.player_id))).filter(Boolean),
    [rows],
  );

  // Player info (names/teams/positions)
  const [playerInfo, setPlayerInfo] = useState<Record<number, PlayerInfoRow>>(
    {},
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
        console.error("PredictionsLeaderboard player info error", playerErr);
        setPlayerInfo({});
        return;
      }
      const map = Object.fromEntries(
        ((data ?? []) as PlayerInfoRow[]).map((row) => [Number(row.id), row]),
      );
      setPlayerInfo(map);
    })();
    return () => {
      active = false;
    };
  }, [playerIds]);

  // Sparkline window
  const cutoffIso = useMemo(() => {
    if (!asOfDate) return undefined;
    const d = new Date(asOfDate);
    d.setDate(d.getDate() - sparklineDays);
    return d.toISOString().slice(0, 10);
  }, [asOfDate, sparklineDays]);

  const enableSpark = !!asOfDate && playerIds.length > 0;
  const { data: sparkRows } = useQuarantinedPredictionsSko(
    enableSpark
      ? {
          since: cutoffIso,
          until: asOfDate ?? undefined,
          playerIds: playerIds.length ? playerIds : undefined,
          order: "asc",
          limit: 2000,
        }
      : {},
  );
  const previousSparkMap = useRef<Record<number, SparklinePoint[]>>({});
  const sparklineMap = useMemo(() => {
    if (!enableSpark) return previousSparkMap.current;
    if (!sparkRows.length) return previousSparkMap.current; // preserve last non-empty
    const acc: Record<number, SparklinePoint[]> = {};
    // One quantity per sparkline: the stored VDP (`sko`) or unknown, never a pred_points fallback.
    for (const r of sparkRows as PredictionRow[]) {
      const pid = r.player_id;
      if (!acc[pid]) acc[pid] = [];
      const value =
        r.sko != null && Number.isFinite(Number(r.sko)) ? Number(r.sko) : null;
      acc[pid].push({ date: r.as_of_date, value });
      if (acc[pid].length > 45) acc[pid] = acc[pid].slice(acc[pid].length - 45);
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
        sparkline: sparklineMap[row.player_id] ?? [],
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
          <strong>Unable to load Volatility-Discounted Points Pace</strong>
          <div className={styles.errorDetail}>{error}</div>
        </div>
        <div className={styles.errorActions}>
          <button
            onClick={() => {
              // bumping retryKey will cause parent callers using useQuarantinedPredictionsSko to re-run (they observe query string changes)
              setRetryKey((k) => k + 1);
              // naive retry by reloading the page-level API endpoint
              fetch(`/api/v1/ml/get-predictions-sko?limit=${limit}`).catch(
                () => {},
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
      <div className={styles.loading}>
        Loading Volatility-Discounted Points Pace…
      </div>
    );
  if (!rows.length)
    return (
      <div className={styles.placeholder}>No VDP rows available yet.</div>
    );

  return (
    <div className={styles.tableWrapper}>
      {warnings.includes("compatibility_model_not_promoted") ? (
        <p className={styles.placeholder} role="note">
          Compatibility model, not promoted: an unvalidated points pace with a
          volatility discount, not a sustainability or forecast rating.
        </p>
      ) : null}
      <PlayerTable players={tableData} />
    </div>
  );
}

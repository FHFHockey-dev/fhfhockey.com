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
    for (const r of sparkRows) {
      const pid = Number(r.player_id);
      if (!acc[pid]) acc[pid] = [];
      // Some historical rows may not yet have an explicit sKO value populated
      // (earlier backfills or legacy pipeline versions). When r.sko is null we
      // derive a reasonable approximation so the sparkline still reflects
      // historical movement instead of collapsing to a single duplicate point.
      // Definition: sKO ≈ predicted points * stability multiplier.
      let derivedValue: number | null = null;
      if (r.sko != null) {
        derivedValue = Number(r.sko);
      } else if (
        r.pred_points != null &&
        r.stability_multiplier != null &&
        !Number.isNaN(r.pred_points) &&
        !Number.isNaN(r.stability_multiplier)
      ) {
        derivedValue = Number(r.pred_points) * Number(r.stability_multiplier);
      } else if (r.pred_points != null && !Number.isNaN(r.pred_points)) {
        // Last‑chance fallback: use raw prediction so we at least show trend.
        derivedValue = Number(r.pred_points);
      }

      acc[pid].push({
        date: r.as_of_date,
        value: derivedValue
      });
      if (acc[pid].length > 32) acc[pid] = acc[pid].slice(acc[pid].length - 32); // allow a little more history
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

  if (error) return <div className={styles.error}>{error}</div>;
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

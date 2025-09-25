import { useEffect, useMemo, useState } from "react";
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

  const { data: sparkRows } = usePredictionsSko({
    since: cutoffIso,
    until: asOfDate ?? undefined,
    playerIds: playerIds.length ? playerIds : undefined,
    order: "asc",
    limit: 2000 // ample cap for window
  });

  const sparklineMap = useMemo(() => {
    const acc: Record<number, SparklinePoint[]> = {};
    for (const r of sparkRows) {
      const pid = Number(r.player_id);
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push({
        date: r.as_of_date,
        value: r.sko === null ? null : Number(r.sko)
      });
      if (acc[pid].length > 24) acc[pid] = acc[pid].slice(acc[pid].length - 24);
    }
    return acc;
  }, [sparkRows]);

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

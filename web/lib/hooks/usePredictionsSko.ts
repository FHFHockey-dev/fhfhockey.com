import { useEffect, useMemo, useState } from "react";

export interface PredictionRow {
  player_id: number;
  as_of_date: string;
  horizon_games: number;
  pred_points: number | null;
  pred_points_per_game: number | null;
  stability_cv: number | null;
  stability_multiplier: number | null;
  sko: number | null;
  top_features: any | null;
  created_at: string;
}

type Options = {
  asOfDate?: string;
  since?: string;
  until?: string;
  horizon?: number;
  playerIds?: number[];
  order?: "asc" | "desc";
  limit?: number;
};

export function usePredictionsSko(opts: Options = {}) {
  const [data, setData] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (opts.asOfDate) p.set("asOfDate", opts.asOfDate);
    if (opts.since) p.set("since", opts.since);
    if (opts.until) p.set("until", opts.until);
    if (opts.horizon) p.set("horizon", String(opts.horizon));
    if (opts.limit) p.set("limit", String(opts.limit));
    if (opts.order) p.set("order", opts.order);
    if (opts.playerIds?.length) p.set("playerIds", opts.playerIds.join(","));
    return p.toString();
  }, [
    opts.asOfDate,
    opts.since,
    opts.until,
    opts.horizon,
    opts.limit,
    opts.order,
    opts.playerIds?.join(",")
  ]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = "/api/v1/ml/get-predictions-sko" + (qs ? `?${qs}` : "");
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setData((json?.rows ?? []) as PredictionRow[]);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [qs]);

  return { data, loading, error };
}

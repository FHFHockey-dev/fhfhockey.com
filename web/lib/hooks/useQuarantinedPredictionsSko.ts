import { useEffect, useMemo, useState } from "react";
import { VOLATILITY_DISCOUNTED_PACE } from "lib/predictions/legacyQuarantine";

export interface PredictionRow {
  player_id: number;
  as_of_date: string;
  horizon_games: number;
  pred_points: number | null;
  pred_points_per_game: number | null;
  /** Stored name of a population SD; read `stability_sd`. */
  stability_cv: number | null;
  /** Population SD of points per appearance over the stability window (null for unknown versions). */
  stability_sd: number | null;
  stability_multiplier: number | null;
  /** Volatility-Discounted Points Pace (decision 80), not sKO. */
  sko: number | null;
  top_features: any | null;
  model_name: string;
  model_version: string;
  created_at: string;
  updated_at: string;
}

type Options = {
  asOfDate?: string;
  since?: string;
  until?: string;
  /** Player appearances; defaults to the current VDP horizon so one series is never mixed. */
  horizon?: number;
  modelName?: string;
  modelVersion?: string;
  playerIds?: number[];
  order?: "asc" | "desc";
  limit?: number;
};

/** Always selects one model, version and horizon (W3-7 D2/D10: no mixed series). */
export function buildPredictionsSkoQuery(opts: Options = {}): string {
  const p = new URLSearchParams();
  if (opts.asOfDate) p.set("asOfDate", opts.asOfDate);
  if (opts.since) p.set("since", opts.since);
  if (opts.until) p.set("until", opts.until);
  p.set(
    "horizon",
    String(opts.horizon ?? VOLATILITY_DISCOUNTED_PACE.defaultHorizonAppearances),
  );
  p.set("modelName", opts.modelName ?? VOLATILITY_DISCOUNTED_PACE.modelName);
  p.set(
    "modelVersion",
    opts.modelVersion ?? VOLATILITY_DISCOUNTED_PACE.modelVersion,
  );
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.order) p.set("order", opts.order);
  if (opts.playerIds?.length) p.set("playerIds", opts.playerIds.join(","));
  return p.toString();
}

/** Keeps the API's warnings (e.g. `compatibility_model_not_promoted`) with the rows. */
export function readPredictionsSkoPayload(json: any): {
  rows: PredictionRow[];
  warnings: string[];
} {
  return {
    rows: (json?.rows ?? []) as PredictionRow[],
    warnings: Array.isArray(json?.sourceWarnings)
      ? json.sourceWarnings.filter(
          (warning: unknown): warning is string => typeof warning === "string",
        )
      : [],
  };
}

export function useQuarantinedPredictionsSko(opts: Options = {}) {
  const [data, setData] = useState<PredictionRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(
    () =>
      buildPredictionsSkoQuery({
        asOfDate: opts.asOfDate,
        since: opts.since,
        until: opts.until,
        horizon: opts.horizon,
        modelName: opts.modelName,
        modelVersion: opts.modelVersion,
        limit: opts.limit,
        order: opts.order,
        playerIds: opts.playerIds,
      }),
    [
      opts.asOfDate,
      opts.since,
      opts.until,
      opts.horizon,
      opts.modelName,
      opts.modelVersion,
      opts.limit,
      opts.order,
      opts.playerIds,
    ],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = "/api/v1/ml/get-predictions-sko" + (qs ? `?${qs}` : "");
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = readPredictionsSkoPayload(await res.json());
        if (!active) return;
        setData(payload.rows);
        setWarnings(payload.warnings);
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

  return { data, warnings, loading, error };
}

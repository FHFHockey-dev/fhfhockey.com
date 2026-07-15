import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "lib/supabase/database-generated.types";

const MAX_PREDICTION_ROWS = 600;
const MAX_MARKET_ROWS = 2400;
const MAX_PULSE_POINTS = 64;
const PULSE_BUCKET_MS = 15 * 60 * 1000;

export type HomepagePulsePoint = {
  timestamp: string;
  value: number;
};

export type HomepagePulsePrediction = {
  game_id: number;
  snapshot_date: string;
  computed_at: string;
  prediction_cutoff_at: string;
  home_win_probability: number;
  metadata: Json;
  components: Json;
};

export type HomepagePulseMarketSnapshot = {
  game_id: number;
  game_date: string;
  captured_at: string;
  event_start_at: string | null;
  home_market_no_vig_probability: number | null;
};

type PulseObservation = {
  timestamp: string;
  value: number;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || typeof value === "boolean" || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonRecord(value: Json): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function embeddedMarketEdge(row: HomepagePulsePrediction): number | null {
  const metadata = jsonRecord(row.metadata);
  const components = jsonRecord(row.components);
  const edge = finiteNumber(
    metadata?.model_vs_market_edge ?? components?.model_vs_market_edge,
  );

  return edge == null ? null : Math.abs(edge);
}

export function selectHomepagePulseSlateDates(
  rows: HomepagePulsePrediction[],
  currentDate: string,
): string[] {
  const availableDates = Array.from(
    new Set(
      rows
        .map((row) => row.snapshot_date)
        .filter((date) => date && date <= currentDate),
    ),
  ).sort((left, right) => right.localeCompare(left));

  if (availableDates.includes(currentDate)) return [currentDate];
  return availableDates.slice(0, 2);
}

function bucketObservations(
  observations: PulseObservation[],
): HomepagePulsePoint[] {
  const buckets = new Map<number, number>();

  for (const observation of observations) {
    const timestampMs = Date.parse(observation.timestamp);
    if (!Number.isFinite(timestampMs) || !Number.isFinite(observation.value)) {
      continue;
    }

    const bucket = Math.floor(timestampMs / PULSE_BUCKET_MS) * PULSE_BUCKET_MS;
    buckets.set(bucket, Math.max(buckets.get(bucket) ?? 0, observation.value));
  }

  const points = Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, value]) => ({
      timestamp: new Date(timestamp).toISOString(),
      value,
    }));

  if (points.length <= MAX_PULSE_POINTS) return points;

  const lastIndex = points.length - 1;
  return Array.from({ length: MAX_PULSE_POINTS }, (_, index) =>
    points[Math.round((index * lastIndex) / (MAX_PULSE_POINTS - 1))],
  );
}

function buildSnapshotEdgeObservations(args: {
  predictions: HomepagePulsePrediction[];
  marketSnapshots: HomepagePulseMarketSnapshot[];
}): PulseObservation[] {
  const predictionsByGame = new Map<number, HomepagePulsePrediction[]>();
  for (const prediction of args.predictions) {
    const gamePredictions = predictionsByGame.get(prediction.game_id) ?? [];
    gamePredictions.push(prediction);
    predictionsByGame.set(prediction.game_id, gamePredictions);
  }
  for (const predictions of predictionsByGame.values()) {
    predictions.sort(
      (left, right) =>
        Date.parse(left.computed_at) - Date.parse(right.computed_at),
    );
  }

  return args.marketSnapshots.flatMap((snapshot) => {
    const marketProbability = finiteNumber(
      snapshot.home_market_no_vig_probability,
    );
    const capturedAtMs = Date.parse(snapshot.captured_at);
    const eventStartMs = snapshot.event_start_at
      ? Date.parse(snapshot.event_start_at)
      : Number.POSITIVE_INFINITY;
    if (
      marketProbability == null ||
      !Number.isFinite(capturedAtMs) ||
      capturedAtMs >= eventStartMs
    ) {
      return [];
    }

    const prediction = (predictionsByGame.get(snapshot.game_id) ?? [])
      .filter((candidate) => Date.parse(candidate.computed_at) <= capturedAtMs)
      .at(-1);
    if (!prediction) return [];

    return [
      {
        timestamp: snapshot.captured_at,
        value: Math.abs(
          prediction.home_win_probability - marketProbability,
        ),
      },
    ];
  });
}

export function buildHomepagePulsePoints(args: {
  predictions: HomepagePulsePrediction[];
  marketSnapshots?: HomepagePulseMarketSnapshot[];
  currentDate: string;
}): HomepagePulsePoint[] {
  const slateDates = selectHomepagePulseSlateDates(
    args.predictions,
    args.currentDate,
  );
  const selectedDateSet = new Set(slateDates);
  const predictions = args.predictions.filter((row) =>
    selectedDateSet.has(row.snapshot_date),
  );
  const marketSnapshots = (args.marketSnapshots ?? []).filter((row) =>
    selectedDateSet.has(row.game_date),
  );

  const embeddedEdgeObservations = predictions.flatMap((prediction) => {
    const value = embeddedMarketEdge(prediction);
    return value == null
      ? []
      : [{ timestamp: prediction.computed_at, value }];
  });
  const snapshotEdgeObservations = buildSnapshotEdgeObservations({
    predictions,
    marketSnapshots,
  });
  const marketObservations = [
    ...embeddedEdgeObservations,
    ...snapshotEdgeObservations,
  ];

  if (marketObservations.length >= 2) {
    return bucketObservations(marketObservations);
  }

  // Historical rows predate market-snapshot persistence. Their changing
  // distance from 50% keeps the offseason pulse real until market capture
  // resumes, at which point the branch above takes over automatically.
  return bucketObservations(
    predictions.map((prediction) => ({
      timestamp: prediction.computed_at,
      value: Math.abs(prediction.home_win_probability - 0.5),
    })),
  );
}

export async function fetchHomepagePulse(args: {
  supabase: SupabaseClient<Database>;
  currentDate: string;
}): Promise<HomepagePulsePoint[]> {
  const predictionsResult = await args.supabase
    .from("game_prediction_history")
    .select(
      "game_id,snapshot_date,computed_at,prediction_cutoff_at,home_win_probability,metadata,components",
    )
    .eq("is_public", true)
    .eq("prediction_scope", "pregame")
    .lte("snapshot_date", args.currentDate)
    .order("snapshot_date", { ascending: false })
    .order("computed_at", { ascending: false })
    .limit(MAX_PREDICTION_ROWS);
  if (predictionsResult.error) throw predictionsResult.error;

  const predictions = (predictionsResult.data ?? []) as HomepagePulsePrediction[];
  const slateDates = selectHomepagePulseSlateDates(
    predictions,
    args.currentDate,
  );
  if (slateDates.length === 0) return [];

  const marketResult = await args.supabase
    .from("game_prediction_market_odds_snapshots")
    .select(
      "game_id,game_date,captured_at,event_start_at,home_market_no_vig_probability",
    )
    .in("game_date", slateDates)
    .not("home_market_no_vig_probability", "is", null)
    .order("captured_at", { ascending: true })
    .limit(MAX_MARKET_ROWS);
  if (marketResult.error) throw marketResult.error;

  return buildHomepagePulsePoints({
    predictions,
    marketSnapshots:
      (marketResult.data ?? []) as HomepagePulseMarketSnapshot[],
    currentDate: args.currentDate,
  });
}

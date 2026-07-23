import { NextApiRequest, NextApiResponse } from "next";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import serverReadonlyClient from "lib/supabase/serverReadonly";

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 2000;

class InvalidQueryError extends Error {}

function parseString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseIso(value: unknown, name: string): string | undefined {
  const parsedValue = parseString(value);
  if (!parsedValue) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedValue)) {
    throw new InvalidQueryError(`${name} must be a YYYY-MM-DD date.`);
  }
  const parsed = new Date(`${parsedValue}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== parsedValue
  ) {
    throw new InvalidQueryError(`${name} must be a real YYYY-MM-DD date.`);
  }
  return parsedValue;
}

function parsePositiveInt(
  value: unknown,
  name: string,
  fallback?: number,
  maximum?: number,
): number | undefined {
  const raw = parseString(value);
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    (maximum !== undefined && parsed > maximum)
  ) {
    const suffix = maximum
      ? ` between 1 and ${maximum}`
      : " a positive integer";
    throw new InvalidQueryError(`${name} must be${suffix}.`);
  }
  return parsed;
}

function parseIds(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const s = Array.isArray(value) ? value.join(",") : String(value);
  const tokens = s
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const out = tokens.map(Number);
  if (!out.length || out.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new InvalidQueryError(
      "playerId/playerIds must contain positive integer ids.",
    );
  }
  return Array.from(new Set(out));
}

function ageDaysFromToday(date: string | null): number | null {
  if (!date) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
      86_400_000,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const wallStart = Date.now();
  const hrStart = process.hrtime.bigint();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const debug = (req.query.debug ?? "").toString() === "1";
    const phase: Record<string, number> = {};
    const mark = (name: string, since?: number) => {
      const now = Date.now();
      phase[name] = now - (since ?? wallStart);
      return now;
    };
    let t = wallStart;

    const asOfDate = parseIso(req.query.asOfDate, "asOfDate");
    const since = parseIso(req.query.since, "since");
    const until = parseIso(req.query.until, "until");
    if (since && until && since > until) {
      throw new InvalidQueryError("since must be on or before until.");
    }
    const horizon = parsePositiveInt(req.query.horizon, "horizon");
    const playerIds = parseIds(req.query.playerId ?? req.query.playerIds);
    const page = parsePositiveInt(req.query.page, "page", 1, 1_000_000) ?? 1;
    const pageSize =
      parsePositiveInt(
        req.query.pageSize ?? req.query.limit,
        "pageSize/limit",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
      ) ?? DEFAULT_PAGE_SIZE;
    const orderParam = (parseString(req.query.order) ?? "desc").toLowerCase();
    if (orderParam !== "asc" && orderParam !== "desc") {
      throw new InvalidQueryError("order must be asc or desc.");
    }
    const order = orderParam as "asc" | "desc";
    mark("parsed_query", t);
    t = Date.now();

    const offset = (page - 1) * pageSize;
    const admin = serverReadonlyClient;
    mark("client_init", t);
    t = Date.now();

    let query = admin
      .from("predictions_sko")
      .select(
        "player_id, as_of_date, horizon_games, pred_points, pred_points_per_game, stability_cv, stability_multiplier, sko, top_features, model_name, model_version, created_at, updated_at",
        { count: "exact" },
      )
      .order("as_of_date", { ascending: order === "asc" })
      .order("player_id", { ascending: true })
      .order("horizon_games", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (horizon) query = query.eq("horizon_games", horizon);
    if (asOfDate) query = query.eq("as_of_date", asOfDate);
    if (since) query = query.gte("as_of_date", since);
    if (until) query = query.lte("as_of_date", until);
    if (playerIds?.length) query = query.in("player_id", playerIds);

    const queryStart = Date.now();
    const { data, error, count } = await query;
    const queryEnd = Date.now();
    phase.query_ms = queryEnd - queryStart;
    if (error) throw error;

    const totalMs = Number(
      (process.hrtime.bigint() - hrStart) / BigInt(1_000_000),
    );
    res.setHeader("X-Execution-Time-ms", String(totalMs));

    // Value-free server-side performance log.
    console.log(
      `[get-predictions-sko] success rows=${data?.length ?? 0} totalMs=${totalMs} queryMs=${phase.query_ms}`,
    );

    const rows = data ?? [];
    const total = count ?? rows.length;
    const asOfDates = rows.map((row) => row.as_of_date).sort();
    const latestUpdatedAt =
      rows
        .map((row) => row.updated_at)
        .filter((value): value is string => typeof value === "string")
        .sort()
        .at(-1) ?? null;
    const earliestAsOfDate = asOfDates[0] ?? null;
    const latestAsOfDate = asOfDates.at(-1) ?? null;
    const hasMore = offset + rows.length < total;
    const basePayload = {
      success: true,
      count: rows.length,
      rows,
      partial: rows.length < total,
      coverage: { returned: rows.length, total },
      pagination: {
        page,
        pageSize,
        total,
        hasPrevious: page > 1 && total > 0,
        hasMore,
      },
      freshness: {
        scope: "page" as const,
        earliestAsOfDate,
        latestAsOfDate,
        latestUpdatedAt,
        ageDaysFromToday: ageDaysFromToday(latestAsOfDate),
      },
      durationMs: totalMs,
      queryMs: phase.query_ms,
    };
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res
      .status(200)
      .json(debug ? { ...basePayload, timings: phase } : basePayload);
  } catch (err: any) {
    if (err instanceof InvalidQueryError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    const dependencyError = normalizeDependencyError(err);
    console.error("get-predictions-sko dependency error", dependencyError);
    return res.status(500).json({
      success: false,
      code: "prediction_data_unavailable",
      error: "Prediction data is temporarily unavailable.",
    });
  }
}

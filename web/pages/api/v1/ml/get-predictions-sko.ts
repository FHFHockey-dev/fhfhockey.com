import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";

/**
 * Resolve the best available Supabase admin key.
 * Preference order:
 *  1. SUPABASE_SERVICE_ROLE_KEY
 *  2. NEXT_SUPABASE_SERVICE_ROLE_KEY (your alternate naming convention)
 *  3. SUPABASE_SERVICE_KEY (fallback legacy name if ever used)
 *  4. NEXT_PUBLIC_SUPABASE_PUBLIC_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY (last resort – NOT service role)
 *
 * We purposefully do NOT expose the full key in logs; only a short masked prefix is logged for troubleshooting.
 */
function resolveSupabaseAdminKey(): {
  key: string;
  from: string;
  serviceRole: boolean;
} {
  const candidates: Array<[string | undefined, string]> = [
    [process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"],
    [
      process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY,
      "NEXT_SUPABASE_SERVICE_ROLE_KEY"
    ],
    [process.env.SUPABASE_SERVICE_KEY, "SUPABASE_SERVICE_KEY"],
    [
      process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLIC_KEY"
    ],
    [process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  ];
  for (const [val, name] of candidates) {
    if (val && val.trim()) {
      const serviceRole = isServiceRoleJWT(val);
      return { key: val.trim(), from: name, serviceRole };
    }
  }
  throw new Error(
    "Supabase credentials missing (looked for SUPABASE_SERVICE_ROLE_KEY / NEXT_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY / NEXT_PUBLIC_SUPABASE_PUBLIC_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
  );
}

// Heuristic: decode JWT payload and see if role == 'service_role'.
function isServiceRoleJWT(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

function assertServerCredentials(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Supabase URL missing (NEXT_PUBLIC_SUPABASE_URL)");
  const { key, from, serviceRole } = resolveSupabaseAdminKey();
  if (!serviceRole) {
    // Warn server-side only (does not leak full key)
    // eslint-disable-next-line no-console
    console.warn(
      `[get-predictions-sko] Using non-service key from ${from}. Some rows may be blocked by RLS.`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[get-predictions-sko] Using service role key from ${from} (${key.slice(0, 8)}… masked)`
    );
  }
  return { url, key };
}

function parseString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

function parseIso(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function parseIntParam(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

function parseIds(value: unknown): number[] | undefined {
  if (!value) return undefined;
  const s = Array.isArray(value) ? value.join(",") : String(value);
  const out = s
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return out.length ? Array.from(new Set(out)) : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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

    const asOfDate = parseIso(parseString(req.query.asOfDate));
    const since = parseIso(parseString(req.query.since));
    const until = parseIso(parseString(req.query.until));
    const horizon = parseIntParam(req.query.horizon);
    const playerIds = parseIds(req.query.playerId ?? req.query.playerIds);
    const limit = parseIntParam(req.query.limit) ?? 500;
    const order =
      (parseString(req.query.order) ?? "desc").toLowerCase() === "asc"
        ? "asc"
        : "desc";
    mark("parsed_query", t);
    t = Date.now();

    const { url, key } = assertServerCredentials();
    const admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    mark("client_init", t);
    t = Date.now();

    let query = admin
      .from("predictions_sko")
      .select(
        "player_id, as_of_date, horizon_games, pred_points, pred_points_per_game, stability_cv, stability_multiplier, sko, top_features, created_at"
      )
      .order("as_of_date", { ascending: order === "asc" })
      .limit(limit);

    if (horizon) query = query.eq("horizon_games", horizon);
    if (asOfDate) query = query.eq("as_of_date", asOfDate);
    if (since) query = query.gte("as_of_date", since);
    if (until) query = query.lte("as_of_date", until);
    if (playerIds?.length) query = query.in("player_id", playerIds);

    const queryStart = Date.now();
    const { data, error } = await query;
    const queryEnd = Date.now();
    phase.query_ms = queryEnd - queryStart;
    if (error) throw error;

    const totalMs = Number(
      (process.hrtime.bigint() - hrStart) / BigInt(1_000_000)
    );
    res.setHeader("X-Execution-Time-ms", String(totalMs));

    // Server-side log (masked) for performance tracking
    // eslint-disable-next-line no-console
    console.log(
      `[get-predictions-sko] success rows=${data?.length ?? 0} totalMs=${totalMs} queryMs=${phase.query_ms}`
    );

    const basePayload: any = {
      success: true,
      count: data?.length ?? 0,
      rows: data ?? [],
      durationMs: totalMs,
      queryMs: phase.query_ms
    };
    if (debug) basePayload.timings = phase;
    return res.status(200).json(basePayload);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("get-predictions-sko error", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || String(err) });
  }
}

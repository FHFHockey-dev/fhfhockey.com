import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/public-client";
import { buildResolvedDataServingContract } from "lib/dashboard/freshness";
import {
  guardSustainabilityDashboardRow,
  type SustainabilityGuardrailState,
} from "lib/sustainability/guardrails";
import {
  fetchSustainabilityTrendIdentity,
  fetchSustainabilityTrendHistory,
  fetchSustainabilityTrendScores,
  type SustainabilityTrendScoreRow,
} from "lib/sustainability/trendsIdentity";

type Direction = "hot" | "cold";
type WindowCode = "l3" | "l5" | "l10" | "l20";
type Pos = "F" | "D" | "all";

const WINDOW_CODES: WindowCode[] = ["l3", "l5", "l10", "l20"];
const POS_CODES: Pos[] = ["all", "F", "D"];
const DIRECTIONS: Direction[] = ["hot", "cold"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateParam(value?: string | string[]): string {
  const candidate = typeof value === "string" ? value : value?.[0];
  if (!candidate) return todayISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : todayISO();
}

function parseEnumParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = typeof value === "string" ? value : (value?.[0] ?? "");
  return (allowed as readonly string[]).includes(candidate)
    ? (candidate as T)
    : fallback;
}

function parseLimitParam(
  value: string | string[] | undefined,
  fallback = 50,
): number {
  const candidate = typeof value === "string" ? value : value?.[0];
  const parsed = Number.parseInt(candidate ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(200, parsed));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const requestedSnapshot = parseDateParam(req.query.snapshot_date);
    const windowCode = parseEnumParam<WindowCode>(
      req.query.window_code,
      WINDOW_CODES,
      "l10",
    );
    const pos = parseEnumParam<Pos>(req.query.pos, POS_CODES, "all");
    const direction = parseEnumParam<Direction>(
      req.query.direction,
      DIRECTIONS,
      "hot",
    );
    const limit = parseLimitParam(req.query.limit, 50);

    const resolveSnapshotDate = async (): Promise<string | null> => {
      const baseQuery = (supabase as any)
        .from("sustainability_scores")
        .select("snapshot_date")
        .eq("window_code", windowCode);

      if (pos === "F" || pos === "D") {
        baseQuery.eq("position_group", pos);
      }

      const nearest = await baseQuery
        .lte("snapshot_date", requestedSnapshot)
        .order("snapshot_date", { ascending: false })
        .limit(1);

      if (nearest.error) throw nearest.error;
      const nearestSnapshot = nearest.data?.[0]?.snapshot_date ?? null;
      if (nearestSnapshot) return nearestSnapshot;

      const latest = await (supabase as any)
        .from("sustainability_scores")
        .select("snapshot_date")
        .eq("window_code", windowCode)
        .order("snapshot_date", { ascending: false })
        .limit(1);

      if (latest.error) throw latest.error;
      return latest.data?.[0]?.snapshot_date ?? null;
    };

    const snapshot = await resolveSnapshotDate();

    if (!snapshot) {
      return res.status(200).json({
        success: true,
        requested_snapshot_date: requestedSnapshot,
        snapshot_date: null,
        serving: buildResolvedDataServingContract({
          requestedDate: requestedSnapshot,
          resolvedDate: null,
          sourceLabel: "Sustainability trends",
        }),
        window_code: windowCode,
        pos,
        direction,
        limit,
        rows: [],
      });
    }

    const scores = await fetchSustainabilityTrendScores(supabase, {
      snapshotDate: snapshot,
      windowCode,
      positionGroup: pos === "F" || pos === "D" ? pos : undefined,
    });

    if (!scores || scores.length === 0) {
      return res.status(200).json({
        success: true,
        requested_snapshot_date: requestedSnapshot,
        snapshot_date: snapshot,
        serving: buildResolvedDataServingContract({
          requestedDate: requestedSnapshot,
          resolvedDate: snapshot,
          sourceLabel: "Sustainability trends",
        }),
        window_code: windowCode,
        pos,
        direction,
        limit,
        rows: [],
      });
    }

    const identityMap = await fetchSustainabilityTrendIdentity(
      supabase,
      scores,
      snapshot,
    );

    type RowOut = {
      player_id: number;
      player_name: string | null;
      position_group: string;
      position_code: string | null;
      window_code: string;
      s_100: number;
      luck_pressure: number;
      z_shp: number;
      z_oishp: number;
      z_ipp: number;
      z_ppshp: number;
      guardrail_state: SustainabilityGuardrailState;
      guardrail_warnings: string[];
      status: "ready" | "provisional";
      score_history: Array<{ snapshot_date: string; s_100: number }>;
      component_breakdown: Array<{
        metric: string;
        contrib: number;
        z_raw: number;
        z_soft: number;
        r: null;
        n: null;
      }>;
    };

    let guardrailFiltered = 0;
    const rows = (scores as SustainabilityTrendScoreRow[])
      .map((score): RowOut | null => {
        const componentsRaw = score.components ?? {};
        let components =
          typeof componentsRaw === "string"
            ? undefined
            : (componentsRaw as Record<string, any>);
        if (!components && typeof componentsRaw === "string") {
          try {
            components = JSON.parse(componentsRaw);
          } catch (parseErr) {
            console.warn("Failed to parse components JSON", parseErr);
          }
        }
        if (!components) components = {};

        const weights = components?.weights?.luck ?? {};
        const z_shp = Number(components?.z_shp ?? 0) || 0;
        const z_oishp = Number(components?.z_oishp ?? 0) || 0;
        const z_ipp = Number(components?.z_ipp ?? 0) || 0;
        const z_ppshp = Number(components?.z_ppshp ?? 0) || 0;

        const luckPressure =
          -(
            Number(weights.shp ?? 0) * z_shp +
            Number(weights.oishp ?? 0) * z_oishp +
            Number(weights.ipp ?? 0) * z_ipp +
            Number(weights.ppshp ?? 0) * z_ppshp
          ) || 0;

        const guarded = guardSustainabilityDashboardRow({
          sRaw: score.s_raw,
          s100: score.s_100,
          luckPressure,
          components,
        });
        if (guarded.state === "blocked") {
          guardrailFiltered += 1;
          return null;
        }

        const identity = identityMap.get(Number(score.player_id));

        return {
          player_id: Number(score.player_id),
          player_name: identity?.playerName ?? null,
          position_group: score.position_group,
          position_code: identity?.positionCode ?? null,
          window_code: score.window_code,
          s_100: guarded.s100,
          luck_pressure: guarded.luckPressure,
          z_shp: Number(guarded.components.z_shp ?? z_shp) || 0,
          z_oishp: Number(guarded.components.z_oishp ?? z_oishp) || 0,
          z_ipp: Number(guarded.components.z_ipp ?? z_ipp) || 0,
          z_ppshp: Number(guarded.components.z_ppshp ?? z_ppshp) || 0,
          guardrail_state: guarded.state,
          guardrail_warnings: guarded.warnings,
          status: guarded.state === "degraded" ? "provisional" : "ready",
          score_history: [],
          component_breakdown: [
            ["shp", z_shp, Number(weights.shp ?? 0)],
            ["oishp", z_oishp, Number(weights.oishp ?? 0)],
            ["ipp", z_ipp, Number(weights.ipp ?? 0)],
            ["ppshp", z_ppshp, Number(weights.ppshp ?? 0)],
          ].map(([metric, z, weight]) => ({
            metric: String(metric),
            contrib: Number(z) * Number(weight),
            z_raw: Number(z),
            z_soft: Number(z),
            r: null,
            n: null,
          })),
        };
      })
      .filter((row): row is RowOut => Boolean(row));

    rows.sort((a, b) => {
      return direction === "hot"
        ? b.luck_pressure - a.luck_pressure
        : a.luck_pressure - b.luck_pressure;
    });

    const selectedRows = rows.slice(0, limit);
    const history = await fetchSustainabilityTrendHistory(supabase, {
      playerIds: selectedRows.map((row) => row.player_id),
      windowCode,
      endDate: snapshot,
      points: 10,
    });

    return res.status(200).json({
      success: true,
      requested_snapshot_date: requestedSnapshot,
      snapshot_date: snapshot,
      serving: buildResolvedDataServingContract({
        requestedDate: requestedSnapshot,
        resolvedDate: snapshot,
        sourceLabel: "Sustainability trends",
      }),
      window_code: windowCode,
      pos,
      direction,
      limit,
      guardrail_filtered: guardrailFiltered,
      rows: selectedRows.map((row) => ({
        ...row,
        score_history: history.get(row.player_id) ?? [],
      })),
    });
  } catch (error: any) {
    console.error("trends error", error?.message || error);
    return res
      .status(500)
      .json({ success: false, message: error?.message || String(error) });
  }
}

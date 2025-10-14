import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";

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
  fallback: T
): T {
  const candidate = typeof value === "string" ? value : value?.[0] ?? "";
  return (allowed as readonly string[]).includes(candidate) ? (candidate as T) : fallback;
}

function parseLimitParam(value: string | string[] | undefined, fallback = 50): number {
  const candidate = typeof value === "string" ? value : value?.[0];
  const parsed = Number.parseInt(candidate ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(200, parsed));
}

type ScoreRow = {
  player_id: number;
  season_id: number;
  snapshot_date: string;
  position_group: string;
  window_code: string;
  s_raw: number | null;
  s_100: number | null;
  components: Record<string, any> | null;
};

type BaselineRow = {
  player_id: number;
  player_name: string | null;
  position_code: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const snapshot = parseDateParam(req.query.snapshot_date);
    const windowCode = parseEnumParam<WindowCode>(req.query.window_code, WINDOW_CODES, "l10");
    const pos = parseEnumParam<Pos>(req.query.pos, POS_CODES, "all");
    const direction = parseEnumParam<Direction>(req.query.direction, DIRECTIONS, "hot");
    const limit = parseLimitParam(req.query.limit, 50);

    let query = (supabase as any)
      .from("sustainability_scores")
      .select(
        [
          "player_id",
          "season_id",
          "snapshot_date",
          "position_group",
          "window_code",
          "s_raw",
          "s_100",
          "components"
        ].join(",")
      )
      .eq("snapshot_date", snapshot)
      .eq("window_code", windowCode);

    if (pos === "F" || pos === "D") {
      query = query.eq("position_group", pos);
    }

    const { data: scores, error: scoreError } = await query;
    if (scoreError) throw scoreError;

    if (!scores || scores.length === 0) {
      return res.status(200).json({
        success: true,
        snapshot_date: snapshot,
        window_code: windowCode,
        pos,
        direction,
        limit,
        rows: []
      });
    }

    const { data: baselineRows, error: baselineError } = await (supabase as any)
      .from("player_baselines")
      .select("player_id, player_name, position_code")
      .eq("snapshot_date", snapshot);

    if (baselineError) {
      // eslint-disable-next-line no-console
      console.error("trends baseline lookup error", baselineError);
    }

    const nameMap = new Map<number, BaselineRow>();
    for (const row of baselineRows ?? []) {
      nameMap.set(Number(row.player_id), {
        player_id: Number(row.player_id),
        player_name: row.player_name ?? null,
        position_code: row.position_code ?? null
      });
    }

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
    };

    const rows: RowOut[] = (scores as ScoreRow[]).map((score) => {
      const componentsRaw = score.components ?? {};
      let components =
        typeof componentsRaw === "string" ? undefined : (componentsRaw as Record<string, any>);
      if (!components && typeof componentsRaw === "string") {
        try {
          components = JSON.parse(componentsRaw);
        } catch (parseErr) {
          // eslint-disable-next-line no-console
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

      const meta = nameMap.get(Number(score.player_id));

      return {
        player_id: Number(score.player_id),
        player_name: meta?.player_name ?? null,
        position_group: score.position_group,
        position_code: meta?.position_code ?? null,
        window_code: score.window_code,
        s_100: Number(score.s_100 ?? 0) || 0,
        luck_pressure: Number(luckPressure.toFixed(6)),
        z_shp,
        z_oishp,
        z_ipp,
        z_ppshp
      };
    });

    rows.sort((a, b) => {
      return direction === "hot"
        ? b.luck_pressure - a.luck_pressure
        : a.luck_pressure - b.luck_pressure;
    });

    return res.status(200).json({
      success: true,
      snapshot_date: snapshot,
      window_code: windowCode,
      pos,
      direction,
      limit,
      rows: rows.slice(0, limit)
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("trends error", error?.message || error);
    return res.status(500).json({ success: false, message: error?.message || String(error) });
  }
}

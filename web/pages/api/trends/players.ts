// =============================
// /web/pages/api/trends/players.ts
// =============================

import type { NextApiRequest, NextApiResponse } from "next";
import { pearson } from "lib/trends/utils";
import type {
  CorrelationRow,
  RegressionSummary,
  PlayerSkoSnapshot,
  MetricSeries,
  MetricOption
} from "lib/trends/types";
import { METRICS_REGISTRY } from "lib/trends/types";

// NOTE: Wire to your DB here. For now we stub with in-memory mocks so the UI can render.
// Replace getLeagueSamples/getMetricSeries/getPlayerSnapshot with real SQL.

type Target = "points" | "goals" | "assists";

function seededRand(seed: number) {
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

async function getLeagueSamples(target: Target, seasons = 4) {
  const n = 600; // mock player-seasons
  const rng = seededRand(
    42 + seasons + (target === "goals" ? 7 : target === "assists" ? 13 : 0)
  );

  // Build a feature bag for ALL metrics in the registry so correlations & series align
  const features: Record<string, number[]> = {};
  METRICS_REGISTRY.forEach((m) => {
    features[m.id] = [];
  });

  // Latent drivers for realism
  const latentShotGen = Array.from({ length: n }, () => 0.5 + rng());
  const latentPlaymaking = Array.from({ length: n }, () => 0.5 + rng());
  const latentLuck = Array.from({ length: n }, () => (rng() - 0.5) * 0.4);

  // Fill some features with structure
  for (let i = 0; i < n; i++) {
    const sg = latentShotGen[i];
    const mk = latentPlaymaking[i];
    const L = latentLuck[i];

    features.shots?.push(80 + sg * 220 + rng() * 15);
    features.ixg?.push(6 + sg * 18 + rng() * 2);
    features.icf?.push(150 + sg * 280 + rng() * 20);
    features.iff?.push(120 + sg * 240 + rng() * 18);
    features.cf_pct?.push(44 + mk * 10 + (rng() - 0.5) * 2);
    features.xgf_per_60?.push(1.6 + mk * 1.4 + (rng() - 0.5) * 0.2);
    features.xga_per_60?.push(2.8 - sg * 0.6 + (rng() - 0.5) * 0.2);
    features.hdcf_per_60?.push(5 + mk * 4 + (rng() - 0.5) * 0.5);
    features.hdga_per_60?.push(5 - sg * 1.2 + (rng() - 0.5) * 0.4);
    features.on_ice_sh_pct_oi?.push(
      0.07 + 0.02 * mk + 0.015 * L + (rng() - 0.5) * 0.005
    );
    features.pdo?.push(0.98 + 0.06 * L + (rng() - 0.5) * 0.01);
    features["on_ice_shooting_pct"]?.push(
      0.07 + 0.018 * L + (rng() - 0.5) * 0.006
    );
    features.shooting_percentage?.push(0.09 + 0.06 * L + (rng() - 0.5) * 0.02);
    features.plus_minus?.push(-5 + (mk + sg - 1) * 15 + (rng() - 0.5) * 3);

    // Fill generically for any remaining metrics
    METRICS_REGISTRY.forEach((m) => {
      if (features[m.id].length <= i) {
        const base = 10 + 10 * rng();
        features[m.id].push(base + (sg + mk) * 5 + (rng() - 0.5) * 3);
      }
    });
  }

  // Build target with controllable emphasis
  const y = Array.from({ length: n }, (_, i) => {
    const shot = features.shots?.[i] ?? 0;
    const xg = features.ixg?.[i] ?? 0;
    const mk = features.cf_pct?.[i] ?? 0;
    const luckish =
      (features["on_ice_shooting_pct"]?.[i] ?? 0) * 100 +
      (features.pdo?.[i] ?? 1) * 10;
    const eps = (rng() - 0.5) * 8;
    if (target === "goals")
      return 0.06 * shot + 2.5 * xg + 0.02 * luckish + eps;
    if (target === "assists")
      return 1.5 * mk + 0.02 * shot + 0.01 * luckish + eps;
    return 0.04 * shot + 1.6 * xg + 0.9 * mk + 0.015 * luckish + eps; // points
  });

  return { target: y, features };
}

async function getMetricSeries(
  metricId: string,
  target: Target,
  seasons = 4
): Promise<MetricSeries> {
  const { target: y, features } = await getLeagueSamples(target, seasons);
  const x =
    features[metricId] || Array.from({ length: y.length }, (_, i) => i + 1);
  return {
    x,
    y,
    xLabel: metricId,
    yLabel: target,
    n: y.length
  };
}

async function getPlayerSnapshot(playerId: number): Promise<PlayerSkoSnapshot> {
  // TODO: Replace with aggregation over last N seasons and NST on-ice metrics
  return {
    player_id: playerId,
    player_name: "Sample Player",
    components: {
      skillOffense: 78,
      skillDefense: 61,
      onIceImpact: 70,
      luckInflation: 22,
      sustainability: 73
    },
    role: "Play Driver",
    deltas: {
      xG_minus_G: 3.2,
      IPP_delta: 0.04,
      onIceSH_delta: 0.01,
      PDO_delta: 0.02
    }
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | CorrelationRow[]
    | RegressionSummary
    | PlayerSkoSnapshot
    | MetricSeries
    | MetricOption[]
    | { ok: true }
    | { error: string }
  >
) {
  try {
    const { action = "correlations" } = req.query as { action?: string };

    if (action === "metrics") {
      res.status(200).json(METRICS_REGISTRY);
      return;
    }

    if (action === "correlations") {
      const target = (req.query.target as Target) || "points";
      const seasons = parseInt((req.query.seasons as string) || "4", 10);
      const source = req.query.source as string | undefined; // optional filter
      const strength = req.query.strength as string | undefined; // optional filter

      const { target: y, features } = await getLeagueSamples(target, seasons);

      const filtered = METRICS_REGISTRY.filter(
        (m) =>
          (!source || m.source === source) &&
          (!strength || m.strength === (strength as any))
      );

      const rows: CorrelationRow[] = filtered.map((m) => {
        const xs = features[m.id] || [];
        const { r, r2 } = pearson(xs, y);
        return {
          metricId: m.id,
          metricLabel: m.label,
          r: Number(r.toFixed(3)),
          r2: Number(r2.toFixed(3)),
          n: Math.min(xs.length, y.length),
          source: m.source,
          strength: m.strength,
          category: m.category,
          dimension: m.dimension
        };
      });

      rows.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
      res.status(200).json(rows);
      return;
    }

    if (action === "series") {
      const metricId = String(req.query.metricId);
      const target = (req.query.target as Target) || "points";
      const seasons = parseInt((req.query.seasons as string) || "4", 10);
      const series = await getMetricSeries(metricId, target, seasons);
      res.status(200).json(series);
      return;
    }

    if (action === "player") {
      const playerId = parseInt(req.query.playerId as string, 10);
      if (Number.isNaN(playerId)) {
        res.status(400).json({ error: "playerId is required" });
        return;
      }
      const data = await getPlayerSnapshot(playerId);
      res.status(200).json(data);
      return;
    }

    if (action === "health") {
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: `unknown action: ${action}` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "unexpected error" });
  }
}

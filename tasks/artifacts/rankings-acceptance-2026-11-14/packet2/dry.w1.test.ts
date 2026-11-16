// W1 dry build against production data: buildEntityMetricRankingRows only. No upsert, no route, no audit row.
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
process.loadEnvFile("/Users/tim/Code/fhfhockey.com/web/.env.local");
const DIR = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-acceptance-2026-11-14/packet2";
it("W1 dry build, season window", async () => {
  const { buildEntityMetricRankingRows } = await import("lib/rankings/entityMetricRankingWriter");
  const metricKeys = JSON.parse(readFileSync(DIR + "/metric-keys.json", "utf8"));
  const t0 = Date.now();
  let result: any = null, error: string | null = null;
  try {
    result = await buildEntityMetricRankingRows({
      season: 20262027, asOfDate: null, windows: ["season"] as any, position: "all", deployment: "all",
      strength: "5v5", minGp: 1, minToiSeconds: 300, teamId: null, peerGroupType: "all_skaters", metricKeys,
    } as any);
  } catch (e: any) { error = String(e?.message ?? e); }
  const ms = Date.now() - t0;
  const ids = result ? Array.from(new Set(result.rows.map((r: any) => r.entity_id))) : [];
  const missing24 = [8473419,8473533,8476891,8477493,8477845,8478424,8479324,8479336,8479346,8480068,8480813,8481014,8482074,8482169,8482667,8482691,8482715,8482742,8482806,8482874,8484180,8484185,8484428,8484984];
  const summary = { ms, error, rows: result?.rows.length ?? 0, distinctEntities: ids.length,
    snapshotDates: result ? Array.from(new Set(result.rows.map((r: any) => r.snapshot_date))) : [],
    metrics: result ? Array.from(new Set(result.rows.map((r: any) => r.metric_key))).length : 0,
    missing24Now: missing24.filter((id) => ids.includes(id)).length,
    unavailable: result?.unavailableMetrics ?? null, contexts: result?.contexts?.map((c: any) => ({ w: c.window, d: c.snapshotDate })) ?? null };
  writeFileSync(DIR + "/out/B6-w1-dry.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
});

import { counters } from "./prelude";
import { buildTrendingSurface, parseTrendingRequest } from "lib/rankings/trending";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const version = process.argv[2]; const outPath = process.argv[3];
const query = { entity: "skaters", season: "20262027", position: "all", deployment: "all", strength: "5v5",
  min_gp: "10", min_toi: "300", sort_direction: "desc", limit: "25" } as any;
async function once() {
  const r0 = counters.reads, b0 = counters.bytes, t0 = performance.now();
  const payload: any = await buildTrendingSurface(parseTrendingRequest(query));
  const ms = performance.now() - t0;
  const stable = JSON.stringify({ rows: payload.rows, meta: { ...payload.meta, generatedAt: undefined } });
  return { ms: Math.round(ms * 10) / 10, reads: counters.reads - r0, bytes: counters.bytes - b0,
    rowCount: payload.rows.length, sha256: createHash("sha256").update(stable).digest("hex"), payload };
}
(async () => {
  const utcDate = new Date().toISOString().slice(0, 10);
  const cold = await once(); const warm = await once();
  writeFileSync(outPath, JSON.stringify({ version, utcDate, cold, warm: { ...warm, payload: undefined }, warmEqualsCold: warm.sha256 === cold.sha256 }));
  console.log(version, utcDate, "cold", cold.ms, cold.reads, cold.bytes, "warm", warm.ms, warm.reads, cold.sha256.slice(0, 12), warm.sha256 === cold.sha256);
})().catch(e => { console.error(e); process.exit(1); });

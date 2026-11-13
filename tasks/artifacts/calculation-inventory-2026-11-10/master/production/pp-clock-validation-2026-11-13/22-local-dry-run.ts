// Decision 152 local dry run, step 2 (F11): run the candidate batch route (update-power-play-combinations/index.ts
// with its [gameId].ts writer, unchanged) with dryRun=true&concurrency=1 over the inputs exported by
// 21-export-dry-run-inputs.py. The route's Supabase client is a fake that answers only from those CSV files, so
// nothing here can reach a database or a provider. Batches run in order; results go to
// OUT/dry-run.unchecked.json in the refresh runner's format (23-reconcile-local-dry-run.py checks and seals it).
// Build (from the repository root), then run:
//   NODE_PATH=web/node_modules web/node_modules/.bin/esbuild <this file> --bundle --platform=node --format=esm \
//     --tsconfig=web/tsconfig.json --loader:.scss=empty --log-level=warning \
//     --alias:utils/adminOnlyMiddleware=<dir>/22-local-dry-run.stubs.ts --alias:lib/cron/withCronJobAudit=<dir>/22-local-dry-run.stubs.ts \
//     --alias:lib/cron/nhlOffSeason=<dir>/22-local-dry-run.stubs.ts --outfile=$S/local-dry-run.mjs
//   node $S/local-dry-run.mjs <export dir> <out dir> <candidate sha>
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import batchHandler from "../../../../../../web/pages/api/v1/db/update-power-play-combinations/index";

const [exportDir, outDir, candidate] = process.argv.slice(2);

// psql CSV: header row, quoted fields with "" escapes, empty = NULL.
function parseCsv(text: string): Array<Record<string, string | null>> {
  const rows: string[][] = [];
  let field = "", row: string[] = [], quoted = false, wasQuoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') { quoted = true; wasQuoted = true; }
    else if (ch === ",") { row.push(wasQuoted || field !== "" ? field : "\u0000"); field = ""; wasQuoted = false; }
    else if (ch === "\n") { row.push(wasQuoted || field !== "" ? field : "\u0000"); rows.push(row); row = []; field = ""; wasQuoted = false; }
    else field += ch;
  }
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] === "\u0000" ? null : cells[i]])));
}

const TEXT_COLUMNS = new Set(["date", "period_type", "time_in_period", "time_remaining", "situation_code", "type_desc_key",
  "penalty_type_code", "penalty_desc_key", "position_code", "powerPlayToi", "powerPlay"]);
const typed = (row: Record<string, string | null>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? null : TEXT_COLUMNS.has(k) ? v : Number(v)]));

function fakeClient(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      if (!(table in tables)) throw new Error(`The local dry run has no export for table ${table}`);
      let rows = tables[table];
      const orders: Array<[string, boolean]> = [];
      const sorted = () => orders.length === 0 ? rows : [...rows].sort((a, b) => {
        for (const [col, asc] of orders) {
          if (a[col] === b[col]) continue;
          if (a[col] == null) return 1;
          if (b[col] == null) return -1;
          return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1);
        }
        return 0;
      });
      const result = (data: any) => Promise.resolve({ data, error: null });
      const builder: any = {
        select: () => builder,
        eq: (col: string, value: any) => { rows = rows.filter((r) => r[col] === value); return builder; },
        in: (col: string, values: any[]) => { rows = rows.filter((r) => values.includes(r[col])); return builder; },
        order: (col: string, opts?: { ascending?: boolean }) => { orders.push([col, opts?.ascending !== false]); return builder; },
        limit: (n: number) => { rows = sorted().slice(0, n); orders.length = 0; return builder; },
        range: (from: number, to: number) => result(sorted().slice(from, to + 1)),
        maybeSingle: () => result(sorted()[0] ?? null),
        throwOnError: () => result(sorted()),
        then: (resolve: any, reject: any) => result(sorted()).then(resolve, reject)
      };
      return builder;
    },
    rpc() {
      throw new Error("The local dry run never writes");
    }
  };
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(exportDir, "export-manifest.json"), "utf8"));
  const calls: any[] = [];
  for (const entry of manifest.batches) {
    const folder = join(exportDir, `batch-${String(entry.batch).padStart(2, "0")}`);
    const tables: Record<string, any[]> = {};
    for (const file of readdirSync(folder).filter((f) => f.endsWith(".csv"))) {
      tables[file.replace(/\.csv$/, "")] = parseCsv(readFileSync(join(folder, file), "utf8")).map(typed);
    }
    // The export selected type_code = 517 only, so every exported shift row is one.
    tables.nhl_api_shift_rows = tables.nhl_api_shift_rows.map((row) => ({ ...row, type_code: 517 }));
    let status = 200, body: any = null;
    const res: any = {
      status(code: number) { status = code; return res; },
      json(payload: any) { body = payload; return res; },
      setHeader() { return res; }
    };
    const started = performance.now();
    await batchHandler({ method: "GET", url: "/api/v1/db/update-power-play-combinations",
      query: { gameIds: entry.gameIds.join(","), dryRun: "true", concurrency: "1" },
      supabase: fakeClient(tables) } as any, res);
    const elapsedS = Number(((performance.now() - started) / 1000).toFixed(2));
    calls.push({ batch: entry.batch, gameIds: entry.gameIds, status, elapsedS, response: body });
    console.log(`batch ${entry.batch}: HTTP ${status} ${elapsedS} s ${JSON.stringify(body?.totals ?? body?.message)}`);
    if (status !== 200 || body?.success !== true || body?.dryRun !== true) {
      console.error(`STOP at batch ${entry.batch}: ${body?.message}`);
      break;
    }
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "dry-run.unchecked.json"), JSON.stringify({
    runner: "22-local-dry-run.ts", phase: "dry", target: `local candidate ${candidate} (fake client over the read-only export)`,
    batchesSha256: manifest.batchesSha256, calculationVersion: "pp-shifts-qualified-clock-v1", calls
  }) + "\n");
}

main().catch((error) => { console.error(error); process.exit(1); });

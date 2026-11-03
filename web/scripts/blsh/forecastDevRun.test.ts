// @vitest-environment node
/** Opt-in local BLSH development forecast comparison (FORECAST-PROPOSAL-v2.md). Exploratory only.
 * Reads frozen local files pinned in this file, writes only to BLSH_FORECAST_OUT (a new directory).
 * No database, provider or network access.
 *
 * BLSH_V1_RUN_DIR             Codex support-conditioned-ranking-v1/run-guarded-v1 (block catalog; ../INPUTS.json)
 * BLSH_DEV_HISTORY            dev-history.jsonl written by export_dev_history.py (EXPORT-RECEIPT.json beside it)
 * BLSH_FORECAST_OUT           new output directory
 * BLSH_FORECAST_PLAYER_LIMIT  optional: cost check on the first N players by id (not a result)
 *
 * The 60-minute budget is enforced cooperatively: the run yields between players and sections and
 * stops once the budget has passed, and the budget is checked again, after every payload is
 * serialized, immediately before the output directory is created. Not a hard preemption guarantee. A passed test is not a clean
 * run by itself: the command's exit status and any unhandled runner error must be reported too.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { devSlot, type DevRow, type Slot } from "../../lib/buyLowSellHigh/currentWindows";
import { DEFAULT_CONFIG, FORECAST_EVALUATION_VERSION, publishBeforeDeadline, runForecastComparison } from "../../lib/buyLowSellHigh/forecastEvaluation";
import type { TrainingBlock } from "../../lib/buyLowSellHigh/supportGap";

const PINS = {
  "ORIGINAL-BLOCK-CATALOG.jsonl": "f60056cd5ab6b80688d130661d2efbaacfe31c001de7b690a634514900ded529",
  "INPUTS.json": "343e796081506a0aa31d3a3da47927af872e11b4e9d150f06c5a902d3bdf2eac",
  "dev-history.jsonl": "da32a473923e7b9940032c7ee22c1292e73798c7dc242a956a0244233d020106",
  "export_dev_history.py": "b6a4a580acc7af04a6d469429fbfefa19411aea4cf52a92d5847b3acd4deefe6",
};
/** Rows v1 preserved as season/date anomalies and kept out of histories (exposure-rate-candidate-v1 SPEC.json). */
const PRESERVED_ANOMALY_IDS = new Set([3100455, 3101421]);
const env = process.env, ready = ["BLSH_V1_RUN_DIR", "BLSH_DEV_HISTORY", "BLSH_FORECAST_OUT"].every(k => env[k]);
const sha256 = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const BUDGET_MS = 3_600_000;

describe.skipIf(!ready)("BLSH development forecast comparison (local, exploratory)", () => {
  it("builds identical origins and compares every arm on all three tracks", async () => {
    const read = (path: string, pin: string) => {
      const bytes = readFileSync(path);
      if (sha256(bytes) !== pin) throw new Error(`Pin mismatch: ${path}`);
      return bytes.toString("utf8");
    };
    const out = env.BLSH_FORECAST_OUT!;
    if (existsSync(out)) throw new Error("Output directory must be new");
    const started = Date.now();
    read(join(env.BLSH_V1_RUN_DIR!, "..", "INPUTS.json"), PINS["INPUTS.json"]);
    read(join(__dirname, "export_dev_history.py"), PINS["export_dev_history.py"]);
    const receipt = JSON.parse(readFileSync(join(dirname(env.BLSH_DEV_HISTORY!), "EXPORT-RECEIPT.json"), "utf8"));
    if (receipt.output?.sha256 !== PINS["dev-history.jsonl"] || receipt.exporter?.sha256 !== PINS["export_dev_history.py"]) throw new Error("Export receipt does not match the pinned history or exporter");
    const blocks = read(join(env.BLSH_V1_RUN_DIR!, "ORIGINAL-BLOCK-CATALOG.jsonl"), PINS["ORIGINAL-BLOCK-CATALOG.jsonl"]).split("\n").filter(Boolean).map(l => JSON.parse(l) as TrainingBlock);
    const rows = read(env.BLSH_DEV_HISTORY!, PINS["dev-history.jsonl"]).split("\n").filter(Boolean).map(l => JSON.parse(l) as DevRow);
    const byPlayer = new Map<number, Slot[]>();
    for (const r of rows) {
      if (PRESERVED_ANOMALY_IDS.has(r.id)) continue;
      const s = devSlot(r);
      if (!byPlayer.has(s.playerId)) byPlayer.set(s.playerId, []);
      byPlayer.get(s.playerId)!.push(s);
    }
    byPlayer.forEach(list => list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id));
    const limit = Number(env.BLSH_FORECAST_PLAYER_LIMIT ?? 0);
    const input = limit > 0 ? new Map([...byPlayer].sort((a, b) => a[0] - b[0]).slice(0, limit)) : byPlayer;
    const expired = () => Date.now() - started > BUDGET_MS;
    const result = await runForecastComparison(input, blocks, DEFAULT_CONFIG, { expired });
    const elapsedSeconds = (Date.now() - started) / 1000;
    const { origins, ...summary } = result;
    // Serialize everything first, so no unchecked interval remains between the deadline check and the first write.
    const files: [string, string][] = [
      ["RESULTS.json", JSON.stringify({ ...summary, label: "EXPLORATORY development comparison (2023-24 exposed); not a performance claim; not reviewed" }, null, 2) + "\n"],
      ["ORIGINS.jsonl", origins.map(o => JSON.stringify(o)).join("\n") + "\n"],
      ["RECEIPT.json", JSON.stringify({ version: FORECAST_EVALUATION_VERSION, pins: PINS, excludedAnomalyIds: [...PRESERVED_ANOMALY_IDS],
        playerLimit: limit || null, players: input.size, rows: rows.length, elapsedSeconds, budgetSeconds: BUDGET_MS / 1000, node: process.version, database: false, network: false,
        runnerStatus: "not recorded here; the command's exit status and any unhandled Vitest error decide whether the run is clean" }, null, 2) + "\n"],
    ];
    publishBeforeDeadline(files, expired, () => mkdirSync(out, { recursive: true }), (name, text) => writeFileSync(join(out, name), text, { flag: "wx" }));
    expect(result.primary.origins).toBeGreaterThan(0);
  }, BUDGET_MS + 300_000);
});

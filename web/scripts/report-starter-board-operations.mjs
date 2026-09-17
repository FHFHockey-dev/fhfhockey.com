import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const [origin, from, until, output] = process.argv.slice(2);
if (!origin || !from || !until || !output) throw new Error("Usage: node scripts/report-starter-board-operations.mjs APPROVED_ORIGIN FROM_ISO UNTIL_ISO PRIVATE_OUTPUT.json");
const target = new URL(origin);
if ((target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname)))
  || target.username || target.password || target.search || target.hash || target.pathname !== "/") throw new Error("Supply a trusted board origin only");
if (![from, until].every((value) => Number.isFinite(Date.parse(value)))) throw new Error("Invalid report timestamps");
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("Authenticated report access is required");
const path = resolve(output);
const repo = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const rejectRepositoryPath = (directory) => {
  const within = relative(repo, directory);
  if (!within || (!within.startsWith(`..${sep}`) && within !== ".." && !within.startsWith(sep))) throw new Error("Keep private operational artifacts outside the repository");
};
rejectRepositoryPath(dirname(path));
let ancestor = dirname(path);
while (!existsSync(ancestor)) ancestor = dirname(ancestor);
rejectRepositoryPath(realpathSync(ancestor));
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
rejectRepositoryPath(realpathSync(dirname(path)));
const response = await fetch(new URL("/api/v1/db/starter-board-release", target), {
  method: "POST", redirect: "error", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "report", from, until }), signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error(`Operational report unavailable: ${response.status}`);
const report = await response.json();
if (report.version !== "starter-board-operations-v1" || !report.inputHash) throw new Error("Unexpected operational report contract");
const content = JSON.stringify(report, null, 2) + "\n";
writeFileSync(path, content, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ path, sha256: createHash("sha256").update(content).digest("hex"), reviewStatus: report.reviewStatus }));

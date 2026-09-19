import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";
import { previewNhlDraftBatch, importNhlIdentity } from "../lib/sources/nhlProspectIdentity";
import { getServiceRoleClient } from "../lib/supabase/server";
loadEnvConfig(process.cwd());
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const write = argument("write") === "true";
  if (write && (process.env.NHL_PROSPECT_REFRESH_ENABLED !== "true" || process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED !== "true")) throw new Error("Prospect and interpretation flags must be enabled for writes.");
  const reports = [];
  let after: number | null = Number(argument("after") ?? 0);
  do {
    const report = await previewNhlDraftBatch({ year: Number(argument("year")), after, limit: Number(argument("limit") ?? 25), profiles: argument("profiles") !== "false" });
    const imports = [];
    if (write) for (const player of report.players) imports.push(await importNhlIdentity(getServiceRoleClient(), player));
    reports.push({ ...report, imports });
    after = report.nextCursor;
    // Checkpoint every successful batch. Re-running from the prior cursor is idempotent.
    if (argument("output")) writeFileSync(argument("output")!, JSON.stringify({ dryRun: !write, nextCursor: after, reports }, null, 2));
  } while (argument("all") === "true" && after != null);
  console.log(JSON.stringify({ dryRun: !write, nextCursor: after, players: reports.reduce((sum, report) => sum + report.players.length, 0), warnings: reports.reduce((sum, report) => sum + report.warnings.length, 0), identityReviews: reports.flatMap((report) => report.imports).filter((result) => result.status === "review").length, output: argument("output") ?? null }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";
import { shadowReplayPendingAliases } from "../lib/sources/tweetAliasReconciliation";
import { getServiceRoleClient } from "../lib/supabase/server";

loadEnvConfig(process.cwd());
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const report = await shadowReplayPendingAliases(getServiceRoleClient(), {
    previewNhlRosters: argument("nhl-rosters") === "true",
    afterId: argument("after"), limit: Number(argument("limit") ?? 100), seasonId: argument("season") ? Number(argument("season")) : undefined,
  });
  const output = argument("output");
  if (output) writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, results: undefined, output: output ?? null }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });

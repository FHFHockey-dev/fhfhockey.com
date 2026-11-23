// Dry run of the team/goalie sustainability producer.
//
// Reads existing database inputs (no NST requests), computes every row and
// writes a JSON coverage report. It never writes to the database: it does not
// import the producer's write module.
//
// Usage (from web/):
//   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
//     scripts/dry-run-entity-sustainability.ts --season 20262027 --end 2026-11-22 --focus 2026-11-22 --out <file.json>

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import { teamsInfo } from "lib/teamsInfo";
import { computeEntitySustainability, TEAM_IDS } from "lib/sustainability/entityProducerData";
import { buildEntityCoverageReport } from "lib/sustainability/entityProducerReport";

dotenv.config({ path: ".env.local", quiet: true });

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing --${name}`);
}

async function main() {
  const seasonId = Number(arg("season"));
  const endDate = arg("end");
  const focusDate = arg("focus", endDate);
  const out = arg("out");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const started = Date.now();
  const run = await computeEntitySustainability({ client, seasonId, endDate });
  const teamNames = new Map(Object.entries(teamsInfo).map(([abbrev, t]) => [t.id, abbrev]));
  const report = buildEntityCoverageReport({ result: run, focusDate, teamIds: TEAM_IDS, teamNames });
  const edmL5 = run.scores.find(
    (s) => s.entity_type === "team" && s.entity_id === 22 && s.snapshot_date === focusDate && s.window_code === "l5"
  );
  const njdL5 = run.scores.find(
    (s) => s.entity_type === "team" && s.entity_id === 1 && s.snapshot_date === focusDate && s.window_code === "l5"
  );
  const payload = {
    dryRun: true,
    writes: 0,
    elapsedMs: Date.now() - started,
    seasonId: run.seasonId,
    seasonStart: run.seasonStart,
    requestedEnd: run.requestedEnd,
    readyThrough: run.readyThrough,
    dates: run.dates.length,
    unmappedAbbrevs: run.unmappedAbbrevs,
    report,
    sampleRows: {
      edmontonL5Score: edmL5 ?? null,
      edmontonL5Bands: run.bands.filter(
        (b) => b.entity_type === "team" && b.entity_id === 22 && b.snapshot_date === focusDate && b.window_code === "l5"
      ),
      newJerseyL5Score: njdL5 ?? null
    }
  };
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        out,
        readyThrough: run.readyThrough,
        dates: run.dates.length,
        totals: report.totals,
        rowCheckProblems: report.rowChecks.length,
        teamFocusCoverage: report.team.focusCoverage,
        offDayTeams: report.team.focusOffDayTeams,
        datesWithFullCoverage: `${report.team.datesWithFullCoverage}/${report.team.datesTotal}`,
        teamSkips: report.team.skips,
        goalieFocusCoverageL5: report.goalie.focusCoverageL5,
        goalieSkips: report.goalie.skips
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

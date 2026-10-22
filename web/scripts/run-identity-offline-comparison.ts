import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runIdentityDevelopmentComparison } from "../lib/sources/fixtures/tweetIdentityDevelopmentComparison";

async function main() {
  const { report } = await runIdentityDevelopmentComparison();
  const directory = resolve(__dirname, "../../tasks/artifacts/luna-identity-offline-2026-10-20");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, "LOCAL-COMPARISON.json");
  writeFileSync(path, JSON.stringify({ mode: "offline_development_only", resolver: "scripted_mock",
    paidRequests: 0, newProviderSpendUsd: 0, canPublish: false, ...report }, null, 2) + "\n");
  process.stdout.write(`${path}\n`);
  for (const cohort of report.cohorts) process.stdout.write(JSON.stringify({ cohort: cohort.cohort, samples: cohort.samples,
    gradedSamples: cohort.gradedSamples, ungradedSamples: cohort.ungradedSamples, mockRequests: cohort.mockRequests }) + "\n");
}

main().catch(() => { process.stderr.write("Offline identity comparison failed\n"); process.exitCode = 1; });

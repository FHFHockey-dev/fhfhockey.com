// Read-only pin check for the R21 (scheduler-retain-only-v1) review.
// Usage from the repository root: node <this> <output.json>
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const tasks = fileURLToPath(new URL("../", import.meta.url));
const sha = (path) => { try { return createHash("sha256").update(readFileSync(path)).digest("hex"); } catch { return null; } };
const owner = JSON.parse(readFileSync(join(tasks, "scheduler-retain-only-v1/owned-source-sha256.json"), "utf8"));
const artifacts = JSON.parse(readFileSync(join(tasks, "scheduler-retain-only-v1/checkpoint-artifacts-sha256.json"), "utf8"));

const changed = Object.fromEntries(Object.entries(owner.changed).map(([path, pin]) => {
  const live = sha(join(repo, path));
  const name = path.split("/").pop();
  const before = sha(join(tasks, "scheduler-retain-only-v1/before", name));
  return [path, { live, matchesAfter: live === pin.after, beforeCopy: before, beforeCopyMatches: before === pin.before }];
}));
const unchangedPins = owner.unchangedDeadlineIncrement;
const unchanged = Object.fromEntries(Object.entries(unchangedPins).map(([path, pin]) => [path, { live: sha(join(repo, path)), matches: sha(join(repo, path)) === pin }]));
// Context files this review reads but the owner did not pin.
const context = [
  "web/lib/sources/iftttIntakePolicy.test.ts",
  "web/lib/projections/starterBoardFlags.ts",
  "web/lib/projections/evidenceTime.ts",
  "web/pages/api/v1/db/update-line-sources.ts",
  "web/pages/api/v1/db/update-lines-ccc.ts",
  "web/pages/api/v1/db/replay-player-aliases.ts",
  "web/pages/api/v1/db/player-name-aliases.ts",
  "web/lib/sources/tweetClaimEvaluationIntake.ts",
  "web/lib/sources/tweetProcessingJobs.ts",
  "web/vercel.json",
  ...["DFOFantasy", "NHL-Rosters", "ccc", "gamedaygoalies", "gamedaylines", "gamedaynewsnhl"].map((n) => `web/pages/api/v1/sources/ifttt/${n}-tweet.ts`),
];
const ownerArtifacts = Object.entries(artifacts).map(([path, pin]) => ({ path, pin, live: sha(join(tasks, path)) }));
const result = {
  capturedAt: new Date().toISOString(),
  gitHead: execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  changed,
  allChangedMatchAfter: Object.values(changed).every((v) => v.matchesAfter && v.beforeCopyMatches),
  unchangedOwnerPins: unchanged,
  allUnchangedMatch: Object.values(unchanged).every((v) => v.matches),
  context: Object.fromEntries(context.map((path) => [path, sha(join(repo, path))])),
  ownerArtifacts: { count: ownerArtifacts.length, mismatches: ownerArtifacts.filter((a) => a.pin !== a.live).map((a) => a.path) },
  gitStatusOfReviewedRuntime: execFileSync("git", ["-C", repo, "status", "--porcelain", "--", "web/lib/sources", "web/pages/api/internal",
    "web/pages/api/v1/db/update-line-sources.ts", "web/pages/api/v1/db/update-lines-ccc.ts", "web/pages/api/v1/db/replay-player-aliases.ts",
    "web/pages/api/v1/sources/ifttt", "web/vercel.json"], { encoding: "utf8" }).split("\n").filter(Boolean),
};
writeFileSync(process.argv[2], JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ allChangedMatchAfter: result.allChangedMatchAfter, allUnchangedMatch: result.allUnchangedMatch, ownerArtifactMismatches: result.ownerArtifacts.mismatches }));

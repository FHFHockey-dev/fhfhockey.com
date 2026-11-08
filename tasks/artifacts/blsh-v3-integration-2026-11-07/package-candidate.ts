/** Offline mapper-only packaging. No data retrieval, scoring, holdout access or runtime repin. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildDisplaySnapshot, type MappedProfile } from "../../../web/lib/buyLowSellHigh/displayProfile";
import { parseCurrentResearchSnapshot } from "../../../web/lib/buyLowSellHigh/researchSnapshot";

const sourcePath = "/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-20261029-01/replay-01/PROFILES-A-canonical.jsonl";
const sourceHash = "0ea21a45568761851856964e7f925a097002c227c5dd7c1c5ddca7c072c6dfb4";
const repository = resolve(process.argv[2] ?? ".");
const output = "/Users/tim/Documents/Codex/2026-11-07/blsh-v3-integration";
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const savedBytes = readFileSync(join(repository, "web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json"));
assert.equal(savedBytes.length, 9_559_567);
assert.equal(sha(savedBytes), "2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8");
const saved = parseCurrentResearchSnapshot(JSON.parse(savedBytes.toString("utf8")));
const sourceBytes = readFileSync(sourcePath);
assert.equal(sourceBytes.length, 10_874_930);
assert.equal(sha(sourceBytes), sourceHash);
assert.equal(saved.sourcePins.profiles, sourceHash);
const profiles: MappedProfile[] = sourceBytes.toString("utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
assert.equal(profiles.length, 729);
assert.ok(profiles.every(profile => profile.arm === "A_development_reference" && !profile.opportunity));
const untouched = JSON.stringify(profiles);
const candidate = buildDisplaySnapshot({ profiles, referencePolicy: saved.referencePolicy,
  assemblerVersion: saved.assemblerVersion, seasonId: saved.seasonId, eventThroughDate: saved.eventThroughDate,
  asOfUTC: saved.asOfUTC, packagedAtUTC: "2026-11-07T21:29:05.041Z", sourcePins: saved.sourcePins });
assert.equal(JSON.stringify(profiles), untouched, "Source profiles must not be modified");
parseCurrentResearchSnapshot(candidate);
assert.equal(candidate.counts.opportunityAttached, 0);
const prior = new Map(saved.profiles.map(profile => [profile.playerId, profile]));
const membershipChanges: object[] = [];
for (const profile of candidate.profiles) {
  const old = prior.get(profile.playerId)!;
  assert.ok(old, "Every candidate profile must exist in the original capture");
  for (const key of ["value", "normalizedGap", "baselineNormalizedGap", "status"] as const) {
    assert.equal(profile.score[key], old.score[key], `${profile.playerId}: saved score ${key}`);
  }
  // v3 adds only the declared headline/supporting role to each otherwise unchanged track.
  assert.deepEqual(profile.tracks.map(({ role, ...track }) => {
    assert.equal(role, track.track === "fantasy_points" ? "headline" : "supporting");
    return track;
  }), old.tracks, `${profile.playerId}: every saved track and attribution`);
  assert.deepEqual(profile.evidence.window, old.evidence.window, `${profile.playerId}: saved current window`);
  if (old.score.list !== profile.score.list) membershipChanges.push({ playerId: profile.playerId,
    from: old.score.list, to: profile.score.list, reason: profile.score.reason });
}
assert.equal(candidate.profiles.length, saved.profiles.length);
// Keep the existing 12 MiB reader cap; whitespace is not evidence.
const json = JSON.stringify(candidate) + "\n";
assert.ok(Buffer.byteLength(json) <= 12 * 1024 * 1024, "Candidate must fit the reader size bound");
mkdirSync(output, { recursive: true });
const candidatePath = join(output, "2026-10-28.arm-a.mapper-v3.candidate.json");
writeFileSync(candidatePath, json);
const receipt = { status: "LOCAL_REVIEW_CANDIDATE_ONLY", mapperVersion: candidate.mapperVersion,
  generatedAtUTC: new Date().toISOString(), candidatePath, bytes: Buffer.byteLength(json), sha256: sha(json),
  source: { path: sourcePath, bytes: sourceBytes.length, sha256: sourceHash },
  original: { bytes: savedBytes.length, sha256: sha(savedBytes), counts: saved.counts },
  candidateCounts: candidate.counts, membershipChanges,
  verified: { parsedByCurrentRuntimeParser: true, original729IdentitiesPreserved: true,
    allSavedScoresTracksAttributionsAndCurrentWindowsUnchanged: true, sourceProfilesUnmodified: true },
  boundaries: { rescored: false, freshData: false, reservedHoldoutRead: false, armCAdopted: false,
    runtimeRepinned: false, opportunityInvented: false, productionWrites: false, deployed: false } };
writeFileSync(join(output, "PACKAGE-RECEIPT.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ candidatePath, bytes: receipt.bytes, sha256: receipt.sha256,
  counts: candidate.counts, membershipChanges: membershipChanges.length }, null, 2));

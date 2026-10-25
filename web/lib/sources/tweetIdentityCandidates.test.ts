// @vitest-environment node
import http from "node:http";
import https from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlayerIdentitySnapshot, indexPlayerIdentitySnapshot, validatePlayerIdentitySnapshot, identityDigest, snapshotRowAtSource } from "./playerIdentitySnapshot";
import { retrieveTweetIdentityCandidates } from "./tweetIdentityCandidates";
import { buildTweetNewsInferencePlayerCandidates } from "./tweetNewsInference";
import type { TweetNewsAutomationReviewRow } from "./tweetNewsAutomation";
import { FIXTURE_AS_OF, offlineIdentityIndex, offlineIdentityRecords } from "./fixtures/tweetIdentityOfflineFixture";

const index = offlineIdentityIndex();
beforeEach(() => {
  const blocked = () => { throw new Error("network forbidden in identity fixtures"); };
  vi.stubGlobal("fetch", vi.fn(blocked));
  vi.spyOn(http, "request").mockImplementation(blocked); vi.spyOn(http, "get").mockImplementation(blocked);
  vi.spyOn(https, "request").mockImplementation(blocked); vi.spyOn(https, "get").mockImplementation(blocked);
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled(); expect(http.request).not.toHaveBeenCalled(); expect(http.get).not.toHaveBeenCalled();
  expect(https.request).not.toHaveBeenCalled(); expect(https.get).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
const retrieve = (mention: string, extra: Partial<Parameters<typeof retrieveTweetIdentityCandidates>[0]> = {}) =>
  retrieveTweetIdentityCandidates({ index, mention, publishedAt: "2026-10-16T12:00:00Z", ...extra });

describe("synthetic versioned identity snapshot", () => {
  it("keeps namespace/registry separate, Unicode keys, dates, scope and provenance in a stable hash", () => {
    const snapshot = index.snapshot;
    expect(snapshot.content.rows[0]).toMatchObject({ canonicalId: "nhl:1001", nhlPlayerId: 1001, registryId: 91,
      aliases: expect.arrayContaining([expect.objectContaining({ scope: { kind: "team", teamId: 11 }, provenance: "synthetic scoped alias" })]) });
    expect(snapshot.content.rows[3]).toMatchObject({ fullName: "Émile St-Pierre", unicodeKey: "émile st pierre", searchKey: "emile st pierre" });
    expect(offlineIdentityIndex([...offlineIdentityRecords].reverse()).snapshot.hash).toBe(snapshot.hash);
    expect(Object.isFrozen(snapshot.content.rows[0]!.aliases)).toBe(true);
    expect(Object.hasOwn(index.byId, "nhl:91")).toBe(false);
  });
  it("does not silently turn undated legacy aliases/team fields into verified historical evidence", () => {
    expect(index.snapshot.content.rows[0]!.aliases.map(alias => alias.text)).not.toContain("Undated nickname");
    const old = snapshotRowAtSource(index.snapshot.content.rows[0]!, index, "2026-10-01T12:00:00Z");
    expect(old.teamIds).toEqual([11]); expect(old.identity.aliases).toContain("Little Spark");
    const traded = snapshotRowAtSource(index.snapshot.content.rows[0]!, index, "2026-10-10T00:00:00Z");
    expect(traded.teamIds).toEqual([22]); expect(traded.identity.aliases).not.toContain("Little Spark");
    expect(snapshotRowAtSource(index.snapshot.content.rows[0]!, index, "2025-01-01T00:00:00Z").teamIds).toEqual([]);
    expect(snapshotRowAtSource(index.snapshot.content.rows[0]!, index, "2026-10-21T00:00:00Z").teamIds).toEqual([]);
  });
  it("rejects tampered hashes, duplicate identities, cross-namespace IDs and conflicting registry links", () => {
    const altered = structuredClone(index.snapshot); altered.content.rows[0]!.fullName = "Altered";
    expect(() => validatePlayerIdentitySnapshot(altered)).toThrow();
    const badId = structuredClone(index.snapshot); badId.content.rows[0]!.canonicalId = "registry:91";
    expect(() => indexPlayerIdentitySnapshot(badId)).toThrow();
    const duplicate = structuredClone(index.snapshot); duplicate.content.rows.push(duplicate.content.rows[0]!); duplicate.hash = identityDigest(duplicate.content);
    expect(() => indexPlayerIdentitySnapshot(duplicate)).toThrow("duplicate_canonical_identity");
    const registry = structuredClone(index.snapshot); registry.content.rows[1]!.registryId = 91; registry.hash = identityDigest(registry.content);
    expect(() => indexPlayerIdentitySnapshot(registry)).toThrow("conflicting_registry_link");
  });
  it("requires verified alias provenance, explicit valid intervals and honest completeness", () => {
    const build = (records: typeof offlineIdentityRecords, completeness = index.snapshot.content.completeness) => buildPlayerIdentitySnapshot({
      records, completeness, asOf: FIXTURE_AS_OF, provenance: "synthetic" });
    for (const change of [
      (r: typeof offlineIdentityRecords) => { r[0]!.verifiedAliases[0]!.provenance = ""; },
      (r: typeof offlineIdentityRecords) => { r[0]!.verifiedAliases[0]!.startsAt = "2026-02-30T12:00:00Z"; },
      (r: typeof offlineIdentityRecords) => { r[0]!.memberships[0]!.endsAt = "2025-01-01T00:00:00Z"; },
    ]) { const records = structuredClone(offlineIdentityRecords); change(records); expect(() => build(records)).toThrow(); }
    expect(() => build(offlineIdentityRecords, { status: "complete", omittedRecords: null, scope: "synthetic" })).toThrow();
  });
});

describe("offline candidate retrieval, no identity selection", () => {
  it.each([
    { mention: "Milo North", baselineIds: [1001], improvedIds: [1001] },
    { mention: "Sparky", baselineIds: [], improvedIds: [1001] },
    { mention: "Milo Nort", baselineIds: [], improvedIds: [1001] },
    { mention: "Emile St-Pierre", baselineIds: [1004], improvedIds: [1004] },
    { mention: "Vale", baselineIds: [1002, 1003], improvedIds: [1002, 1003] },
    { mention: "zzzzzzzzzz", baselineIds: [], improvedIds: [] },
  ])("compares synthetic baseline/retrieval candidates for $mention (not model accuracy)", ({ mention, baselineIds, improvedIds }) => {
    const players = offlineIdentityRecords.map(({ identity: p }) => ({ id: p.playerId, fullName: p.fullName, lastName: p.lastName,
      aliases: p.aliases?.concat("Sparky"), position: p.position ?? null, team_id: null }));
    // This baseline function reads only team_id from its row; no route/storage invocation.
    const baseline = buildTweetNewsInferencePlayerCandidates({ row: { team_id: null } as TweetNewsAutomationReviewRow,
      players, sources: [{ id: "wrapper", text: `${mention} remains out.`, url: null, authorHandle: null }] });
    expect(baseline.map(p => p.id)).toEqual(baselineIds);
    expect(retrieve(mention).candidates.map(c => c.row.nhlPlayerId)).toEqual(improvedIds);
  });
  it.each(["Milo North", "Sparky", "M.North", "Emile St‑Pierre", "Émile St-Pierre", "Del Bel"])("retrieves full/alias/initial/Unicode/compound %s", mention => {
    expect(retrieve(mention).candidates.length).toBeGreaterThan(0);
  });
  it("keeps every ambiguous surname candidate even with wrong team/position hints", () => {
    const set = retrieve("Vale", { teamId: 999, position: "C" });
    expect(set.exactStatus).toBe("ambiguous");
    expect(set.candidates.map(c => c.row.canonicalId)).toEqual(["nhl:1002", "nhl:1003"]);
    expect(set.candidates.every(c => c.teamEvidence === "conflicting" && c.positionEvidence === "conflicting")).toBe(true);
    const stale = retrieve("Milo North", { teamId: 11 });
    expect(stale.candidates[0]).toMatchObject({ teamEvidence: "conflicting", activeTeamIds: [22] });
    expect(retrieve("Milo North", { teamId: 11, publishedAt: "2026-10-01T12:00:00Z" }).candidates[0]!.teamEvidence).toBe("supported");
  });
  it("withholds out-of-scope alias metadata even when a canonical name retrieves the player", () => {
    const current = retrieve("Milo North").candidates[0]!;
    expect(current.row.aliases.map(alias => alias.text)).toEqual(["Sparky"]);
    expect(retrieve("Little Spark").candidates).toEqual([]);
    const beforeMembership = retrieve("Milo North", { teamId: 11, publishedAt: "2025-01-01T00:00:00Z" }).candidates[0]!;
    expect(beforeMembership).toMatchObject({ teamEvidence: "unknown", activeTeamIds: [], eligibleAliasTexts: [] });
    expect(beforeMembership.row.aliases).toEqual([]);
    const afterSnapshot = retrieve("Milo North", { teamId: 22, publishedAt: "2026-10-21T00:00:00Z" }).candidates[0]!;
    expect(afterSnapshot).toMatchObject({ teamEvidence: "unknown", activeTeamIds: [] });
    expect(afterSnapshot.row.aliases).toEqual([]);
    expect(index.snapshot.content.rows[0]!.aliases).toHaveLength(2);
  });
  it("retrieves conservative spelling candidates without returning a match decision", () => {
    const set = retrieve("Milo Nort");
    expect(set).toMatchObject({ exactStatus: "missing_player", quality: "weak", candidates: [{ basis: "fuzzy", nameDistance: 1 }] });
    expect(retrieve("zzzzzzzzzz")).toMatchObject({ quality: "missing", candidates: [] });
  });
  it("derives uppercase canonical token initials across Unicode/hyphens as weak hypotheses, not aliases", () => {
    const records = [
      { identity: { playerId: 3001, fullName: "Ryan Nugent-Hopkins", lastName: "Nugent-Hopkins" }, verifiedAliases: [], memberships: [] },
      { identity: { playerId: 3002, fullName: "Riley North‑Hill", lastName: "North‑Hill" }, verifiedAliases: [], memberships: [] },
      ...offlineIdentityRecords,
    ];
    const acronymIndex = offlineIdentityIndex(records);
    const result = retrieve("RNH", { index: acronymIndex });
    expect(result).toMatchObject({ exactStatus: "missing_player", quality: "weak", truncated: false });
    expect(result.candidates.map(c => c.row.canonicalId)).toEqual(["nhl:3001", "nhl:3002"]);
    expect(result.candidates.every(c => c.basis === "acronym" && c.nameDistance === null && !c.eligibleAliasTexts.length && !c.row.aliases.length)).toBe(true);
    expect(retrieve("R.N.H.", { index: acronymIndex }).candidates.map(c => c.row.canonicalId)).toEqual(["nhl:3001", "nhl:3002"]);
    expect(retrieve("ÉSP", { index: acronymIndex }).candidates[0]).toMatchObject({ basis: "acronym", row: { canonicalId: "nhl:1004" } });
    expect(retrieve("ESP", { index: acronymIndex }).candidates[0]).toMatchObject({ basis: "acronym", row: { canonicalId: "nhl:1004" } });
    expect(retrieve("Ryan Nugent-Hopkins", { index: acronymIndex }).candidates[0]!.basis).toBe("full_name");
    expect(acronymIndex.byId["nhl:3001"]!.aliases).toEqual([]);
  });
  it("does not manufacture absent candidates or treat unrelated acronym chunks as names", () => {
    for (const mention of ["RNH", "NHL", "PP1", "rnh", "RNH highlights", "M.N."]) expect(retrieve(mention).candidates).toEqual([]);
  });
  it("does not generate acronym hypotheses from an ineligible scoped alias", () => {
    const records = structuredClone(offlineIdentityRecords);
    records[0]!.verifiedAliases[1]!.text = "RNH";
    expect(retrieve("RNH", { index: offlineIdentityIndex(records) }).candidates).toEqual([]);
    const old = retrieve("RNH", { index: offlineIdentityIndex(records), publishedAt: "2026-10-01T12:00:00Z" });
    expect(old.candidates[0]).toMatchObject({ basis: "alias", eligibleAliasTexts: ["RNH", "Sparky"] });
    expect(retrieve("LS", { index: offlineIdentityIndex(records) }).candidates).toEqual([]);
  });
  it("exposes truncation for colliding canonical acronyms", () => {
    const records = Array.from({ length: 85 }, (_, i) => ({ identity: { playerId: 4000 + i, fullName: "Robin North-Hill", lastName: "North-Hill" }, verifiedAliases: [], memberships: [] }));
    const set = retrieve("RNH", { index: offlineIdentityIndex(records) });
    expect(set).toMatchObject({ quality: "weak", totalCandidates: 85, omittedCount: 45, truncated: true });
    expect(set.candidates.every(c => c.basis === "acronym")).toBe(true);
  });
  it("uses one bounded wider search when the correct ID was absent, and exposes partial coverage", () => {
    expect(retrieve("Emile St Pioree").candidates).toEqual([]);
    const wider = retrieve("Emile St Pioree", { pass: 1 });
    expect(wider.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ row: expect.objectContaining({ canonicalId: "nhl:1004" }), nameDistance: 2 })]));
    expect(wider.completeness.status).toBe("partial");
    expect(() => retrieve("Vale", { pass: 2 as 1 })).toThrow("identity_widening_limit");
  });
  it("shows both shortlist caps and never treats a truncated surname list as unique", () => {
    const records = Array.from({ length: 85 }, (_, i) => ({ identity: { playerId: 2000 + i, fullName: `Fixture${i} Shared`, lastName: "Shared" }, verifiedAliases: [], memberships: [] }));
    const crowded = offlineIdentityIndex(records);
    const first = retrieve("Shared", { index: crowded }), second = retrieve("Shared", { index: crowded, pass: 1 });
    expect(first).toMatchObject({ exactStatus: "ambiguous", totalCandidates: 85, omittedCount: 45, truncated: true });
    expect(first.candidates).toHaveLength(40);
    expect(second).toMatchObject({ totalCandidates: 85, omittedCount: 5, truncated: true }); expect(second.candidates).toHaveLength(80);
  });
  it("does not grant labels to reported troublesome leads without verified source context", () => {
    for (const lead of ["Blackhawks lines", "Lomberg-Del Bel-Garland", "Greaves in the home"]) expect(retrieve(lead).candidates).toEqual([]);
  });
});

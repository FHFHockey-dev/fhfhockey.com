// @vitest-environment node
import { describe, expect, it } from "vitest";
import saved from "./fixtures/tweetIdentitySavedEvidence.json";
import { projectSavedPlayerIdentityEvidence, type SavedPlayerIdentityEvidence } from "./playerIdentitySnapshotEvidence";
import { identityDigest, indexPlayerIdentitySnapshot, snapshotRowAtSource } from "./playerIdentitySnapshot";

const asOf = "2026-10-22T00:00:00Z", sourcePublishedAt = "2026-09-29T16:28:31Z";
const causal = { asOf, evaluation: { mode: "causal_as_of" as const, sourcePublishedAt } };
const retrospective = { asOf, evaluation: { mode: "retrospective" as const, sourcePublishedAt, reviewedAt: asOf } };
const evidence = () => structuredClone(saved) as SavedPlayerIdentityEvidence;
const interval = () => ({ startsAt: "2026-09-01T00:00:00Z", endsAt: null,
  basis: "independently_evidenced_effective_interval" as const, provenance: "Synthetic interval, not real player history" });
function synthetic() {
  const e = evidence(); e.cohort = "synthetic_contract_controls_not_player_history";
  e.players.forEach(p => { p.knownAt = "2026-09-01T00:00:00Z"; });
  e.aliases = [{ ...e.aliases[3]!, knownAt: "2026-09-01T00:00:00Z", effective: interval() }];
  e.memberships = [{ ...e.memberships[0]!, knownAt: "2026-09-01T00:00:00Z", effective: interval() }];
  return e;
}

describe("saved identity evidence: explicit causal-as-of and retrospective cohorts", () => {
  it("keeps October-observed canonical data out of the causal September view without relabeling it", () => {
    const e = evidence(), before = structuredClone(e);
    const result = projectSavedPlayerIdentityEvidence(e, causal);
    expect(result.evaluation).toEqual(causal.evaluation);
    expect(result.knowledgeCutoff).toBe(sourcePublishedAt);
    expect(result.snapshot.content.rows).toEqual([]);
    expect(result.audit.filter(x => x.kind === "player").every(x => x.reasons.includes("known_after_cutoff"))).toBe(true);
    expect(result.snapshot.content.completeness.status).toBe("partial");
    expect(e).toEqual(before);
  });
  it("retrospectively retains canonical IDs and owner confirmation while withholding unsupported effective intervals", () => {
    const result = projectSavedPlayerIdentityEvidence(evidence(), retrospective);
    expect(result.evaluation.mode).toBe("retrospective");
    expect(result.snapshot.content.rows.map(p => [p.canonicalId, p.registryId])).toEqual([["nhl:8476454", 9521], ["nhl:8481617", 10190]]);
    expect(result.snapshot.content.rows.every(p => !p.aliases.length && !p.memberships.length)).toBe(true);
    expect(result.audit.filter(x => x.kind !== "player").every(x => x.reasons.includes("historical_effective_interval_unavailable"))).toBe(true);
    expect(result.evidence.aliases[3]).toMatchObject({ text: "RNH", verified: true, scope: { kind: "global" },
      knownAt: "2026-10-20T23:03:35Z", effective: null });
    expect(result.evidence.memberships[0]!.recordInterval?.createdAt).toBe("2026-09-19T00:57:26.215689+00:00");
    expect(result.snapshot.hash).not.toBe(projectSavedPlayerIdentityEvidence(evidence(), causal).snapshot.hash);
    expect(Object.isFrozen(result.evidence.aliases)).toBe(true);
    expect(result).toMatchObject({ canPublish: false, canWriteAliases: false, canExecute: false });
  });
  it("includes independently dated synthetic evidence at microsecond/exclusive-end boundaries", () => {
    const e = synthetic(); e.aliases[0]!.effective = { ...interval(), startsAt: "2026-09-29T16:28:31.000001Z", endsAt: "2026-09-29T16:28:31.000003Z" };
    const result = projectSavedPlayerIdentityEvidence(e, causal), index = indexPlayerIdentitySnapshot(result.snapshot), row = index.snapshot.content.rows[0]!;
    expect(row.aliases[0]!.provenance).toBe(`saved-alias-evidence:${identityDigest(result.evidence.aliases[0])}`);
    expect(snapshotRowAtSource(row, index, "2026-09-29T16:28:31.000000Z").aliases).toHaveLength(0);
    expect(snapshotRowAtSource(row, index, "2026-09-29T16:28:31.000001Z").aliases).toHaveLength(1);
    expect(snapshotRowAtSource(row, index, "2026-09-29T16:28:31.000003Z").aliases).toHaveLength(0);
  });
  it("separates late knowledge from an earlier effective date, and never auto-selects evaluation mode", () => {
    const e = synthetic(); e.aliases[0]!.knownAt = "2026-10-01T00:00:00Z";
    expect(projectSavedPlayerIdentityEvidence(e, causal).snapshot.content.rows[0]!.aliases).toEqual([]);
    expect(projectSavedPlayerIdentityEvidence(e, retrospective).snapshot.content.rows[0]!.aliases).toHaveLength(1);
    expect(() => projectSavedPlayerIdentityEvidence(e, { asOf } as never)).toThrow();
    expect(() => projectSavedPlayerIdentityEvidence(e, { ...causal, evaluation: { ...causal.evaluation, reviewedAt: asOf } } as never)).toThrow();
  });
  it("keeps unknown canonical knowledge unavailable even when an alias has dates", () => {
    const e = synthetic(); e.players[0]!.knownAt = null;
    const result = projectSavedPlayerIdentityEvidence(e, retrospective);
    expect(result.snapshot.content.rows.map(p => p.canonicalId)).toEqual(["nhl:8481617"]);
    expect(result.audit.find(x => x.kind === "alias")!.reasons).toContain("canonical_identity_not_available_at_cutoff");
  });
  it("preserves scoped aliases and conflicting memberships without guessing a team", () => {
    const e = synthetic(); e.aliases[0]!.scope = { kind: "team", teamId: 22 };
    e.memberships[0]!.effective = { ...interval(), endsAt: "2026-09-20T00:00:00Z" };
    let index = indexPlayerIdentitySnapshot(projectSavedPlayerIdentityEvidence(e, causal).snapshot);
    expect(snapshotRowAtSource(index.snapshot.content.rows[0]!, index, sourcePublishedAt).aliases).toEqual([]);
    e.memberships[0]!.effective = interval(); e.memberships.push({ ...e.memberships[0]!, teamId: 99 });
    index = indexPlayerIdentitySnapshot(projectSavedPlayerIdentityEvidence(e, causal).snapshot);
    expect(snapshotRowAtSource(index.snapshot.content.rows[0]!, index, sourcePublishedAt).identity.teamId).toBeNull();
  });
  it.each(["foreign-link", "swapped-namespaces", "conflicting-link", "duplicate-player", "foreign-membership"] as const)("rejects %s", kind => {
    const e = synthetic();
    if (kind === "foreign-link") e.aliases[0]!.registryId = 999;
    if (kind === "swapped-namespaces") e.aliases[0]!.nhlId = 9521;
    if (kind === "conflicting-link") e.aliases[0]!.nhlId = 8481617;
    if (kind === "duplicate-player") e.players.push(e.players[0]!);
    if (kind === "foreign-membership") e.memberships[0]!.nhlId = 999;
    expect(() => projectSavedPlayerIdentityEvidence(e, causal)).toThrow(/link/);
  });
  it.each(["time", "verification", "scope"] as const)("withholds missing %s", field => {
    const e = synthetic();
    if (field === "time") e.aliases[0]!.knownAt = null;
    if (field === "verification") e.aliases[0]!.verified = false;
    if (field === "scope") e.aliases[0]!.scope = null;
    expect(projectSavedPlayerIdentityEvidence(e, causal).snapshot.content.rows[0]!.aliases).toEqual([]);
  });
  it("exposes truncation and rejects row/byte overflow and extra authority", () => {
    const e = evidence(); e.truncated = true; e.completeness.status = "complete"; e.completeness.omittedRecords = 0;
    expect(projectSavedPlayerIdentityEvidence(e, retrospective).snapshot.content.completeness).toMatchObject({ status: "partial", omittedRecords: null });
    expect(() => projectSavedPlayerIdentityEvidence({ ...e, players: Array(21).fill(e.players[0]) }, retrospective)).toThrow();
    expect(() => projectSavedPlayerIdentityEvidence({ ...e, aliases: Array(100).fill(e.aliases[0]) }, retrospective)).toThrow();
    expect(() => projectSavedPlayerIdentityEvidence({ ...e, cohort: "x".repeat(256_001) }, retrospective)).toThrow("saved_identity_evidence_too_large");
    expect(() => projectSavedPlayerIdentityEvidence({ ...e, canPublish: true }, retrospective)).toThrow();
  });
  it("rejects invalid dates, intervals, proof and evaluation clock order", () => {
    const e = synthetic(); e.aliases[0]!.knownAt = "2026-02-30T00:00:00Z";
    expect(() => projectSavedPlayerIdentityEvidence(e, causal)).toThrow();
    e.aliases[0]!.knownAt = sourcePublishedAt; e.aliases[0]!.effective!.endsAt = "2026-08-01T00:00:00Z";
    expect(() => projectSavedPlayerIdentityEvidence(e, causal)).toThrow();
    e.aliases[0]!.effective = { ...interval(), provenance: "" };
    expect(() => projectSavedPlayerIdentityEvidence(e, causal)).toThrow();
    expect(() => projectSavedPlayerIdentityEvidence(evidence(), { ...retrospective, asOf: sourcePublishedAt })).toThrow("invalid_evaluation_clock_order");
    expect(() => projectSavedPlayerIdentityEvidence(evidence(), { asOf, evaluation: { ...retrospective.evaluation, reviewedAt: "2026-01-01T00:00:00Z" } })).toThrow("invalid_evaluation_clock_order");
  });
});

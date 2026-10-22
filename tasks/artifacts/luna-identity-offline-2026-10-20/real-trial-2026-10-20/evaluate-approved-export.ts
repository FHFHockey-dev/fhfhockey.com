import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildPlayerIdentitySnapshot, identityDigest, indexPlayerIdentitySnapshot } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { retrieveTweetIdentityCandidates } from "../../../../web/lib/sources/tweetIdentityCandidates";
import { evaluateLocalAliasIdentityReview } from "../../../../web/lib/sources/tweetIdentityLocalReview";
import { prepareFixtureIdentityRequest, validateFixtureIdentityProposal, type FixtureIdentitySource } from "../../../../web/lib/sources/tweetIdentityProposal";

// Local analysis only. No transport, environment loading, database client or ledger writer.
const read = (name: string) => JSON.parse(readFileSync(join(__dirname, name), "utf8"));
const save = (name: string, value: unknown) => writeFileSync(join(__dirname, name), JSON.stringify(value, null, 2) + "\n");
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

async function main() {
  const exported = read("APPROVED-EXPORT.json");
  const sourceFile = join(__dirname, "../../../../web/lib/sources/fixtures/iftttComparisonObservations.json");
  const retained = JSON.parse(readFileSync(sourceFile, "utf8")).records.find((row: { id: string }) => row.id === "S06");
  if (!retained || sha(retained.text) !== "860b1c32b2f653225eb2a88463efdb984b91244ae58b8d9d6a300a049a0cc2ee") throw Error("source drift");
  if (exported.players.length >= 10 || exported.identities.length >= 10 || exported.registry_aliases.length >= 40
    || exported.lineup_aliases.length >= 20 || exported.memberships.length >= 40) throw Error("export cap reached; completeness unknown");
  const ids = new Set([...exported.players.map((p: any) => p.id), ...exported.identities.map((p: any) => p.nhl_player_id)]);
  const related = exported.registry_aliases.length + exported.lineup_aliases.length + exported.memberships.length;
  if (ids.has(null) || ids.size > 20 || related > 100) throw Error("export scope violation");
  const snapshot = buildPlayerIdentitySnapshot({ asOf: new Date(exported.retrievedAt).toISOString(),
    provenance: "Approved bounded Supabase identity export; APPROVED-EXPORT.json",
    completeness: { status: "partial", scope: "Podkolzin/Nugent-Hopkins/RNH candidate evidence; not a league directory", omittedRecords: null },
    records: exported.players.map((player: any) => {
      const registries = exported.identities.filter((identity: any) => identity.nhl_player_id === player.id && identity.verification_status === "verified");
      if (registries.length !== 1 || registries[0].canonical_name !== player.fullName) throw Error("registry link conflict");
      return { identity: { playerId: player.id, registryId: registries[0].id, fullName: player.fullName,
        lastName: player.lastName, position: player.position },
      // Neither alias table in the approved scope supplies validity dates. No invented intervals or global aliases.
      verifiedAliases: [],
      memberships: exported.memberships.filter((r: any) => r.playerId === player.id && r.seasonId === 20262027
        && (r.ended_at !== null || r.is_current === true)).map((r: any) => ({ teamId: r.teamId,
        startsAt: r.created_at, endsAt: r.ended_at,
        provenance: "rosters created_at/ended_at, season 20262027; existing source-time review semantics" })) };
    }) });
  const index = indexPlayerIdentitySnapshot(snapshot);
  const source: FixtureIdentitySource = { id: retained.id, text: retained.text, originalPostId: retained.sourceId,
    authorId: retained.author, url: `https://x.com/${retained.author.slice(1)}/status/${retained.sourceId}`,
    publishedAt: retained.publishedAt, receivedAt: retained.receivedAt,
    provenance: { kind: "approved_local", label: "Retained S06 observation; owner-exposed development example",
      lineageKey: `original-post:${retained.sourceId}` } };
  const spans = [{ start: 0, end: 9, text: "Podkolzin" }, { start: 20, end: 23, text: "RNH" }];
  const rows = spans.map(span => ({ raw_name: span.text, context_text: source.text, team_id: null,
    metadata: { sourcePublishedAt: source.publishedAt, evidence: { ...span, origin: "parser" as const } } }));
  const local = await evaluateLocalAliasIdentityReview({ enabled: true, source, index, rows });
  if (local.status !== "evaluated" || local.occurrences.length !== 2 || local.holds.length) throw Error("caller extraction held");
  const mentions = local.occurrences.map(o => ({ id: o.id, kind: "name" as const, span: o.span, teamHint: null, positionHint: null }));
  const prepared = prepareFixtureIdentityRequest({ enabled: true, source, index, mentions });
  if (prepared.status !== "prepared") throw Error("preparation held");
  const widened = spans.map(span => ({ span, candidateSet: retrieveTweetIdentityCandidates({ index,
    mention: span.text, publishedAt: source.publishedAt!, pass: 1 }) }));
  // Separate development labels, joined after retrieval. Never passed into request construction.
  const labels = [
    { span: spans[0], canonicalId: "nhl:8481617", fullName: "Vasily Podkolzin", registryId: 10190 },
    { span: spans[1], canonicalId: "nhl:8476454", fullName: "Ryan Nugent-Hopkins", registryId: 9521 },
  ];
  const comparisons = local.occurrences.map((occurrence, i) => ({ ...occurrence, ownerDevelopmentLabel: labels[i],
    baselineContainsExpected: occurrence.baselineCandidateIds.includes(labels[i]!.canonicalId),
    deterministicRetrievalContainsExpected: occurrence.candidateIds.includes(labels[i]!.canonicalId),
    boundedWideningContainsExpected: widened[i]!.candidateSet.candidates.some(c => c.row.canonicalId === labels[i]!.canonicalId) }));
  let invalidRnhMatchRejection: string | null = null;
  try {
    validateFixtureIdentityProposal(prepared.request, { version: prepared.request.content.version,
      requestHash: prepared.request.hash, directoryHash: snapshot.hash,
      occurrences: local.occurrences.map((o, i) => ({ occurrenceId: o.id, canonicalId: labels[i]!.canonicalId,
        status: "matched", evidence: o.span, identityConfidence: "strong" })) });
  } catch (error) { invalidRnhMatchRejection = error instanceof Error ? error.message : "unknown"; }
  if (invalidRnhMatchRejection !== "identity_not_in_occurrence_candidates") throw Error("missing candidate fail-closed check failed");
  const missing = comparisons.filter(o => !o.deterministicRetrievalContainsExpected);
  if (!missing.length) throw Error("retrieval gate unexpectedly changed; do not dispatch from this analysis script");
  save("DIRECTORY.json", snapshot);
  save("PREPARED-INPUT.json", prepared.request);
  save("OWNER-BINDINGS.json", { cohort: "owner_adjudicated_development_not_holdout", labels,
    provenance: "TJ supplied names/replacement direction; approved export supplies canonical IDs. No independent holdout adjudication.",
    priorSlotStateVerified: false, sourceTimePositionVerified: false, labelsExcludedFromPreparedInput: true });
  save("RESULT.json", { status: "paid_step_blocked_retrieval_gate", providerRequests: 0, newModelCostUsd: 0,
    reserveAdmittedNanoUsd: 0, wireRequestSealed: false, requestId: null, providerUsage: null, rawModelProposals: null,
    sourceHashUtf8: sha(source.text), sourceFileHash: sha(readFileSync(sourceFile)), directoryHash: snapshot.hash,
    preparedInputHash: prepared.request.hash, exportedDistinctPlayers: ids.size, exportedRelatedRows: related,
    canonicalRowCounts: { players: exported.players.length, registryLinks: exported.identities.length },
    relatedRowCounts: { registryAliases: exported.registry_aliases.length, lineupAliases: exported.lineup_aliases.length, memberships: exported.memberships.length },
    capReached: false, directoryCompleteness: snapshot.content.completeness, source, callerResult: local, comparisons, widened,
    invalidRnhMatchRejection, stopReason: "RNH expected ID is absent from both initial and bounded widened occurrence candidates; no paid dispatch permitted by sealed preflight policy.",
    evidenceLimits: ["No RNH alias was returned from either alias table within the approved search.",
      "All returned alias records are undated; none is promoted to a dated global alias.",
      "Both roster intervals include source time under existing created_at/ended_at/is_current semantics; not independently audited trade history.",
      "No team or position hint occurs in S06. Team 22 is not injected into occurrence hints from the roster or owner memory.",
      "The snapshot is candidate-scoped and partial. No full-league ambiguity or accuracy claim.",
      "No real model response, usage, latency, accuracy, certainty inflation or subject-binding metric is available."] });
  process.stdout.write(JSON.stringify({ status: "paid_step_blocked_retrieval_gate", comparisons: comparisons.map(o => ({
    mention: o.span.text, baseline: o.baselineSelectedId, candidates: o.candidateIds,
    deterministic: o.deterministicSelectedId, widenedCandidates: widened.find(w => w.span.text === o.span.text)!.candidateSet.candidates.map(c => c.row.canonicalId)
  })), invalidRnhMatchRejection, providerRequests: 0 }) + "\n");
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Local analysis failed"}\n`); process.exitCode = 1; });

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateLocalAliasIdentityReview } from "../../../../web/lib/sources/tweetIdentityLocalReview";
import { identityDigest, indexPlayerIdentitySnapshot } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { prepareFixtureIdentityRequest, validateFixtureIdentityProposal } from "../../../../web/lib/sources/tweetIdentityProposal";

const read = (path: string) => JSON.parse(readFileSync(join(__dirname, path), "utf8"));
const save = (name: string, value: unknown) => writeFileSync(join(__dirname, name), JSON.stringify(value, null, 2) + "\n");
type BoundLabel = { occurrenceId: string; span: { start: number; end: number; text: string }; canonicalId: string };
function checkLabelBindings(bindings: BoundLabel[], occurrences: { id: string; span: BoundLabel["span"] }[]) {
  if (bindings.length !== occurrences.length || new Set(bindings.map(b => b.occurrenceId)).size !== bindings.length) throw Error("grade_binding_count_or_duplicate_id");
  for (const occurrence of occurrences) {
    const matches = bindings.filter(binding => binding.occurrenceId === occurrence.id);
    if (matches.length !== 1 || identityDigest(matches[0]!.span) !== identityDigest(occurrence.span)) throw Error("grade_binding_span_mismatch");
  }
}
async function main() {
  if (process.argv[2] === "--check-label-bindings") {
    const request = read("PREPARED-INPUT.json"), bindings = read("GRADING-BINDINGS.json");
    checkLabelBindings([...bindings].reverse(), request.content.occurrences);
    for (const invalid of [[bindings[0], bindings[0]], [{ ...bindings[0], span: bindings[1].span }, bindings[1]]]) {
      let rejected = false;
      try { checkLabelBindings(invalid, request.content.occurrences); } catch { rejected = true; }
      if (!rejected) throw Error("invalid_grading_binding_accepted");
    }
    process.stdout.write("Grading bindings: reordered labels accepted; duplicate IDs and wrong spans rejected\n");
    return;
  }
  if (process.argv[2] === "--validate") {
    const body = read("PROVIDER-RESULT.json").response;
    if (body.model !== "gpt-6-luna" || body.status !== "completed") throw Error("incomplete_or_wrong_model_response");
    const messages = body.output.filter((item: { type: string }) => item.type === "message");
    if (messages.length !== 1 || messages[0].role !== "assistant" || messages[0].content.length !== 1
      || messages[0].content[0].type !== "output_text" || body.output.some((item: { type: string }) => !["message", "reasoning"].includes(item.type))) throw Error("unexpected_provider_output");
    const raw = JSON.parse(messages[0].content[0].text);
    save("RAW-PROPOSALS.json", raw);
    const validated = validateFixtureIdentityProposal(read("PREPARED-INPUT.json"), raw);
    const baseline = read("LOCAL-BASELINE.json"), bindings: BoundLabel[] = read("GRADING-BINDINGS.json");
    checkLabelBindings(bindings, read("PREPARED-INPUT.json").content.occurrences);
    const rows = validated.occurrences.map(o => {
      const label = bindings.find(binding => binding.occurrenceId === o.occurrenceId);
      const prior = baseline.occurrences.find((item: { id: string }) => item.id === o.occurrenceId);
      if (!label || !prior || identityDigest(label.span) !== identityDigest(o.evidence)) throw Error("grade_binding_missing_or_wrong_evidence");
      return { occurrence: o.evidence.text, proposal: o, ownerDevelopmentExpected: label.canonicalId,
        expectedAgreement: o.canonicalId === label.canonicalId, baselineSelectedId: prior.baselineSelectedId,
        deterministicSelectedId: prior.deterministicSelectedId };
    });
    save("VALIDATED-RESULT.json", { status: "valid_identity_proposals_only", rows,
      cohort: "one_owner_exposed_development_tweet_two_occurrences_not_holdout",
      canPublish: false, canWriteAliases: false, canChangeStatus: false,
      noClaimCertaintyFields: true, accuracyOrCollisionRateEstimate: null,
      certaintyInflationAndSubjectBindingEvaluation: "not measured: identity-only output, original source retained; no claim interpreter or replacement operation executed" });
    process.stdout.write(JSON.stringify({ status: "valid_identity_proposals_only", rows }) + "\n");
    return;
  }
  const index = indexPlayerIdentitySnapshot(read("../real-trial-2026-10-20/DIRECTORY.json"));
  const source = read("../real-trial-2026-10-20/PREPARED-INPUT.json").content.source;
  const spans = [{ start: 0, end: 9, text: "Podkolzin" }, { start: 20, end: 23, text: "RNH" }];
  const local = await evaluateLocalAliasIdentityReview({ enabled: true, source, index,
    rows: spans.map(span => ({ raw_name: span.text, context_text: source.text, team_id: null,
      metadata: { sourcePublishedAt: source.publishedAt, evidence: { ...span, origin: "parser" as const } } })) });
  if (local.status !== "evaluated" || local.holds.length || local.occurrences.length !== 2) throw Error("local_caller_held");
  const prepared = prepareFixtureIdentityRequest({ enabled: true, index, source,
    mentions: local.occurrences.map(o => ({ id: o.id, kind: "name", span: o.span, teamHint: null, positionHint: null })) });
  if (prepared.status !== "prepared") throw Error("request_held");
  // Labels are checked after actual retrieval, never appended to its inputs or wire hints.
  const labels = read("../real-trial-2026-10-20/OWNER-BINDINGS.json").labels;
  if (labels.length !== local.occurrences.length) throw Error("owner_label_count_mismatch");
  const bindings: BoundLabel[] = local.occurrences.map(o => {
    const matching = labels.filter((label: { span: BoundLabel["span"] }) => identityDigest(label.span) === identityDigest(o.span));
    if (matching.length !== 1) throw Error("owner_label_span_missing_or_duplicated");
    return { occurrenceId: o.id, span: o.span, canonicalId: matching[0].canonicalId };
  });
  checkLabelBindings(bindings, local.occurrences);
  if (!local.occurrences.every((o, i) => o.candidateIds.includes(labels[i].canonicalId) && !o.candidateTruncated)) throw Error("retrieval_gate_failed");
  if (local.occurrences[1]!.deterministicSelectedId !== null) throw Error("acronym_became_deterministic_match");
  const request = prepared.request;
  const schema = { type: "object", additionalProperties: false,
    required: ["version", "requestHash", "directoryHash", "occurrences"], properties: {
      version: { type: "string", enum: [request.content.version] }, requestHash: { type: "string", enum: [request.hash] },
      directoryHash: { type: "string", enum: [index.snapshot.hash] },
      occurrences: { type: "array", minItems: 2, maxItems: 2, items: { type: "object", additionalProperties: false,
        required: ["occurrenceId", "canonicalId", "status", "evidence", "identityConfidence"], properties: {
          occurrenceId: { type: "string", enum: local.occurrences.map(o => o.id) },
          canonicalId: { type: ["string", "null"], enum: [...new Set(local.occurrences.flatMap(o => o.candidateIds)), null] },
          status: { type: "string", enum: ["matched", "ambiguous", "missing", "conflicting", "not_player", "needs_widening"] },
          evidence: { type: "object", additionalProperties: false, required: ["start", "end", "text"], properties: {
            start: { type: "integer", minimum: 0, maximum: source.text.length },
            end: { type: "integer", minimum: 1, maximum: source.text.length }, text: { type: "string" } } },
          identityConfidence: { type: "string", enum: ["strong", "tentative", "unknown"] },
        } } },
    } };
  const wire = { ...read("../real-trial-preflight/WIRE-PARAMETERS.json"),
    instructions: request.content.instructions.join("\n"), input: JSON.stringify(request),
    text: { format: { type: "json_schema", name: "tweet_identity_proposal_v1", strict: true, schema } } };
  if (request.hash !== identityDigest(request.content)) throw Error("request_hash_mismatch");
  save("GRADING-BINDINGS.json", bindings);
  save("LOCAL-BASELINE.json", local); save("PREPARED-INPUT.json", request); save("OUTPUT-SCHEMA.json", schema); save("WIRE.json", wire);
  process.stdout.write(JSON.stringify({ status: "retrieval_gate_passed", directoryHash: index.snapshot.hash,
    rows: local.occurrences.map(o => ({ mention: o.span.text, baseline: o.baselineSelectedId,
      retrieved: o.candidateIds, deterministic: o.deterministicSelectedId })), paidRequests: 0 }) + "\n");
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Identity preparation failed"}\n`); process.exitCode = 1; });

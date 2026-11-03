import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createLunaEvaluationBatch } from "../lib/sources/fixtures/tweetLunaEvaluation";
import { identityDigest } from "../lib/sources/playerIdentitySnapshot";
import { runRetainedTweetLunaReview } from "../lib/sources/tweetLunaReview";
import { scoreLunaEvaluation } from "../lib/sources/tweetLunaEvaluationScoring";
import { openLunaLocalAdmission } from "../lib/sources/tweetLunaLocalStore";
import { createLunaTransport, LUNA_MODEL, priceLunaUsage, type LunaEndpoint } from "../lib/sources/tweetLunaTransport";

/** Offline only: no environment access, real credential, global fetch or dispatch option.
 * The actual caller/transport/admission run with a prescribed synthetic responder.
 * Frozen expected labels are authored independently of validator acceptance.
 */
export async function rehearseLunaEvaluation(outputDirectory: string, scenario?: "provider-failure" | "missing-status" | "equivalent-evidence-and-order") {
  const batch = createLunaEvaluationBatch(), budget = batch.content.budget;
  mkdirSync(outputDirectory, { mode: 0o700 }); // Require a new directory; never reset a spending ledger.
  const save = (name: string, value: unknown) => writeFileSync(join(outputDirectory, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  save("batch.json", batch); // Pin inputs, bindings, labels and retry budget before any responder call.
  const ledgerPath = join(outputDirectory, "SYNTHETIC-ONLY-ledger.json");
  save("SYNTHETIC-ONLY-ledger.json", { version: "luna-local-admission-v1", approvedPolicyId: `OFFLINE-NO-PAID-AUTHORITY:${batch.hash}`,
    enabled: true, blockedReason: null, expiresAt: budget.expiresAt, capNanoUsd: budget.capNanoUsd,
    priorExposureNanoUsd: budget.priorExposureNanoUsd, maxCalls: budget.maxCalls, attempts: {} });
  const now = () => "2026-10-31T20:00:00Z";
  const requests: { caseId: string; endpoint: LunaEndpoint; body: any; hash: string; bytes: number; estimatedNanoUsd: number }[] = [];
  const results: { caseId: string; labelMatch: boolean; review: Awaited<ReturnType<typeof runRetainedTweetLunaReview>> }[] = [];
  let current = batch.content.entries[0]!, stopped = false;
  // This function is intentionally not an injectable network client or paid runner.
  const syntheticFetch: typeof fetch = async (url, init) => {
    if (!init || typeof init.body !== "string" || requests.length >= budget.maxCalls) throw new Error("synthetic_request_limit");
    const endpoint: LunaEndpoint = String(url).endsWith("/responses") ? "responses" : "decisions";
    const body = JSON.parse(init.body), bytes = Buffer.byteLength(init.body);
    const estimatedNanoUsd = priceLunaUsage({ model: LUNA_MODEL,
      usage: { input_tokens: bytes + 1024, output_tokens: 2048 } }, endpoint);
    requests.push({ caseId: current.id, endpoint, body, hash: identityDigest({ endpoint, body }), bytes, estimatedNanoUsd });
    if (scenario === "provider-failure") throw new Error("synthetic_provider_failure");
    let response: any = { id: `synthetic-${current.id}-${endpoint}`, model: LUNA_MODEL, usage: { input_tokens: 100, output_tokens: 50 } };
    if (endpoint === "responses") {
      const input = JSON.parse(body.input), request = input.identityRequest;
      if (input.developmentExamples !== undefined || input.developmentLibrary !== undefined
        || input.referencePackage.mode !== "rules-and-synthetic-only") throw new Error("synthetic_source_boundary_failed");
      const identity = { version: request.version, requestHash: input.identityRequestHash, directoryHash: request.directory.hash,
        occurrences: current.expected.identity.map(o => ({ ...o, identityConfidence: o.status === "matched" ? "tentative" : "unknown" })) };
      const goalieStatuses = structuredClone(current.expected.goalie);
      if (scenario === "equivalent-evidence-and-order") {
        identity.occurrences.reverse(); goalieStatuses.reverse();
        for (const goalie of goalieStatuses) {
          const variants = current.expected.goalieEvidenceVariants.find(v => v.occurrenceId === goalie.occurrenceId)!.allowedSpans;
          goalie.evidence = variants[current.id === "E01" ? 2 : 1]!;
        }
      }
      const proposal = { identity, goalieStatuses: scenario === "missing-status" ? [] : goalieStatuses };
      response = { ...response, status: "completed", output: [{ type: "message", role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(proposal) }] }] };
    } else {
      if (!current.decisionsBinding || !isDeepStrictEqual(body.questions, current.decisionsBinding.request.questions)
        || body.input !== current.decisionsBinding.request.input) throw new Error("synthetic_binding_changed");
      response.answers = body.questions.map((q: any) => {
        if (q.type === "predicate") return { name: q.name, type: q.type, probability: current.expected.decisions!.relevance ? 0.95 : 0.05 };
        const choice = q.name.endsWith("_support") ? current.expected.decisions!.support : current.expected.decisions!.wording;
        return { name: q.name, type: q.type, choice, confidence: 1,
          probabilities: q.choices.map((c: any) => ({ value: c.value, probability: c.value === choice ? 1 : 0 })) };
      });
    }
    return new Response(JSON.stringify(response), { headers: { "x-request-id": `synthetic-${current.id}-${endpoint}` } });
  };
  const transport = createLunaTransport({ enabled: true, stopped: () => stopped,
    apiKey: () => "offline-synthetic-not-a-credential", admission: openLunaLocalAdmission(ledgerPath, () => Date.parse(now())), fetch: syntheticFetch });
  for (const entry of batch.content.entries) {
    current = entry;
    const review = await runRetainedTweetLunaReview({ enabled: true, input: entry.input, transport, now });
    const { labelMatch } = scoreLunaEvaluation(entry.expected, review);
    results.push({ caseId: entry.id, labelMatch, review });
    if (review.status !== "review_only" || !labelMatch || review.holds.includes("decisions_unresolved")) { stopped = true; break; }
  }
  save("requests.json", { batchHash: batch.hash, requests });
  save("results.json", { batchHash: batch.hash, results });
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const summary = { version: "luna-offline-rehearsal-v2", batchHash: batch.hash, requestsHash: identityDigest(requests),
    status: stopped ? "held" : "passed", completedReports: results.length, matchedReports: results.filter(r => r.labelMatch).length,
    responsesCalls: requests.filter(r => r.endpoint === "responses").length, decisionsCalls: requests.filter(r => r.endpoint === "decisions").length,
    maxCalls: budget.maxCalls, maxRetries: budget.maxRetries, concurrency: budget.concurrency,
    estimatedNewCostNanoUsd: requests.reduce((sum, r) => sum + r.estimatedNanoUsd, 0),
    estimateBasis: "Diagnostic only: serialized UTF-8 bytes plus 1024 as input tokens, maximum output; not a proven provider token bound. Full-context reservations and aggregate admission govern.",
    syntheticReceiptChargesNanoUsd: Object.values(ledger.attempts as Record<string, any>).reduce((sum, a) => sum + (a.receipt?.chargeNanoUsd ?? 0), 0),
    actualPaidRequests: 0, actualPaidCostNanoUsd: 0, ledgerBlockedReason: ledger.blockedReason,
    meaning: "Prescribed synthetic responses through real caller/transport/local admission; not model accuracy, billing evidence or independent holdout.",
    expectedLabels: "Frozen assistant-authored labels pending independent review; no human-ground-truth claim.", scenario: scenario ?? null };
  save("rehearsal.json", summary);
  return summary;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") throw new Error("Offline only: --output NEW_DIRECTORY");
  rehearseLunaEvaluation(resolve(args[1]!)).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.status !== "passed") process.exitCode = 2;
  }).catch(() => { process.stderr.write("Offline rehearsal failed; inspect local synthetic artifacts. No paid dispatch exists in this script.\n"); process.exitCode = 1; });
}

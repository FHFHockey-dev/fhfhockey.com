import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { runRetainedTweetLunaReview } from "../../../../web/lib/sources/tweetLunaReview";
import { proposeLunaEvidenceBindingReview, LUNA_EVIDENCE_BINDING_POLICY } from "../../../../web/lib/sources/tweetLunaEvidenceBinding";
import { createLunaTransport } from "../../../../web/lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../../../../web/lib/sources/tweetLunaLocalStore";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// Saved responses only, isolated fake-key ledger, inherited network denial.
// No environment loader, real ledger mutation, provider request or retry.
async function main() {
  const base = resolve("../tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "span-binding-review");
  const read = (path: string) => JSON.parse(readFileSync(join(base, path), "utf8"));
  const sha = (path: string) => createHash("sha256").update(readFileSync(join(base, path)) as unknown as Uint8Array).digest("hex");
  const start = read("span-binding-review/START-PINS.json"), ledger = read("paid-evaluation/ledger.json");
  assert.equal(sha("paid-evaluation/ledger.json"), start.ledgerSha256);
  assert.equal(ledger.enabled, false); assert.equal(Object.keys(ledger.attempts).length, 4);
  const results = [];
  for (const [id, prep, execution] of [["E02", "continuation-v4", "continuation-execution"],
    ["E03", "continuation-v4-e03", "continuation-e03-execution"]]) {
    const entry = read(`${prep}/PACKETS.json`).entries[0], wire = read(`${prep}/REQUESTS.json`).requests[0];
    assert.equal(entry.id, id);
    const hash = identityDigest({ endpoint: "responses", body: wire.body }), receipt = ledger.attempts[hash].receipt;
    const rawOutputText = receipt.body.output[0].content[0].text;
    const request = { content: JSON.parse(wire.body.input).identityRequest, hash: JSON.parse(wire.body.input).identityRequestHash };
    const candidate = proposeLunaEvidenceBindingReview({ policy: LUNA_EVIDENCE_BINDING_POLICY, request, rawOutputText });
    assert.equal(candidate.status, "candidate_for_human_review");
    assert.equal(candidate.rawOutputText, rawOutputText);
    assert.equal(candidate.corrections.length, 1);
    assert.equal(candidate.corrections[0]!.proposed.end, id === "E02" ? 40 : 46);
    assert.deepEqual(candidate.candidate!.identity, JSON.parse(rawOutputText).identity);
    const proposed = candidate.candidate!.goalieStatuses[0]!, expected = entry.expected.goalie[0];
    assert.equal(proposed.status, expected.status); assert.equal(proposed.occurrenceId, expected.occurrenceId);
    assert.equal(proposed.canonicalId, expected.canonicalId);
    assert(entry.expected.goalieEvidenceVariants[0].allowedSpans.some((e: unknown) => identityDigest(e) === identityDigest(proposed.evidence)));
    assert.equal(proposed.verified, false); assert.equal(candidate.canApply, false);
    const temp = mkdtempSync(join(tmpdir(), "luna-span-review-offline-"));
    try {
      const path = join(temp, "SYNTHETIC-ONLY.json"), now = () => "2026-10-31T21:36:45Z";
      writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "OFFLINE-SPAN-REPLAY-NO-AUTHORITY",
        enabled: true, blockedReason: null, expiresAt: "2026-11-01T23:59:59Z", priorExposureNanoUsd: 0, capNanoUsd: 1_000_000_000, maxCalls: 1, attempts: {} }));
      let calls = 0;
      const transport = createLunaTransport({ enabled: true, stopped: () => false, apiKey: () => "offline-not-a-credential",
        admission: openLunaLocalAdmission(path, () => Date.parse(now())), fetch: async (url, init) => {
          assert(String(url).endsWith("/responses")); assert.equal(++calls, 1);
          assert.deepEqual(JSON.parse(String(init?.body)), wire.body);
          return new Response(JSON.stringify(receipt.body), { headers: { "x-request-id": receipt.requestId } });
        } });
      const review = await runRetainedTweetLunaReview({ enabled: true, input: entry.input, transport, now });
      assert.deepEqual(review, read(`${execution}/reviews/${id}.json`));
      const historicalScore = scoreLunaEvaluation(entry.expected, review);
      assert.equal(historicalScore.labelMatch, false); assert.equal(review.status, "held");
      results.push({ id, originalRequestHash: hash, originalReviewReproducedExactly: true, historicalScore,
        candidateLabelFieldsMatch: true, originalModelFailureRemains: true, candidate, mockCalls: calls, actualProviderRequests: 0 });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.equal(sha("paid-evaluation/ledger.json"), start.ledgerSha256);
  const output = { version: "luna-span-binding-offline-replay-v1", actualProviderRequests: 0, realLedgerUnchanged: true,
    provenance: "exposed-synthetic-development; no holdout or new prediction", results };
  writeFileSync(join(dir, "OFFLINE-REPLAY.json"), JSON.stringify(output, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ actualProviderRequests: 0, realLedgerUnchanged: true,
    results: results.map(({ candidate, ...result }) => ({ ...result, candidateStatus: candidate.status, corrections: candidate.corrections })) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });

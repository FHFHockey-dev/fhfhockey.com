import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";
import { exactIdentitySpan } from "../../../../web/lib/sources/tweetIdentityProposal";
import { runRetainedTweetLunaReview } from "../../../../web/lib/sources/tweetLunaReview";
import { createLunaTransport } from "../../../../web/lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../../../../web/lib/sources/tweetLunaLocalStore";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";

// Saved reply/isolated synthetic ledger only. No environment loader or network fallback.
async function main() {
  const base = resolve("../tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "e02-boundary-diagnosis");
  const read = (p: string) => JSON.parse(readFileSync(join(base, p), "utf8"));
  const sha = (p: string) => createHash("sha256").update(readFileSync(join(base, p)) as unknown as Uint8Array).digest("hex");
  const start = read("e02-boundary-diagnosis/START-PINS.json"), ledger = read("paid-evaluation/ledger.json");
  assert.equal(sha("paid-evaluation/ledger.json"), start.ledgerSha256); assert.equal(ledger.enabled, false);
  const plan = read("continuation-v4/PLAN.json"), requestHash = plan.sequence[0].hash;
  const receipt = ledger.attempts[requestHash].receipt;
  const entry = read("continuation-v4/PACKETS.json").entries[0], source: string = entry.input.packet.source.text;
  const raw: string = receipt.body.output[0].content[0].text, proposal = JSON.parse(raw), span = proposal.goalieStatuses[0].evidence;
  assert.equal(createHash("sha256").update(raw).digest("hex"), start.originalProposalTextSha256);
  const wire = read("continuation-v4/REQUESTS.json").requests[0];
  assert.equal(source, JSON.parse(wire.body.input).identityRequest.source.text);
  assert.equal([...source].every(c => c.charCodeAt(0) < 128), true);
  assert.equal(source.length, 40); assert.equal(span.text.length, 36);
  assert.equal(source.indexOf(span.text), 4); assert.equal(source.lastIndexOf(span.text), 4);
  assert.equal(source.slice(4, 38), "Avery Keeper will not start tonigh");
  assert.equal(source.slice(38, 40), "t."); assert.equal(exactIdentitySpan(source, span), false);
  const variants = [
    { name: "observed", end: 38, text: span.text, valid: false },
    { name: "mismatched-punctuation", end: 39, text: span.text, valid: false },
    { name: "counterfactual-corrected-end", end: 40, text: span.text, valid: true },
    { name: "predeclared-equivalent-no-period", end: 39, text: span.text.slice(0, -1), valid: true },
  ];
  const results = [];
  for (const variant of variants) {
    const temp = mkdtempSync(join(tmpdir(), "luna-e02-boundary-offline-"));
    try {
      const path = join(temp, "SYNTHETIC-ONLY.json"), now = () => "2026-10-31T21:18:25Z";
      writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "OFFLINE-EVIDENCE-CONTROL-NO-AUTHORITY",
        enabled: true, blockedReason: null, expiresAt: "2026-11-01T23:59:59Z", priorExposureNanoUsd: 0, capNanoUsd: 1_000_000_000, maxCalls: 1, attempts: {} }));
      let calls = 0;
      const transport = createLunaTransport({ enabled: true, stopped: () => false, apiKey: () => "offline-not-a-credential",
        admission: openLunaLocalAdmission(path, () => Date.parse(now())), fetch: async (url, init) => {
          assert(String(url).endsWith("/responses")); assert.equal(++calls, 1);
          const body = JSON.parse(String(init?.body));
          assert.equal(identityDigest({ endpoint: "responses", body }), requestHash);
          assert.deepEqual(body, wire.body);
          const reply = structuredClone(receipt.body), output = structuredClone(proposal);
          output.goalieStatuses[0].evidence = { start: 4, end: variant.end, text: variant.text };
          reply.output[0].content[0].text = JSON.stringify(output);
          return new Response(JSON.stringify(reply), { headers: { "x-request-id": receipt.requestId } });
        } });
      const review = await runRetainedTweetLunaReview({ enabled: true, input: entry.input, transport, now });
      const score = scoreLunaEvaluation(entry.expected, review), evidence = { start: 4, end: variant.end, text: variant.text };
      assert.equal(exactIdentitySpan(source, evidence), variant.valid);
      assert.equal(score.labelMatch, variant.valid);
      assert.equal(review.status, variant.valid ? "review_only" : "held");
      if (variant.name === "observed") assert.deepEqual(review, read("continuation-execution/reviews/E02.json"));
      if (variant.valid) {
        assert(entry.expected.goalieEvidenceVariants[0].allowedSpans.some((e: any) => identityDigest(e) === identityDigest(evidence)));
        assert.equal(review.goalieStatuses[0]!.verified, false); assert.equal(review.goalieStatuses[0]!.gameId, null);
      }
      results.push({ ...variant, evidence, actualSlice: source.slice(evidence.start, evidence.end), mockCalls: calls,
        exactSpan: exactIdentitySpan(source, evidence), score, review, actualProviderRequests: 0 });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.equal(sha("paid-evaluation/ledger.json"), start.ledgerSha256);
  const output = { version: "luna-e02-boundary-diagnosis-v1", source, allAscii: true, sourceUtf16Length: source.length,
    originalEvidence: span, quoteUtf16Length: span.text.length, quoteUniqueStart: 4, quoteExclusiveEnd: 40,
    omittedCharactersByOffsets: "t.", originalRequestHash: requestHash, originalResultReproducedExactly: true,
    realLedgerUnchanged: true, actualProviderRequests: 0, results };
  writeFileSync(join(dir, "OFFLINE-DIAGNOSIS.json"), JSON.stringify(output, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ ...output, results: results.map(({ review, ...r }) => r) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });

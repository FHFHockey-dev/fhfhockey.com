import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { runRetainedTweetLunaReview } from "../../../../web/lib/sources/tweetLunaReview";
import { createLunaTransport } from "../../../../web/lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../../../../web/lib/sources/tweetLunaLocalStore";
import { scoreLunaEvaluation } from "../../../../web/lib/sources/tweetLunaEvaluationScoring";
import { identityDigest } from "../../../../web/lib/sources/playerIdentitySnapshot";

// Saved provider replies only. No environment/key loading or network fallback.
async function main() {
  const label = process.argv[2];
  if (!["baseline", "candidate"].includes(label!)) throw new Error("offline_replay_label_required");
  const base = resolve("../tasks/artifacts/luna-reference-package-2026-10-31");
  const read = (name: string) => JSON.parse(readFileSync(join(base, name), "utf8"));
  const oldLedger = read("paid-evaluation/ledger.json"), savedReview = read("paid-evaluation/reviews/E01.json");
  if (oldLedger.enabled || Object.keys(oldLedger.attempts).length !== 2) throw new Error("paid_stop_changed");
  const receipts: any[] = Object.values(oldLedger.attempts).map((a: any) => a.receipt);
  const frozen = read("repair-r2/rehearsal/batch.json").content.entries[0];
  const oldRequests = read("repair-r2/rehearsal/requests.json").requests.filter((r: any) => r.caseId === "E01");
  const now = () => "2026-10-31T20:53:30Z", results = [];
  for (const variant of ["observed-omission", "counterfactual-positive"]) {
    const dir = mkdtempSync(join(tmpdir(), "luna-saved-offline-")), path = join(dir, "SYNTHETIC-ONLY.json");
    try {
      writeFileSync(path, JSON.stringify({ version: "luna-local-admission-v1", approvedPolicyId: "OFFLINE-SAVED-REPLY-NO-PAID-AUTHORITY",
        enabled: true, blockedReason: null, expiresAt: "2026-11-01T23:59:59Z", capNanoUsd: 1_000_000_000,
        priorExposureNanoUsd: 0, maxCalls: 2, attempts: {} }));
      const requests: any[] = [];
      const transport = createLunaTransport({ enabled: true, stopped: () => false, apiKey: () => "offline-not-a-credential",
        admission: openLunaLocalAdmission(path, () => Date.parse(now())), fetch: async (url, init) => {
          const endpoint = String(url).endsWith("/responses") ? "responses" : "decisions";
          const body = JSON.parse(String(init?.body)), receipt = receipts.find(r => r.endpoint === endpoint);
          if (!receipt || requests.length >= 2) throw new Error("saved_reply_unavailable");
          requests.push({ endpoint, body, hash: identityDigest({ endpoint, body }) });
          const reply = structuredClone(receipt.body);
          if (variant === "counterfactual-positive" && endpoint === "responses") {
            const content = reply.output[0].content[0], proposal = JSON.parse(content.text);
            // One explicit counterfactual: pre-existing frozen label, not a model prediction.
            proposal.goalieStatuses = structuredClone(frozen.expected.goalie);
            content.text = JSON.stringify(proposal);
          }
          return new Response(JSON.stringify(reply), { headers: { "x-request-id": receipt.requestId } });
        } });
      const review = await runRetainedTweetLunaReview({ enabled: true, input: frozen.input, transport, now });
      const result = { variant, actualProviderRequests: 0, mockCalls: requests.length,
        frozenRequestHashesMatch: requests.every((r, i) => r.hash === oldRequests[i]?.hash),
        strictSchemaUnchanged: isDeepStrictEqual(requests[0].body.text, oldRequests[0].body.text),
        identityRequestUnchanged: isDeepStrictEqual(JSON.parse(requests[0].body.input).identityRequest, JSON.parse(oldRequests[0].body.input).identityRequest),
        decisionsRequestUnchanged: isDeepStrictEqual(requests[1].body, oldRequests[1].body),
        retainedResultExactlyMatchesPaid: isDeepStrictEqual(review, savedReview),
        score: scoreLunaEvaluation(frozen.expected, review), review, requests };
      results.push(result);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  const summary = { label, actualProviderRequests: 0, savedReplyReplayOnly: true, results };
  writeFileSync(join(base, "omission-diagnosis", `${label}-replay.json`), JSON.stringify(summary, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ label, results: results.map(({ review, requests, ...r }) => r) }, null, 2) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });

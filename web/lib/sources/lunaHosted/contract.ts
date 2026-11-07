import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { identityDigest } from "../playerIdentitySnapshot";
import { getLunaReferencePackage } from "../tweetLunaReference";
import type { LunaReviewInput } from "../tweetLunaReview";
import { mapTweetDecisionReview } from "../tweetDecisionReviewMapping";

export const HOSTED_LUNA_VERSION = "luna-hosted-review-v1";
export const jobIdSchema = z.string().uuid().transform(value => value.toLowerCase());
export const requestSchema = z.object({ jobId: jobIdSchema }).strict();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const jobSchema = z.object({
  id: jobIdSchema, inputJson: z.string().max(512_000), inputHash: digest,
  referenceHash: digest, receiptJson: z.string().max(512_000), receiptHash: digest,
  provenanceRef: z.string().min(1).max(500),
}).strict();

/** Only a private owner-staged job is accepted. The HTTP caller supplies just its ID.
 * The owner must import the receipt from verified immutable retention; copying an
 * arbitrary packet into this table does not authenticate its original reporter.
 */
export function validateHostedLunaJob(value: unknown, expectedId: string): LunaReviewInput {
  const job = jobSchema.parse(value);
  const receipt = JSON.parse(job.receiptJson) as unknown;
  if (Buffer.byteLength(job.receiptJson) > 512_000) throw new Error("invalid_hosted_job");
  if (job.id !== jobIdSchema.parse(expectedId) || Buffer.byteLength(job.inputJson) > 512_000
    || identityDigest(receipt) !== job.receiptHash) throw new Error("invalid_hosted_job");
  const input = JSON.parse(job.inputJson) as LunaReviewInput;
  if (identityDigest(input) !== job.inputHash
    || !isDeepStrictEqual(input.packet?.receiptSnapshot, receipt)
    || input.decisions !== false || input.referenceMode !== "rules-and-synthetic-only"
    || !input.identity || input.identity.evaluation.mode !== "causal_as_of"
    || job.referenceHash !== getLunaReferencePackage(input.referenceMode).hash) throw new Error("invalid_hosted_job");
  const mapped = mapTweetDecisionReview({ enabled: true, packet: input.packet,
    extractionVersion: input.extractionVersion, statements: input.statements });
  if (mapped.status !== "mapped") throw new Error("invalid_hosted_job");
  return input;
}

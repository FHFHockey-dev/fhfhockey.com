import { claimHash, TWEET_CLAIM_EXTRACTION_VERSION, type TweetClaimEnvelope } from "./tweetClaimExtraction";

export type TweetClaimEvaluationCohort = { id: string; startsAt: string; extractionVersion: string; endsAt?: string; maxSamples?: number };
export type TweetClaimEvaluationSample = {
  id: string; cohortId: string; lineageKey: string; originId: string; documentHash: string;
  publishedAt: string; receivedAt: string; capturedAt: string; extractionVersion: string;
  text: string; predictions: Array<{ key: string; qualified: boolean }>; exceptionReasons: string[];
};
export type TweetClaimEvaluationLabel = {
  sampleId: string; documentHash: string; extractionVersion: string; labeledAt: string;
  /** Complete claim annotation is required before computing recall. */
  complete: boolean; expectedClaimKeys: string[]; evidence: string;
};
export type TweetClaimEvaluationExport = {
  cohorts: Array<TweetClaimEvaluationCohort & { registeredAt: string }>;
  samples: TweetClaimEvaluationSample[];
  labels: TweetClaimEvaluationLabel[];
};

export function tweetClaimEvaluationConfig(): TweetClaimEvaluationCohort | null {
  const id = process.env.TWEET_CLAIMS_EVALUATION_ID, startsAt = process.env.TWEET_CLAIMS_EVALUATION_START_AT;
  if (!id && !startsAt) return null;
  if (!id?.trim() || !startsAt || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt))) {
    throw new Error("Evaluation requires a named cohort and explicit future start with timezone");
  }
  return { id, startsAt, extractionVersion: TWEET_CLAIM_EXTRACTION_VERSION };
}

/** Raw receipt and original publication must both be genuinely after registration. */
export function captureForwardTweetClaimSample(claims: TweetClaimEnvelope[], cohort: TweetClaimEvaluationCohort, capturedAt: string): TweetClaimEvaluationSample | null {
  const first = claims[0];
  if (!first || first.extractionVersion !== cohort.extractionVersion || !first.semantic.original.tweetId || !first.semantic.original.publishedAt
    || !Number.isFinite(Date.parse(first.semantic.receivedAt)) || !Number.isFinite(Date.parse(cohort.startsAt))
    || !Number.isFinite(Date.parse(first.semantic.original.publishedAt)) || !Number.isFinite(Date.parse(capturedAt))
    || Date.parse(first.semantic.original.publishedAt) < Date.parse(cohort.startsAt) || Date.parse(first.semantic.receivedAt) < Date.parse(cohort.startsAt)
    || Date.parse(capturedAt) < Date.parse(cohort.startsAt) || Date.parse(first.semantic.original.publishedAt) > Date.parse(first.semantic.receivedAt)
    || Date.parse(first.semantic.receivedAt) > Date.parse(capturedAt)
    || (cohort.endsAt != null && (!Number.isFinite(Date.parse(cohort.endsAt)) || Date.parse(capturedAt) >= Date.parse(cohort.endsAt)))) return null;
  const text = first.semantic.evidence.text === "" ? first.source.rawText ?? "" : first.source.primaryTextSource === "quoted_oembed"
    ? first.source.quotedEnrichedText ?? first.source.quotedRawText ?? "" : first.source.enrichedText ?? first.source.rawText ?? "";
  return { id: `tweet-evaluation-v1:${claimHash([cohort.id, first.lineageKey])}`, cohortId: cohort.id, lineageKey: first.lineageKey,
    originId: first.semantic.original.tweetId, documentHash: claimHash(text), text,
    publishedAt: first.semantic.original.publishedAt, receivedAt: first.semantic.receivedAt, capturedAt, extractionVersion: first.extractionVersion,
    predictions: claims.filter(claim => claim.semantic.fact).map(claim => ({ key: claimHash([claim.semantic.fact, claim.semantic.scope]), qualified: claim.semantic.support.status === "supported" })),
    exceptionReasons: [...new Set(claims.flatMap(claim => claim.semantic.support.status === "pending" ? [claim.semantic.support.reason] : []))] };
}

/** Offline metrics over frozen future samples; relays are one origin, not votes. */
export function evaluateForwardTweetClaims(samples: TweetClaimEvaluationSample[], labels: TweetClaimEvaluationLabel[]) {
  const origins = new Map<string, TweetClaimEvaluationSample[]>();
  for (const sample of [...samples].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id))) {
    const key = `${sample.cohortId}:${sample.originId}:${sample.documentHash}:${sample.extractionVersion}`;
    origins.set(key, [...(origins.get(key) ?? []), sample]);
  }
  let truePositive = 0, falsePositive = 0, falseNegative = 0, labeledDocuments = 0, exceptions = 0;
  for (const group of origins.values()) {
    const sample = group[0]!;
    const sampleIds = new Set(group.map(item => item.id));
    if (sample.exceptionReasons.length) exceptions++;
    const matching = labels.filter(label => sampleIds.has(label.sampleId) && label.documentHash === sample.documentHash
      && label.extractionVersion === sample.extractionVersion && label.complete && label.evidence.trim()
      && Number.isFinite(Date.parse(label.labeledAt)) && Date.parse(label.labeledAt) >= Date.parse(sample.capturedAt));
    // Multiple labels need explicit adjudication; never choose whichever is convenient.
    if (matching.length !== 1) continue;
    labeledDocuments++;
    const expected = new Set(matching[0]!.expectedClaimKeys), predicted = new Set(sample.predictions.filter(item => item.qualified).map(item => item.key));
    for (const key of predicted) if (expected.has(key)) truePositive++; else falsePositive++;
    for (const key of expected) if (!predicted.has(key)) falseNegative++;
  }
  return { retainedReceipts: samples.length, distinctOriginDocuments: origins.size, labeledDocuments,
    unadjudicatedDocuments: origins.size - labeledDocuments, truePositive, falsePositive, falseNegative,
    precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null,
    recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null,
    exceptionRate: origins.size ? exceptions / origins.size : null };
}

/** Validate a retained export before reporting metrics; no database or network I/O. */
export function evaluateForwardTweetClaimExport(data: TweetClaimEvaluationExport, asOf: string) {
  if (!Array.isArray(data.cohorts) || !Array.isArray(data.samples) || !Array.isArray(data.labels) || !Number.isFinite(Date.parse(asOf))) throw new Error("Invalid evaluation export");
  const cohorts = new Map(data.cohorts.map(cohort => [cohort.id, cohort]));
  if (cohorts.size !== data.cohorts.length) throw new Error("Duplicate cohort identity");
  for (const cohort of cohorts.values()) if (!cohort.id?.trim() || !cohort.extractionVersion?.trim()
    || !Number.isFinite(Date.parse(cohort.startsAt)) || !Number.isFinite(Date.parse(cohort.registeredAt))
    || Date.parse(cohort.registeredAt) >= Date.parse(cohort.startsAt)) throw new Error("Cohort was not registered before its future start");
  for (const sample of data.samples) {
    const cohort = cohorts.get(sample.cohortId);
    if (!cohort || sample.extractionVersion !== cohort.extractionVersion || !/^\d+$/.test(sample.originId)
      || !Array.isArray(sample.predictions) || !Array.isArray(sample.exceptionReasons) || sample.documentHash !== claimHash(sample.text)
      || [sample.publishedAt, sample.receivedAt, sample.capturedAt].some(time => !Number.isFinite(Date.parse(time)) || Date.parse(time) < Date.parse(cohort.startsAt))
      || Date.parse(sample.publishedAt) > Date.parse(sample.receivedAt) || Date.parse(sample.receivedAt) > Date.parse(sample.capturedAt)
      || Date.parse(sample.capturedAt) > Date.parse(asOf)
      || (cohort.endsAt != null && (!Number.isFinite(Date.parse(cohort.endsAt)) || Date.parse(sample.capturedAt) >= Date.parse(cohort.endsAt)))) throw new Error("Sample is outside the frozen prospective cohort");
  }
  for (const cohort of cohorts.values()) if (cohort.maxSamples != null && (!Number.isInteger(cohort.maxSamples) || cohort.maxSamples < 1
    || data.samples.filter(sample => sample.cohortId === cohort.id).length > cohort.maxSamples)) throw new Error("Evaluation export exceeds frozen receipt budget");
  return { state: data.samples.length ? "export_evaluated" : "no_future_samples", ...evaluateForwardTweetClaims(data.samples, data.labels),
    cohortIds: [...cohorts.keys()], provenance: "Date/hash checks only; retain the authenticated database export receipt" };
}

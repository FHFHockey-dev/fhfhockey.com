import { tweetClaimEvaluationConfig, type TweetClaimEvaluationCohort } from "./tweetClaimEvaluation";

export type BoundedTweetClaimEvaluationCohort = TweetClaimEvaluationCohort & { endsAt: string; maxSamples: number };
export function boundedTweetClaimEvaluationConfig(): BoundedTweetClaimEvaluationCohort | null {
  const cohort = tweetClaimEvaluationConfig();
  if (!cohort) return null;
  const endsAt = process.env.TWEET_CLAIMS_EVALUATION_END_AT, maxSamples = Number(process.env.TWEET_CLAIMS_EVALUATION_MAX_SAMPLES);
  if (!endsAt || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(endsAt) || !Number.isFinite(Date.parse(endsAt))
    || Date.parse(endsAt) <= Date.parse(cohort.startsAt) || Date.parse(endsAt) - Date.parse(cohort.startsAt) > 31 * 86400_000
    || !Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > 1000) throw new Error("Evaluation requires an immutable end within 31 days and a 1–1000 receipt budget");
  return { ...cohort, endsAt, maxSamples };
}

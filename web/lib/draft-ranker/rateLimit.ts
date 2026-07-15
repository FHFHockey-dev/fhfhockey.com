export const DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS = {
  queueHourlyLimit: 120,
  queueDailyLimit: 500,
  responseMinuteLimit: 60,
  responseHourlyLimit: 300,
  communityResponseTenMinuteLimit: 30,
  samePairWeeklyLimit: 3,
} as const;

export type DraftPairwiseRateLimitConfig = {
  [Key in keyof typeof DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS]: number;
};

type PairwiseRateEnvironment = Partial<
  Record<
    | "DRAFT_RANKER_QUEUE_HOURLY_LIMIT"
    | "DRAFT_RANKER_QUEUE_DAILY_LIMIT"
    | "DRAFT_RANKER_RESPONSE_MINUTE_LIMIT"
    | "DRAFT_RANKER_RESPONSE_HOURLY_LIMIT"
    | "DRAFT_RANKER_COMMUNITY_RESPONSE_TEN_MINUTE_LIMIT"
    | "DRAFT_RANKER_SAME_PAIR_WEEKLY_LIMIT",
    string | undefined
  >
>;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : fallback;
}

export function draftPairwiseRateLimitConfig(
  environment: PairwiseRateEnvironment = process.env,
): DraftPairwiseRateLimitConfig {
  return {
    queueHourlyLimit: boundedInteger(
      environment.DRAFT_RANKER_QUEUE_HOURLY_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.queueHourlyLimit,
      10_000,
    ),
    queueDailyLimit: boundedInteger(
      environment.DRAFT_RANKER_QUEUE_DAILY_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.queueDailyLimit,
      50_000,
    ),
    responseMinuteLimit: boundedInteger(
      environment.DRAFT_RANKER_RESPONSE_MINUTE_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.responseMinuteLimit,
      10_000,
    ),
    responseHourlyLimit: boundedInteger(
      environment.DRAFT_RANKER_RESPONSE_HOURLY_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.responseHourlyLimit,
      50_000,
    ),
    communityResponseTenMinuteLimit: boundedInteger(
      environment.DRAFT_RANKER_COMMUNITY_RESPONSE_TEN_MINUTE_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.communityResponseTenMinuteLimit,
      10_000,
    ),
    samePairWeeklyLimit: boundedInteger(
      environment.DRAFT_RANKER_SAME_PAIR_WEEKLY_LIMIT,
      DEFAULT_DRAFT_PAIRWISE_RATE_LIMITS.samePairWeeklyLimit,
      1_000,
    ),
  };
}

import type { YahooDraftProviderStatus } from "./liveDraft";

const MAX_FAILURE_DELAY_SECONDS = 60;

export type YahooDraftPollPolicyInput = {
  burstPollsRemaining?: number;
  consecutiveFailures?: number;
  draftTime?: string | null;
  providerStatus: YahooDraftProviderStatus;
  retryAfterSeconds?: number | null;
  unchangedPolls?: number;
};

export type YahooDraftPollPolicyOptions = {
  burstEnabled?: boolean;
  now?: Date;
  random?: () => number;
};

function predraftDelaySeconds(draftTime: string | null | undefined, now: Date) {
  if (!draftTime) return 30;
  const draftTimeMs = Date.parse(draftTime);
  if (!Number.isFinite(draftTimeMs)) return 30;
  const minutesUntilDraft = (draftTimeMs - now.getTime()) / 60_000;
  if (minutesUntilDraft > 15) return 60;
  if (minutesUntilDraft > 2) return 30;
  return 12;
}

function activeDelaySeconds(unchangedPolls: number) {
  if (unchangedPolls >= 6) return 30;
  if (unchangedPolls >= 3) return 15;
  return 10;
}

export function yahooDraftPollDelaySeconds(
  input: YahooDraftPollPolicyInput,
  options: YahooDraftPollPolicyOptions = {},
) {
  const failures = Math.max(0, Math.floor(input.consecutiveFailures ?? 0));
  const retryAfter = Math.max(0, Math.ceil(input.retryAfterSeconds ?? 0));
  const random = options.random ?? Math.random;
  const jitter = Math.min(2, Math.floor(Math.max(0, random()) * 3));

  if (failures > 0) {
    const exponential = Math.min(
      MAX_FAILURE_DELAY_SECONDS,
      5 * 2 ** (failures - 1),
    );
    return Math.max(
      Math.min(MAX_FAILURE_DELAY_SECONDS, exponential + jitter),
      retryAfter + jitter,
    );
  }

  if (retryAfter > 0) return retryAfter + jitter;
  if (
    input.providerStatus === "drafting" &&
    options.burstEnabled === true &&
    Number(input.burstPollsRemaining ?? 0) > 0
  ) {
    return 5 + jitter;
  }
  if (input.providerStatus === "drafting") {
    return (
      activeDelaySeconds(Math.max(0, Math.floor(input.unchangedPolls ?? 0))) +
      jitter
    );
  }
  if (input.providerStatus === "predraft" || input.providerStatus === "unknown") {
    return predraftDelaySeconds(input.draftTime, options.now ?? new Date()) + jitter;
  }
  return 15 + jitter;
}

export function yahooDraftBurstEnabled(
  value = process.env.YAHOO_LIVE_DRAFT_FIVE_SECOND_BURST,
) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

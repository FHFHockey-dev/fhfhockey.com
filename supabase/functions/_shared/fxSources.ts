// Layer 2 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md): the FxTwitter API
// served by public api.fxtwitter.com, then by TJ's self-hosted FxEmbed mirror (same code, same response shape, same
// ids). Stateless per request: the public API gets one attempt, a miss goes to the mirror, and the next request starts
// with the public API again, so the hand-back is automatic. No Deno or npm imports, so web/ Vitest can test it.

export const PUBLIC_FX_BASE = "https://api.fxtwitter.com";
const USER_AGENT = "fhfhockey-timeline-poller (+https://fhfhockey.com)";

export type FxVia = "public" | "mirror";
export type FxStep = { via: FxVia; base: string; attempts: number };
export type FxChainResult = { status: number; attempts: number; body: unknown; via: FxVia | null };
export type FxChainOptions = {
  delayMs?: number;
  timeoutMs?: number;
  deadline?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/** The mirror's origin, or null unless it is a plain https origin (no credentials, path, query or fragment). */
export function mirrorOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin === PUBLIC_FX_BASE ? null : url.origin;
  } catch {
    return null;
  }
}

/**
 * The order of attempts for one request. Without a mirror it is today's behaviour: the public API, 3 attempts. With
 * one: the public API once, the mirror up to 3 times, then the public API once more.
 */
export function fxSourcePlan(mirrorBase: string | null | undefined): FxStep[] {
  const mirror = mirrorOrigin(mirrorBase);
  if (!mirror) return [{ via: "public", base: PUBLIC_FX_BASE, attempts: 3 }];
  return [
    { via: "public", base: PUBLIC_FX_BASE, attempts: 1 },
    { via: "mirror", base: mirror, attempts: 3 },
    { via: "public", base: PUBLIC_FX_BASE, attempts: 1 },
  ];
}

export const profileStatusesPath = (handle: string, cursor?: string | null) =>
  `/2/profile/${encodeURIComponent(handle)}/statuses?count=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
export const statusPath = (tweetId: string) => `/2/status/${encodeURIComponent(tweetId)}`;

/**
 * GET `path` through the plan. A 404, 429, 5xx or network error is retried (FxTwitter's random 404s are upstream
 * failures, not missing accounts); any other status ends the chain. `via` names the source that answered.
 */
export async function fetchFxChain(path: string, plan: FxStep[], options: FxChainOptions = {}): Promise<FxChainResult> {
  const {
    delayMs = 1500, timeoutMs = 8000, deadline = Infinity, fetchImpl = fetch,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  let status = 0;
  let attempts = 0;
  for (const step of plan) {
    for (let attempt = 1; attempt <= step.attempts; attempt++) {
      if (attempts > 0) {
        if (Date.now() + delayMs + timeoutMs > deadline) return { status, attempts, body: null, via: null };
        await sleep(delayMs);
      }
      attempts++;
      try {
        const response = await fetchImpl(`${step.base}${path}`, {
          headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs),
        });
        status = response.status;
        if (response.ok) return { status, attempts, body: await response.json(), via: step.via };
        await response.body?.cancel();
      } catch {
        status = 0;
      }
      const retryable = status === 0 || status === 404 || status === 429 || status >= 500;
      if (!retryable) return { status, attempts, body: null, via: null };
    }
  }
  return { status, attempts, body: null, via: null };
}

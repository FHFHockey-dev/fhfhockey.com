export type EditionResponse = { ok: boolean; status: number; body: { error?: string } & Record<string, unknown> };

// One in-flight request per edition URL, shared by every caller in the page.
const inflight = new Map<string, Promise<EditionResponse>>();

/**
 * Fetch a social-share edition once per URL at a time. A second caller while the first request is
 * pending (React strict-mode double mount in dev, a double click) joins it instead of issuing another
 * API call, so each load makes exactly one upstream edition read. Settled requests are forgotten, so
 * an explicit refresh still fetches a new edition.
 */
export function fetchEdition(url: string, fetcher: typeof fetch = fetch): Promise<EditionResponse> {
  const pending = inflight.get(url);
  if (pending) return pending;
  const request = fetcher(url, { cache: "no-store" })
    .then(async response => ({ ok: response.ok, status: response.status, body: await response.json() }))
    .finally(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
}

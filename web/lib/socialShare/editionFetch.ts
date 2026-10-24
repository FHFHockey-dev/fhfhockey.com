import supabase from "lib/supabase/client";
import { isSocialShareFormat } from "./types";

export type EditionResponse = { ok: boolean; status: number; body: { error?: string } & Record<string, unknown> };

// Only callers with the same user, token and edition URL may share a pending read.
const inflight = new Map<string, Promise<EditionResponse>>();

/**
 * Fetch a social-share edition once per URL at a time. A second caller while the first request is
 * pending (React strict-mode double mount in dev, a double click) joins it instead of issuing another
 * API call, so each load makes exactly one upstream edition read. Settled requests are forgotten, so
 * an explicit refresh still fetches a new edition.
 */
export async function fetchEdition(url: string, fetcher: typeof fetch = fetch): Promise<EditionResponse> {
  const path = url.match(/^\/api\/v1\/social-share\/([a-z-]+)(?:\?[^#\s\\]*)?$/);
  if (!path || !isSocialShareFormat(path[1])) throw new Error("Invalid share studio request.");
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session?.user.id || !session.access_token) throw new Error("Sign in to use the share studio.");
  const key = JSON.stringify([session.user.id, session.access_token, url]);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = fetcher(url, { cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${session.access_token}` } })
    .then(async response => {
      const body = await response.json();
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== session.user.id || current.data.session?.access_token !== session.access_token) {
        throw new Error("Your session changed. Reopen the share studio.");
      }
      return { ok: response.ok, status: response.status, body };
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

import { createClient } from "@supabase/supabase-js";
import type { Database } from "lib/supabase/database-generated.types";
import { MAX_DISPATCH_REQUESTS } from "./dailyPublicationPolicy";

// Bound every PostgREST call, including helper queries, any transport retries and in-flight reads.
// Reserve one request and five seconds for the terminal ledger entry.
export function createDailyPublicationClients(deadline: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Rankings publication database configuration is missing.");
  const origin = new URL(url).origin;
  let requests = 0;

  function makeClient(stopAt: number, maxRequests: number) {
    const signal = AbortSignal.timeout(Math.max(0, stopAt - Date.now()));
    return createClient<Database>(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => {
          const endpoint = new URL(input instanceof Request ? input.url : input.toString());
          if (endpoint.origin !== origin || !endpoint.pathname.startsWith("/rest/v1/")) {
            throw new Error("Unexpected Rankings database destination.");
          }
          if (requests >= maxRequests || Date.now() >= stopAt || signal.aborted) {
            throw new Error("Rankings publication request or time budget exhausted.");
          }
          requests++;
          const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
          return fetch(input, {
            ...init, redirect: "error", signal: caller ? AbortSignal.any([signal, caller]) : signal,
          });
        },
      },
    });
  }
  return {
    work: makeClient(deadline - 5000, MAX_DISPATCH_REQUESTS - 1),
    terminal: makeClient(deadline, MAX_DISPATCH_REQUESTS),
    requestCount: () => requests,
  };
}

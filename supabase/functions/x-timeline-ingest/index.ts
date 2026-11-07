// Layer 3 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md §2.3). TJ's Raspberry
// Pi runs twscrape with a burner account when the poller (public FxTwitter, then the self-hosted mirror) has had no
// good read of an account for a few minutes, and every 15 minutes as a cross-check against a stale feed, and posts
// what it reads here. This function converts the tweets to
// FxTwitter's status shape and stores them with the poller's own mapper and queue logic, so the rows are identical.
//   POST {"mode":"health"}                                   → which accounts are due for the fallback
//   POST {"mode":"ingest","sourceKey":"…","tweets":[…]}      → store (and, for a switched account, queue) them
// Auth: the x-fhfh-ingest-secret header must match Vault 'x_timeline_ingest_secret' (RPC
// x_timeline_ingest_secret_matches, draft SQL in ./setup.sql). Every other caller gets 401.
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import * as fx from "../x-timeline-poll/fxtwitter.ts";
import { mapFxProfileFeed, POLLED_ACCOUNTS } from "../x-timeline-poll/fxtwitter.ts";
import { twscrapeFeedBody } from "../_shared/twscrapeStatus.ts";
import { storeAndEnqueue, switchedAtFor } from "../_shared/xTimelineStore.ts";
import { parseIngestRequest } from "../_shared/xTimelineIngestRequest.ts";

const MAX_BODY_BYTES = 2_000_000;
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

Deno.serve(async (req) => {
  const secret = req.headers.get("x-fhfh-ingest-secret");
  if (req.method !== "POST" || !secret || secret.length > 128) return unauthorized();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const auth = await db.rpc("x_timeline_ingest_secret_matches", { p_secret: secret });
  if (auth.error) return Response.json({ ok: false, error: "Auth check failed" }, { status: 500 });
  if (auth.data !== true) return unauthorized();

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "Body too large" }, { status: 413 });
  const request = parseIngestRequest(raw, POLLED_ACCOUNTS.map((account) => account.sourceKey));
  if ("error" in request) return Response.json({ ok: false, error: request.error }, { status: 400 });

  if (request.mode === "health") {
    const health = await db.rpc("x_timeline_account_health", {});
    if (health.error) return Response.json({ ok: false, error: "Health check failed" }, { status: 500 });
    return Response.json({ ok: true, accounts: health.data ?? [] });
  }

  const account = POLLED_ACCOUNTS.find((candidate) => candidate.sourceKey === request.sourceKey)!;
  const rows = mapFxProfileFeed(account, twscrapeFeedBody(request.tweets, account.handle));
  const provider = await switchedAtFor(db, account.sourceKey);
  if (provider.error) {
    // As in the poller: without the switch we cannot tell whether to queue, so store only and report it.
    const stored = await storeAndEnqueue(db, fx, account, rows, null);
    return Response.json({ sourceKey: account.sourceKey, providers: "unavailable", ...stored, ok: false }, { status: 207 });
  }
  const result = await storeAndEnqueue(db, fx, account, rows, provider.switchedAt);
  return Response.json({ sourceKey: account.sourceKey, via: "twscrape", received: request.tweets.length, ...result },
    { status: result.ok ? 200 : 207 });
});

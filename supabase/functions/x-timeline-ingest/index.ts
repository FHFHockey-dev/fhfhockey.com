// Layer 3 of the X intake safety net (tasks/artifacts/x-intake-safety-net-design-2026-11-06.md §2.3). A scheduled
// GitHub Actions job (.github/workflows/x-twscrape-fallback.yml) reads the tracked accounts with twscrape and a burner
// account and posts what it reads here. This function converts the tweets to FxTwitter's status shape and maps them
// with the poller's own mapper, so the rows are identical to the poller's.
//   POST {"mode":"anchors"}                                          → newest observed timeline id per account
//   POST {"mode":"observe","sourceKey":"…","runId":"…","tweets":[…]}  → SHADOW: x_timeline_twscrape_observations only
//   POST {"mode":"health"}                                           → which accounts are due for a live takeover
//   POST {"mode":"ingest","sourceKey":"…","tweets":[…]}               → LIVE: store and queue, as the poller does
// Shadow writes nothing production reads: not x_timeline_shadow_posts (first write wins there, and the poller queues
// from first sightings), not the line queues, not social_share_x_posts. Live ingest is refused unless the function
// secret X_TIMELINE_INGEST_LIVE is "1"; when it is promoted, it must also write FHFHockey's card posts to
// social_share_x_posts the way the poller does (x-timeline-poll/index.ts storeSocialShare), which it does not yet.
// Auth: the x-fhfh-ingest-secret header must match Vault 'x_timeline_ingest_secret' (RPC
// x_timeline_ingest_secret_matches, migration 20261107181046_x_timeline_twscrape_shadow.sql). Every other caller gets
// 401. The modes themselves are in ./handler.ts, which web/ Vitest runs against a fake database.
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import * as fx from "../x-timeline-poll/fxtwitter.ts";
import { mapFxProfileFeed, POLLED_ACCOUNTS } from "../x-timeline-poll/fxtwitter.ts";
import { toObservationRows, twscrapeFeedBody } from "../_shared/twscrapeStatus.ts";
import { storeAndEnqueue, switchedAtFor } from "../_shared/xTimelineStore.ts";
import { newestId, parseIngestRequest } from "../_shared/xTimelineIngestRequest.ts";
import { handleIngest } from "./handler.ts";

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

  const { status, body } = await handleIngest(request, {
    db,
    accounts: POLLED_ACCOUNTS,
    liveEnabled: Deno.env.get("X_TIMELINE_INGEST_LIVE") === "1",
    mapFeed: mapFxProfileFeed,
    feedBody: twscrapeFeedBody,
    toObservationRows,
    newestId,
    switchedAtFor,
    storeAndEnqueue: (client, account, rows, switchedAt) => storeAndEnqueue(client, fx, account, rows, switchedAt),
  });
  return Response.json(body, { status });
});

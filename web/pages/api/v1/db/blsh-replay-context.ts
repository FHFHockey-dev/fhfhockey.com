// BLSH v6 hosted fixture replay, stage 2 (test mode, default off): one Supabase Cron GET runs the real request-context
// handler and store with an in-memory test key against the private blsh_replay_api sandbox, after stage 1.
// See tasks/artifacts/blsh-replay-2026-11-20/hosted/.
import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import { createReplayRoute } from "lib/blsh/replay/replayRoute";

// The live request-context route's limit (pages/api/v1/db/blsh-request-context.ts): 240 s.
export const config = { maxDuration: 240 };

export default withOperationalRouteAuth(createReplayRoute("context"), { methods: ["GET"], audit: false });

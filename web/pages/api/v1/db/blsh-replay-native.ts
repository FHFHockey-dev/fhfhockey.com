// BLSH v6 hosted fixture replay, stage 1 (test mode, default off): one Supabase Cron GET runs the real v6 native handler,
// core, sink and store over the hash-pinned frozen 2026-11-19 slate, writing only to the private blsh_replay_api sandbox.
// See tasks/artifacts/blsh-replay-2026-11-20/hosted/.
import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import { createReplayRoute } from "lib/blsh/replay/replayRoute";

// The live native route runs as its own 250 s function behind a 240 s pg_net timeout. 249 keeps this route in its own
// function too (never co-bundled with the live route's instance); the binding limit is the same 240 s pg_net timeout.
// web/vercel.json carries the same value for this exact path.
export const config = { maxDuration: 249 };

export default withOperationalRouteAuth(createReplayRoute("native"), { methods: ["GET"], audit: false });

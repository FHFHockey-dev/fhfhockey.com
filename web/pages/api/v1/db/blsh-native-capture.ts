// BLSH native-input capture v6: one daily, one-shot capture of the previous UTC date's slate.
// Triggered by pg_cron at 12:05Z (backup 12:20Z); see tasks/artifacts/blsh-cron-v6-2026-11-15/DESIGN.md.
// Inert until the migration is applied and blsh_capture_control.enabled is set true.
import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import { createDefaultBlshNativeCaptureHandler } from "lib/blsh/nativeCaptureV6/handler";

// 250, not the shared 240: a distinct config makes Vercel bundle this route as its own function
// (DESIGN.md M1). web/vercel.json carries the same value for this exact path.
export const config = { maxDuration: 250 };

export default withOperationalRouteAuth(
  createDefaultBlshNativeCaptureHandler(typeof __filename === "string" && __filename.startsWith("/") ? __filename : null),
  { methods: ["POST"], audit: { jobName: "blsh-native-capture" } },
);

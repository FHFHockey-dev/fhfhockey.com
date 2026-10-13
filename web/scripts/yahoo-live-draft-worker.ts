import "dotenv/config";

import { setTimeout as wait } from "timers/promises";

import {
  getYahooClientCredentials,
  getYahooLiveDraftSeasonConfig,
  getYahooRedirectUri,
} from "lib/integrations/yahoo/config";
import { runYahooDraftPollCoordinator } from "lib/integrations/yahoo/pollCoordinator";
import { isYahooDraftBackgroundPollingSuspended, YAHOO_DRAFT_BACKGROUND_RESUMES_AT } from "lib/integrations/yahoo/pollPolicy";
import { getServiceRoleClient } from "lib/supabase/server";

const once = process.argv.includes("--once");
const help = process.argv.includes("--help") || process.argv.includes("-h");
let stopping = false;

process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

function validateConfiguration() {
  getServiceRoleClient();
  getYahooClientCredentials();
  getYahooRedirectUri();
  getYahooLiveDraftSeasonConfig();
  if (!process.env.YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET?.trim()) {
    throw new Error("YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET is not configured.");
  }
}

async function main() {
  if (help) {
    process.stdout.write(
      "Usage: npm run worker:yahoo-live-draft -- [--once]\n",
    );
    return;
  }
  if (!once && isYahooDraftBackgroundPollingSuspended()) {
    process.stdout.write(`${JSON.stringify({ event: "yahoo_live_draft_worker_suspended", resumesAt: YAHOO_DRAFT_BACKGROUND_RESUMES_AT })}\n`);
    while (!stopping && isYahooDraftBackgroundPollingSuspended()) await wait(60_000);
    if (stopping) return;
  }
  validateConfiguration();
  do {
    const startedAt = Date.now();
    try {
      const result = await runYahooDraftPollCoordinator(once ? { manual: true } : {});
      process.stdout.write(
        `${JSON.stringify({
          ...result,
          durationMs: Date.now() - startedAt,
          event: "yahoo_live_draft_worker_cycle",
        })}\n`,
      );
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({
          durationMs: Date.now() - startedAt,
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "unknown worker error",
          event: "yahoo_live_draft_worker_error",
        })}\n`,
      );
      if (once) process.exitCode = 1;
    }
    if (!once && !stopping) await wait(1_000);
  } while (!once && !stopping);
}

void main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "unknown worker startup error",
      event: "yahoo_live_draft_worker_startup_error",
    })}\n`,
  );
  process.exitCode = 1;
});

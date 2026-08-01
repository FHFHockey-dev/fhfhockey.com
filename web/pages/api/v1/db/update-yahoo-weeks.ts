// web/pages/api/v1/db/update-yahoo-weeks.ts

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  loadYahooGlobalCredentials,
  persistYahooGlobalTokens,
} from "lib/integrations/yahoo/globalCredentials";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import YahooFantasy from "yahoo-fantasy";
import { randomUUID } from "node:crypto";
import adminOnly from "utils/adminOnlyMiddleware";
import {
  isYahooGameWeekSnapshotReceipt,
  prepareYahooGameWeekSnapshot,
  withYahooRetry,
  type YahooGameWeekSnapshotReceipt,
} from "lib/integrations/yahoo/ingestionLifecycle";
import type { Database } from "lib/supabase/database-generated.types";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  let retries = 0;
  let rateLimitEvents = 0;

  try {
    // 1. Get creds & init YahooFantasy
    const creds = await loadYahooGlobalCredentials(supabase);
    const yf = new YahooFantasy(
      creds.consumer_key,
      creds.consumer_secret,
      async ({
        access_token,
        refresh_token,
      }: {
        access_token: string;
        refresh_token: string;
      }) => {
        // Persist refreshed tokens
        await persistYahooGlobalTokens(supabase, creds.id, {
          access_token,
          refresh_token,
        });
      },
    );
    yf.setUserToken(creds.access_token);
    yf.setRefreshToken(creds.refresh_token);

    // 2. The scheduled path discovers the current NHL game through Yahoo's
    // canonical alias. An explicit key remains a bounded maintenance override.
    const { game_key } = req.query as { game_key?: string };
    const requestedGameKey = game_key || "nhl";
    if (!/^[A-Za-z0-9._-]+$/.test(requestedGameKey)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid game_key parameter" });
    }

    // 3. Fetch weeks from Yahoo API
    const response = await withYahooRetry<any>(
      () => yf.game.game_weeks(requestedGameKey),
      {
        maxAttempts: 3,
        onRetry: ({ rateLimited }) => {
          retries += 1;
          if (rateLimited) rateLimitEvents += 1;
        },
      },
    );
    const snapshot = prepareYahooGameWeekSnapshot(response);
    const snapshotId = randomUUID();
    const { data, error } = await supabase.rpc(
      "replace_yahoo_game_weeks_snapshot",
      {
        p_snapshot_id: snapshotId,
        p_game: snapshot.game,
        p_weeks: snapshot.weeks,
      },
    );
    if (error) throw new Error("Yahoo game-week snapshot persistence failed.");
    const receipt = data as YahooGameWeekSnapshotReceipt | null;
    if (
      !isYahooGameWeekSnapshotReceipt(receipt, {
        snapshotId,
        gameId: snapshot.game.game_id,
        gameKey: snapshot.game.game_key,
        season: snapshot.game.season,
        sourceCount: snapshot.weeks.length,
      })
    ) {
      throw new Error("Yahoo game-week snapshot receipt is invalid.");
    }

    return res.status(200).json({
      success: true,
      status: "success",
      gameId: receipt.gameId,
      gameKey: receipt.gameKey,
      season: receipt.season,
      snapshotId,
      sourceHash: receipt.sourceHash,
      processed: snapshot.weeks.length,
      succeeded: snapshot.weeks.length,
      failedRows: 0,
      omitted: 0,
      metadataChanged: receipt.metadataChanged,
      changed: receipt.changed,
      removed: receipt.removed,
      retries,
      rateLimitEvents,
      completeSnapshot: true,
      message: `Reconciled ${snapshot.weeks.length} week(s) for game_key=${snapshot.game.game_key}`,
    });
  } catch {
    console.error("Yahoo matchup week update failed.");
    return res.status(500).json({
      success: false,
      status: "failure",
      retries,
      rateLimitEvents,
      message: "Yahoo matchup week update failed",
    });
  }
}

export default withCronJobAudit(adminOnly(handler as any));

import type { SupabaseClient } from "@supabase/supabase-js";

import { get, isNhlGamecenterNotFound } from "../NHL/base";
import {
  finalizeScheduleNotRealizedGameStats,
  type QuarantinedGameStatsManifestReceipt,
} from "./transactionalGameStatsPersistence";

export async function tryFinalizeScheduleNotRealizedGameStats(args: {
  supabase: SupabaseClient;
  gameId: number;
  landingError: unknown;
}): Promise<QuarantinedGameStatsManifestReceipt | null> {
  if (!isNhlGamecenterNotFound(args.landingError, args.gameId, "landing")) {
    return null;
  }

  const [rightRail, boxscore] = await Promise.allSettled([
    get(`/gamecenter/${args.gameId}/right-rail`),
    get(`/gamecenter/${args.gameId}/boxscore`),
  ]);
  const confirmedMissing =
    rightRail.status === "rejected" &&
    isNhlGamecenterNotFound(rightRail.reason, args.gameId, "right-rail") &&
    boxscore.status === "rejected" &&
    isNhlGamecenterNotFound(boxscore.reason, args.gameId, "boxscore");

  return confirmedMissing
    ? finalizeScheduleNotRealizedGameStats({
        supabase: args.supabase,
        gameId: args.gameId,
      })
    : null;
}

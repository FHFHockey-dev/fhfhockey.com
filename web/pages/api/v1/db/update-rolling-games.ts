import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

type LegacyRollingGamesMain = (mode: "all" | "recent") => Promise<void>;

async function defaultLoadLegacyMain(): Promise<LegacyRollingGamesMain> {
  const importedModule = await import("lib/supabase/Upserts/fetchRollingGames.js");
  const legacyModule =
    importedModule &&
    typeof importedModule === "object" &&
    "default" in importedModule
      ? importedModule.default
      : importedModule;
  const { main } = legacyModule as { main: LegacyRollingGamesMain };
  return main as LegacyRollingGamesMain;
}

let loadLegacyMainImpl: () => Promise<LegacyRollingGamesMain> =
  defaultLoadLegacyMain;

export async function loadLegacyMain() {
  return loadLegacyMainImpl();
}

export function setLegacyMainLoaderForTests(
  loader: (() => Promise<LegacyRollingGamesMain>) | null
) {
  loadLegacyMainImpl = loader ?? defaultLoadLegacyMain;
}

/**
 * Query params:
 * - date: optional "all" | "recent"; defaults to "all".
 *
 * Cron-safe static URLs:
 * - /api/v1/db/update-rolling-games
 * - /api/v1/db/update-rolling-games?date=recent
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    // Parse query parameter:
    // /api/v1/db/update-rolling-games?date=all         (default), full season process or:
    // /api/v1/db/update-rolling-games?date=recent      for just the most recent games
    const mode = req.query.date === "recent" ? "recent" : "all";
    const main = await loadLegacyMain();
    await main(mode);
    res.status(200).json({
      message: `Rolling games data processed successfully in ${mode} mode.`
    });
  } catch (error: any) {
    console.error("Error processing rolling games data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}

export default withCronJobAudit(handler);

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import { createRequire } from "module";
import path from "path";

type LegacyPowerRankingsMain = () => Promise<void>;

async function defaultLoadLegacyMain(): Promise<LegacyPowerRankingsMain> {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { main } = require(
    path.join(process.cwd(), "lib/supabase/Upserts/fetchPowerRankings.js")
  );
  return main as LegacyPowerRankingsMain;
}

let loadLegacyMainImpl: () => Promise<LegacyPowerRankingsMain> =
  defaultLoadLegacyMain;

export async function loadLegacyMain() {
  return loadLegacyMainImpl();
}

export function setLegacyMainLoaderForTests(
  loader: (() => Promise<LegacyPowerRankingsMain>) | null
) {
  loadLegacyMainImpl = loader ?? defaultLoadLegacyMain;
}

/**
 * Query params:
 * - none
 *
 * Cron-safe static URL:
 * - /api/v1/db/update-power-rankings
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string }>
) {
  try {
    const main = await loadLegacyMain();
    await main();

    res.status(200).json({
      message: `Power rankings data processed successfully.`
    });
  } catch (error: any) {
    console.error("Error processing power rankings data:", error);
    res.status(500).json({ message: `Error: ${error.message}` });
  }
}

export default withCronJobAudit(handler);

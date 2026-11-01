import { goalieLedgerScope } from "./busyQuiet";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildRatioImpact, goalieBase, manualBase, type RatioImpactData, type RatioImpactSettings } from "./ratioImpact";
import { readGoalieAppearances } from "./shared/goalieLedger.sources";

/** One goalie's season is at most 82 games. With no goalie id the calculator reads nothing at all. */
const GOALIE_BASE_LIMIT = 100;

export async function loadRatioImpact({ client, generatedAt }: SharePostContext, settings: RatioImpactSettings): Promise<SharePostLoadResult<RatioImpactData>> {
  if (settings.baseGoalieId === null) return buildRatioImpact(settings, manualBase(settings), null);
  const scope = goalieLedgerScope(generatedAt);
  const rows = await readGoalieAppearances(client, { ...scope, goalieIds: [settings.baseGoalieId], limit: GOALIE_BASE_LIMIT });
  return buildRatioImpact(settings, goalieBase(settings.baseGoalieId, rows, scope.through), { name: "NHL.com goalie game stats", tables: ["wgo_goalie_stats"], state: "ready", asOf: rows[rows.length - 1]?.date ?? null, updatedAt: null });
}

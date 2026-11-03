import { lateFeedTrimmed, periodMissing, readSkaterPeriod, readSkaterSeason } from "./bshBoard.sources";
import { buildCategoryBlueprint, type CategoryBlueprintData, type CategoryBlueprintSettings } from "./categoryBlueprint";
import type { SharePostContext, SharePostLoadResult } from "./contract";

export async function loadCategoryBlueprint(context: SharePostContext, settings: CategoryBlueprintSettings): Promise<SharePostLoadResult<CategoryBlueprintData>> {
  const { period, reason } = await readSkaterPeriod(context, settings);
  return reason ? periodMissing(reason) : lateFeedTrimmed(await readSkaterSeason(context, period), season => buildCategoryBlueprint(season, settings));
}

import { readSkaterSeason } from "./bshBoard.sources";
import { buildCategoryBlueprint, type CategoryBlueprintData, type CategoryBlueprintSettings } from "./categoryBlueprint";
import type { SharePostContext, SharePostLoadResult } from "./contract";

export async function loadCategoryBlueprint(context: SharePostContext, settings: CategoryBlueprintSettings): Promise<SharePostLoadResult<CategoryBlueprintData>> {
  return buildCategoryBlueprint(await readSkaterSeason(context), settings);
}

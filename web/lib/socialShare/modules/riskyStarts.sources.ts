import type { SharePostContext, SharePostLoadResult } from "./contract";
import { riskyStartsResult, type RiskyStartsData, type RiskyStartsSettings } from "./riskyStarts";
import { inventoryWindow, loadGoalieInventoryDetail } from "./shared/goalieInventory.sources";

export async function loadRiskyStarts({ client, generatedAt }: SharePostContext, settings: RiskyStartsSettings): Promise<SharePostLoadResult<RiskyStartsData>> {
  return riskyStartsResult(await loadGoalieInventoryDetail(client, { ...inventoryWindow(generatedAt, settings.days), generatedAt }));
}

import type { SharePostContext, SharePostLoadResult } from "./contract";
import { inventoryWindow, loadGoalieInventoryDetail, serverObservationClient } from "./shared/goalieInventory.sources";
import { startSitResult, type StartSitData, type StartSitSettings } from "./startSit";

export async function loadStartSit({ client, generatedAt }: SharePostContext, settings: StartSitSettings): Promise<SharePostLoadResult<StartSitData>> {
  return startSitResult(await loadGoalieInventoryDetail(client, { ...inventoryWindow(generatedAt, settings.days), generatedAt }, { observationClient: await serverObservationClient() }));
}

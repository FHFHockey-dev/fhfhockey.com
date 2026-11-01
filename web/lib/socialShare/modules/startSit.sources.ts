import { UNKNOWN_EVIDENCE, type SharePostContext, type SharePostLoadResult } from "./contract";
import { inventoryPeriodRequest, loadGoalieInventoryDetail, loadInventoryPeriod, serverObservationClient } from "./shared/goalieInventory.sources";
import { startSitNoUpcoming, startSitResult, type StartSitData, type StartSitSettings } from "./startSit";

export async function loadStartSit({ client, generatedAt }: SharePostContext, settings: StartSitSettings): Promise<SharePostLoadResult<StartSitData>> {
  const { period, reason } = await loadInventoryPeriod(client, settings, generatedAt);
  if (!period) return { state: "missing", reasons: [reason], evidence: UNKNOWN_EVIDENCE, data: null };
  if (period.elapsed) return startSitNoUpcoming(period, generatedAt);
  return startSitResult(await loadGoalieInventoryDetail(client, inventoryPeriodRequest(period, generatedAt), { observationClient: await serverObservationClient() }), period);
}

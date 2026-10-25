import type { ProviderSyncAccess } from "lib/integrations/providerSyncAccess";
import { useAccountAccess } from "./useAccountAccess";

export function useProviderSyncAccess(options: { entitlementOnly?: boolean } = {}) {
  return useAccountAccess<ProviderSyncAccess>(`/api/v1/account/provider-sync${options.entitlementOnly ? "?entitlementOnly=true" : ""}`);
}

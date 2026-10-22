import type { ProviderSyncAccess } from "lib/integrations/providerSyncAccess";
import { useAccountAccess } from "./useAccountAccess";

export function useProviderSyncAccess() {
  return useAccountAccess<ProviderSyncAccess>("/api/v1/account/provider-sync");
}

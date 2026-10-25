import type { DraftProAccess } from "lib/draft-pro/contracts";
import { useAccountAccess, type AccountAccessState } from "./useAccountAccess";

export type DraftProAccessState = AccountAccessState<DraftProAccess>;

export function useDraftProAccess() {
  return useAccountAccess<DraftProAccess>("/api/v1/account/draft-pro");
}

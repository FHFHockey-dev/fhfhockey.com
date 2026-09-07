import type { DraftProExportInput } from "lib/draft-pro/exportContract";

export async function requestDraftProExport({
  hasPrivateImport,
  canUseProExport,
  token,
  payload,
  fetcher = fetch,
}: {
  hasPrivateImport: boolean;
  canUseProExport: boolean;
  token: string | null | undefined;
  payload: DraftProExportInput;
  fetcher?: typeof fetch;
}) {
  if (hasPrivateImport) return { response: null, message: "Save your private CSV to your account before exporting blended projections." };
  if (!canUseProExport) return { response: null, message: "Blended projections export is available with Draft Pro." };
  if (!token) return { response: null, message: "Sign in to export blended projections." };
  return {
    response: await fetcher("/api/v1/draft-pro/export", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    message: null,
  };
}

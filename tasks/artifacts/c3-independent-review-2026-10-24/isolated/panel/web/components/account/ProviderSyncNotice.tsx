import Link from "next/link";
import { PROVIDER_SYNC_ACCESS_HREF, providerSyncAccessMessage, type ProviderSyncAccess } from "lib/integrations/providerSyncAccess";

export default function ProviderSyncNotice({ status, access, refresh }: {
  status: string;
  access: ProviderSyncAccess | null;
  refresh: () => unknown;
}) {
  if (status === "ready" && access?.eligible) return null;
  const unavailable = status === "error" || access?.reason === "verification_unavailable";
  return <p role={unavailable ? "alert" : "status"}>
    {providerSyncAccessMessage(status, access)}{" "}
    {unavailable ? <button type="button" onClick={() => void refresh()}>Retry access check</button>
      : status !== "loading" ? <Link href={status === "idle" ? "/auth?mode=sign-in" : PROVIDER_SYNC_ACCESS_HREF}>{status === "idle" ? "Sign in" : "View premium access"}</Link> : null}
  </p>;
}

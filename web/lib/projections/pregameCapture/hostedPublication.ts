import type { SupabaseClient } from "@supabase/supabase-js";
import { publishQualifiedPregameCapture, type PublicationTarget } from "./publication";

/** The owner's reader, model, and observation RPCs are unchanged. Only its atomic write requires the hosted fence. */
export function publishHostedClaim(db: SupabaseClient, dispatchId: string, target: PublicationTarget,
  deps: Pick<NonNullable<Parameters<typeof publishQualifiedPregameCapture>[1]>, "trust"> = {}) {
  const scoped: SupabaseClient = Object.create(db);
  scoped.rpc = ((name: string, args: Record<string, unknown>) => {
    switch (name) {
      case "forge_pregame_capture_read_v1": return db.rpc("forge_pregame_capture_read_v1", args);
      case "forge_pregame_publication_receipt_v1": return db.rpc("forge_pregame_publication_receipt_v1", args);
      case "forge_pregame_publish_v1": return db.rpc("forge_hosted_publish_v2", { ...args, p_dispatch_id: dispatchId });
      default: throw new Error("unexpected_hosted_publication_rpc");
    }
  }) as typeof db.rpc;
  return publishQualifiedPregameCapture(target, { ...deps, db: scoped });
}

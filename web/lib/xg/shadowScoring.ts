/**
 * Shadow scoring (owner decision 101): an unapproved artifact may be scored
 * only as clearly labelled shadow output.
 * - The rows persist as unapproved (`model_approved = false`,
 *   `provenance.scoringMode = "shadow_unapproved"`), with the model version,
 *   artifact tag, path and checksum recorded.
 * - Every serving and aggregate path admits approved rows only (builders,
 *   routes and the registry pin), so shadow rows are never served.
 * - Access is restricted: the scheduled cron secret cannot run it; it needs a
 *   signed-in admin and an explicit `allowUnapproved=true`.
 * - Success never promotes: approval comes only from the decision-88 gate
 *   record in the artifact (see approvalGate.ts); scoring writes no registry row.
 */
export type XgScoringMode = "approved" | "shadow_unapproved";

export type XgScoringModeResolution =
  | { allowed: true; mode: XgScoringMode }
  | { allowed: false; status: 403 | 409; error: string };

export function resolveXgScoringMode(args: {
  modelApproved: boolean;
  allowUnapproved: boolean;
  invokedByCron: boolean;
}): XgScoringModeResolution {
  if (args.modelApproved) return { allowed: true, mode: "approved" };
  if (!args.allowUnapproved) {
    return {
      allowed: false,
      status: 409,
      error:
        "The selected xG artifact is not approval-grade. Shadow scoring needs allowUnapproved=true from a signed-in admin; its rows stay unapproved and are never served.",
    };
  }
  if (args.invokedByCron) {
    return {
      allowed: false,
      status: 403,
      error: "Shadow scoring of an unapproved xG artifact cannot run under the cron secret; a signed-in admin must request it.",
    };
  }
  return { allowed: true, mode: "shadow_unapproved" };
}

// A table or view that does not exist yet (its migration is not applied): PostgREST reports PGRST205 ("Could not find
// the table … in the schema cache"), Postgres 42P01 ("relation … does not exist").
export const REPORT_SECTIONS_MIGRATION = "20261106201221";

export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (typeof code === "string" && ["42P01", "PGRST205"].includes(code))
    || (typeof message === "string" && /does not exist|could not find the table/i.test(message));
}

/** A readable message for an Error or a PostgREST error object. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = error && typeof error === "object" ? (error as { message?: unknown }).message : null;
  return typeof message === "string" ? message : String(error);
}

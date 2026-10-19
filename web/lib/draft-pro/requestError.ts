// An error whose status and message were written by FHFH for the caller.
// Routes trust only `instanceof DraftProRequestError`; any other error (Supabase
// Storage, PostgREST, RPC) may carry its own statusCode and backend text, so it
// gets the route's fixed 500.
export class DraftProRequestError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "DraftProRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

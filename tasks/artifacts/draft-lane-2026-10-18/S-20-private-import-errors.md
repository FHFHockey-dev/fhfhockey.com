# Draft Pro private-import routes: unknown errors become a fixed 500 (2026-10-18)

This is a request from the S-02 security lane, relayed by the Chef. Everything is local and uncommitted, with no network calls. `lib/draft-pro/server.ts`, `adminOnlyMiddleware` and `corsProxy` are unchanged.

## Problem

`private-imports.ts`, `private-imports/[uploadId]/stage.ts` and `private-imports/[uploadId]/chunks/[ordinal].ts` sent every caught error out as `400 {error:{code: e.code, message: e.message}}`. That included raw Supabase/Storage errors, whose Postgres `code` and relation text reached the client.

## Changes

- **Routes (all three):** the catch now follows the sibling `drafts/index.ts` pattern.
  - An error with a `statusCode` (capability denial, typed validation) keeps its status and safe message.
  - A `ZodError` returns 400 with the first issue message (begin and stage routes).
  - Anything else is logged with `console.error` and returns `500 {error:{code, message:"Private imports are unavailable. Your local draft is unchanged."}}`. The codes are `PRIVATE_IMPORT_UNAVAILABLE` (begin), `PRIVATE_IMPORT_STAGE_UNAVAILABLE` and `PRIVATE_IMPORT_CHUNK_UNAVAILABLE`.
  - I used the S-02 uppercase `<X>_UNAVAILABLE` form. The read route's lowercase `private_import_unavailable` is its 404, so an uppercase code avoids clashing with it.
  - The chunk route's own "Upload prefix is required." and "Chunk exceeds 750 KiB." are now typed 400s.
  - The begin route's "conflict returned no draft" stays untyped, so it becomes a 500.
- **`web/lib/draft-pro/privateImportTransport.ts`:** a new `invalidPrivateImport(message)` sets `statusCode: 400`.
  - Applied to the 17 caller-correctable begin, chunk and stage checks: expired or unavailable upload, chunk bounds or ordinal, retry content mismatch, non-server-owned paths, JSON/row/size limits.
  - Left untyped, so they become a 500: RPC/Storage errors, "transaction returned no save session" and "could not be staged".
  - The read functions used by the read route are unchanged.
  - Behavior change: a missing or foreign `uploadId` lookup used to return the 400 "Private import transaction returned no result." It now returns the same 400 "Private import upload is unavailable." as an expired upload, so a foreign ID cannot be told apart from an expired one.
- **Client:** `hooks/useSavedDrafts.ts` shows `payload.error.message` on any non-OK response, so users now see the fixed sentence instead of raw text. It does not read the codes.

## Tests

- `lib/draft-pro/api-tests/private-imports.test.ts` has 5 new cases:
  - begin: unexpected failure returns the fixed 500;
  - stage: typed 400 and schema 400;
  - stage: unexpected failure returns the fixed 500, with no relation text;
  - chunk: missing prefix and typed ordinal both return 400;
  - chunk: unexpected Storage failure returns the fixed 500.
- `lib/draft-pro/privateImportTransport.test.ts`:
  - the foreign-upload lookup now asserts `{statusCode: 400, message: "Private import upload is unavailable."}`;
  - the chunk-bounds check asserts `statusCode: 400`;
  - a new case asserts that RPC errors stay untyped.

## Checks

- `npx vitest run lib/draft-pro/api-tests/private-imports.test.ts lib/draft-pro/privateImportTransport.test.ts`: passed, 21 tests.
- `npx vitest run lib/draft-pro components/DraftDashboard` (heavy lock): passed, 56 files, 391 tests.
- `npx tsc --noEmit` (8 GB heap, heavy lock): passed, exit 0.
- Not run: lint, full Vitest, and the browser save flow (pending).

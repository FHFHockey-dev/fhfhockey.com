# BLSH native capture preparation: local candidate, not a capture

## Outcome

Prepared a tested optional bounded-response patch for the established authenticated NST client, without editing that shared client, plus a local-only two-page plan/retention rehearsal. No provider request, shared-admission RPC, database change, credential file read, holdout read, score, acceptance policy, Git mutation, build or deployment was performed.

This does not produce real native evidence. There is no live CLI. `executeNativeProcessCapture` always throws. The example plan selects 2026-11-06 as a candidate date, not a verified completed slate; official completion review remains required. Plans expire after 15 minutes and must be recreated/revalidated before any later authorized operation.

## Ownership and exact patch

- Shared `web/lib/nst/client.ts` remains Claude's NST lane. No custody transfer or integration permission is claimed.
- Canonical base SHA256: `48d82fc40ca06d9abe4675f4a1896add55c4e53d4dee661bbe082d424c944e4f`.
- `nativeProcessCaptureClient.base.ts` is an exact base copy.
- `nativeProcessCaptureClient.candidate.ts` is an isolated successor; `nativeProcessCaptureClient.patch` is its unified diff against that base. `CLIENT-SOURCE-PINS.json` pins base, candidate, patch and related frozen controls/consumer files.
- `git apply --check` passed against the unchanged canonical source. The patch was **not applied**. If the owner's bytes change, reconcile the patch with that owner; do not overwrite them or apply a stale candidate.
- The latest shared coordination mailbox was read before preparation. The parent supplied the current Claude NST custody constraint. No external-agent dispatch or acknowledgment is inferred from reading that record.

## What the client patch actually bounds

`maxResponseBytes` is optional. Without it, the original clone/text and cache behavior is unchanged. With it, the existing client reads the original response stream, retains at most the requested number of decoded body bytes, and aborts/cancels on overflow. It does not tee an unread clone. The existing timeout covers body reading. Overflow uses the existing non-retryable execution-limit error. Invalid limits fail before provider dispatch/admission. Opt-in bounded calls through the cache helper use the existing uncached authenticated route; default cache calls remain unchanged.

This is a cap on **retained/accepted decoded body bytes**, not an exact cap on bytes received or downloaded. An oversized chunk can already have arrived before its size is checked, and HTTP/OS buffering and compressed wire bytes are outside this cap. The frozen canonical client still calls `response.clone().text()` without any streaming bound. The offline packet's 2 MiB retention check happens after supplied text already exists and does not fix that transport limitation. If an exact wire-byte ceiling is required, this candidate is insufficient and collection must remain blocked.

Bounded mode consumes the original Response body. Consumers must use the returned `text`; Response metadata remains available, but a second `response.text()` is not supported in bounded mode. No existing caller opts in automatically.

## Offline plan and packet seam

Canonical new files only:

- `web/scripts/blsh/nativeProcessCapturePreparation.ts`
- `web/scripts/blsh/nativeProcessCapturePreparation.test.ts`

The plan rejects 2025–26, other seasons, arbitrary URLs/extra fields, invalid dates, dates today or later, dates outside its seven-day candidate window, future/stale plan clocks, and duplicate/missing/extra/reordered groups. It constructs exactly one individual and one on-ice all-strength/count URL on the authenticated data origin. It does not fetch them or treat a past calendar date as proof of game completion.

The retention function accepts **unverified offline observations**, exercised only with synthetic fixtures. It preserves the supplied original reported clock separately from retention time; exact UTF-8 bytes including CRLF/Unicode are retained with SHA256/length. Non-roundtrippable strings are rejected. Client/redactor source bytes and the offline retainer source bytes are copied and hashed, explicitly as proposed code bindings, not proof that those functions produced the supplied text.

Output directories must be new, including refusing existing symlinks. Files use exclusive creation and private local modes. The first page survives a second-page error; later observations stop after failure. Missing/failed/writing-interrupted packets never claim a completed capture. Metadata whitelists fields and error codes, never arbitrary headers, upstream exception strings, tokens or caller URLs. The supplied body is **not authenticated as redacted or secret-free**. Do not use this rehearsal interface to certify real bodies.

These are not `NativeReceipt` objects: status is `retained_unverified`, transport status/TLS/origin/redirect facts are null, clock is `reportedRetrievedAtUTC`, and there is no trusted producer/redactor proof. No `success` receipt, `nativeValuesMatched: true`, reviewed evidence bundle or accepted policy is generated. Publication and model definition stay unknown; score is null; advanced admission and production adoption stay false.

## Exact remaining live-integration contract (not execution permission)

1. Obtain the NST owner's bounded-client integration/review. Recheck all source pins after integration. No canonical edits are authorized by this artifact.
2. Independently review the completed current-season date and official frame/slate evidence. Recreate the strict plan against the actual clock. Do not reuse the stale Nov 1 current-source request or promote old receipts into new retrieval times.
3. Obtain the necessary authorization for the actual shared-admission path. **Two is the maximum number of NST provider attempts, not total external requests or ledger writes.** `admitSharedNstAttempt` may poll its production RPC repeatedly until the deadline; its RPC count has no independent cap in the existing implementation. The plan states this explicitly. Do not bypass, mock, or disable those controls in live use.
4. A future producer must call `fetchNstTextByUrl` sequentially with one shared `requestControl`: `maxAttempts: 2`, `attemptsStarted: 0`, `plannedRequestCount: 2`, `minIntervalMs: NST_MIN_REQUEST_INTERVAL_MS`, a fresh 120-second deadline, `retries: 0`, `timeoutMs: 15000`, `allowQueryKeyFallback: false`, and `maxResponseBytes: 2097152`. One page for each strict planned group; stop on the first failure. No alternate scraper, URL, public-origin fallback or cache substitute.
5. Before dispatch, create a fresh private packet directory, snapshot/pin the actual producer and exact redactor/client source, and record start state. Immediately after each authenticated client result completes, capture the original retrieval clock and exact `Buffer.from(result.text, "utf8")` bytes. Never regenerate the retrieval clock during later retention/replay. Persist each page independently using exclusive creation so partial failure remains inspectable. Recheck code pins; a changed producer is not the pinned producer.
6. The real producer must validate actual HTTP 200, expected final HTTPS origin and redirect behavior from the returned transport, plus reviewed TLS/runtime evidence. The current offline interface accepts no caller-provided transport proof. Successful `fetch`, `redirect: error`, a claimed TLS boolean or the planned URL alone is not independent proof of all required facts. Credential-echo/redaction review remains required without logging credentials or headers. Preserve unknown facts as unknown and withhold a receipt if proof is absent.
7. Only then propose a separate real receipt matching the existing consumer contract: URL, success/200, justified TLS verification, exact parser-input representation/hash/length, actual producer/redactor source hashes, original retrieval clock and reviewed TOI contract. Neither the optional body cap nor a completed local packet independently accepts that receipt.
8. Reuse the existing `nst_lineage.py:check` and selected-receipt intake for semantic comparison. Every required field must be `literal_match` before a later composer may propose `nativeValuesMatched`; structural `row_lineage_checked_proposed_contract` alone can coexist with xG discrepancies/placeholders. Model/scope review, exact official identity/exposure, current-source freshness and independent bundle policy acceptance remain separate. Do not change the closed gate or scoring as part of transport integration.

## Verification and reproduction

Run from `web/`. Candidate-only tests/config/setup live in this artifact directory so the normal canonical test suite and TypeScript include do not inherit them.

- `./node_modules/.bin/vitest run scripts/blsh/nativeProcessCapturePreparation.test.ts`: 27 synthetic tests passed.
- `./node_modules/.bin/vitest run --config ../tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureCandidate.vitest.mts`: 37 tests passed, including all 23 unchanged canonical client tests against the isolated candidate plus 14 focused new tests.
- `node ../tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureTypecheck.cjs`: passed. Six focused roots use repository TypeScript options; candidate substitutes for the canonical client only in compiler memory, with no emit.
- Scoped ESLint of the canonical pair and candidate source passed. Candidate tests/setup/config were also checked through ESLint stdin under a TypeScript filename; config has one non-blocking anonymous-default-export warning, no errors.
- `./node_modules/.bin/vitest list nativeProcessCapture --filesOnly`: finds only the canonical preparation test. No candidate-only test is discoverable by ordinary web test discovery.
- `git apply --check` passed; actual source-pin check and exact diff review passed. No canonical patch application.

The isolated harness denies real fetch/sockets and mocks transport, local budget and shared admission. Tests cover chunk boundaries, cumulative/oversized body failure, misleading Content-Length, invalid limits, cancellation, timeout, original defaults/cache paths, no retry on overflow, and retained admission/auth/redaction behavior. Synthetic success is not provider proof.

Full canonical TypeScript, full application tests, live transport/TLS, builds and browser tests were not run for this bounded slice. Logs and final hashes are retained beside this handoff. Initial verification failures (test path, ESM fs spy, cache-mock resolution, Buffer typing, artifact Vitest import) were harness/type issues corrected before the final checks; no live operations were attempted.

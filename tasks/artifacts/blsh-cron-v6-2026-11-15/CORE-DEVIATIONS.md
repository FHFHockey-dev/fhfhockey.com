# v6 core and adapter: deviations from the reviewed v5 (`348a122d6`)

**Revised after V6-REVIEW `c0789453`, finding L4.** `core.ts` is now the v5 runner edited in place:
- **Copied verbatim from v5** (spliced from the file, not retyped): `peerFacts`, `TlsFacts`, `tlsFacts`, the module-level `need`/`fail`/`text`/`nullableText`, and the dispatcher-anchor block (`GLOBAL_DISPATCHER` … `DISPATCHER_AT_RUNNER_LOAD`).
- **The diffs:** `core-v5.diff` (`diff -u`, 14 hunks) and `adapter-v5.diff` (4 hunks). Each hunk falls under one or more numbered deviations below; nothing else differs.

**Unchanged from v5 (verbatim):**
- the TLS fact copying and binding rules;
- the dispatch guards: order, budget, deadline, CA store and dispatcher before and after;
- the 1000 ms permit rule and the 22 s spacing;
- `retries: 0`, `maxAdmissionCalls: 1`, the request control;
- `retain`'s transport checks, the parser row count and the 8 MiB packet cap;
- the 120 s deadline (stop timer and terminal timer);
- the adapter's scope checks, `boundedFetch` and the credential-echo check;
- **Superseded by the M1 fix (2026-11-16; TJ chose M1-FIX-DESIGN parts 1 and 3):** v5's socket-fact block (adapter lines 14–52) is copied verbatim into `tlsObservation.ts` (sha256 `f05d54f6…`), and `withTlsObservation` is replaced by a context-attributed version (M1-FIX-DESIGN.md). Earlier text, kept for the record: `withTlsObservation`, imported from the pinned v5 adapter, not copied. Chef's decision (2026-11-15): the RC (c2b3bd24c) ships v5 (348a122d6) on top of origin/master, so v6 imports the observer from the v5 adapter unchanged, as reviewed. The verbatim copy is not used; its bytes are kept in release/fix-tls-observer/ for reference only.

## Core deviations

1. **Header and imports** (hunk 1): a v6 header, plus imports for the sink, the v6 runtime receipt and the run-state type. There are no `node:fs`/`node:path`/`node:tls` imports.
2. **The date is an input** (hunks 1, 9, 14):
   - the `DATE` constant moves into the run as `input.sourceDate`;
   - `pilot_date_not_approved` becomes `plan_date_or_run_mismatch`, which also binds the sink's date and run id;
   - a new `adapter_date_mismatch` check;
   - `completedGames(bytes, date)` takes the date as a parameter. Its game-id regex is unchanged and season-wide.
3. **Disabled lifecycle only** (hunks 1, 9, 10, 11, 12, 13, 14):
   - no `begin`/`finish`/`hold` operations, no `reference` or `jobToken`, no `withJob` and no `workStarted`;
   - the operation cap is 5;
   - the admission RPC is always `nst_admit_attempt_v1`;
   - `remainingRunMs` has no lifecycle cleanup extension;
   - the "Lifecycle receipts" lines are removed.
4. **No source or node pins** (hunks 2, 3, 6, 7, 9, 14):
   - removed: v5's `RUNTIME_OVERRIDE_KEYS`/`ADAPTER_ENV_KEYS`/`LAUNCH_ENV_KEYS`, `runtimeReceipt` (node binary hash, `launch`), `sourcePaths` and `sourceSnapshot`;
   - RUNTIME comes from `runtimeReceipt.ts` (PROFILE-SPEC.md §3);
   - STARTED.json and the TRANSPORT-OBSERVATIONs carry `deploymentBinding` instead of `sourceBindings`;
   - the adapter interface drops `sourcePath` and `lifecycleMode`, and gains `sourceDate`.
5. **Sink instead of a laptop directory** (hunks 9, 14):
   - `write` goes to `sink.write`, a local `/tmp` journal with `wx`, file fsync and directory fsync;
   - removed: `mkdirSync`/`syncDirectory`;
   - `.MANIFEST.json.tmp` plus the hard link becomes `sink.publishManifest` (MANIFEST.json uploaded last), then `sink.close`. Completion needs all three; PROFILE-SPEC §1.
6. **Remote checkpoints only outside the permit window** (hunks 10, 14):
   - **(a)** For `schedule` only, a checkpoint runs after the STARTED journal write and **before the operation timer is armed**, with its own 20 s budget (`PRE_SCHEDULE_CHECKPOINT_MS`; review **L2**). The operation deadline counts from the moment it is armed (`armedAt`).
   - **(b)** A checkpoint after the schedule is retained.
   - **(c)** Before each group, one `sink.intent(group)` and then a checkpoint, outside the permit.
   - **(d)** A checkpoint after each group's page is retained.
   - **Never** between `admission:G` and `nst:G`.
   - `sink.checkpoint` is serialized, so an abandoned checkpoint never runs alongside a second one.
7. **Schedule outcomes** (hunks 8, 14):
   - D's day entry must be present (review **L1**): a missing entry is `schedule_shape_invalid` (failed), and a present day with `games: []` is `no_slate`;
   - `schedule_day_ambiguous` and `schedule_game_incomplete_or_wrong_scope` end as `refused_schedule`;
   - the schedule body is retained **before** finality is judged.
8. **Failure reporting and closing** (hunks 9, 10, 13, 14):
   - a run-local `need` (same name and same call sites as v5) and `guard` record the first refusal code (`firstFailure`);
   - `parser_utf8_invalid` goes through `need`, so it is recorded too;
   - start-of-run refusals now sit **inside** the `try` (review **L3**): the plan, date, project, adapter date, dispatcher and RUNTIME build. So they close the run as `failed` with their code, with no network.
   - The outer `catch` takes a code-shaped error message (`^[a-z][a-z0-9_:]{2,100}$`) when nothing was recorded. FAILED.json adds `runState` and `reason`. Then a best-effort checkpoint and `close(failed | refused_schedule)`. If the close fails, the row stays `claimed` for the watchdog.
9. **Pre-claim runtime gate** (hunk 3): `runtimePrecheckV6()`, using v5's anchor (`DISPATCHER_AT_RUNNER_LOAD`) and code (`global_dispatcher_not_runner_load_default`).
   - **Note:** the copied v5 anchor comment mentions "the bootstrap". There is no bootstrap on Vercel. Whether npm undici registers before the anchor in the Next bundle is PROBE-LIST item 6.

## Adapter deviations (`adapter-v5.diff`)

1. The schedule URL takes the source date (v5: the literal `…/schedule/2026-11-11`).
2. `withJob` is removed (disabled mode). `NST_JOB_LIFECYCLE_ENABLED` must be **absent**: any value is refused (`capture_adapter_lifecycle_key_present`).
3. `sourcePath` and `lifecycleMode` are removed; `sourceDate` is added. The environment check is exported (`nativeCaptureEnvironmentProblemV6`) for the route's pre-claim gate.
4. `withTlsObservation`/`TlsObservation` come from v6's `./tlsObservation` (M1 fix (2026-11-16; TJ chose M1-FIX-DESIGN parts 1 and 3)): v5 lines 14–52 verbatim plus a context-attributed `withTlsObservation`. `boundedFetch` is copied unchanged, because v5 does not export it.
5. One redundant `need(settlement.kind === "provider", …)` next to the equivalent `if (…) throw` is dropped.

# Browserless quarantine — release and database approval packet

Prepared only. The replacement remains parked. This packet grants no production action; the unresolved fields below must be settled before Scout requests release/write approval.

## Serial ownership

Request `CODEX-BROWSERLESS-QUARANTINE-SERIAL-WINDOW-REQUEST-20261112` was appended to the established `CODEX-TO-CLAUDE.md` handoff and routed to the DRM coordinator. Reply belongs in `CLAUDE-TO-CODEX.md`. Latest owner evidence is `CLAUDE-FIX-SPRINT-SERIAL-ORDER-20261112` (19:30:30Z): Claude owns phase E; planned handoff is `CLAUDE-FIX-SPRINT-DB-HANDOFF-2-20261112`. Existing approved order is Trends repair → Goalie source release → Claude summary/goalie refresh → wider DRM repair → Goalie H1. Browserless has no allocated slot. Do not insert it based on an estimated completion time, old stop notice or another lane being idle.

Ask Claude/Scout to name the exact insertion event, confirm current DB/build owners and overlapping manual writers stopped, permit the one catalog preflight, confirm production project `fyhftlxokyjtpndbkfse`, and state expiry/handback conditions. No production read is permitted before that acknowledgment. If an owner supplies the approved sanitized snapshot instead, reuse it and do not duplicate the read. Record the snapshot's time, project, SQL hash and successful read-only completion.

## Exact local release candidate

The guard-only patch is `guard-candidate.patch` SHA-256 `22a55c7fe8b41b20f4b0091039faf276b229d5e987f726f8fe9ce10720ab667c`. Its only release paths are:

| Path | SHA-256 |
| --- | --- |
| `web/pages/api/v1/webhooks/on-new-line-combo.ts` | `dd3a7255fc37c81124f4cc1416d8db89d8d12b92d3101ccb706d7f5653243de8` |
| `web/__tests__/pages/api/v1/webhooks/on-new-line-combo.test.ts` | `c822f18313318d2f9ff5a75d2d7ea94ec774851310fc70ed872b7fdd4fb0122e` |

The handler adds a fixed authenticated HTTP 200 `status: skipped`, `reason: line_combo_webhook_parked` return before query access/logging/retry/Browserless/storage/Discord. Redaction and auth code are unchanged. Tests: 5 guard + 13 baseline diagnostic cases; scoped lint/types and independent review passed. Reuse those results while pins/imported behavior stay unchanged. `GUARD-CHECKS.json`, `QUARANTINE-REVIEW.md` and `RELEASE-SCOPE.json` retain evidence.

**Final release SHA is pending the release composer.** Scout must integrate only these two pinned paths on the then-current accepted release base, preserve all later accepted releases, verify the resulting diff, and record the exact SHA before approval. This lane does not claim Git/index custody or create commits/branches/worktrees. Do not publish the shared dirty checkout. Do not add the parked transport files, diagnostic extensions, package declarations, SQL artifacts, diaries, styling/DRM changes, migration authority or servedForecastLedger. Combining with another authorized release changes its candidate SHA/scope and needs explicit approval of that combined candidate; no automatic piggyback.

Proposed target: Vercel `fhfhockey` (`prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`), root `web`, environment production, release branch `master`. Local `web/.vercel/project.json` agrees with the retained inventory. Before approval/publication, refresh all four linked projects and existing deployment status for the exact SHA. Historical companions: `functions-fhfhockey` root `functions`, `cms-fhfhockey` root `cms`, `fhfhockey.com` root null. Expected fan-out is four deployment entries, **one completed web build and three ignored/canceled companion entries**, conditional on fresh ignore rules and previous-SHA baselines. Root `vercel.json` ignores builds; companion configurations compare their own paths; web's ignore rule detects this route/test change. No ignore/Git/project setting changes are included. If another project would build, stop and obtain a revised scoped plan/approval. Reuse a suitable successful exact-SHA deployment or wait for an existing build; never create a duplicate.

Release budget proposal: at most four project metadata reads; one exact-SHA deployment list (limit20); at most eight deployment-status reads in total, pending polls at least30s apart, stopping on conclusive READY/alias or failure. One web build maximum, no preview/manual duplicate. Timeout/failure/inventory mismatch stops execution and returns to Scout; no automatic retry. Capture actual entries/build counts and exact alias/SHA. **Zero application HTTP requests** are proposed, including no webhook invocation, synthetic insert, cron/ETL call or log-triggering experiment. This verifies deployment provenance, not live handler execution.

## Catalog and trigger scope

After the owner explicitly allows the slot, run `trigger-preflight.sql` once: one read-only catalog transaction, 5-second statement timeout, no application rows or HTTP calls, no retries. It returns server version, regular-table topology and all trigger identities/modes/definition hashes for `public."lineCombinations"`; raw function bodies/arguments and secrets are not returned. Require the three known trigger/function pairs from `TRIGGER-PLAN.md`, target type5 and zero arguments, no inheritance/partitions. Any mismatch or failed/uncertain read stops the lane. Do not infer current state from the migration file.

Bind write approval to that actual snapshot/fingerprint and original target mode. If target is already D, omit the write and record that it was already disabled. Otherwise, after the exact guard release is confirmed READY/aliased and the owner renews/retains the quiet window, propose **one transaction** using `trigger-set-mode-plan.sql`, filling only the approved fingerprint and desired mode D. The template deliberately refuses unfilled inputs. Scope: disable only `after_line_combo_insert`; preserve `after_player_underlying_stats_insert`, `update_power_play_combinations_after_line_combo_insert` and every other trigger/function field.

Limits: table lock2s, statement10s, idle transaction30s. Run all statements on one connection with stop-on-error; any mismatch/timeout/error means rollback and stop, never retry blindly. Capture original/new mode, before/after fingerprints and confirmed commit result. NOTICE output alone is not a commit receipt. After commit, one separate execution of the same catalog query (5s) must match the complete expected post-state. Total normal database budget: **one preflight read, one targeted write transaction, one postcheck read**, zero data row writes/provider requests. A stale preflight is caught inside the write transaction; do not refresh the fingerprint silently to bypass drift. If a new snapshot is needed, re-coordinate and settle revised scope before another attempt.

## Rollback and stopping rules

Database rollback is a separately approved transaction in a renewed quiet window. Use the saved post-disable fingerprint and exact original mode in the same reviewed script: O=ENABLE, R=ENABLE REPLICA, A=ENABLE ALWAYS, D=leave disabled (normally no write). One postcheck read must match the original full snapshot; preserve adjacent trigger state. Any intervening drift aborts; do not broaden to ALL/USER, session_replication_role, dropped/recreated triggers or function edits. This rollback is outside the normal execution budget and never automatic. The handler remains parked unless separately changed.

Application rollback is also separately approved. Record the immediate pre-release deployment ID/SHA before publishing. A no-build promotion of that exact deployment is only eligible if no intervening accepted release would be lost **and** Scout/TJ explicitly approve reactivation risk. Otherwise prepare a narrow guard-specific correction against the current release and obtain its exact-SHA/build approval. Never restore the old whole deployment merely to remove these ten guard lines, never restore the transport archive, and never automatically enable the database trigger. Even with the trigger disabled, removing the guard can expose the old Browserless path to direct callers, so keeping the guard is the default while a correction is prepared.

After success or any stop, publish a specific handback naming reads/writes/builds actually performed, commit certainty, exact trigger mode, source/deployment identity, and whether this lane has any running operation. Do not hold the DB slot across an unapproved release or while waiting indefinitely; return it explicitly and obtain a fresh handoff later. Do not restart Claude/DRM work on their behalf.

## Unsettled fields and preserved risks

Pending: Claude's acknowledgment and allocated window; confirmed DB project/current snapshot/server version/privilege readiness; final release SHA and current linked-project/previous-deployment inventory; separate release and trigger-change approval. SQL has been source-reviewed but not parsed/executed by PostgreSQL. No production quarantine has been applied by this lane.

This stops future target-trigger dispatch only once executed and stops downstream work only once the guard serves. It does not cancel in-flight/queued requests, stop alternate callers, secure the old host, rotate credentials, scrub old logs or replay skipped events. Images and Discord notifications are intentionally skipped during quarantine. Prior plaintext transport/token/log risks stay unresolved; replacement, TLS and rotation remain archived and outside this packet.

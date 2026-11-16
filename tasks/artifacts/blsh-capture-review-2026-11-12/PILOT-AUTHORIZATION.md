# BLSH bounded pilot authorization draft — November 12, 2026

**Draft only; not yet approval-ready and not permission to execute.** Existing evidence identifies the intended design as a local Node process using the canonical NST client. The local bootstrap is now implemented and reviewed; the actual configured process and current operator assignment remain unconfirmed. This packet proposes the smallest mode: **one run, at most five application HTTP attempts, with lifecycle already disabled**. If the actual execution mode is enabled or unknown, stop and revise the packet; do not change a flag or expand to seven/eight calls.

The [prerequisite follow-up](PILOT-PREREQUISITES.md) now proposes the established Claude NST custodian as operator, **November 13, 14:05–14:06 UTC** as a conditional start window (work ends before 14:08), and an exact private output path whose parent metadata was checked. These are not assigned, reserved or approved. Later saved installation reports also support the post-burst admission contract; the stale draft header is not the latest evidence. The [bootstrap handoff](BOOTSTRAP-HANDOFF.md) closes local implementation/review; the actual configured-process receipt remains missing.

The [exact execution and reconciliation plan](PILOT-EXECUTION-PLAN.md) and [current readiness receipt](PILOT-READINESS.json) consolidate the next step. The November 12 19:37 Claude write handoff gives the next slots to Trends/Goalie Grid, not BLSH; the existing BLSH custodian request remains unanswered.

## Runtime established without credentials or live requests

Current observations are in [RUNTIME-IDENTIFICATION.json](RUNTIME-IDENTIFICATION.json).

| Item | Verified local value |
| --- | --- |
| Checkout | `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; base `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f` plus the pinned two-file correction |
| Execution directory | `/Users/tim/Code/fhfhockey.com/web` |
| Node binary | `/usr/local/bin/node`, **v22.23.4**, macOS (`darwin`) arm64 |
| Node SHA-256 | `daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef` |
| TLS / HTTP implementation | OpenSSL **3.5.9**, built-in Undici **6.29.1**; default TLS min 1.2 / max 1.3 |
| Loader | Installed **ts-node 10.9.2**, `transpileOnly: true`, TypeScript **5.7.3**; compiler overrides `module: commonjs`, `moduleResolution: node`; `NODE_PATH=.` |
| Local loader-cache policy proposed | `DISABLE_V8_COMPILE_CACHE=1` for the one-shot process; tested only in an isolated import probe |
| Other direct runtime dependencies | Cheerio **1.1.2**, memory-cache **0.2.0** |
| Dependency/package authority | npm; package declares `npm@10.9.0`; no install is part of the pilot |
| Source candidate | All **17** current source/test pins match; the nine runtime roles are separately mapped in [CORRECTION-CHECKS.json](CORRECTION-CHECKS.json) |

The Node executable, four dependency entry/manifest hashes, lockfile, tsconfig, bundled/default CA hashes and built-in fetch source hash matched the November 9 observations when checked. These dependency entry pins do not purport to hash every transitive installed file. The Browserless lane subsequently added only the four direct `ws` / `@types/ws` declaration lines across the two manifests and released custody; the read-only diff shows no resolved dependency changes. BLSH owns neither manifest. Initial and final manifest hashes are both recorded in the runtime evidence; the Browserless work is not included in this candidate.

An import-only check loaded all nine corrected runtime modules from the expected absolute paths, using the binary and loader above in an empty-environment child with real transports and writes blocked. It invoked neither the adapter factory nor capture methods. The final no-cache check observed **zero network attempts and zero write attempts**. An initial guard check failed; diagnosis found two blocked loader-cache write attempts, eliminated by the installed loader's `DISABLE_V8_COMPILE_CACHE` switch. Those earlier attempts were not reported as passing and made no actual writes.

The ambient inspected shell has **no `NEXT_PUBLIC_SUPABASE_URL` configured** and an **unset lifecycle flag**, which the code classifies as disabled. No NODE_OPTIONS, custom-CA/proxy variables or TLS verification bypass were present. **That shell is not a configured capture environment.** Credential presence and values were not inspected; no `.env`, credential file, Vercel environment or production settings were read.

The historical owner statement that production lifecycle was off explicitly relied on prior release/readback evidence and was not a fresh runtime check. Saved November 9 loopback TLS tests establish only that earlier synthetic local behavior; provider TLS remains unverified. A future run must preserve normal certificate/hostname verification, and retained observations remain `TLSVerified: null` unless independently supported by appropriate evidence. No extra provider TLS preflight is included.

## Missing facts before requesting approval

| Owner | Required concrete evidence |
| --- | --- |
| Coordinating Chef + NST custodian | Confirm proposed NST custodian `local_3bb2755d` or name its replacement, and clear the proposed November 13 14:05–14:06 UTC start window with current re-normalization/NST coordination. Current Claude Chef is recorded as `local_78a99adf`; historical routing through `local_c4e6c533` is not a current assignment. See the follow-up for saved schedules and the November 12 incident. |
| Execution operator | Bind the implemented [one-shot bootstrap and reviewed command](BOOTSTRAP-HANDOFF.md), SHA-256 `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f`, to the final authorization. Its 32 mocked tests, actual check-only CLI and independent correction review are complete; no live invocation or valid approval receipt exists. |
| Execution operator | Record the actual configured process's non-secret project, existing lifecycle mode, binary/loader/dependency resolution and TLS configuration. This five-call draft requires **existing disabled mode** and the exact project below. Do not infer them from this inspection shell or change a flag. Confirm credential availability privately without exposing values; this task did not access credentials. |
| Execution operator | Accept proposed `/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z`, or supply an exact alternate. Its child is absent and parent is a user-owned 0700 real directory; no creation or durability probe occurred. Confirm host write authority and retain the runner's pre-dispatch directory/file fsync checks. |
| NST custodian | Confirm no later admission/control change, or supply a retained exact deployed-body/ACL/control receipt. Saved November 9 installation and November 10 live-status reports support post-burst budget MD5 prefix `5e854308`; the local body is `5e8543085513e308b92ce55b0090557b`. The SQL file's draft header is stale relative to those reports. This is still historical evidence, not current full-hash or enforcement-state verification. Any additional production read needs separate bounded authority outside these five calls. |

The current entry point is `web/scripts/blsh/nativeProcessCaptureRunner.ts:runNativeProcessCapture`, supplied by `createNativeProcessCaptureAdapter`. The older preparation executor still throws. Use only the reviewed bootstrap after the remaining execution fields and specific user approval are complete; do not improvise a live REPL call or load credentials from this draft.

## Exact proposed scope

Current season **20262027**, regular season, fixed date **2026-11-07**, all teams, skaters, all strength, count values. One official finality check and two ordered NST pages only. The strict plan is recreated immediately before an approved run and expires after 15 minutes. The fixed date fails the code's age bound starting **2026-11-15T00:00:00.000Z**; no start at or after that time. A changed date requires a revised source/URL proposal and approval.

| Order | Attempt | Maximum |
| --- | --- | ---: |
| 1 | GET `https://api-web.nhle.com/v1/schedule/2026-11-07` | 1 |
| 2 | POST `https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1` for individual page | 1 |
| 3 | GET individual NST URL below, only after a valid current permit | 1 |
| 4 | Same admission RPC for on-ice page | 1 |
| 5 | GET on-ice NST URL below, only after a valid current permit | 1 |

Both POST bodies use `p_burst: false`, `p_planned_requests: null`, as implemented by the canonical client. Authentication uses the existing header paths; no query-key fallback, token refresh, browser service or alternate host/key. The maximum includes failed attempts. No begin, finish, hold, status-poll, SELECT/readback, application smoke-test or other request is included.

```text
https://data.naturalstattrick.com/playerteams.php?fromseason=20262027&thruseason=20262027&stype=2&sit=all&score=all&stdoi=std&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2026-11-07&td=2026-11-07&lines=single&draftteam=ALL
https://data.naturalstattrick.com/playerteams.php?fromseason=20262027&thruseason=20262027&stype=2&sit=all&score=all&stdoi=oi&rate=n&team=ALL&pos=S&loc=B&toi=0&gpfilt=gpdate&fd=2026-11-07&td=2026-11-07&lines=single&draftteam=ALL
```

Concurrency **one**, exactly one admission attempt per page, **zero retries or redirects**, and at least **22 seconds of monotonic elapsed time between NST dispatches**. Preserve both the real same-user local ledger and production shared admission; no private substitute or clearing state. Existing global headroom and any post-burst cooldown still apply. The code's stricter 39/minute, 80/5-minute, 100/15-minute and 180/hour limits are unchanged; deny/deferral stops rather than polling or bursting.

Work budget: **120 seconds** from function entry; provider response/body timeout at most **15 seconds**, admission at most **5 seconds** and always clamped to remaining work time. This disabled-mode draft allows no additional lifecycle cleanup request/time. Synchronous filesystem calls cannot be forcibly interrupted; an overrun is rejected when control returns, with no later provider action or successful completion. A client timeout cannot prove the server canceled its transaction; preserve uncertainty and do not retry.

## Data writes and retention authorized only by a later explicit approval

- **Production:** at most two legacy admission transactions on project `fyhftlxokyjtpndbkfse`. The saved local legacy function locks `nst_job_control`, refuses when enforcement requires a job token, and otherwise updates `last_untracked_at` before calling the budget function. That timestamp write can invalidate earlier qualification even if budget admission returns denied. An allowed permit updates the `nst_request_admission_state` singleton, including pruning old attempts, appending one attempt and updating spacing (and any deployed budget bookkeeping). At most two new permit timestamps; no refunds. The exact deployed budget implementation still needs the custodian evidence above.
- **Local ledger:** up to two reservations and their dispatch/completion updates under the existing same-user `tmpdir()/fhfhockey-nst-budget-<uid>` store. A reservation can be charged even when shared admission blocks the provider. Preserve unfinished/uncertain state; no clearing or alternate store.
- **No statistics, forecast, score, cohort, evidence-admission, configuration or application publication writes.** No lifecycle job row is created by this disabled-mode draft. No production repair, cron/ingestion trigger, migration or deployment.
- **Private packet:** the operator-selected new directory must be 0700, files exclusive 0600, with parent/operation-directory fsync before dispatch. Retain exact original decoded schedule body and exact client-returned redacted parser input with original response completion clocks, code snapshots/hashes and sanitized operation/transport receipts. No credentials, headers, full RPC responses or reconstructed timestamps enter shared reports.
- **Limits:** 1 MiB accepted decoded schedule body; 2 MiB per NST page; at most 5,000 parsed rows per NST page; 8 MiB whole packet including source/metadata. Shared admission JSON retains its existing uncapped `response.json()` path. These limits are not wire-byte ceilings; buffering/compression and admission bytes remain unknown. Request/DB/NST charges are not priced by this packet; no Vercel build is involved.
- Preserve partial packets and successful earlier pages on failure. A failed invocation or FAILED receipt prevents acceptance even if a completion marker cannot be removed; retain explicit marker uncertainty. Keep the private packet until qualification and disposition are recorded, with no automatic deletion, overwrite, upload or Git inclusion. Share only reviewed, credential-free evidence.

## Stop conditions

Stop before transport if source/dependency pins, actual project/mode/runtime, output directory, approved slot or date/plan validity differ. Stop before NST admission if the schedule is absent, ambiguous, empty, has duplicate/incoherent identities, wrong season/type, or any game is not `OFF`/`FINAL` with schedule state `OK`.

Stop on first denied/invalid/expired/unknown permit, HTTP/TLS/redirect/body/shape error, timeout, byte/row cap, retention/fsync failure, environment drift or uncertain transport. No re-poll, alternate source, second process, later date, cleanup RPC or automatic second run. Reconcile from retained local evidence; any further remote action needs separate bounded approval.

## Authorization wording for use only after the missing facts are filled

> Approve one BLSH native-input pilot, operated by **[named operator]** in **[confirmed November 13 14:05–14:06 UTC start window, work ending before 14:08]**, using `web/scripts/blsh/nativeProcessCaptureBootstrap.ts` SHA-256 `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f`, the Node/loader profile and exact candidate hashes in this packet, and new private output directory **[exact path]**. Preserve the verified existing disabled lifecycle mode. Allow only the five ordered HTTP attempts above for November 7, 2026, including at most two production legacy admission transactions and their documented local/global ledger effects. Keep all rate, deadline, retention and stop limits. No retry, other date, live forecast, source adoption, repair, deployment or additional request is authorized.

Runner SHA-256: `5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb`. Adapter SHA-256: `0162fb52fe3df0b3c1b70f11b0739792a5b0f32b8dbd35b92255597a506c5368`. All nine runtime bindings: [CORRECTION-CHECKS.json](CORRECTION-CHECKS.json). Source acceptance remains false and baseline weight 1.0 stays unchanged; even a successful pilot cannot supply complete per-player/goalie membership or finish serving qualification.

No approval is being requested or inferred from this draft. This preparation made zero live requests, ledger/database operations, credential accesses, pilot runs or production changes.

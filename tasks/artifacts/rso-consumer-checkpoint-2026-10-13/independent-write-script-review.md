# Independent guarded schedule-write review

Reviewed and re-reviewed 2026-10-14 UTC. Final verdict: **ACCEPT — P2 corrected; no remaining blocking findings**. Acceptance applies only to corrected write-script SHA-256 `ca244dabfeaeabde90e381981e884d15c55221c558eb14458ed1933a71af65f0`. The original review covered SHA-256 `fd53e70c2f056a720d54cd10775c085ff5c20580d99a961e854c60729d29713c`, independently matched to its verification receipt.

## Corrected P2: Response decoding bypassed the UNKNOWN acknowledgement

The original `write-inspected-schedule.py:128–129` used `subprocess.run(..., text=True)` but caught only `OSError`, `TimeoutExpired`, and `KeyboardInterrupt`. Python decodes both captured stdout and stderr before returning the process result. An unexpected response/error body containing bytes invalid for the decoder raises `UnicodeDecodeError`. This can occur after the production request has been transmitted, including after a schedule write has completed. The original handler allowed that exception to exit through a traceback instead of emitting its UNKNOWN acknowledgement, explicit no-replay instruction, and database/audit readback requirement.

The corrected handler catches `(OSError, subprocess.TimeoutExpired, KeyboardInterrupt, UnicodeError)`. Independent in-memory AST compilation passed, and the Python exception hierarchy confirms that `UnicodeDecodeError` is covered. Replacing only that corrected exception line with its original bytes reproduces the original SHA-256 exactly. This establishes that the exception tuple is the sole script change; the approved scope, transport bounds, sanitizer, and no-retry behavior are unchanged. Decoding failures now enter the existing suppressed-output UNKNOWN/readback path.

Evidence: static AST inspection confirms the exception tuple above. A pure, invented invalid-UTF-8 byte-string decoding probe raised `UnicodeDecodeError`, which is not an `OSError`. Neither the script, its main function, nor a subprocess/network request was executed to establish this finding.

## Scope and binding checks

- The fixed query supplies bounded mode, game key `477`, Oct 11–19 inclusive, NHL season `20262027`, all 57 game IDs `2026020084` through `2026020140`, `maxSides=114`, `dryRun=false`, and inspected scope hash `eab29c8c1413bc553908a01f0f5e6d760565ee58675d336931f7420b174e8b7c`. The hash matches the supplied sanitized inspection receipt. That receipt remains user-supplied evidence, not an independently observed production result.
- The supplied route snapshot parses these fields from `req.query`, so the script's URL query and empty POST body bind correctly. `dryRun=false` selects the audited write handler; `dryRun=true` selects the unaudited inspection handler.
- The supplied guard requires the exact game set, two reciprocal team sides per game, correct season/key/date range, complete mapping, side limit, and content hash before upsert. The hash excludes only observation time. Drift fails before upsert and can still reach the separate failure-audit insert.
- Bounded mode supplies no stale-row IDs for deletion. The guarded 114-side scope fits the route's stated single-upsert chunk. The supplied audit wrapper contains one audit insert and no retry. Schedule persistence and audit persistence are separate; audit failure does not imply schedule rollback.
- The script rejects arguments and noninteractive input, requires its fixed public destination confirmation, obtains the bearer through hidden TTY input, rejects unsafe bearer characters, and supplies authorization only through curl's stdin configuration. Its fixed subprocess argument list disables curl configuration, redirects are not enabled, retry count is zero, and connect/runtime/body-size bounds are present. No credential file/profile reads appear in the reviewed script.
- The sanitizer emits selected public booleans, integer counts, fixed outcome/audit enums, and bounded uppercase error codes; raw message/detail/header/body content is suppressed. Successful acknowledgement still requires database readback. Failed or missing audit with an acknowledged schedule explicitly says not to replay. Unknown/failed transport paths that are currently caught also require readback and prohibit retry.

## Verification performed

Both Python files passed in-memory AST compilation without executing either module. Only the `public_integer` and `sanitize` function definitions were extracted and evaluated in an isolated namespace with invented safe payloads. **35 sanitizer checks passed**: exact success, failed/missing/invalid audit, source drift with a persisted failure audit, non-success HTTP status, malformed/error bodies, altered range/key/season/mode/dry-run/counts/hash/game IDs, and suppression of an invented private sentinel. No probe claimed rollback or successful database readback.

One nonblocking schema observation: Python equality accepts `False` as zero in `rowsDeleted`, although the output integer filter returns null. The supplied route emits an integer deletion count, so this does not invalidate acknowledgement of that route's actual response contract; this review does not certify arbitrary foreign schemas.

Reviewed byte pins:

| File | SHA-256 |
| --- | --- |
| `write-inspected-schedule.py` | `fd53e70c2f056a720d54cd10775c085ff5c20580d99a961e854c60729d29713c` |
| Corrected accepted `write-inspected-schedule.py` | `ca244dabfeaeabde90e381981e884d15c55221c558eb14458ed1933a71af65f0` |
| `inspect-approved-schedule.py` | `72c787a6c83fbd4a89137b567dd0ac5e124fd24f9c684c758f984f69c3a9f3f2` |
| Supplied deployed `update-roster-optimizer-schedule.ts` | `04c91b0b33693b241207f41b094c1d4215b241955b89c9fe6d82f6ce5caa12e1` |
| Supplied deployed `refreshGuard.ts` | `4b5cdd04b3688ccc528d28148ac60cc1ed2c38a6010d662fce7c9e87bfcbcc78` |
| Supplied deployed `withCronJobAudit.ts` | `d2e01aaa070f165f0c673523470482d693268d71dda8d4bdf04f9b2469d690bd` |

Production snapshots were read only from the already materialized `refresh-verification/deployed-source/web` directory. This static review does not independently establish deployment/environment authenticity or successful runtime writes. Requests made: **0**. Credentials/profiles read: **0**. Script/main executions: **0**. Database/compiler operations: **0**. The only file written by this review is this report; application and script sources remain frozen.

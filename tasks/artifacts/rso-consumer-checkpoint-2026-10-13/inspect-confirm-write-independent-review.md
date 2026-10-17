# Independent inspect-confirm-write review

Reviewed 2026-10-14 UTC. Verdict: **ACCEPT — no blocking findings** for `inspect-confirm-write-schedule.py` SHA-256 `43129788749954e27f6b5ca5bee4b18fd4c4350af1b578a5553b87daf208d14b`, independently verified from current bytes.

## Flow and scope

- The fixed inspection query contains bounded mode, game key `477`, Oct 11–19 inclusive, NHL season `20262027`, all 57 IDs `2026020084` through `2026020140`, `maxSides=114`, and `dryRun=true`.
- Inspection must return the exact approved range, seasons, key, mode, game IDs, 114 planned sides, zero upserts/deletions, `not_attempted`, zero warnings, and a lowercase 64-character scope hash. An invalid inspection returns before confirmation or writing.
- The sanitized inspection is printed before the confirmation prompt. The required phrase is exactly `WRITE 114 ` plus the first 12 characters of the newly inspected hash. Extra characters, wrong text, EOF/interruption, or an answer returned after the monotonic 120-second deadline stop without writing. The input prompt itself can remain open after expiry; the subsequent check rejects a late answer.
- The write query copies the fixed scope and changes only `dryRun` to `false` while adding the **full fresh inspected hash** as `expectedScopeHash`. It does not reuse the obsolete prior hash. The write sanitizer receives the same fresh hash.
- Static control-flow inspection found two request call sites: one inspection and one conditional write, with no loops/reinspection/retry path. After write transport failure, scope drift, unknown acknowledgement, or failed audit, the script terminates. Credentials/configuration remain in process/pipe memory; no script output file is created.

## Transport, output, and supplied deployed binding

The fixed endpoint and subprocess argument list use POST/query parameters, empty body, HTTPS, disabled curl configuration, no enabled redirects, zero retries, bounded connect/runtime/body size, and authorization supplied through stdin configuration. Arguments/noninteractive input are rejected; hidden TTY input, warning-as-error handling, bearer character validation, and public destination confirmation remain present. `UnicodeError` is caught alongside other transport failures. A write transport failure emits UNKNOWN, prohibits retry, and requires database/audit readback; an inspection transport failure states that no write was submitted.

Sanitizers allowlist public scope/count/outcome/audit facts and suppress arbitrary messages, details, headers, and body content. Successful schedule acknowledgement still requires database readback. Failed/missing audit does not imply rollback and explicitly prohibits replay. The integer filter also rejects boolean zero values for inspection upserts/deletions and write deletions.

The three supplied deployed source snapshots retain their previously reviewed hashes:

| Snapshot | SHA-256 |
| --- | --- |
| `update-roster-optimizer-schedule.ts` | `04c91b0b33693b241207f41b094c1d4215b241955b89c9fe6d82f6ce5caa12e1` |
| `refreshGuard.ts` | `4b5cdd04b3688ccc528d28148ac60cc1ed2c38a6010d662fce7c9e87bfcbcc78` |
| `withCronJobAudit.ts` | `d2e01aaa070f165f0c673523470482d693268d71dda8d4bdf04f9b2469d690bd` |

Their existing reviewed contract parses `req.query`, dispatches `dryRun=true` to unaudited inspection, and requires the whole scope/hash check before guarded upsert. Bounded mode supplies no deletion IDs. The write handler can record one separate failure audit even when drift prevents schedule upsert. There is one audit insert attempt, and audit failure does not undo the schedule statement. This acceptance does not independently verify deployment/environment authenticity or the reported prior 409/database/audit observations.

## Checks actually performed

- In-memory AST parse/compilation passed without executing the module, main function, or transport helper.
- **55 isolated sanitizer checks passed**, using only extracted pure sanitizer functions and invented safe payloads. Coverage includes valid inspection/write; warning, dry-run, count, range, key, season, hash and game-set mismatches; malformed responses; non-success status; drift rejection; failed/missing/invalid audit; boolean-zero rejection; and suppression of an invented private sentinel.
- **Five isolated mock-flow checks passed** for valid timely confirmation, wrong phrase, expired phrase, wrong-and-expired phrase, and invalid inspection. The model evaluated only the actual pure phrase, confirmation-predicate, and write-query expressions with an invented clock. It never executed main or request_once. Every modeled path issued at most one symbolic write; wrong/expired/invalid paths issued none.
- Fixed query values, fresh full-hash propagation, two single call sites, absence of loops, and the corrected exception tuple were independently asserted from the AST. Existing snapshot hashes were reverified from the already materialized files.

Requests made: **0**. Script/module/main/transport executions: **0**. Subprocesses invoked by the reviewed script: **0**. Credentials/profiles read: **0**. Database/compiler operations: **0**. Only this report was written. The original app sources and both guarded-write scripts were unchanged by this review. Acceptance is a static delivery review, not evidence that a production write has occurred.

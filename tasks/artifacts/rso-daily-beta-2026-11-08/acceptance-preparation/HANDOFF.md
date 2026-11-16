# Offline acceptance preparation — November 8

Four saved-evidence command-line tools now execute when launched through a filesystem alias, including macOS temporary-directory aliases. Previously, each could return exit code 0 with empty output without inspecting the input. The fix compares real paths at the entry guard; it changes no qualification, forecasting or settlement logic.

## Changes and evidence

The eight exact paths are recorded in [BEFORE.json](BEFORE.json). They are the three CLI/test pairs under `rso-resume-2026-11-01/release-prep/qualification-capture/` (`inspect-identity`, `inspect-issued-packet`, `normalize-settlement`) and the supplementary `qualification-readbacks/tooling/check-readbacks` pair. [CLI-FIX.patch](CLI-FIX.patch) is the reviewable delta; [RESULT.json](RESULT.json) binds the before/after hashes and preserved inputs.

- Four new tests **failed before the fix**, each observing exit 0 but no JSON report. [Red receipt](cli-regression-red.json), [log](cli-regression-red.log).
- The four complete suites now have **72 passing tests**, no failures or skips. Each new case checks successful evidence and rejected/empty evidence through a symlink containing a space. Existing direct CLI, imported-function, sealed-window, missing-evidence, microsecond and calendar checks also pass. [Green receipt](cli-regression-green.json), [log](cli-regression-green.log).
- Node v22.23.4, existing synthetic fixtures, temporary files only, inert environment and outbound network guard. No provider, account, database or deployment action occurred. The focused diff check passes.

The application candidate remains `101448c6c6b6da210b2b71786fb5e6024e747cb5`. Its separately completed 2,304-test, TypeScript, lint and 63-browser-case verification remains in [the parent handoff](../HANDOFF.md). This tooling fix is outside that application's release delta. Application checks were not repeated for artifact-only edits.

## Retained checker custody

The original `rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks` pair remains unchanged. Its empty-population false pass already has the independently reviewed [November 1 repair](../../rso-resume-2026-11-01/release-prep/qualification-readbacks/INSTALLATION-HANDOFF.md); that repair still awaits exact-file installation custody. Do not use the old checker as acceptance proof.

The old `source.patch`, review receipts, scientific scope and protocol hashes are preserved. They describe the reviewed preimages, which are retained in `before/`. The supplementary tools now carry this separately tested entry-guard delta; do not claim their new hashes were covered by the November 1 independent review. The retained-file custodian can install the reviewed repair and this small follow-up, or allocate the two original paths for a coordinated installation with installed-layout verification. No original-file installation was attempted here.

[RETAINED-CHECKER-SUCCESSOR.patch](RETAINED-CHECKER-SUCCESSOR.patch) combines both changes for exactly those two retained target paths. Its original/replacement hashes are in `RESULT.json`, and `git apply --check` passes against the untouched originals. It is prepared, **not applied**. The installed-layout check remains the custodian's next step after allocation/installation. The older reviewed patch is retained unchanged as historical review evidence.

## Work that can proceed without live access

Use the fixed supplementary tools to inspect an **already authorized, privately held** evidence export. Keep private account/roster data outside this repository. Require a nonempty JSON report, check its explicit pass/findings fields as well as the exit code, and preserve its exact input identity in the owner's private evidence store. A synthetic pass or a consistency check grants no forecast use or real-account acceptance.

The remaining owner inputs are specific:

| Owner | Existing evidence or decision needed | Result it unlocks |
| --- | --- | --- |
| Current legacy FORGE runtime/configuration owner | Deployment-specific non-secret configuration, original `captured_live` horizon-1 revision/snapshot/run identity, exact RSO/Start Chart readbacks, and comparator/participation/settlement evidence; explicitly state absent items. | Offline consistency/admission review and an accurately bounded prospective capture proposal if needed. Current ownership is unresolved; do not assume the separate FORGE v2 lane owns legacy operation. |
| Retained FORGE-QUAL tooling custodian | Install the reviewed two-file repair plus this follow-up, or allocate those exact retained paths. | One canonical safe checker with installed-layout evidence. |
| Yahoo connected-planning owner | An existing approved private snapshot/read receipt, or a concrete bounded path covering provider fan-out, credential refresh and persistence. See [YAHOO-ACCEPTANCE-BOUNDS.md](YAHOO-ACCEPTANCE-BOUNDS.md). | A realistic private connected-workflow acceptance window. The global ownership writer/credential task is separate. |
| TJ / private beta owner | Manual and connected daily-use outcomes against the agreed candidate and real league rules, using [the checklist](../PRIVATE-BETA-CHECKLIST.md). | Product acceptance for private daily testing. Fixture passes do not substitute for this decision. |
| Release owner | Current release-base reconciliation and an exact candidate commit; separate publishing/deployment authorization. | Release composition and an approved deployment, if requested. |

Requests were appended to the established Codex→Claude coordination file as `CODEX-RSO-ACCEPTANCE-PREP-20261108-02`; the completion receipt is `CODEX-RSO-ACCEPTANCE-PREP-20261108-03`. Delivery is not an owner acknowledgement. These requests seek existing evidence and local custody; they do not ask anyone to issue new forecasts, run jobs, activate flags, access credentials or deploy. No actual authenticated acceptance is claimed.

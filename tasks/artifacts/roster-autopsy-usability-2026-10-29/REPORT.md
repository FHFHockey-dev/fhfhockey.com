# Roster Autopsy — local usability follow-up

Date: 2026-10-29. This report describes the local, uncommitted candidate; no deployment or live-provider behavior is implied. The complete product direction and later stages remain in the [PRD](../../TASKS/prd-roster-autopsy.md) and [foundation receipt](../roster-autopsy-foundation-2026-10-29.md).

## Changes

- Phone and tablet widths show fixed Roster and Coverage links beneath the existing header. They jump to focusable headings without unmounting the roster. Desktop keeps the side-by-side layout.
- Manual RSO import now opens an explicit review for an empty or populated roster. New identities are selected by default, matching IDs cannot overwrite existing entries, and possible duplicate names are unselected until the manager chooses them. Cancel leaves the workspace alone. Slot-count replacement is separately presented; existing counts are not selected for replacement in a populated workspace. A changed workspace invalidates the preview.
- Existing players, positions, scoring, source RSO data, account separation and storage-conflict protections are retained. Incompatible or unavailable scoring causes imported recent stats to be omitted rather than presented under unrelated scoring. Newly added roster entries and replaced slots require review again. Only manual RSO workspaces are imported.
- This remains a structural slot-coverage view, not a player-quality grade, league comparison, trade recommendation or playoff schedule.

## Pinned candidate

The isolated source copy contains **4,334 pinned files**. [Snapshot metadata](SNAPSHOT.json) records the source HEAD before and after capture (`9d70700ab37e24300c711a22c640ab66f40b24d2`), exclusions and the temporary path. The copied working-tree bytes include local uncommitted work; this is not a claim that HEAD alone contains the candidate. The [source manifest](SOURCE-MANIFEST.sha256) has SHA-256 `0111139d32376cc99466cd4ae5793bbba59fd83f03621a959141eff070628964`. All six owned files matched the checkout at capture and after the checks; all manifest entries matched before tests, after tests and after the browser run.

The manifest includes `package-lock.json`, but the snapshot uses a symlink to the existing `web/node_modules` installation for execution; installed dependency bytes and generated Next output are not pinned. Hidden environment files were excluded, provider configuration was synthetic, and Node 22.11.0 was used. This is a source-pinned local verification, not a hermetic build.

## Results

- **Passed:** 18 focused Vitest tests (9 model, 9 component), including identity collisions, incompatible scoring, roster limits, account changes and saved-workspace conflict protections. [Log](TESTS.log).
- **Passed:** scoped TypeScript for the Autopsy route, model, component and focused tests with their imports; [log](TYPECHECK.log). The entire app was not re-type-checked for this changed candidate. The earlier whole-app check applies to the earlier foundation only.
- **Passed:** scoped ESLint on the five Autopsy TypeScript/TSX files in the checkout; Sass compilation and CSS Modules pure-mode on the pinned copy ([log](CSS.log)).
- **Passed:** 30 Chromium assertions across 1440 × 900 desktop and 390 × 844 touch-enabled phone fixtures ([result](BROWSER-RESULT.json)). On desktop, the review, cancel, merge, explicit duplicate selection, explicit slot replacement and stale-preview safeguards behaved as expected. On phone, the fixed section navigation remained at y=56 while scrolling, Coverage landed below it with focus, returning to Roster retained all 20 fixture players, and the reviewed merge preserved existing entries and slot counts. Both viewports avoided horizontal overflow; no uncaught page errors were observed. Visual captures: [desktop review](desktop-review.png), [phone coverage](phone-coverage.png), [phone roster](phone-roster.png) and [phone review](phone-review.png).
- **Passed:** 17 additional Chromium assertions for fresh manual entry, simultaneous C/LW slot matching, saved-data reload and conflict protection at both sizes ([result](manual-browser-attempt-03/BROWSER-RESULT.json)). The first two attempts stopped on test-selector ambiguities: the broad position label also matched the review checkbox, and the broad alert role also matched Next's route announcer. Both attempts and their logs are retained; the final run used exact/scoped selectors. No application change was made between these attempts.
- **Passed:** source-manifest verification before and after checks and again after the browser pass. The snapshot, source manifest and verification scripts are retained for audit.

The browser runs used a loopback-only Next server with synthetic browser storage. Browser routing blocked external traffic and local application APIs; no local API requests were attempted. The Node preload blocked the Next server's attempted npm-registry version check ([denial log](SERVER-NETWORK-DENIALS.jsonl)); external fonts, analytics and a donation image were blocked in the browser, so screenshots use fallback assets. Each owned server and Chromium process was stopped at completion ([main execution receipt](BROWSER-EXECUTION.json), [manual execution receipt](manual-browser-attempt-03/BROWSER-EXECUTION.json)). These checks made no production/provider requests or database writes, and no migration, Git mutation, deployment or deletion occurred.

BLSH's repair pilot had priority and reached a review pause before this work acquired the shared heavy slot. Each slot acquisition was atomic; only this task's token-verified lock was renamed to a preserved receipt. The earlier occupied RSO type-check lock was left alone.

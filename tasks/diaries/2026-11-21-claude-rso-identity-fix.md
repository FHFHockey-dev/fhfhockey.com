# 2026-11-21 · Claude · RSO identity fix

**Scope:** let an RSO review match rows issued after its own release. (1) Move the catalog out of the FORGE producer closure. (2) Make the bound codeVersion stable. (3) Require `@issuance` for every issued participation method. (4) Register the new closure. Chef: local_9996b7b8. Parent: local_091a3ca0.

**Where:** detached worktree `/private/tmp/forge-rso-identity-fix-20261121`, base `47a1a2628` (the participation candidate). `web/node_modules` is symlinked to the canonical checkout.

**Decisions**
- TJ pop-up (Nov 21): ship the stable identity as a new field. `payload.codeVersion` stays the deploy SHA because the DB enforces 40-hex: `20261118135813` lines 114 and 203, `20261119230000:15`, and `verifiedForgeRelease` takes a SHA. `inputProvenance.modelIdentity` v2 carries `codeVersion` = verified producer closure, and `artifactHash = sha256({codeVersion, configurationHash})`. `publication.ts:87` is unchanged.
- Base closure at `47a1a2628` = `0446100e…` (released, 243 modules, 0 findings).

**State: PARKED (Nov 21).** Chef verified `6ca16d025`, and TJ accepted the design by pop-up. Leave the worktree untouched.
- Chain: `3551f7efb` (code) → `98daf41b6` (registration of closure `01131f2a…`, receipt under `tasks/artifacts/rso-identity-fix-2026-11-21/`) → `6ca16d025` (tests: the route path and the writer under a build constant).
- Checks: Vitest 61 files pass (2 load-timing flakes pass alone), typecheck exit 0, eslint clean, merge-tree vs origin/master clean. Chef's rerun: 1,498/1,498.
- Report: side-session-notes/local_091a3ca0…/rso-identity-fix-REPORT.md.

**Next:** ships in one release together with the participation candidate and a real review entry, once the evidence exists. **The closure registration must be redone on the actual release commit:** `01131f2a…` → `3551f7efb` is provisional.

**Gotchas:**
- The closure scanner follows `import type`. `planningDataTransport.ts` and `workspaceSchema.ts` are in the closure.
- `currentPlanningTime()` is `Date.now()` outside a current read, so tests resolving old fixtures need fake timers.
- RosterScheduleOptimizer.test.tsx mocks `restrictRsoForecast`; the mock now targets `rsoUseResolver`.

## 2026-11-22: release candidate (Chef ticket; TJ "Ship, gate closed")
- Rebuilt on origin/master `ebfdf1cd2` by cherry-pick, with no conflicts: participation `775c72b40 c2b4c639b fb7252592 e87aef54f`, then identity `339acf34b 24cbe90af`. The old registration was dropped.
- Closure `3611475f…` (244 modules, 0 findings). Receipt `tasks/artifacts/rso-release-candidate-2026-11-22/24cbe90af….json`. Registered in **candidate `989ee767c`**.
- Review-before-use stays ON (empty catalog). No push yet.
- Gates (full-tree export of 989ee767c): admission pass, typecheck exit 0, eslint exit 0, Vitest 96 files 3059 passed / 8 skipped / 1 failed. The failure is `forgeEnvScope`, which fails the same way on master.
- Gate-closed table: Detailed RSO is labelled but denied on every target. Daily RSO serves the same numbers as master; the bridge applies no participation.
- Report: side-session-notes/local_091a3ca0…/rso-rc-2026-11-22/REPORT.md. Sent to Chef.
- **State: waiting on TJ's push approval.** Push step: confirm `ls-remote` still prints ebfdf1cd2, then `git push origin 989ee767c…:refs/heads/master` from the worktree (fast-forward, no force).
- Gotcha: gates need a full-tree export. `web/` alone lacks `supabase/` (typecheck) and `tasks/` (registry receipts).

# C7 ticket 36: review of `233f59b52` (RSO: upgrade drops old device-wide workspaces; ownerless signed-out slot)

**Verdict: accept.**
- It closes my R34 P1 and P2. P3 still fails closed, as intended.
- No legacy provider data can reach a signed-out view or another account.
- Data loss is limited to the one-time upgrade: signed-in accounts and the new anonymous slot survive every later migration.
- The migration is idempotent and safe across tabs, with one benign first-upgrade race (U1).
- The edits to all three e2e specs are key renames only.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive 233f59b52` at `/private/tmp/c7-r36`), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- Evidence is in `r36-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: `workspace.test.ts`, `RosterScheduleOptimizer.test.tsx`, `AcquisitionRules.integration.test.tsx` | **240/240** |
| **Parent mirror** (`workspace.ts` from `7007a0527`, with the commit's `workspace.test.ts`) | **24/27.** The 3 changed or new tests fail: "keeps anonymous reads unchanged…", "migrates a pre-upgrade device as ownerless: only dates carry over and every legacy key is removed", and "never overwrites an existing anonymous workspace with migrated legacy dates". |
| **My controls** (`r36Workspace.test.ts`) | **5/5** (below) |
| **E2E** | Not run. The spec diffs were checked by text comparison only. |

## Checks

| Check | Evidence | Result |
| --- | --- | --- |
| **Can legacy provider data still reach a signed-out view or another account?** | No. `migrateLegacyWorkspace` (`workspace.ts:213-223`) now keeps **only** season, dates and time zone (`ownerlessWorkspace`), for manual legacy entries too, and removes the bare device key, every legacy context key and its `:undo`. Signed-out reads use the new `fhfh:rso:workspace:v1:anonymous` namespace, which no legacy entry occupies. Accounts read only their own namespace. **Control 1:** a legacy "Continue manually" fork of a Yahoo roster, with Undo, migrates to an empty manual workspace with the same dates and no history. No legacy key remains, and the name "Prior Account Goalie" appears nowhere in storage. | Closed (R34 P1) |
| **One failing key no longer blocks the others** | Legacy keys are listed first, then each is removed in its own `try`. Keys are no longer parsed, so a malformed name can't throw. **Control 2:** with removal failing for the `league-a` keys, the malformed key and the manual key are still removed, and the next run removes the rest. | Closed (R34 P2) |
| **Preservation journal** | `preservationKeys` and `validatePreservation` are unchanged and use account keys only. An old journal still fails with "unexpected storage keys". The anonymous slot is never preserved. | Fails closed (R34 P3) |
| **Is the loss limited to the one-time upgrade?** | Yes. The legacy filter (`key === WORKSPACE_KEY \|\| startsWith("…v1:context:")`) can't match `…v1:principal:…` or `…v1:anonymous:…`. **Controls 3 and 5:** after migrating, an account's slot and an anonymous edit (with their context keys) are byte-identical across 3 more migrations. Since `e8d223cc2` isn't on `origin/master`, **production devices go straight from the legacy layout to this one**. At that release every user's local plan starts fresh, signed in or not; account saves are unaffected. After that, account and anonymous slots persist. | Holds (release-note item) |
| **Idempotent** | After the first run there are no legacy keys left, so later runs only list keys and do nothing (control 3: storage unchanged). It runs on every hydrate (each load and each account change). | Holds |
| **Safe across tabs** | The anonymous slot is written from legacy dates **only if it's empty** (`getItem(ANONYMOUS_WORKSPACE_KEY) === null`). **Control 4:** a later legacy pointer, for example from an old-version tab still open after the deploy, never overwrites an existing anonymous workspace, and its legacy key is still removed. New code never reads legacy keys, so an old tab's writes are invisible to new tabs and removed on their next load. | Holds (see U1) |
| **Were the `start-chart.spec.ts` edits only key changes?** | Yes. The 2 changed lines differ only in `"fhfh:rso:workspace:v1"` becoming `"…:anonymous"`. `rso-continuity.spec.ts` has 2 such lines. `roster-schedule-optimizer.spec.ts` has 74 changed lines, and **the removed and added lines are identical once the key string is normalised** (sorted diff is empty, `r36-evidence/c7-r36-spec.diff`). No assertion or logic changed. | Key-only |

## Notes (info)

| # | Note |
| --- | --- |
| **U1** | **The migration doesn't take the RSO writer lock.** On the very first load after upgrade, two new tabs could interleave: tab A sees the anonymous slot empty, tab B writes a signed-out edit, then tab A writes the legacy dates over it. Only anonymous and ownerless data is involved; there's no cross-account exposure, and the window is one load. Acceptable as is. |
| **U2** | `ANONYMOUS_WORKSPACE_KEY` means a no-principal call no longer uses the bare device key (a deliberate change from R34's "same as before"). The only non-test callers are the RSO component's account-scoped calls. Tests and e2e specs that seed the bare key would now be migrated away, and the commit updated all three specs. |
| **U3** | Release note, as in R34 P4: "local RSO plans start fresh after this update; plans saved to your account are kept." |

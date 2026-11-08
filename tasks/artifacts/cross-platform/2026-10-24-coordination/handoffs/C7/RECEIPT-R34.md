# C7 ticket 34: review of `e8d223cc2` (RSO per-account local workspaces; context switches keep plans apart)

**Verdict: accept with limits.**
- **Accounts are kept apart.** Sign-in, sign-out, token refresh and an in-place account switch now show each account only its own local slot. New signed-in work never reaches the anonymous slot.
- **D1 holds.**
- **Callers that pass no principal behave exactly as before.**
- **The limit is one finding, P1 (low-medium, one-time at upgrade):** the legacy-key migration keeps old **manual** workspaces whole in the anonymous slot. A manual workspace made with "Continue manually" from Yahoo still holds that account's Yahoo roster, plan and Undo history.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive e8d223cc2` at `/private/tmp/c7-r34`), not the working tree.
- Unit tests ran under the outbound network-deny preload with `TZ=UTC`.
- Evidence is in `r34-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: `workspace.test.ts`, `RosterScheduleOptimizer.test.tsx`, `AcquisitionRules.integration.test.tsx` | **239/239** |
| **Parent mirror** (`workspace.ts` and the component from `46bc91caf`, with the commit's tests) | **111/239.** The 3 new `workspace.test.ts` cases fail (the new exports are missing). 125 component cases fail, mostly because the tests now seed the per-account key, which the parent doesn't read, so that count isn't a targeted signal. The D1 assertions ("…clearing the team…", "…late response for the previous scope") and the rewritten account-switch case are among the failures. |
| **My controls** (`r34Workspace.test.ts`) | **4/4.** They demonstrate P1 and P2, and confirm that no-principal key names match the parent and that each account's writes stay in its own keys. |
| **E2E `rso-continuity.spec.ts`** | **Discovery only:** `--list` finds 10 tests. **Not run:** it needs a dev server and Chromium, which my time box didn't allow. The commit reports the worker ran it on :3160; I haven't verified that. |

## Privacy paths

| Path | Evidence | Result |
| --- | --- | --- |
| **Sign-in** (anonymous to A) | The hydrate effect (`RosterScheduleOptimizer.tsx:233-250`) waits for `authLoading`, then reads only `fhfh:rso:workspace:v1:principal:<A>` (`workspaceStorageKey`). With no slot, it starts from `defaultWorkspace()`. Anonymous edits stay in the anonymous slot. | Holds |
| **Sign-out** (A to anonymous) | It reads only the device key, through `anonymousWorkspace` (a provider workspace becomes an empty manual one). History is `[]` unless the stored workspace is already manual. `setWorkspace` and `setLoadedScope` run in the same effect, so A's in-memory workspace is never persisted under `null`. | Holds (see P1 for legacy data) |
| **Token refresh** | `user?.id` doesn't change, so the effect returns early (`loadedScopeRef.current === scope`). A loading flicker also returns early. | Holds |
| **Principal switch without reload** (A to B) | B's slot or an empty workspace is shown, `history.current = []`, and `viewingSaved` is reset. In-flight provider refreshes are aborted (`:434`) and also check `userId === providerRef.current.userId` before calling `setWorkspace` (`:490-513`). The account save view is cleared. The component test asserts that the late first-account response ("First Account Player") never shows, B's slot is empty, and A's slot is intact. | Holds |
| **Other tabs** | The only `storage` listener (`:324-333`) invalidates a held preservation session; it never adopts another tab's workspace. All tabs share one Supabase session, so they switch accounts together. | Holds |
| **Context restore across accounts** | `edit()` reads `readWorkspace(next.context, scope)` and `readWorkspaceHistory(next, scope)` in the current account's namespace. Signed out, a non-manual stored context is refused (`:352`). `readWorkspace` also requires the stored context to match the requested one. | Holds |
| **Preservation (restore) keys** | `preservationKeys` now uses the per-account keys, and `validatePreservation` requires the backup's keys to equal them. So an old journal holding device keys can't restore into the anonymous slot; it fails closed with "Backup contains unexpected storage keys". | Holds (P3) |
| **No-principal callers** | `workspaceStorageKey(null)` is `WORKSPACE_KEY`, and `contextStorageKey(ctx, null)` matches the parent's format. My control: a no-principal write produces exactly the parent's 3 key names. All new parameters default to `null`. | Same as parent |

## D1: context switch (`RosterScheduleOptimizer.tsx:349-356`)

- **Switching league, team, season or provider:** with no saved workspace for the new context, the intent's `steps`, `protectedPlayerIds` and `excludedPlayerIds` are cleared (as were the overrides, roster and locks). With a saved one, its own plan is restored from the per-context key.
- **Date and time-zone edits** keep the intent.
- **Tests:** e2e case 2 checks league-b starts empty and league-a's moves come back on return. The component tests assert the cleared intent after clearing the team and after a team change.
- **Note:** Team ID and League ID are free-text fields, so typing passes through intermediate contexts. Each one starts empty, and returning to the original id restores it from its key. That is correct, but a manager might briefly see their moves "disappear" while typing.

## Out-of-lease tests

| File | Change | Weakened? |
| --- | --- | --- |
| `AcquisitionRules.integration.test.tsx` | 3 call sites now pass `auth.user?.id ?? null` to `writeWorkspace`, `readWorkspace` and `readWorkspaceHistory`. Nothing else changed. | No (pure adaptation) |
| `e2e/roster-schedule-optimizer.spec.ts` | `seedWorkspace` takes a principal (default anonymous); reads use the fixture principal's key; 2 `expect.poll` waits were added for asynchronous persistence before reading storage. | No, for these |
| Same file, test "connected refresh and account save … exclu…" | **Not just a key change.** Removed: the setup fieldset and Source disabled, the roster panel inert while access is held, and "Continue manually" forking **the first account's** retained intent, roster and locks for the second account. Added: the second account has no Refresh button, shows "0 players", has no Protect checkbox, and its slot is manual and empty; the first account's slot is unchanged. | Not a weakening. The removed assertions encoded the old cross-account behaviour that TJ's decision removes. With no retained inputs, the read-only and inert checks don't apply. Coverage of "held access keeps retained inputs read-only" now relies on other tests. |

The in-lease `RosterScheduleOptimizer.test.tsx` has the same kind of changes: about 140 key adaptations, 2 assertions updated to the D1 semantics, the account-switch case rewritten as above, and a signed-out case that chooses Yahoo in the session instead of seeding the anonymous slot.

## Findings

| # | Severity | Finding |
| --- | --- | --- |
| **P1** | **Low-medium** (one-time, at upgrade) | **Legacy manual workspaces can carry Yahoo data into the anonymous slot.**<ul><li>`migrateLegacyWorkspace` keeps every legacy **manual** entry whole: the device key and the manual context keys **with `:undo`**. `anonymousWorkspace` also passes any manual workspace through unchanged.</li><li>But "Continue manually" (`:1022`) creates a **manual** workspace from a Yahoo one through `retainProviderInputs`, so it holds that account's Yahoo roster, players, plan and locks.</li><li>So a device where an account used "Continue manually" before upgrading keeps that roster, plan and Undo history in the anonymous slot. Anyone who opens RSO signed out on that device sees it, including after that account signs out.</li><li>My control P1 shows the roster ("Prior Account Goalie"), the step and 1 Undo entry readable anonymously after migration.</li><li>Not a regression: before this commit the same data was visible to every account on the device. But it contradicts "provider data never enters it" for legacy data.</li><li>**Fix options:** treat all legacy entries as ownerless (reduce the device key to dates only, and drop the legacy context and `:undo` keys too), or drop legacy manual entries whose `manualPlayers` came from a provider. The first is simplest and safest; its cost is that anonymous manual users lose a pre-upgrade manual plan.</li></ul> |
| **P2** | Info | **The migration loop sits in one `try`.** An undecodable or non-JSON key under the legacy `…:context:` prefix stops it, so later legacy **Yahoo** keys survive. A signed-out `edit()` to that context then reads its legacy `:undo` history (`readWorkspaceHistory(next, null)`), and Undo would restore the Yahoo workspace. My control P2 shows the surviving keys and the readable history. The app never writes such malformed keys, so this isn't reachable in practice today. A per-key `try` would close it. |
| **P3** | Info | A preservation journal held from before the upgrade (with device keys) now fails validation and stays held ("normal writers are paused"). It fails closed and is rare. |
| **P4** | Info | **At upgrade, a signed-in account's device workspace doesn't move into its new slot.** It becomes the anonymous one: emptied if it was a provider workspace, kept if manual. Account saves are unaffected. This follows from the design, but it's worth a release note: "your local plan starts fresh after this update; account saves are kept". |
| **P5** | Info | **Edits made while auth is still loading are kept only if the account has no saved slot.** If it has one, it replaces them (`:244`). The comment at `:245` describes only the no-slot case. This is minor; the window is usually a fraction of a second. |

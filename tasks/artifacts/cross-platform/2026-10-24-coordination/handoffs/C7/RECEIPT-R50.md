# C7 review R50 (pre-release): `5e8043d6d` (RSO UI batch 1)

**Verdict: accept with limits.**
- **Nothing must change before release.**
- Item 1 (the no-blank fallback) does what it claims on all four questions.
- Items 2–4 are layout only, with no regressions found.
- The closure is unchanged at **`bf23edfe…`**, which is now allowlisted (via `fea39c3e3`), so **R49's P1 is closed** for RC 9.
- Limits L1 and L2 and test gap T1 are noted below; none blocks the release.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I used `git archive` snapshots at `/private/tmp/c7-r50` of `5e8043d6d` and its parent `8beaa186b`.
- Tests ran under the outbound network-deny preload with `TZ=UTC`.
- Evidence is in `r50-evidence/`: the run summary, the script, my control test file and the mutation note.

## Tests

| Run | Result |
| --- | --- |
| **`5e8043d6d`**: hook, executionAdapter, ForecastPoints, points, TeamScheduleContext, RSO component | **315/315** |
| **Parent** (`8beaa186b`, with the commit's tests) | **290/315.** All 4 lapse tests in the hook fail, as do the 13 adapter cases asserting `privateLapsesFirst` (`expected undefined to be true/false`), the 5 "exp"/"if GS" label cases, the 2 team-schedule cards and the Bench days tab case. Each failure is the intended change. |
| **C7 controls** (`c7-standin.control.test.tsx`, run at the commit) | **5/5** (C1–C5, below) |
| **Mutation:** drop `&& fallback?.key === key` from `useRosterPlanning.ts:60` | **C5 fails** (the old account's stand-in is shown after the new account's plan lapses); C1–C4 still pass. The author's own tests **don't** kill this mutant (T1). |
| **Closure** | `5e8043d6d` and its parent: **`bf23edfea5b5…7ab3b`**, 194 modules, 0 findings. No touched file is in the closure. The allowlist at `5e8043d6d` lists `4bf0fce7`, `4c06fd9e`, `c1f0129a`, `87edd78f`, `5644e3fd` **and `bf23edfe`**. |
| **e2e listing** | `e2e/rso-acceptance.spec.ts` lists 8 tests, including "returning to the tab keeps the page mounted…" and the two UI batch 1 cases. Discovery only: I didn't run Chromium. The author reports 8/8 in UTC and New York. |

## Item 1: no-blank fallback (`hooks/useRosterPlanning.ts`, `executionAdapter.ts`)

| Question | Evidence | Result |
| --- | --- | --- |
| **Can an expired number ever be shown?** | `useRosterPlanning.ts:69` returns the current plan only if `!lapsed(current)`. Otherwise it returns the stand-in only if `!lapsed(standIn)`, and otherwise nothing. `lapsed` uses the monotonic deadline when present. The stand-in is never shown without a same-key `current` (when `current` is null, `lapsed(undefined)` is false, so `execution` is `undefined`). Controls: **C4** (a stand-in that arrives already expired is never shown); the author's "re-plans once the public stand-in lapses too" (blank, then re-read). | **No** |
| **Is the stand-in always the same generation?** | It's stored with `{snapshot, intent, key}` and shown only on an identity match of all three (`:60`). `key` covers `allowRead`, `publicContext`, `refreshKey`, `epoch`, the requested ids, `yahooEligibility` and `yahooPrincipalId`. The stand-in request reuses the same `refreshKey` and generation (`:52–54`). Any re-plan bumps `epoch`, which drops it. | **Yes** |
| **Is it free of private Yahoo data?** | The stand-in request passes `yahooPrincipalId: null` (author test, plus C1), so `rosterPlanningExecution.ts:27` builds no Yahoo read broker. `currentPlanningRead` then takes the public `/api/v1/roster-schedule-optimizer/data` path, which never sets `privateDeadline`, so no private confirmation marks are read or applied. Two things are still used, both as before: the client-held provider snapshot (the user's own league data) and the client-held `yahooEligibility` receipt, i.e. Yahoo *default positions* from the public `yahoo_players` job, checked against its daily cycle in `cachedYahooPlayer`. Neither is a new private read. | **Yes** (no live private Yahoo data) |
| **Does account isolation hold on a real switch?** | A switch changes `yahooPrincipalId`, so `key` changes. In the first render `current` is null and nothing is shown. The effect cleanup cancels the pending stand-in timer and releases its worker. **C2:** the stand-in is on screen, then a switch gives `null`/loading at once, with the new read under `"other"`. **C3:** the stand-in read is in flight during the switch; the worker is terminated and its late answer is ignored. **C5:** after the switch, the new account's plan lapses and its own stand-in read fails; the old account's stand-in is **not** shown. The mutation shows the `fallback.key === key` check is what guarantees this. | **Holds** |
| **Does it avoid a Yahoo read every 2 minutes?** | **Before:** the plan lapsed, the page blanked, then re-planned with a new private read, so roughly one Yahoo read every 2 minutes while the page was open. **Now:** the replan deadline moves to the **stand-in's** expiry (`:66–67`). With a public stand-in that has no deadline (`expiresAt: null`), there's no further read at all. The author's test shows 2 workers total after 10 minutes. The cost is **one public `/data` read per private generation**, about 30 s before the deadline. Plan edits inside the window cost no extra read (the timer is keyed on `published`). The next Yahoo read comes with provider upkeep, an input change or the stand-in's own expiry. | **Yes** |
| **Is `privateLapsesFirst` correct?** | `executionAdapter.ts:24` is true only when the earliest deadline **is** the private one and no public deadline is at or before it. The adapter test "reports a public input, not the Yahoo window, when a forecast expires first" covers it, and the author's "reads no stand-in when a public input ends the plan first" shows the old withdraw-and-re-read path is kept. | Correct |

| # | Severity | Note |
| --- | --- | --- |
| **L1** | Medium (limit) | **A frozen or heavily throttled background tab still blanks.** If the stand-in timer (deadline − 30 s) and the replan timer (the deadline) both come due in the same wake-up (Chrome Energy Saver or Memory Saver tab freezing, or a stand-in read slower than 30 s), the replan fires before the stand-in's worker can answer. It bumps `epoch`, cancels the stand-in, and the page blanks and re-reads Yahoo on return, exactly as before. **C1** reproduces this. Normal 1-second background throttling isn't affected. If TJ's report recurs on a frozen tab, a fix would be to let the replan wait briefly for an in-flight stand-in, or to read it on `visibilitychange`. |
| **L2** | Info | **The swap at the lapse isn't labelled in the UI, and the plan can change.** At the deadline the page switches to the public-only plan: Yahoo start marks drop, and the optimal lineup or points may differ from the private plan (the author test shows `result` going from `plan` to `publicPlan`). Nothing in the diff tells the user that the confirmations lapsed. Separately, a stand-in with no public deadline can stay on screen past the 08:40 UTC eligibility cycle; its default positions are then from the previous cycle. That's the same as an ordinary public plan, but it's newly reachable for Yahoo pages. |
| **T1** | Low (test gap) | **No author test covers the cross-account case** (C5). Dropping the key check passes the whole committed suite. Consider adopting C5 as a regression test. |

## Items 2–4: layout (glance)

- **Bench days tab** (`RosterScheduleOptimizer.tsx`): "Players | Bench days" buttons with `aria-pressed`; Players is the default. Bench days replaces the player rows and moves out of the week summary; the goalie chip and metrics are unchanged.
  - Nit: `aria-controls="rso-bench-days"` points at an element that exists only while the tab is open.
- **Goalie cells** (`SlotWeekGrid.module.scss`): the goalie-only `--cell-height: 64px` override is removed, so goalie cells share the skater height. Points are stacked in column 2.
  - Visible text is now "exp" and "if GS"; the aria-labels and titles are unchanged (per the receipt; the tests assert the visible text).
- **Team schedule cards** (`TeamScheduleContext.tsx`):
  - opponent logos replace H/A, with a fallback logo `onError`, and H/A text when the opponent is unknown;
  - the aria-label is now "Home vs X" / "Away at X";
  - off-nights are shown with a green fill instead of an underline;
  - a team band uses `teamsInfo` colours (undefined-safe);
  - Score sits above GP and OFF.
  - Nit: the contrast of secondary on primary colours isn't guaranteed for every team.
- **CSS Modules purity:** every new or changed selector starts with a local class (`.rosterViews`, `.forecastPoints[data-goalie] …`, `.days b[…]`, `.cards article`, `.teamBand`, `.opponentLogo`, `.teamMetrics .weekScore`), so they're pure. The removed `.teamLogo` and `.cardHead` have no remaining references.
- **Opt-in diagnostics:** `rsoDebug` logs only when `localStorage["fhfh:rso:debug"] === "1"`. It writes to the local console, including the Supabase user id. It's harmless, but worth removing once the "page reset" report is closed.

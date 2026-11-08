# C7 ticket 24 — review of the 5 local commits since the push (`origin/octoberBranch..HEAD`)

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads.
- Tests ran under the outbound network-deny preload, against a clean `git archive HEAD` snapshot at `/private/tmp/c7-r24` (HEAD `cc4886a81`); the canonical working tree has uncommitted SS1 edits.
- No heavy lock was taken.
- Evidence is in `r24-evidence/`.

| Commit | Verdict |
| --- | --- |
| `418224990` route-runner test clock pin | **Accept** |
| `dffd3b2d0` lint: dynamic `import()` / `require()` of `evidenceBundle` | **Accept** (closes my R22 L2) |
| `9501fda81` HIR policy 3A weekly lock | **Accept** (H4, minor) |
| `0f457e0da` WiGO six audit items | **Accept** |
| `cc4886a81` SS1 Targeted Matchups picks and chip contrast | **Accept with limits** (S1, S2) |

## Tests: new tests fail on the parent, pass on HEAD

Each mirror symlinks the HEAD snapshot, except the directories the commit touched. In those, the commit's sources are reverted to `<commit>^` and the HEAD tests are kept. For the test-only `418224990`, the mirror uses the **parent's test file** against unchanged sources. Aliases resolve into the mirror.

| Commit | HEAD | Parent | Failing on the parent |
| --- | --- | --- | --- |
| `418224990` | 13/13 | 12/13 | "runs one step for the cron bearer and writes one small audit row" (the parent test fails **today**, after 2026-10-25T09:00Z) |
| `9501fda81` | 22/22 | 19/22 | the 3 new weekly-lock tests (alert copy, the lock pricing, locked-window ranking) |
| `0f457e0da` | 21/21 | 13/21 | 8 new or retargeted tests across GameScoreSection, NameSearchBar ×3, StatsTable ×2, StatsTableRowChart and fetchTeamDriverSnapshots |
| `cc4886a81` | 49/49 | chipContrast 1/7; `schedule.test` and `targets.test` can't load (`./targets` absent) | 6 contrast tests, plus all target tests |

`dffd3b2d0` is config-only; I probed it directly (below).

## `418224990` route-runner: `web/__tests__/pages/api/v1/db/route-runner.test.ts:73-76, :86`

- **Root cause confirmed:** `makeJob()` fixtures carry `expires_at: "2026-10-25T09:00:00.000Z"` (`lib/routeRunner/memoryStore.testHelper.ts:27`). The memory store compares that with `Date.parse(nowIso)` (`:54`, `:74`, `:84`), so the tick returned idle from that real instant on.
- **The fix** pins only `Date` to 2026-10-22T10:00Z (after the fixtures' `created_at` of 09:00Z), the same pattern as `tick.test.ts` and `store.test.ts`, and restores real timers afterwards.
- **The commit touches only the test**, so the route is unchanged.

## `dffd3b2d0` lint: `web/eslint.config.mjs` (`no-restricted-syntax` block)

**Stdin-only probes** (`lint-probe.txt`; no files written):

| Form | Blocked |
| --- | --- |
| `import("lib/…/evidenceBundle")` | yes |
| Relative `import("./evidenceBundle")` | yes |
| With `.ts` extension | yes |
| Template ``import(`lib/${d}/evidenceBundle`)`` | yes |
| `require("./evidenceBundle")` | yes |
| Template `require` | yes |
| `vi.importActual("…/evidenceBundle")` | yes |
| `import eb = require(…)` | yes |
| `evidenceBundleView` (similar name) | **no**, correctly |
| `evidenceLoader` dynamic import | **no**, correctly |
| `typeof import(…)` type query | **no**, correctly |
| `evidenceLoader.ts` (ignored) | **no**, correctly |
| String-concatenated path (`"lib/player-cards/" + n`) | **no**: no static rule can see it; this is the residual |

**Real tree: 0 hits.** As with my R22 L3, this is now the config's only `no-restricted-syntax` block, so any later block for that rule on overlapping files would replace it unless the two are merged.

## `9501fda81` HIR weekly lock: `web/lib/rosterScheduleOptimizer/healthyReserves.ts:62-71, :85-86`, `HealthyReserveAlert.tsx:7-17`

- **Behaviour:**
  - Weekly leagues only.
  - When the current window's `lockAt` has passed (the same `asOf > lockAt` test the planner uses), the activated player is **locked to the bench** (`slotId: null`) on every remaining game date in that window.
  - The gain is then only from later windows, and the activation carries `nextWindow: true`.
  - The alert reads "Weekly lineup is locked; from next week: …", or "…counts from next week" when there is no positive gain.
  - Daily leagues and an unlocked weekly window are unchanged; both are tested with `toStrictEqual`, so there's no stray `nextWindow` key.
- **H4 (low):** `lockedDates` lists only remaining dates that have games (`:69-71`). If the window has locked but **no game dates remain** in it (e.g. late Sunday), `lockedDates` is empty, so the activation isn't marked `nextWindow`. Its gain, which can only come from next week, is then labelled "… this week". Decide `nextWindow` from the lock itself (`window.lockAt` passed), not from `lockedDates.length`.

## `0f457e0da` WiGO six items

| Item | Location | Assessment |
| --- | --- | --- |
| A-05 | `NameSearchBar.tsx:71-72` | `.or("position.is.null,position.neq.G")` is AND-ed with the other filters; null positions stay searchable. |
| A-03 cutoff | `fetchTeamDriverSnapshots.ts:17-29` | Both latest dates are read in parallel and the cutoff is the earlier one. `wgo_team_stats` is season-filtered; an error on the new read throws. The "N of M games" coverage policy correctly stays with TJ. |
| B-08 | `StatsTableRowChart.tsx:68-77, :296` | "Game mean: …", formatted like the stat. |
| C-01 | `GameScoreSection.tsx:18` | Copy only; the RPC is unchanged. |
| B-21 | `WigoComparisonMatrix.tsx:191` | `DIFF !== 0` treats both `0` and `-0` as neutral. |
| B-22 | `TimeframeComparison.tsx:8-9` | Options now follow the matrix column order. |

All six match `RECEIPT-4.md` and the audit; no findings.

## `cc4886a81` SS1 Targeted Matchups: `web/lib/socialShare/targets.ts`, `tiers.ts:96-131, :143-146`, `matchups.ts:101-160`, `SocialShare.tsx`

**Pick rules, against TJ's decisions** (RECEIPT-22, TJ's pop-ups):
- **Goal storm → scorers** (G/GP), **shot storm → shooters** (SOG/GP), and **shots-against storm → blockers** (BLK/GP). The new `blocks` evidence is tilt-team SA/GP plus opponent SF/GP, both in the league top third.
- **There is no hits → hitter rule: TJ chose "no hits tilt for now"** (no team-hits source; `targets.ts:9`, RECEIPT-22:33). So the ticket's "hits→hitter" line doesn't apply yet.
- **Spread across 2+ storms:** picks alternate across the tilt roles, best remaining first, and a player who is also the best remaining fit for another role covers both.
- **No storm:** the night uses the single strongest primary pairing by combined rank. Tired, soft-defence and off-night tags alone drive nothing.
- **Never padded:** unknown rates are never picked, and fewer qualifiers means fewer cards.
- **On the pinned PNG** (`t22/evidence/monday-stream-pinned.png`):
  - STL (goal, shot and SA storms) gets Scorer, Shooter and Blocker;
  - DET (two storms) gets Scorer, Shooter, Scorer;
  - BUF shows "Shooter + Scorer";
  - NYI (no storm) gets 3 Scorers.

**Rostered < 50%:** the pool is `snapshot.players`, and the layer is built only from the Yahoo read filtered `lt("percent_ownership", 50)` (`playerSources.ts`). There is no separate filter in `targets.ts`; the guarantee is at the source. The card says "Picks = rostered <50% (Yahoo), season rates".

**Only shown players leave the server:**
- `trimEditionPlayers` adds exactly the picked players and records `targets: {TEAM:gameId → [{id, roles}]}`.
- `TRIMMED_PLAYERS_MAX` rises by `STREAM_LIMIT × TARGETS_PER_NIGHT` (+18).
- The client uses only the server's recorded picks on a trimmed layer, and shows none for an older edition without `targets`, never a guess.
- **The pool is sufficient:** `rankingPool` adds the top 3 per tilt role per night. At most 2 players are taken before any role's turn (3 picks in all), so the top 3 per role always contain that role's pick, and server picks equal full-layer picks.

**Fail-closed:**
- `targetPicks` needs `trusted` and `playersReady`.
- A missing `goals` value (`count()` guard, `players.ts:98`) means the player is not a scorer candidate.
- Night selection is unchanged by the new `blocks` flag (`selectionFlags` ignores it), so no matchup moves.

| # | Severity | Finding |
| --- | --- | --- |
| **S1** | Low | **A three-role legend isn't covered by the "unclipped" check.** The e2e check (`e2e/social-share.spec.ts`, `cardText`) compares each part's `scrollWidth` with its own `clientWidth`. A shrink-wrapped `<legend>` always passes that, so a legend **wider than its fieldset** wouldn't be caught. The widest real legend, "SCORER + SHOOTER + BLOCKER" (a player who is best remaining for all three storms), is about 25 characters at 9.5px with 0.06em tracking. That is likely wider than a one-third-width card. The pinned PNGs only show up to "SHOOTER + SCORER", which fits. Add an assertion that the legend box is inside the fieldset box, or shorten multi-role legends (e.g. "G · SOG · BLK"). |
| **S2** | Info | The <50% guarantee lives only in `playerSources.ts` (the `lt` filter). If a future source widens the layer (e.g. a "rostered ≥ 50%" card), `targetPicks` would silently include those players. A one-line `player.ownership < 50` filter in `targets.ts` would make the card's claim self-enforcing. |

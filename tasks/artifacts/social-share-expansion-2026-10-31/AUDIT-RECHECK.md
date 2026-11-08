The recheck is **not clean**: F1 remains partly fixed, F5 retains a misleading coverage summary, and the new posted-week flow has four medium and one low finding.

All six hashes in the working-tree `FREEZE.md` **exactly match `7e2623f756f8f3542ecccce44b43c1d040af91cb`**. All code references below use that pin. Probes executed pinned code in memory with synthetic inputs and mocked I/O; nothing was written.

**Open findings, ranked by severity**

1. **High — F1: Partial shift feeds still delete valid PP rows.**  
   [update-power-play-combinations/[gameId].ts:164](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:164), deletion at line 187.

   The guard accepts aggregate player PPTOI equal to three times team PP time. That does not establish complete shifts.

   **Observed:** Using the actual pinned penalty calculator, shift/matrix functions, metrics builder and writer, both teams had 120 seconds of PP time. Five skaters’ shifts existed for one team and only three for the other. The writer returned success with eight rows and issued deletion excluding only those eight players—removing valid stored rows for the omitted players. Four opposing skaters also passed. Zero or one opposing skater correctly caused rejection before any write.

   The added zero/one-skater tests would fail on the old writer, but miss this surviving failure.

2. **Medium — Missing or unreadable post dates create false ✅ on the receipt day.**  
   [FHFHockey-post.ts:35](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sources/ifttt/FHFHockey-post.ts:35), duplicate handling at line 41.

   A Sunday post delivered Monday with missing or unresolved `CreatedAt` is stored as Monday’s post. A corrected retry cannot repair it because the first delivery wins.

   **Observed:** With Monday receipt time and `created_at: "{{CreatedAt}}"`, the actual handler returned 200 and stored Monday’s timestamp; `buildPostedWeek` then returned Monday `done`. The test at [FHFHockey-post.test.ts:118](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/sources/ifttt/FHFHockey-post.test.ts:118) explicitly preserves this fallback. Unknown publication time needs to remain distinct from receipt time.

3. **Medium — The webhook does not establish that an accepted post belongs to FHFHockey.**  
   [FHFHockey-post.ts:22](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sources/ifttt/FHFHockey-post.ts:22), [lineSourceIftttReceiver.ts:76](/Users/tim/Code/fhfhockey.com/web/lib/sources/lineSourceIftttReceiver.ts:76).

   Account validation is conditional on `username`; `source_account` is ignored, and the URL parser accepts any string containing `/status/<digits>`. A misrouted applet using the shared secret can therefore mark FHFHockey as having posted.

   **Observed:** With valid synthetic authentication, both a GameDayLines URL with `source_account: "GameDayLines"` and no username, and `https://example.invalid/status/789`, returned 200 and reached the storage spy. Tests reject an explicit wrong username but do not cover these cases. This is an authenticated provenance defect, **not an unauthenticated bypass**.

4. **Medium — A previously populated table is treated as proof of uninterrupted tracking.**  
   [postedWeek.ts:73](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/postedWeek.ts:73), status assignment at line 89; [posted-week.ts:26](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/social-share/posted-week.ts:26).

   Once any historical post exists, missing receipts become “no post,” even if the applet stopped, delivery failed, or only selected historical posts were backfilled. `latest` is displayed but never used to qualify tracking coverage.

   **Observed:** With earliest and latest receipts both October 1 and the clock at November 4, the builder returned Monday and Tuesday `missed`; the UI renders ❌ and labels them “no post.” Existing tests enforce this inference. The data supports “no receipt recorded,” not verified absence of a post.

5. **Medium — A continuously visible landing page retains the previous day/week.**  
   [ShareLanding.tsx:92](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/ShareLanding.tsx:92), toggle handling at line 107.

   Refresh occurs on mount and visibility change only. Crossing midnight while the tab remains visible preserves yesterday’s `today`, week and statuses. `toggleDay` updates the week without updating `today`.

   **Observed:** An in-memory component/hook probe crossed Sunday 23:59 to Monday 00:01 New York time. Sunday remained “today,” and last week’s Monday ✅ remained displayed. Clicking Tuesday then saved `{week:"2026-11-02", done:["tue"]}` and displayed ✅ for a future day. The E2E reset test reloads the page, so it misses this transition.

6. **Low — F5: What Changed/Role Watch still report numerically complete coverage despite missing player rows.**  
   [whatChanged.ts:182](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/whatChanged.ts:182), evidence mapping at line 274; [roleWatch.ts:123](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/roleWatch.ts:123).

   Missing-team detection now correctly makes the post partial and prevents export. However, the generic coverage summary still counts completed results independently of player coverage.

   **Observed:** One team’s player rows plus both completed team results returned `observed:2, expected:2, missing:0`, alongside a missing-team reason. The new tests explicitly require `20/20` and `24/24` summaries in these incomplete cases. Separate result coverage from player coverage, or label the count accordingly.

7. **Low — The posted-week reader silently truncates at 500 posts.**  
   [posted-week.ts:20](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/social-share/posted-week.ts:20).

   The ascending query has no overflow detection or pagination. Beyond 500 weekly posts, later days can incorrectly become ❌.

   **Observed:** A mocked table containing 500 Monday posts and one Tuesday post produced HTTP 200, Tuesday `missed`, and no Tuesday card count, while `latest` correctly named Tuesday. No existing test covers the ceiling. This requires unusually high volume, hence low severity.

**Disposition of the prior findings**

“Regression proof” below distinguishes executed equivalent probes from inspection of the added tests; I did not run Vitest or Playwright.

| Finding | Verdict | Pinned evidence and regression proof |
|---|---|---|
| **F1** | **Partly fixed** | Missing-team rejection works at `[gameId].ts:164`; three/four-skater feeds still reach deletion. Old/new probes confirmed both the improvement and remaining defect above. |
| **F2** | **Fixed** | [goalieInventory.sources.ts:115](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/shared/goalieInventory.sources.ts:115) computes low-first competition ranks from values; line 292 uses them. For `[1,1,2,3]`, the old code produced defensive strength rank 2, bar 0.75 and an offensive winner; the candidate produced rank 1, bar 1 and a tie. Added tied-cohort assertions would fail old behavior. |
| **F3** | **Fixed** | [startSit.ts:35](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/startSit.ts:35), [riskyStarts.ts:105](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/riskyStarts.ts:105), shared TTL at `goalieInventory.sources.ts:310`. An executed Start/Sit snapshot/export probe changed 18:59 generation expiry from 19:14 to 19:00; export was blocked at and after puck drop. Both modules have matching expiry regression assertions. |
| **F4** | **Fixed** | [lastNightsStandouts.ts:226](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/lastNightsStandouts.ts:226), [LastNightsStandoutsCard.tsx:49](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/modules/LastNightsStandoutsCard.tsx:49). Unknown GSAx now has no numeric rank, the known cohort supplies the ranking denominator, and omitted unknowns remain disclosed. Probe returned ranks `[1,null]` for `−3` and unknown. Added mixed/all-unknown and omitted-row assertions contradict the old rendering. |
| **F5** | **Partly fixed** | [whatChanged.ts:178](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/whatChanged.ts:178), [lastNightsStandouts.ts:261](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/lastNightsStandouts.ts:261). Team-specific detection now produces reasons and partial state; Standouts also correctly reports `1/2`, missing 1. Old code produced no reason. New partial-state assertions would fail old behavior, but What Changed/Role Watch retain the numerical issue above. |
| **F6** | **Fixed** | [goalieRescue.ts:43](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/goalieRescue.ts:43), candidate admission at line 76. Old/new probes changed the October 1 goalie’s ownership from known 1% to unknown despite an unrelated November 1 row. Tests cover exclusion, explicit unknown inclusion and oldest admitted evidence date; these reject old behavior. |
| **F7** | **Fixed** | [goalieRescue.sources.ts:28](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/goalieRescue.sources.ts:28). Probes excluded `OFF`/`FINAL`, retained scheduled/live games under the disclosed rule, and returned unknown for unusable state with a past start. The Sunday-final zero-count assertion would fail the old unconditional counter. Source failure now supplies a dash and reason. |
| **F8** | **Fixed** | [riskyStarts.sources.ts:38](/Users/tim/Code/fhfhockey.com/web/lib/socialShare/modules/riskyStarts.sources.ts:38), query filter at line 53. The same two-book probe changed selection from newer FanDuel to older DraftKings. Added tests reject old selection and verify partner fallback without a false stored-DraftKings label. |
| **F9 — accepted real parts** | **Fixed** | The [PRD](/Users/tim/Code/fhfhockey.com/tasks/TASKS/prd-social-share-expansion-2026-10-31.md:1) exists in the pin. [Standouts spec:97](/Users/tim/Code/fhfhockey.com/web/e2e/social-share-last-nights-standouts.spec.ts:97) validates downloaded PNG bytes, dimensions and size; line 283 exercises built and goalie views. These close missing evidence coverage, rather than identify old runtime behavior that must fail. They do not prove pixel parity. |
| **F10** | **Fixed** | [PostStudio.tsx:33](/Users/tim/Code/fhfhockey.com/web/components/SocialShare/PostStudio.tsx:33). Actual old/new static-render probes changed failure disclosure from absent to `NST missing: NST read failed.` The new component assertion would fail the old implementation. |
| **F11** | **Fixed** | [bulk PP route:10](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/index.ts:10), limits at lines 49, 87, 118 and 125. Executed handler probes: 60 games changed peak concurrency from 60 to 4; 61 games changed from execution to HTTP 400 with zero writer calls. The added bound assertions reject old behavior. |

The inspected access paths retain the editor check before posts-table reads, private/no-store responses, and restricted selected columns. The [migration:31](/Users/tim/Code/fhfhockey.com/supabase/migrations/20261101171113_social_share_x_posts.sql:31) enables RLS, creates no public policies, revokes `PUBLIC`/`anon`/`authenticated` access and grants service-role access.

Actual shared-receiver probes confirmed route-secret precedence, shared fallback, wrong-secret rejection and fail-closed behavior when both secrets are absent. No secret value appeared in those responses. The new webhook logs only the database error code. I found no additional source-confirmed credential exposure in the inspected changes.

The downstream changes preserve GameDay inclusion, add the route-matching `dfo` and `nhl_rosters` groups, and retain accepted/observed filters and first-arrival selection. The added tests cover source inclusion and relay-author attribution. Those paths do not read the new posts table.

I did **not** verify live RLS/grants, deployed authentication, actual applet payloads or delivery completeness, production logs, existing PP repairs, browser bundles, or browser-to-PNG parity. FREEZE’s test/build claims remain owner-reported evidence; I did not rerun those suites, start a server, build, or make network requests.

**Severity counts: Blocker 0 · High 1 · Medium 4 · Low 2.**


Codex session ID: 01a19820-9212-7fb0-9e82-130bffc8a856
Resume in Codex: codex resume 01a19820-9212-7fb0-9e82-130bffc8a856

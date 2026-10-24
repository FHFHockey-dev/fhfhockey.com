# C1 receipt: STATS-S05 goalie workload recovery, selected team and responsive containment

- Lane C1, Claude session, 2026-10-24. Status: **implementation candidate with screenshots; not reviewed, integrated or released**. This is one S05 slice, not all of STATS.
- Base: `octoberBranch` @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. No Git writes. Lease baselines matched 6/6 at start. S06 files are untouched by this patch.
- Patch: `handoffs/C1/C1-S05.patch`, sha256 `66a5e41121d0da29b11aa95bf93d8065ca6f3a9a9fe0219d6e09d01d1ede9da4`. It touches 4 files (+112/−17). It replaces the earlier draft `acb55edb…`, which did not include the CSS containment fix.

| File | Candidate sha256 |
| --- | --- |
| `web/components/GoalieShareChart/index.tsx` | `b632a0cae6a50174012264950b7a0ca1b22402811a7162024216c40ecf09949c` |
| `web/components/GoalieShareChart/GoalieShareChart.module.scss` | `1352a81560e50128c75709d29ad65eed1295562834746e7cf2d18948e65d138b` |
| `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx` | `fef6ef9c2b4b4fd754333d322b1ac31d5193c27a17b098c2c3d7a0b01a686536` |
| `web/styles/Stats.module.scss` | `e0dbf85fab25a006ce4b5f7be97ef7c355c519e34edba385c5226a157f15d8d8` |
| `GoalieShareChart.test.ts`, `TeamStatsPage.module.scss` | unchanged (`250bfc55…`, `95729a78…`) |

## Gaps reproduced on HEAD and fixed

1. **Recovery.** When the season was withheld, the alert offered no way to recover short of a page reload.
   - Fix: the loader is a reusable callback, and the alert has a **Try again** button.
   - Each run keeps the 2-attempt budget per request and withholds every window until all pages are complete (A8 unchanged).
   - Browser evidence: 5 goalie page calls on the failed run (4 pages, with one retry of the failing page) and exactly 4 on the retry.
2. **Selected team (below 768px).** The default ANA with no rows rendered **0 charts** while the selector showed BOS. In the withheld state an empty selector was also shown (before capture: `selectValue ''`).
   - Fix: the view falls back to the first team with data, and the selector appears only when data exists (`aria-label="Team"`).
3. **Responsive containment.** Found during the screenshots.
   - `Stats.module.scss` `.mainLayout` used `400px 1fr 400px` from 1024px, which left the middle column (Key Metrics, Leaderboard Position, Goalie Share) **144px** wide at 1024.
   - The chart's 4-column desktop table also used fixed 160px doughnut boxes. It overflowed its box by **616px at 1024, 200px at 1440 and 32px at 320**, so it was clipped to one partial column at 1024.
   - Fix part 1, `.mainLayout`: `minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr)`. Measured tracks: 270/405/270 at 1024 and 389/583/389 at 1440 (was 400/560/400).
   - Fix part 2, chart rows: each row is an auto-fit grid with a 150px minimum and `min-width: 0`, and the doughnut box is `width: 100%; max-width: 160px`. That gives 2 team columns at 1024 and 0px chart overflow at every width.
   - `.mainLayout` is used only by `pages/stats/index.tsx`.

## Verification

- `npx vitest run components/GoalieShareChart`: 20/20 passed.
- Combined with the S06 suites (TeamTabNavigation, useShotData, team page): **62/62 passed**.
- The 3 new behaviour tests fail on HEAD (`fixture-harness/s05-baseline-run.txt`). CSS containment is verified by browser measurement, not Vitest.
- `npx eslint` on the component and test files: **passed** (0 errors; 2 existing `<img>` warnings).
- **CSS-module pure check** (`fixture-harness/css-pure-check.cjs`; Next's postcss-modules-local-by-default in `mode: "pure"` on sass output): **passed** on all 3 leased `.module.scss` files after the final edit. The checker rejects an impure `td[data-x]`.
- **Whole-project `npx tsc --noEmit`** (8 GB heap, under `/private/tmp/fhfh-heavy.lock`, released afterwards): **failed, exit 2**, with 3 errors and none in C1 files (`tsc-s05-2026-10-24.txt`):
  - the 2 pre-existing Luna errors;
  - `e2e/social-share.spec.ts:335`, another lane's file.

  No TypeScript changed after that run; only SCSS did.

## Screenshots (`handoffs/C1/screenshots-s05/`, before-* and after-*)

- **Setup.** Isolated Next (`PLAYWRIGHT_ISOLATED_NEXT=1`, 127.0.0.1:3110) with Supabase pointed at `fixture-harness/pgrst-stub.mjs` on 127.0.0.1:54399.
  - The chart's `/api/cors` NHL season and goalie calls were answered in Playwright from fixtures: 32 teams × 12 games, 384 rows in 4 pages.
  - Every other request was aborted. The server log shows no live fallback (`nhle` or `supabase.co`: 0 matches).
- **Before captures.** These used HEAD's versions of `index.tsx`, `GoalieShareChart.module.scss` and `Stats.module.scss`, swapped in and restored with sha256 verified (`s05-before-swap.sh`).
- **Widths:**
  - `all-teams-{320,390,1024,1440}`
  - `stats-fullpage-{320,390,1024,1440}`
  - `no-ANA-390`
  - `withheld-{390,1440}` → `after-retry-{390,1440}`
  - `compare-1024-before-after.png`
- **Measurements:** `{before,after}-report.json`. Document horizontal overflow is 0 at every width, before and after.
- **Not covered:** 768–1023px tablet widths beyond the probe, real devices, assistive technology and real NHL data.
- **Slot released.** The server and stub were stopped at 2026-10-24T16:54:16Z, :3110 and :54399 were confirmed free, and TJ's :3000 was untouched. C4 is next.

## Remaining (not done)

- At 1024 the middle column's Key Metrics cards in `pages/stats/index.tsx` are still tight (labels truncate). That needs the metrics markup or other Stats rules, outside this slice.
- Long team names push "GP: 12" to the header edge in a 150px chart cell. This is cosmetic.
- S02 cohort semantics and goalie-source contracts were not touched.

## R1 evidence addendum (C7 C1-S05-O1), 2026-10-24 ~17:00–17:07Z

- **No code change.** All hashes are unchanged:
  - `index.tsx` `b632a0ca…`
  - `GoalieShareChart.module.scss` `1352a815…`
  - `Stats.module.scss` `e0dbf85f…`
  - `C1-S05.patch` `66a5e411…`
- **What the dark band was.** It was page chrome stacked over the chart, plus my capture method; it was not a GoalieShareChart layout bug. Hit-testing at 390×844 (`screenshots-s05-r1/report.json`) found:
  - the global `Header_mobileHeader` (sticky, 56px, outside the lease);
  - the `components/StatsPage/MobileTeamList` team-select header (sticky; **492px tall while expanded at load**, 44px collapsed; outside the lease);
  - the `/stats` `Stats_searchSection` (sticky, 98px; in `Stats.module.scss`, page chrome rather than the S05 shell);
  - the fixed bottom nav (65px).
- **Why the original captures showed it.** They used `scrollIntoViewIfNeeded` plus element screenshots, which placed the section under the expanded team list (the hit at the section top was `MobileTeamList_teamList`).
- **Recapture** (`fixture-harness/recapture-s05-390.mjs`). The chart was scrolled iteratively until its top sat below the lowest stuck bar (146px), then viewport screenshots were taken. Hit-test points covered in the chart: **0** in every state:
  - `no-ANA-390-viewport.png`: Bruins selector (`select=BOS`), BOS team header, 1 chart.
  - `withheld-390-viewport.png`: alert plus **Try again** visible, no selector, 0 charts.
  - `after-retry-390-viewport.png`: `select=ANA`, ANA header, 1 chart.
- Same fixture harness as before: the stub, fixture `/api/cors`, all else aborted. The server log has 0 `nhle` or `supabase.co` matches.
- **Observation, not fixed:** the sticky stack takes 146px at the top plus 65px at the bottom of an 844px viewport, and the team list covers 492px while expanded. Changing that belongs to the owner of the global Header and MobileTeamList, plus the `/stats` search bar decision. It is not an S05 shell defect.
- **Slot released.** The server and stub were stopped at 2026-10-24T17:06:56Z, :3110 and :54399 were confirmed free, and :3000 was untouched. SS1 is next.

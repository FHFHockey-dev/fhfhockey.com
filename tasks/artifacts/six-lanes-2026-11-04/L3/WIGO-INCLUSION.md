# WiGO inclusion/dependency assessment — local candidate

**The nine-file WiGO pin set is not yet an exact candidate integration.** Five files need overlays; four already match candidate/base. A current-only comparison-matrix change is directly coupled to a CSS class renamed by the proposed stylesheet, and three additional current-only component/style files affect the canonical visual evidence. None is silently accepted here.

Named candidate: `fefcdbced64c57691a4b61c7c6610e4c5a8a4e2d`. Named base: `03c53add225fea452c2e2e92515aab08e56c3c3d`. Current canonical HEAD observed at start: `a2b72850cbd522b3dd7bfe616bd25d7c01ae8f0c` on `octoberBranch`; it was not treated as candidate authority. All 71 inspected source/dependency/shell/config/asset/fixture paths have identical candidate/base bytes. The current-only differences below therefore cannot be inherited from either named object.

`WIGO-INCLUSION.json` contains all nine exact target hashes, proposed five overlays, unchanged target pins, 92 direct import/re-export/dynamic-import/Sass edges, 71 file hash comparisons and the seven unaccepted current-only dependency/style differences. This is an observation/proposal, not a new accepted candidate manifest or custody transfer.

## Exact proposed overlays — five paths

| Path | Final proposed SHA256 |
|---|---|
| `web/styles/wigoCharts.module.scss` | `97db5872e028c39814ff5142ab45dcd83938b3543efa3a0cc4a3c08bddd8421c` |
| `web/components/WiGO/PlayerRatingsDisplay.tsx` | `64b7f51a39a48828db6a631d54f15666c9d06ccb42a4fb24d92fce1da2983e84` |
| `web/components/WiGO/PlayerRatingsDisplay.module.scss` | `fa386829bf5a61a796c596f834c8f2bd3eebf78b792e2c3d3c1d46c9d7ec8c43` |
| `web/components/WiGO/PlayerRatingsDisplay.test.tsx` | `1a557d3f1479e364b6ee4d735eae9fe964cfc11a044a38894e824dfb154c68e3` |
| `web/e2e/wigo-one-page.spec.ts` | `cc42bb7444a801b168f3bc0d8901b7806cc540d3bdb703b8135b31e245cf39b8` |

Four target paths already match both candidate and base and require no new blob:

- `web/pages/wigoCharts.tsx`
- `web/components/WiGO/WigoDashboardSections.tsx`
- `web/__tests__/pages/wigoCharts.test.tsx`
- `web/components/WiGO/WigoDashboardSections.test.tsx`

All nine current bytes match both the L6 final pin record and Chef's final-verification pin set. The five overlays include the ratings implementation/style/test, main page stylesheet and browser spec. Page and section implementation/tests are already in the named candidate/base.

## Direct closure and actual page shell

The page directly imports the section module, dashboard hook, types/table utility and main stylesheet. The section module directly/dynamically imports ratings, comparison matrix, consistency/chart panels, player/search header, tables, team-driver panel and shared helpers. Ratings imports its own stylesheet, existing rating fetch/calculation hooks/constants and React Query. These local imports resolve; declared external packages and relevant package/TypeScript/Next/Playwright/Vitest configuration match candidate/base. No dependency/tooling addition is identified by these changes.

The main/ratings styles import `styles/vars` and `components/WiGO/_scale`; all referenced `s.$`/`v.$` identifiers exist in candidate/base. Current scale only adds two comparison-color tokens unused by these styles; current vars only adds unused `$text-on-primary`. Retaining candidate/base tokens is sufficient for this static closure. **No Sass compilation was run.**

The new `@font-face` references `/fonts/social-share/RobotoCondensed-Variable.ttf`. Current, candidate and base bytes are identical: SHA256 `dace262afcee68a5276f200d8026c57221735c0118ab5fda8c2c0d3dc409a8d0`, 371,616 bytes. No font addition is needed.

The browser spec directly imports stat metadata and `e2e/fixtures/wigo/wigoFixtures.ts`; that fixture imports `schema.json`. All match candidate/base. Fixture/schema contents were not inspected as data rows, and no provider/source data was read. The suite intercepts synthetic API inputs and aborts public font requests. No new fixture asset/version is required by the overlay.

Actual shell: `_app.tsx` loads Layout, global CSS/vars, Home styles and team landing styles. Layout adds its WiGO class and hides Footer on this route; Header remains present. The bounded Header/MobileMenu/Navbar and their styles, plus direct panel stylesheet closure, were compared. `_app`, Layout, Header/Navbar code/styles and other inspected global styles match candidate/base/current. The exceptions are the unused vars addition and unaccepted MobileMenu style changes below. `Stats.module.scss` is not in the inspected WiGO/page-shell import closure and remains excluded.

## Unaccepted current-only dependencies — exact scope decision

| Path | Source-level evidence and disposition |
|---|---|
| `web/components/WiGO/WigoComparisonMatrix.tsx` | Candidate line463 uses `styles.statsTableNote`; proposed main stylesheet removes that class and defines `.bandNote` at2284. Current component changes the phone paragraph to `styles.bandNote`. Nine-file overlay alone leaves that paragraph without its intended module class. **Chef/L6 must review/accept this exact extra one-line coupling or a separately reviewed compatibility alternative.** No runtime failure was executed; the class-export mismatch is directly visible in source. |
| `web/components/WiGO/ConsistencyChart.tsx` | Current inserts Cardio under 0Pts and adds arrow/`consistencySubItem`; candidate appends an unindented row. Proposed stylesheet styles the new subgroup class. This is not a missing import, but canonical row order/subset presentation depends on this unpinned markup change. Owner must decide inclusion or explicitly retain candidate behavior. |
| `web/components/WiGO/PerGameStatsTable.module.scss` | Current corrects the numeric font family, adds tabular figures and removes letter-spacing; candidate keeps old family/spacing. Its own imported CSS affects comparison-panel geometry. Canonical typography evidence cannot be treated as exact candidate evidence without a scope decision/check. |
| `web/components/WiGO/TeamPerformanceDrivers.module.scss` | Current changes font/gaps and adds large-screen card/type sizing. Canonical 1920px behavior uses those bytes; candidate retains its prior independent stylesheet. Owner must decide whether the intended large-tier design includes this file. |
| `web/components/WiGO/_scale.scss` | Only two unused comparison-color additions. Keep candidate version; no current-only token inclusion required. |
| `web/styles/vars.scss` | Only unused `$text-on-primary` addition for this selected style closure. Keep candidate version; no global/token grant inferred. |
| `web/components/Layout/MobileMenu/MobileMenu.module.scss` | Current dialog colors/borders/radii differ, including current-page rule width. This is an actual Header dependency but not needed to resolve WiGO code/style symbols. Preserve/exclude this unrelated shell change and verify the candidate shell. |

Full current/candidate/base hashes for all seven are in JSON. The four page-specific markup/style differences are **review dependencies, not proposed accepted additions**. All their changes have been inspected only enough to identify the direct coupling/geometry difference. No second broad design audit or implicit file lease is created.

## Existing checks and smallest exact-candidate verification

Chef's `FINAL-VERIFICATION.json` records **13 distinct canonical cases with passing evidence across focused runs**. It is explicitly not one all13 final run; earlier failures remain retained and unaffected successes were reused. Final compact and large-tier screenshots were reviewed. The nine final pins/font match that record. This is useful canonical evidence, **not verification of these five overlays on candidate fefcdbce**, particularly with the current-only component/style differences above.

Smallest next bounded sequence, after the owner scope decision:

1. Chef/L6 decide the missing comparison-matrix class coupling and whether to retain/include the three other page-specific visual dependencies. Git composer prepares only that accepted closure against the named candidate in its existing controlled export. L3 does not alter the export, source, index or refs.
2. Compile the selected Sass using candidate vars/scale and run the single changed `PlayerRatingsDisplay.test.tsx`. Reuse unchanged page/section test evidence unless their contracts are changed by the final owner decision.
3. On that **exact candidate** with synthetic fixtures, run four sequential targeted page cases:1280×800 compact fit,1920×1080 large fit,390px phone comparison,1280×700 flowing layout. These cover the repaired matrix/ratings, separate large-tier driver CSS and the phone class seam. Add long-name case only if chosen typography changes beyond the accepted scope or a fit case fails. Keep external/API requests blocked, isolated Next output and owned server; no production data or route execution.
4. If conclusive and pins/scopes justify it, reuse unaffected canonical evidence with its dated limitations. No full build, all-app suite or repeated all13 run is requested merely for confidence.

No exact candidate compile/unit/browser run occurred in L3. The plan is a proposal, not an executed check or new spend/production authorization.

## Stop condition and handoff

**Missing scope/owner:** Chef/L6 must resolve `WigoComparisonMatrix.tsx` plus the desired canonical-versus-retained behavior of ConsistencyChart and the two panel stylesheets. Git composer coordination stays with Chef. No source-only extra is admitted automatically; no whole-branch inheritance or current-export mutation was used.

Keep Luna, Stats.module.scss, toenail, cron/Yahoo and unrelated/global changes excluded. No push/deploy, Git/index/ref mutation, source/test edit, existing export edit, heavy test, data-row/reserved-file read, provider operation, worker or message was performed.

L3 verification: exact nine pins/candidate/base identities, direct import/style/asset/fixture/shell comparisons, consequential drift inspection, static Sass-token and missing-class evidence, JSON/Markdown/whitespace checks. Dependency enumeration initially looked for Layout/index.tsx, then used the actual index.ts re-export and Layout.tsx; no source was changed. One bounded review complete; stop at the exact scope decision above.

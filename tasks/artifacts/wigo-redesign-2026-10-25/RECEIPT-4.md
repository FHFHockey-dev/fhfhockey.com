# WIGO ticket 4 receipt: multiple audit fixes, 2026-10-25

Scope: open audit items, highest user-visible data correctness first. All work is inside the WIGO lease (`web/components/WiGO/**`). There are no live reads and no changes to `calculate-wigo-stats.ts`, the server or Git, and nothing is committed.

## Items fixed

| ID | Sev | Problem | Fix | Test |
| --- | --- | --- | --- | --- |
| A-05 | P1 | Search returned goalies; WiGO is skater-only, so selecting one gave empty panels. | `NameSearchBar` query adds `.or("position.is.null,position.neq.G")`. Goalies are excluded at the source, and players with an unknown position stay searchable (a plain `neq` would drop NULLs). | `NameSearchBar.test.tsx` asserts the filter (4/4) |
| A-03 (partial) | P1 | The team-driver cutoff came from `nst_team_5v5` alone. If the WGO team writer lagged one night, every team that played that night looked incomplete and the cards went blank league-wide. | `fetchTeamDriverSnapshots` now cuts both sources at the earlier of the two latest dates (one extra one-row read, run in parallel). | `fetchTeamDriverSnapshots.test.ts`: new lag case; the gap test is retargeted to a pre-cutoff gap. Its mock now honours latest-first ordering. |
| B-08 | P1 | The selected-stat chart's dashed "Avg" was an unweighted mean of game values drawn beside the pooled STD line. It was also formatted as a count, so S% read "0.12". | Labelled "Game mean" and formatted like the stat (percent, mm:ss, rate, or per-game count) via the new exported `formatGameMeanLabel`. | `StatsTableRowChart.test.tsx` (3/3) |
| C-01 | P1 | The Game Score help text didn't disclose that the on-ice goal term counts all situations, unlike the published 5v5 model. | Help text now says so, and who it favours and penalises. The RPC is unchanged; changing the model is a database function change, out of scope. | New `GameScoreSection.test.tsx` (1/1) |
| B-21 | P3 | A zero DIFF was tagged `positive` (green tint). | Zero gets no sign, so it renders neutral; non-zero values keep their sign. | `StatsTable.test.tsx`: new zero/positive/negative case |
| B-22 | P3 | The timeframe selectors listed STD, L5, L10, L20, LY, 3YA, CA, but the matrix column order is STD, LY, CA, 3YA, L5, L10, L20. | Options now follow the matrix column order. | `StatsTable.test.tsx` asserts both selectors (9/9 in the file) |

## Decision left for TJ (not changed)

A-03's other half: a team with any missing game row before the cutoff stays "Incomplete regular-season coverage" for the whole season. The existing tests make this deliberate ("partial seasons must not masquerade as complete").

Options:
- Keep the strict rule.
- Show "N of M games" with a coverage threshold, for example 90%.

This changes what the card claims, so it's TJ's call.

## Files (status, sha256 after, base sha256 at commit d7f8da538)
```
MODIFIED  618814f1794de6b5e56a31646c7354fee340f42b609af48591090c339bfb19fe  web/components/WiGO/NameSearchBar.tsx
          base b824a9a6aa65230e12c7b7c654708134e763f22cbd9b97081a4fea2edc32346b
MODIFIED  6cb642b4a0396064a2efd9e73c97bb26a3968bb352f6b3bfdab9dbaf0db06e3b  web/components/WiGO/NameSearchBar.test.tsx
          base b5a36e507770bcbd9e2e6acf6688afe6e717b506479f32845fdb5ef4a0afbf19
MODIFIED  463f79ea5be8072fd7f61649531899e0e9c32a981183a5c4dd107ac8721c4697  web/components/WiGO/fetchTeamDriverSnapshots.ts
          base f678d52fd3d5618b1b1c0b39542987a5f95a20007f92d5cad925b0aa477c9a6c
MODIFIED  136f60c909b8b83f8d9f440ae640a287cadab863e43d06b0aef7733f8386e58b  web/components/WiGO/fetchTeamDriverSnapshots.test.ts
          base aaea69b62d6e4f3ccc4d4c524da468623792859de9419030a67db1b1700ea031
MODIFIED  06ed643358319117cffc20270f0355d65e8ddca6bbf8ec75de91e3cdcafac164  web/components/WiGO/StatsTableRowChart.tsx
          base 1704b7f0d45b15bbf3494face0a996aa0f916335f865f95e020bc99ea7802b84
MODIFIED  0bb9b643759655b431852dce7e2d9b5e4e2a4ffd9fae267fad23cd6e8a521e03  web/components/WiGO/StatsTableRowChart.test.tsx
          base 107ac9a850205cc51bf681d1fb33588eca93ab69cbf09b3d895e26001d3fdf0b
MODIFIED  7500062c5623695c9cecf9e2fb577e86ba94b9abd09675f5cbdcc8dbb03df327  web/components/WiGO/GameScoreSection.tsx
          base 9a1402ee5f3955c11eb463541052d44c0f55b27cc64873b1b6895b9bdf516548
ADDED     88c73829d66c48c6934d0354467880a9557d023c2cc3e8dec82d4afcf1247807  web/components/WiGO/GameScoreSection.test.tsx
MODIFIED  7a141baaaf399e494d06f333f6b57f2d48489cc328c770e6a2ffa772483e6f61  web/components/WiGO/WigoComparisonMatrix.tsx
          base 0e61a5e1b1d3deef98d18e5b1c1425159d5b03b0db1e8d04c6b7210e4e5758a8
MODIFIED  ccbbf992cf36e57fd1dd3a646bb36ca911e920cd99446c8e0772b98681a9e123  web/components/WiGO/TimeframeComparison.tsx
          base a814e19eb056eaaf4997a3572a104135cb4805fb2201755b0ca52d3b76eeb765
MODIFIED  fbbdad3a601603780a4be55b448ffb3152b93e1df929bd7846a5603e68cf94ba  web/components/WiGO/StatsTable.test.tsx
          base 0644ab5a6259c67c4aa3b8fa3fd4cb85492e47057300aed783ba6f9938b07144
```

## Checks actually run (canonical `web/`)
- Vitest across all WiGO scope suites (WiGO components, the page test, `useWigoPlayerDashboard`, and `fetchWigoPlayerStats`, `fetchWigoPercentiles`, `calculateWigoRatings` and `calculatePercentiles` under utils): **23 files, 181/181 passed**.
- ESLint on all 11 touched files: **0 problems**.
- Whole-project `tsc --noEmit` (8 GB, under the heavy lock): **exit 0**.
- Playwright `e2e/wigo-one-page.spec.ts`: **7/7 passed**. It ran against a canonical `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3150 with fictional env and network-deny. The fixtures already answer the new latest-date read and ignore the search `or` filter. The one-page layout still fits.
- **Shutdown:** :3150 stopped; heavy lock released at 18:57:08Z.
- No `.module.scss` touched, so no CSS pure check is needed.

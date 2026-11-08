# WIGO ticket 5 receipt: team-driver coverage threshold (A-03 open half), 2026-10-25

**TJ decision (via the orchestrator):**
- A team-driver card renders with an honest "N of M games" label once coverage is ≥90% of the regular-season games before the cutoff.
- Below 90% it stays "Incomplete regular-season coverage".
- At 100% it shows no label (the complete display is unchanged).
- Rates must use the covered games only; missing games are never zeros.

## What changed (WIGO lease only; nothing committed)

**Model** (`teamPerformanceDriverModel.ts`): new `TEAM_DRIVER_MIN_COVERAGE = 0.9`.
- **5v5 (`aggregateTeamFiveOnFive`):**
  - A row counts as covered only if its `gp` matches the expected games on that date and its xGF, xGA and GF are finite and ≥ 0. Any other row is a missing game.
  - With covered/expected ≥ 90%, the snapshot sums only the covered rows, sets `gp` = covered games (so xGF/GP and xGA/GP divide by covered games), and carries `coveredGames` and `expectedGames`.
  - Below 90%, the team is omitted (incomplete).
- **Special teams (`aggregateTeamSpecialTeams(rows, expectedGames?)`):**
  - Rows with unusable counts are missing games. Coverage is checked against each team's expected regular-season game count before the cutoff.
  - PP% and PK% are ratios of sums over covered games only.
  - Below 90%, the team is omitted (the old strict filter is gone).
- **`buildTeamPerformanceDrivers`** returns `fiveOnFiveCoverage` and `specialTeamsCoverage`, each `{coveredGames, expectedGames}` only when below 100%, otherwise null.
- **Unchanged:** the 24-team league gate, percentile and status logic, conflict detection (duplicate rows still throw), and the shared cutoff from ticket 4.

**Fetch** (`fetchTeamDriverSnapshots.ts`): passes the expected game count per team; the unused `observed` map is removed.

**Card** (`TeamPerformanceDrivers.tsx`)
- Partial coverage reads:
  - "Regular season · 5v5: 78 of 82 games to <date>"
  - "Special teams: 78 of 82 games to <date>"
  - plus "Partial coverage: rates use covered games only."
- At 100% the original two lines are unchanged.

**CSS** (`TeamPerformanceDrivers.module.scss`, one-page block only): driver line-height 1.2 → 1.15 and card padding 2 → 1px, so the extra note line fits the 1280×800 band. The e2e caught a 1–2px overflow before this change.

**E2E fixture** (`e2e/fixtures/wigo/wigoFixtures.ts`): optional `teamGameGaps` drops the fictional VAN team's first N team-game rows from both sources.

## Tests
- **Updated to the new rule** (`teamPerformanceDrivers.test.ts`, `fetchTeamDriverSnapshots.test.ts`):
  - Snapshots now carry the coverage fields.
  - A one-game sample whose only row is unusable is omitted (it used to be returned with a null percentage).
  - "1 of 2 games" is renamed "keeps a team below 90% coverage incomplete".
  - The existing incomplete, partial-metric and cumulative-row cases still fail coverage (50%) and stay incomplete.
- **New model tests:**
  - 9 of 10 games kept, with rates over the 9.
  - An unusable row is treated as missing, not zero: an xGF of 999 on a GF-null row is excluded.
  - 8 of 10 stays incomplete, for both 5v5 and special teams.
  - Special teams at 9 of 10 computed over the covered games.
  - Driver coverage reported only below 100%.
- **New `TeamPerformanceDrivers.test.tsx`:** partial labels plus the covered-games note; at 100%, no label.
- **New e2e** `wigo-one-page.spec.ts`: "a team-driver card at 95% coverage shows its N-of-M label and still fits 1280×800".

## Files (status, sha256 after, base sha256 at commit 0f457e0da)
```
MODIFIED  a4e78233161baeba6da12731ca411ca25e08e4f9e0ad6c003cd8d3a373974580  web/components/WiGO/teamPerformanceDriverModel.ts
          base 1f638e1c23e7e06d5105e7771a349c3924f7ae47682151fa2b484ae7ae51ee6a
MODIFIED  b743a4789968625986b472fc41596152b8864cbd0d7aa4a87d5bd1fbdc37d898  web/components/WiGO/fetchTeamDriverSnapshots.ts
          base 463f79ea5be8072fd7f61649531899e0e9c32a981183a5c4dd107ac8721c4697
MODIFIED  6d498fd9ece2f584d9069932ad51e651a24c008ff4ac6cf975791abe3abd83ce  web/components/WiGO/TeamPerformanceDrivers.tsx
          base 3d6f9f03ad223c47991ae0ef1990396b9e98d2b2134b3d23ba636a6c752959ed
MODIFIED  8a6e1e58a42b58b6dc5fde8bb12f4c0ab766f569bb8e4e2168f43d9851ef274c  web/components/WiGO/TeamPerformanceDrivers.module.scss
          base 1c9941c3c5533eecdd52520876a9392fdaa750aa6c8bfa32a03e3399c73325ca
MODIFIED  de7e677153ddf07c89898573f6abaecb4168ec145685c0a60f639954947ea6ed  web/components/WiGO/teamPerformanceDrivers.test.ts
          base aea1dca940ff88668a4ad8f67d855a8bb6f4db34e9ba586c31a3608737c219ee
MODIFIED  96b2a268807af8b4c892bcb28fe2e3b85a45a4c0b258b3022c70b05e80c72eb4  web/components/WiGO/fetchTeamDriverSnapshots.test.ts
          base 136f60c909b8b83f8d9f440ae640a287cadab863e43d06b0aef7733f8386e58b
ADDED     8697977f908a70ee00a7677806d439faff7e3ccb7043494a1bbd13fb2f567ee6  web/components/WiGO/TeamPerformanceDrivers.test.tsx
MODIFIED  e6fd06ae9f9f306a2acbb2b0b8213fae92d3ac57dd182f0b9a02e032d07e72d9  web/e2e/fixtures/wigo/wigoFixtures.ts
          base 9d3ec6ca6686ff22f7292e4c191251bb9a7a143000e1af3dace1c328cfd529e8
MODIFIED  c334b7a2384ad7d0028074ec1372aaa9f439454b734bed158719a384be17c10e  web/e2e/wigo-one-page.spec.ts
          base 3a772eef615df3b8febd380c21fb2f2bd9438f382f4d857b36c0dd2eda7a64e2
```

## Checks actually run (canonical `web/`)
- Vitest across all WiGO scope suites (WiGO components, the page test, `useWigoPlayerDashboard`, and `fetchWigoPlayerStats`, `fetchWigoPercentiles`, `calculateWigoRatings` and `calculatePercentiles` under utils): **24 files, 188/188 passed**.
- ESLint on the 8 touched TS/TSX files: **0 problems**.
- CSS-modules pure check on `TeamPerformanceDrivers.module.scss`: **pure**.
- Whole-project `tsc --noEmit` (8 GB, under the heavy lock): **exit 0**.
- Playwright `e2e/wigo-one-page.spec.ts`: **8/8 passed** on a canonical `PLAYWRIGHT_ISOLATED_NEXT=1` server on :3150, with fictional env and network-deny.
  - The first run failed the new 95% case on a 1–2px card overflow. That led to the CSS tightening above; the rerun passed.
- **Shutdown:** :3150 stopped; heavy lock held 19:11:12–19:14:03Z, then released.
- No live reads, no Git, no `calculate-wigo-stats.ts`.

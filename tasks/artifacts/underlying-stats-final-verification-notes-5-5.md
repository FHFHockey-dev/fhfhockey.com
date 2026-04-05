# Underlying Stats Landing Page Final Verification Notes (`5.5`)

Date: `2026-04-05`

## Verified

- Landing-page trend values are no longer all zero on the served `/underlying-stats` path because the page now overlays a landing-page-only repair based on prior played snapshots instead of relying on flattened carry-forward history alone.
- Snapshot date selection now resolves against distinct available snapshot dates rather than a raw-row-limited dedupe pass.
- Landing-page `SoS` is present in the data payload and rendered table for the selected snapshot date.
- The page still sorts teams by landing-page `Power`, not by `SoS`.
- The landing-page-only implementation did not alter `/underlying-stats/playerStats`, and the focused `playerStats` regression suite still passes.
- A fresh full-suite pass succeeded after the `4.x` and `5.x` changes:
  - `npm run test:full`
  - `169` test files passed
  - `849` tests passed

## Shipped assumptions

- `SoS` is a snapshot metric, not a game-by-game historical reconstruction. The predictive half uses each opponent’s current selected-snapshot Power Score rather than opponent strength as-of each game date.
- The standings-style half uses the verified `sos_standings` snapshot and derives:
  - direct opponent point percentage
  - an OOWP-style opponent-schedule context term
- `SoS` is normalized onto the same 100-centered scan scale used elsewhere on the page:
  - `100 + 15 * z`
- The page keeps `Power` as the primary ordering dimension because `/underlying-stats` remains a power-rankings surface, not a schedule-strength rankings page.

## Intentionally excluded optional inputs

- Goal differential
- Home/road split adjustment
- Rest disadvantage
- Separate home-rink advantage adjustment
- Separate expected-goaltending adjustment

These were excluded because the best candidate source for richer record/split context, `nhl_standings_details`, is stale relative to the shipped snapshot date, and the remaining verified landing-page source set does not support a calibrated inclusion of the other terms without speculation.

## Residual risks

- The landing page now repairs `trend10` at read time, but the underlying stored `team_power_ratings_daily` history still contains flattened/stale trend behavior. That is why follow-up task `NEW 6.0` remains open for upstream refresh or backfill.
- Richer `SoS` context is intentionally deferred until `nhl_standings_details` ingestion is refreshed. That is why follow-up task `NEW 7.0` remains open.
- Desktop visual verification is slightly weaker than mobile verification because local headless Chrome screenshot capture remained flaky during the final rendered check. Served HTML, live route response, stylesheet ordering rules, and mobile screenshot evidence were all verified directly.
- The current working-tree `width: 90%` shell override in `indexUS.module.scss` was treated as intentional local state and was not normalized or reverted during this landing-page pass.

## Conclusion

The landing-page-only change set is verified end-to-end for data correctness, landing-page scope isolation, and the shipped `SoS` definition. The remaining open items are upstream data-quality follow-ups, not blockers for the landing-page implementation delivered here.

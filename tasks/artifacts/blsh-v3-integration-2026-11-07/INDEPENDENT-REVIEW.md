# Independent review and corrections

A separate read-only reviewer checked source/contracts, candidate bytes, all 11 manifested source/dependency hashes, saved browser receipts and screenshots. Three P2 findings were confirmed and corrected:

1. The original view keyed withheld filters only by `score.reason`. In the authenticated candidate 103 withheld profiles have a null primary reason; 40 of those have a separate personal-history direction reason. The shared projection now uses the saved primary reason, direction reason, non-concordant status, then stale-window reason. Filtering and row text use the same projection. No-history now includes all 115 profiles, thin history all 48; separate conflict/stale groups contain 30/33. List membership and scores did not change.
2. A generic balanced opportunity label previously suggested a role-change explanation. It is now neutral “Balanced”; any explanation comes from the saved assessment. A both-balanced synthetic regression prevents the unsupported wording.
3. Returning from mobile details left the table scrolled to generic Details buttons without player names. Both candidate and withheld tables now retain their identity column during horizontal scrolling. Chromium explicitly checks player identity remains visible after closing mobile details.

Re-review found all three correctly addressed and no new blocking issue. Its minor fixture note was also fixed: the stale-window regression now has a ten-day age and matching earlier game dates, not just `fresh=false`.

Final checks: 13 synthetic UI tests, full TypeScript check, scoped lint, actual-component desktop/mobile Chromium interactions. Browser checks assert all 115 no-history and 48 thin-history rows are filterable, known conflicts/stale windows have their explanations, mobile details do not widen the page, and player identity remains visible afterward. Final source pins are in MANIFEST.json; the previous manifest is preserved separately. Full Next-route and deployment verification remain outside these results.

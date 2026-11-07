# Independent historical PPP composition review

**No actionable finding.** The frozen field-evidence ledger correctly composes the reviewed evidence for exactly 150 permitted 2022–23 reference records. This review accepts that bounded composition, not consumer/scoring admission or broader reference qualification.

Reviewed actual `compose.py`, `run.py`, contract, nine regressions, ledger/summary/receipt and their dependencies in `/Users/tim/Documents/Codex/2026-10-27/task-3/historical-ppp-composition-20261102-01`. Contract SHA-256 `ecb4dc4fafaaa7304ebd05cfe9825e20b10c2e7828392cc1fee7d0956f2a529b`; composer `9de3628ddeecfb899021012ff2d5fbe4e9c841ef6210441d7a9e1b5560ca5a17`.

Independent `verify.py` reconstruction matches **every field in all 150 ledger rows**, not just summary counters. It rebuilt exact source identities and canonical full-row hashes; checked source-ID membership and nonoverlapping proof methods; reauthenticated **146 distinct retained official boxes** against their receipt/hash/size/URL/TLS/status/season/game/date/finality; matched the player/team, GP1, positive exact TOI and assists; and rechecked the direct body, receipt and field-check hashes and identities. All **413 pins** remain unchanged.

Coverage is exactly 50 rows each for Tanev, Connor and Kaprizov:

| Method | Records | Corroborated zero values | Nonzero values |
| --- | ---: | ---: | ---: |
| Official PP goals with observed zero assists | 101 | 88 | 13 |
| Unique official goal-census derivation | 22 | 16 | 6 |
| Direct native ppPoints report | 27 | 13 | 14 |
| Total | 150 | 117 | 33 |

These are record counts, not PPP totals. The 117 corroborated zeros preserve their proof methods; they should not be interpreted as 117 direct native PPP observations. No missing value is filled with zero. Missing proof stays unknown, and the composer rejects changed source hashes, conflicting values/identities, duplicated source identities, overlapping method membership and altered prior hold metadata. All **nine focused tests pass**, with network access denied. The actual composer was also evaluated on all 150 authenticated inputs and matches the independently constructed expected ledger. Producer artifact-writing entrypoints were not run.

Both held census records, **3085027 and 3087408**, preserve their entire original census rows, reason `goal_census_score_mismatch_no_shootout_or_goalie_adjustment`, and null bounds. Their separate direct PPP proof does not clear the census-method hold. Original `priorLink` objects, including formerly unknown PPP flags/reasons, are unchanged for every row. `fieldStatus` describes only composed PPP evidence; every `wholeProfileQualified` and `scoringAdmission` flag remains false.

Evidence chronology is supported. Source observation timestamps were independently compared as timezone-aware instants: the ledger's latest relevant raw observation matches each `proofObservedAtUTC`; observations range from **2026-10-26 03:04:57.447067 UTC** to **2026-11-02 00:19:08.185661 UTC**, before the frozen contract/composition. Each direct observation is later than its retained box. Review references bind the accepted reports by exact hash. Original publication time stays null; source-observation time does not establish historical issuance-time availability, proof-review time or freshness.

Baseline summaries, original rows, means, SDs and all member IDs are exactly preserved. All ten shared implementation/snapshot pins match. There is no model/scorer import or score calculation in the composer; the new ledger does not expand qualification to all 729 references or claim calibrated confidence, predictive value, current readiness or a refreshed baseline.

Installed gate check: `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts` is byte-identical to the accepted precision-fix candidate, SHA-256 **28bd6807e0ab103af6065c1bf5f6731320035d633b6f6ac359ff51c4f8a7d4f8**. Its installed test file matches **7ec79313bb997b98ca62561c62177daae7cf3cff2e5b2f564fb21ccb628232f7**. `currentInput.ts` remains **58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232**. The gate's default real acceptance policy remains empty. A bounded search of BLSH library/components/pages found only its declaration and test import. This is installation identity verification, not integrated runtime or policy acceptance; the unchanged gate suite was not redundantly rerun after its prior accepted precision review.

Evidence: `RESULT.json`, `PINS.json`, `TESTS.log`, `verify.py`, and `FINAL-RECEIPT.json` in this audit directory. No source or held-file edit, production/provider/database request, holdout/excluded-season read, build, deployment or Git mutation was performed. All owned processes/locks ended.

Remaining gates: any consumer/scoring acceptance; full advanced-source/Game Score qualification and native NST provenance; preservation of the two method holds and historical publication/reference-age limits. This sidecar review does not authorize changing original data, frozen scores or production behavior. No blocker or pending approval remains for the audit.

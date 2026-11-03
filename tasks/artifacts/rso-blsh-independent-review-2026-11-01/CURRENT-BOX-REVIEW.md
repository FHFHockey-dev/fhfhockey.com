# Independent current-box provenance review — 2026-11-01

**No correctness finding identified in the reviewed sidecar, qualifier or reported accounting.** The saved official evidence supports the scoped identity/finality/team and comparison labels. It does not resolve differing source vintages or authorize repairing the frozen WGO data, changing scores or admitting advanced metrics.

Reviewed actual `qualify.py`, `test_qualify.py`, frozen contract, raw source/capture, accepted prior provenance sidecar, goal-evidence bundle, all 183 referenced raw box bodies and receipts, row output and discrepancy JSON/CSV. All frozen input and FINAL-RECEIPT file hashes match.

## Independent denominator reconciliation

| Predicate | Rows | Meaning |
|---|---:|---|
| Original saved window population | 3,407 | Every unique original source ID retained, across 201 games |
| Exact final game/player/official team | 2,827 | All have positive official TOI; WGO TOI need not match |
| Above plus GP1 and exact positive TOI | 2,774 | Counting-stat agreement is separately reported |
| Above plus all five counts matched | 2,728 | G/A/SOG/HIT/BLK; not a claim about every metric |
| At least one TOI/count difference | 99 | Separate from the 580 unavailable rows |
| No box bound to the frozen bundle | 580 | 18 games; remains unknown, not DNP/zero |

Exact partitions: **3,407 = 2,728 + 99 + 580**; **2,827 = 2,728 + 99**. The 99-row difference union is **53 TOI + 47 counting − 1 overlapping row**. There are **103 field disagreements**: 53 TOI, 2 goals, 4 assists, 23 shots, 15 hits and 6 blocks. The counting differences involve 46 players in 23 games. Every discrepancy JSON/CSV value and timestamp matches the underlying sources.

The overall `identity_team_exposure_qualified` state deliberately does not certify counts: **46 counting-discrepant rows are among the 2,774 exposure-qualified rows**. Consumers must retain per-field statuses. The saved `held` count, 633, is 580 missing-box rows plus 53 TOI mismatches; it is not the complete population of discrepant rows. This distinction is documented correctly by the checkpoint and tested explicitly.

Unavailable-row dates reconcile: October 1: 1; October 8: 3; October 19: 36; October 27: 396; October 28: 144. All 18 unavailable games are outside the frozen bundle's box pin set; none was silently excluded because a pinned body's read/authentication failed. This does not assert no evidence exists elsewhere, and no fallback search was performed.

## Receipt, identity and value checks

Independently read **183 existing official bodies / 2,441,578 bytes**. Checked exact game URL, matching frozen bundle pin, receipt SHA, body SHA/length, successful HTTP/TLS and receipt time before the original October 29 capture cutoff. Verified 2026–27 regular-season identity, final state, exact source game date, distinct valid home/away identities, complete forwards/defense arrays and unique valid skater IDs.

For every covered source row, independently located the exact player and matching official team, parsed positive official TOI and compared GP/exposure and the five counts directly. Checked source-row hashes and mapped each result back to the unchanged accepted window and raw WGO record. No row selection/filter or denominator loss was found.

All **657** previously supported window finality rows are reconfirmed from raw bodies; the extension adds **2,170**. This supplies raw current-box evidence beyond the prior review, which had checked the earlier proposal/receipt metadata only. `gameFinality` remains distinct from player appearance, team match, exposure and count equality in the output.

PPP accounting is correct within the **2,827 covered rows**: **2,182** observed zero-official-assist cases match WGO PPP to official PP goals; **645** remain unknown because PP assists are unavailable. The **580 uncovered rows have no PPP comparison**. This does not close the separate 49 historical baseline PPP limitations.

The **787 zero-shot source rows** are WGO rows that pass identity/team/exposure. This is not the 19 zero-shot player-window denominator and does not imply every field on those rows agrees with the official box.

## Source-vintage interpretation

Confirmed the Max Sasson / Arshdeep Bains game 2026020150 goal differences directly against the raw cached box and WGO rows. The box timestamp is October 27 at 20:15:08.223550 UTC; WGO capture is October 29 at 18:41:12.798646 UTC. Recorded goal values are respectively 1 versus 0 and 0 versus 1 (WGO versus box). TOI differences range from −70 to +104 seconds, with the reported full delta distribution matching.

These facts establish a disagreement between dated captures. They do not identify a correction's effective time, prove the later WGO row wrong or establish which value was authoritative at the later cutoff. The checkpoint appropriately retains both sources and avoids repair. A subsequent recheck could add a new dated observation; without historical revision evidence, it would not automatically settle the earlier cutoff's truth.

## Tests, evidence and boundaries

**Newly ran 10/10 focused synthetic tests; all passed.** Negative cases cover missing box/player without DNP inference, missing/wrong teams, incomplete/duplicate skater census, wrong game/date/season/type, nonfinal state, GP/TOI conflicts, malformed TOI, missing/invalid versus observed zero, independent count mismatches, unknown PP-assist attribution, receipt/body/TLS/hash/length/URL mismatch and post-cutoff evidence. Reserved-season rejection uses synthetic fixture values, not holdout data.

Supporting evidence: `current-box-review/tests.log`, `RESULTS.json` and `verify.py`. The independent verifier reconstructed comparisons and discrepancy exports directly from source bodies rather than calling the implementation's `qualify_row`. Tests/checks used an atomically acquired shared heavy lock, released afterward. No unrelated preview tests/types/lint, app build or browser run was repeated or newly claimed.

The exact extension is suitable for the Player Cards owner to attach as separate, dated provenance facts with missing/differing statuses preserved. Snapshot staleness, unknown original publication/revision, NST model/native strength limits and consumer UI acceptance remain unresolved. “Full match” means the stated exposure plus five counts, not GameScore/on-ice/xG/all-metric qualification or predictive validation.

No source, score, membership, window, original capture or accepted sidecar was modified. Only review artifacts and the required diary were written. Zero remote/provider/API/NST/database/production requests, repairs, reserved-season data reads, Git index/ref mutations or deployments. No denied/pending action or uncertain outcome; no blocker to this scoped review handoff.

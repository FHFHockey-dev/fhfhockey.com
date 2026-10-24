# Authorized WiGO production diagnostic — 2026-10-24

TJ approved the previously proposed bounded reads through the parent thread. This is an addendum to the preserved offline report; the original ten synthetic results are unchanged.

## Verified target and execution bounds

- Production project **fhfhockey.com**, ref `fyhftlxokyjtpndbkfse`, API host `fyhftlxokyjtpndbkfse.supabase.co`, active/healthy. Confirmed by local linked project ref, production environment's URL **hostname only**, and Supabase `get_project`/`get_project_url`. No keys/passwords were printed or saved.
- Player 8476453 is live **Nikita Kucherov**, team 14, R. Latest started season is **20262027**, previous **20252026**.
- **Two sequential SELECTs, 68 returned rows total**. Both sent as explicit `BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SELECT ...; ROLLBACK;` in one connector call each. Both returned data with `isError=false`.
- Query 1: started **16:25:33.354Z**, connector wall time **6,243 ms**, **8/9 maximum rows**. Query 2: started **16:26:03.736Z**, connector wall time **5,054 ms**, **60/60 maximum rows**. These wall times include connector/network overhead; database execution duration was not separately returned. The five-second database statement limit was present in both submitted SQL texts.
- **Query 3 never run**: stopped once recent-window failures were separated. No app/public endpoints, refresh, cron, backfill, write, credential change, test or deployment was run in this phase. No failed/denied/pending or uncertain database operation.

Exact SQL: [query-1.sql](query-1.sql), [query-2.sql](query-2.sql). Complete connector receipts/timing: [query-1-result.json](query-1-result.json), [query-2-result.json](query-2-result.json). Parsed actual source snapshots: [query-1-rows.json](query-1-rows.json), [query-2-rows.json](query-2-rows.json). Arithmetic/matching receipt: [summary.json](summary.json).

## What is actually causing the missing cells

`wigo_recent` exists and was last computed **2026-10-24 08:52:04.250Z**. NHL-derived values are populated: L5 has GP=5, points=5 and SOG=21; L10 GP=10, points=13 and SOG=28; L20 GP=20, points=23 and SOG=55. ATOI, ixG, iCF, IPP, oiSH% and total-TOI per-60 fields are null in all three windows. PP time/rates remain populated. This is persisted missing-source/materialization state, not absent player identity or a wholly empty season.

| Window | Actual input coverage selected by current builder | Conclusion |
| --- | --- | --- |
| **L5** | Latest five NHL appearances (Oct 13, 15, 17, 20, 23) each have matching numeric-season NST individual and on-ice rows with positive TOI and finite ixG/iCF. **5/5 matched** in both sources. | Stored nulls disagree with currently available source rows. Current inspected builder math would have support for these metrics. This is an outdated/inconsistent materialization; why it was null at 08:52 cannot be dated from this read. |
| **L10** | Ten NHL appearances in 20262027; **9/10 matched**. **2026-10-05** is absent from both selected NST tables, while dates before and after it are present. Its NHL row exists with game_id 2026020040, GP=1, TOI=1,319 seconds, points=2, SOG=1. | A real NST source gap in this player's current-season window. The builder deliberately nulls dependent whole-window metrics when one required game is absent. |
| **L20** | NHL window = ten current-season + ten prior regular-season appearances. Independent NST latest-20 selection includes seven later prior-season dates Apr 19–May 3, leaving only four matches to the NHL prior-season frame. Together with nine current matches this is **13/20 matched** in both sources. | The real Oct 5 gap plus **unaligned independent top-20 selection**. Six older NHL-window dates are absent from the selected NST set; their existence deeper in the tables was not queried. Do not describe those six as proven ingestion gaps. |

L20 unmatched older dates: **2026-04-07, 04-06, 04-04, 04-02, 03-31, 03-26**. The seven NST dates displacing them are **2026-04-19, 04-21, 04-24, 04-26, 04-29, 05-01, 05-03**, all after the returned prior regular-season end date **2026-04-17**. Calling these playoff rows is an inference from their dates; their game type was not queried. Their displacement of matching NHL-window dates is directly observed.

The relevant code is [calculate-wigo-stats.ts:275](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:275) (independent top-20 reads), [:309](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:309) (season/date joins), [:930](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:930) (window slices), [:1100](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:1100) (null on incomplete coverage). WiGO consumes these stored nulls directly: [fetchWigoPlayerStats.ts:252](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts:252), [:374](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts:374).

Arithmetic over the captured **current L5 inputs** gives TOI **6,313 seconds**, ATOI **1,262.6 seconds (21:02.6)**, ixG **1.82**, iCF **35**, SOG/60 **11.9753**, points/60 **2.8513**, ixG/60 **1.0379**, iCF/60 **19.9588**. These are diagnostic calculations, not published replacements or a production recompute.

## Findings that are not this player's observed cause

- There is **no `wigo_rates` row** for 8476453. The offline-reproduced null/stale legacy override is a valid separate reader defect, but cannot cause his currently observed recent nulls through that table.
- STD currently agrees with current-season NHL totals: season 20262027, GP=10, goals=4, points=13, shots=28. The prior-season STD fallback defect was not observed here.
- No source observation/update timestamps were in the approved source selection. We cannot prove whether L5's NST rows arrived after 08:52, whether a different deployed computation ran then, or whether that run had a source-read error. The historical 521/stall receipts do not establish the cause of this exact Oct 5 omission.
- No live percentile table read was made, so this adds no current league-cohort coverage claim for the player-card PRD.

## Smallest repair scope to propose

1. **Align recent source selection to the NHL appearance frame.** Choose the exact game identities/season/dates for the window first; fetch matching NST rows for that frame rather than each source's unrelated latest 20. Preserve the current cross-season WiGO policy unless separately approved; new-card season/carryover rules remain a distinct decision. This removes the observed L20 row-displacement failure without a broad statistics refactor.
2. **Keep true missing NST metrics unavailable and expose the gap.** Oct 5 needs a separately authorized ingestion repair if NST metrics for L10/L20 are to be complete. Do not convert it to zero or manufacture its ixG/iCF. Existing complete NHL TOI could independently support NHL-based all-strength ATOI/SOG/points rates, if that small source-contract change is approved; it cannot supply missing NST ixG/iCF.
3. **Re-materialize the affected player after source/selection corrections.** L5 has enough current input to restore its supported fields. Existing `calculate-wigo-stats` fetches all non-goalie IDs ([route:232](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:232), [:161](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts:161)); do not invoke that broad route as an implied diagnostic repair. A future repair needs an explicit bounded single-player path and execution approval.

Failing source reads instead of stamping partial results fresh is a separate small builder hardening task, supported by the offline reproduction. Fixing the legacy-rate reader and exact STD fallback remains separate from this player's proven recent-window causes. No changes or repairs have been applied.

# Future approval and read budget — not requested or executed now

First obtain already-retained successful snapshot/issuance receipts, independent schedule/population/finality evidence, and forecast-only revision history. The current named artifacts do not establish them. Offline transfer of existing proof files is enough; missing files do **not** authorize a model recapture. If the proofs cannot be supplied, stop at an ineligible/diagnostic report. No amount of filtering the current ledger proves an overwritten forecast was the original served forecast.

After receipts establish the actual start date and sufficient settled game days, present this concrete request to TJ, with the final SQL SHA256 from `EVIDENCE.json`, exact dates and receipt references filled in:

> Approve one read-only F6 Release C ledger-week export against the production FHFH Supabase database, using the reviewed `forge-f6-ledger-week-2026-10-23/queries.sql` hash, season 20262027, served dates **2026-10-23 through 2026-10-29 inclusive only if independently verified**. Run the seven listed SELECTs once each in one read-only repeatable-read transaction, sequentially, concurrency one; 15-second per-statement timeout, 2-second lock timeout, 120-second total session ceiling, no retry. The run/rolling lookback is October 16–29 for that tentative window. Limit returned rows to the table caps below plus one sentinel each; stop on a sentinel, SQL/transport error, unavailable prerequisite, inconsistent version, or timeout. Do not call any application API, cron, snapshot, settle, recompute or capture runner. No writes, Yahoo, migrations, new model capture, scheduling, push or deployment. Retain query hashes, dates, returned counts, observation time, statement outcomes and proof references; report actual reads used against this budget.

If actual first serving differs, revise the date literals and budget request before execution. Do not silently extend until seven days pass. A mixed week does not become one cohort: retain the version partitions and request a separately dated evaluation for the new version. The prepared evaluator is pinned to Release C and does not approve a different baseline by changing a command-line flag.

| Select | Table(s) / purpose | Row cap | Overflow sentinel |
|---|---|---:|---:|
| 1 | `forge_runs`, from−7 through end; issuance and full-SHA inventory | 500 | 501 |
| 2 | `forge_served_forecast_ledger`, exact season/date window, five non-market sources; Q3/Q4 | 20,000 | 20,001 |
| 3 | `forge_player_projections` joined to runs, h1 in window; Q6 | 10,000 | 10,001 |
| 4 | `rolling_player_game_metrics`, EV, season, from−7 through end; Q5 current-state diagnostic | 12,000 | 12,001 |
| 5 | `games`, season/date window; independent calendar | 250 | 251 |
| 6 | `wgo_skater_stats`, season/date window; independent actual rows | 6,000 | 6,001 |
| 7 | `wgo_goalie_stats`, season/date window; Q3 goalie diagnostic actuals | 1,000 | 1,001 |

Total ceiling: **7 SELECTs, 49,750 ordinary rows + at most 7 sentinels (49,757 returned rows)**, one session, concurrency 1. BEGIN, two SET LOCAL statements and ROLLBACK are four transaction/control statements in addition to the seven reads. No pagination, additional counts, EXPLAIN, broad metadata scans, request retries or proof-source reads are authorized by this proposal. No HTTP application GETs. Database work scanned and monetary cost are not established by a returned-row cap; statement/session timeouts limit the attempt, and cost attribution remains unknown. Do not run through a connector whose output limit truncates the JSON cell.

Missing production proof-source discovery/read is **outside this exact seven-SELECT proposal**. A new request must name that source, the fields, date/game/team/class scope, row cap and statement/time budget after the ledger owner identifies it. No invented table, migration or finality derived from a row count. If a failed/incomplete run uses fewer than seven reads, record that count and stop; no automatic repeat.

This packet creates no scheduled task and makes no production qualification claim. Every actual model capture or baseline recapture remains a separate explicit TJ approval, with its own capture budget; this export is not a reconstruction capture and grants no such authority.

# Math audit W1-3: rolling-player-averages-trends-part1 (M-ROLL-001–060)

- **Scope:** read-only audit of 60 packet entries; one output file `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/rolling-player-averages-trends-part1.md`. No code changes.
- **Where:** `octoberBranch` at `c093e8d79` plus dirty tree. Packet `master/packets/rolling-player-averages-trends-part1.md`; brief TRIAGE.md §2 W1-3; OWNER-DECISIONS.md.
- **DB rules:** read-only, check `pg_stat_activity` before heavier reads (stop at >5 active or any >10 s), small LIMIT-ed reads by id/date only. No NST/NHL/Yahoo calls.
- **State (start):** packet, brief and owner decisions read. Code reading in progress.
- **Next:** read trend calculator + rolling writer engine; size C39/C40; column dictionary; hand recompute for 5 players (one traded, one PP-only).
- **Blockers:** none.
- **Gotchas:** packet line numbers drifted; re-locate by symbol. Never set GIT_DIR.

## Checkpoint 2 (code read, DB sized)
- Read myself: playerTrendCalculator, player-trends route, skater/goalie-power, rolling writer METRICS + derive loop + GP%, aggregation engine, TOI/PP-share/source contracts, socialShare/trends, trends player page.
- Research agent A (downstream readers) done and spot-verified. Agent B (legacy/sandbox entries) still running.
- Confirmed on live rows (bounded reads, pg_stat_activity 0 active each time):
  - C39: 108/108 skater rows on latest date (2026-11-09) have shots_per_60 60x low (NST not yet in MV at 12:00 UTC cron).
  - GP%: preseason games in the ledger (EDM 17 reg + 4 pre => 0.81 for a full-attendance player); trade double count (8476967: 60 GP / 169); career denominator missing pre-2023-24 (811 / 290 clamped to 1).
  - pp_share_pct skips zero-PP games (8475167: 11.1% stored vs ~5.6% true).
  - Stored rows 2026-03-08..04-16 are window-truncated (season = 1 game).
  - Rankings results-luck reads `*_per_60_total_lastN` (a rate) as a count; FORGE sample weight reads toi_seconds_avg_all (s/game) as evidence TOI.
  - L7/L14/L30 quick views read row[metric.key], which is never selected.
- Ops note (not math): rolling rows missing for 326/432 skaters on 11-07 and all of 11-09.
- Next: write the audit file; fold in agent B; final check.

## Checkpoint 3 (audit written)
- Correction to checkpoint 2: `pg_stat_activity` was checked at the start and once mid-way (0 other active both times), not before every read; all reads were by player id and/or date, catalog, or the small `games` table.
- Audit file written: `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/rolling-player-averages-trends-part1.md`. Verdicts: 32 sound, 15 mis-specified, 13 wrong, 0 undetermined. Left uncommitted for Chef.
- New since checkpoint 2: expected_sh_pct drops ixG from zero-shot games (4 of 5 players); hand recompute matched 18 columns for 5 players otherwise; sustainability feature dictionary names the rolling table but the code never queries it.
- Next: none for this pass. Open owner questions are in section 6 of the audit.

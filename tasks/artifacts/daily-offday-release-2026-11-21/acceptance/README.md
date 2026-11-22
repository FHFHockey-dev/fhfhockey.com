# Daily FORGE off-day fix: natural-run live acceptance

Release: `096b78b62` (production `dpl_2psc7uGM4UhXgEFHwmhrVx8GA3G1`, receipt `../release/RELEASE-RECEIPT.json`). Production has since moved to `523ba0108`, and that move doesn't touch the daily pipeline files. Reused, not replayed:
- Nov 21 recovery: `../recovery/run/RECOVERY-RECEIPT.json` (run `ced8d73f`, 13 games 0360–0372).
- Signed EDM–CAR pregame: `../../forge-live-release-2026-11-19/live-0359-20261121/READBACK-0359.json`.

Daily FORGE is **verified only when both natural runs pass**.

| Run | Kind | Checkpoint (after the 10:05Z run and its retry window) | Command |
|---|---|---|---|
| Nov 22 10:05Z | nonempty control (source Nov 21, 14 games) | **Sun Nov 22, 11:15Z** (05:15 CST) | `./check.sh 2026-11-22 2026-11-21 control` |
| Nov 27 10:05Z | first live off-day (source Nov 26, 0 games) | **Fri Nov 27, 11:15Z** (05:15 CST) | `./check.sh 2026-11-27 2026-11-26 offday` |

`check.sh` is read-only. It makes:
- 2 NHL schedule GETs;
- 1 read-only DB session (`default_transaction_read_only=on`);
- 2 sequential production reader GETs (Start Chart, then Daily RSO), the same URLs the recovery used.

It writes only `acceptance/<runDate>/`. `summarize.py` writes `ACCEPTANCE.json` with:
- the expected game IDs from the official schedule, compared with the IDs served by each reader;
- the pipeline stage statuses;
- the NST audit (`verifiedOffDates`, network attempts);
- the run IDs;
- the body hashes.

The parser was dry-run on the Nov 21 recovery's real reader bodies: 13/13 games matched.

**On failure:** record the first non-`complete` stage and the exact missing IDs from `ACCEPTANCE.json`, then propose a repair. Never rerun or reset.

## Strict evaluation (patched Nov 21, ~23:5xZ, before the first checkpoint)
Missing, null, ambiguous or vacuous evidence fails. A pass requires all of:
- an explicit date-matched run-day schedule whose count equals its games list (nonempty);
- a source-day schedule that matches the stated kind (`offday` means an explicit 0 games and an empty list);
- all 11 `daily_incremental:<date>` stage rows `complete`;
- exactly one `full_slate` run created between 09:55 and 11:15Z, and it `succeeded` (no selected_games fallback, no guess);
- every expected game in the writer rows, in Start Chart, and in the Daily RSO bridge, under that exact run ID;
- both readers returning HTTP 200;
- for `offday`:
  - an NST audit row in the window: `success`, `skipped_no_completed_games`, the source date in `verifiedOffDates`, `missingScheduleDates []`;
  - and every NST row in the window with explicit `planned 0` and `networkAttempts 0`.

`check.sh` now runs psql quiet: the old `-At` printed `SET` into `db.json`, which would have broken parsing. Raw receipts stay whatever the verdict.

Tests: `python3 -I -m unittest discover -s tests -v`. There are 20 tests:
- 3 positive controls, built from the real Nov 21 reader bodies;
- 4 reproduced false passes, each shown to pass `tests/legacy_summarize.py` and to fail the strict checker;
- 13 other rejections.

Receipts are in `receipts/`.

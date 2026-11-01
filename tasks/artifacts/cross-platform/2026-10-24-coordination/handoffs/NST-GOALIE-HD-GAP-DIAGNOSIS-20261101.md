# NST goalie HD/GS gap: diagnosis (2026-11-01)

Read-only. No NST calls, route calls, writes, code changes, pushes or deploys.

## Root cause

The Busy and Quiet card is correct. The data is missing because the `update-nst-goalies` writer has been falling behind since the 2026-10-25 release (#380, b3f9a7e25, 04:40 UTC).

1. **Every request is now paced at 21s, even in burst mode.** #380 changed `web/lib/nst/client.ts` so a call with no `requestControl` gets a default one with `minIntervalMs: 21000`. The released route calls `fetchNstTextByUrl(url, { timeoutMs: 30000 })` with no control, so its burst plan (`requestIntervalMs: 0`) no longer bursts. A normal 20-URL run now needs at least 420s, and `maxDuration` is 240s.
2. **Audit rows stop at the same moment.** Before the release, this job had a success row every day, each with 20 URLs in 5-15s (10-10 through 10-24). After it, only one row exists in 8 runs (10-30). pg_cron reported success every day, but that only means the request was sent. Rows kept arriving on the unaudited days, so the function was running and very likely being killed at 240s before the audit wrapper could write. This is an inference: no Vercel logs were available to confirm it.
3. **Once behind, it can't catch up.** At 40+ queued URLs (4+ dates) the route drops to strict mode: 6 URLs per run at 21s (10-30 audit: 50 queued, 6 processed, 229.9s). The backlog grows by 10 URLs a day. Observed: 43 URLs written in 8 runs, about 5.4 a day. Two things inflate the queue count: URLs that already exist, and today's date, which has no finished games at 08:30 UTC.

Ruled out:
- Rate-limit stop: the 10-30 audit shows the plan compliant in all four windows.
- Season or date filter: the season and regular-season dates in the response are correct.
- Job disabled or skipped: the cron is active and fired daily.
- Player-id mapping: through 10-27, the only season miss is Matt Murray (below).
- Coverage rule too strict: goalies print "—" because their rows really are absent.

Not determined:
- Why the 10-31 and 11-01 runs left no audit row. They wrote only 10 URLs between them, fewer than two clean 6-URL runs would, and no failure row exists.
- Why one URL took 115.7s on 10-30 (ppRates 10-26). That length suggests retries.
- That #380 was live by 08:30 UTC on 10-25. The timing fits, but the deployment list is also blocked.
- Vercel access: logs, errors and deployments all return 403 for this team through the connector, and there is no `vercel` CLI here. Authorizing team access would need TJ's approval.

## Evidence

Writer progress by table. `nst_gamelog_goalie_*` has no write timestamps, so this is the only record.

| Table group | Latest complete date |
|---|---|
| all 10 tables | 2026-10-27 |
| 5v5_counts, 5v5_rates, ev_counts | 2026-10-28 (partial date) |
| ev_rates, all_counts, all_rates, pp_*, pk_* | stop at 2026-10-27 |

`nst_gamelog_goalie_all_counts` (the table the card reads) vs `wgo_goalie_stats`:

| Date | WGO goalies | NST matched | NST missing |
|---|---|---|---|
| 10-18 | 4 | 4 | 0 |
| 10-19 | 8 | 8 | 0 |
| 10-20 | 23 | 23 | 0 |
| 10-21 | 5 | 5 | 0 |
| 10-22 | 25 | 25 | 0 |
| 10-23 | 4 | 4 | 0 |
| 10-24 | 24 | 24 | 0 |
| 10-25 | 10 | 10 | 0 |
| 10-26 | 7 | 7 | 0 |
| 10-27 | 22 | 22 | 0 |
| 10-28 | 9 | 0 | 9 |
| 10-29 | 24 | 0 | 24 |
| 10-30 | 7 | 0 | 7 |
| 10-31 | 20 | 0 | 20 |

60 goalie-games are missing. `hd_shots_against` is never null on the rows that do exist (10-07 onward). `nst_team_gamelogs_as_counts` and `nst_gamelog_as_counts` are current through 10-31, so only this writer is affected.

Audit rows for `/api/v1/db/update-nst-goalies`:

| Run | Duration | Processed / queued | Interval |
|---|---|---|---|
| 10-10 to 10-24 (daily) | 5.6-15.2s | 20 / 30 | 0 |
| 10-25 to 10-29 | no row | 27 URLs written across 5 runs (from table contents) | unknown |
| 10-30 | 229.9s | 6 / 50 | 21000 |
| 10-31, 11-01 | no row | 10 URLs written across 2 runs (from table contents) | unknown |

Schedule: pg_cron `update-nst-goalies`, `30 8 * * *` (not in `web/vercel.json`).

## Card rule

`web/lib/socialShare/modules/busyQuiet.ts:19,93`: `NST_MIN_COVERAGE = 0.9`. HD is shown only if rows exist for at least 90% of the goalie's games in the window. The check uses the WGO goalie id and date against NST `player_id` and `date_scraped`.

- L5: one miss gives at most 80%, so "—".
- L10: one miss in a full 10 gives exactly 90%, so it still shows.

## Affected goalies

47 of 72 goalies have played since 10-27. All 47 print "—" on L5. On L10 and season, the only ones still shown are those with one miss and 10+ games.

Named in the request (L5, L10, season, missing dates):

| Goalie | L5 | L10 | Season | Missing |
|---|---|---|---|---|
| Merilainen | 3/5 | 8/10 | 9/11 | 10-29, 10-31 |
| Nedeljkovic | 4/5 | 5/6 | 5/6 | 10-31 |
| DiPietro | 3/4 | 3/4 | 3/4 | 10-31 |
| Woll | 4/5 | 7/8 | 7/8 | 10-28 |

Still shown on L10 (9/10): Swayman, Wallstedt, Knight, Saros, Bobrovsky, Luukkonen.

The other affected goalies: Hill, Schmid, Vasilevskiy, Stolarz, Forsberg, Sergeev, Silovs, Soderblom, Lindgren, Ellis, Hellebuyck, Kuemper, Cooley, Wolf, Sorokin, Fowler, Allen, Oettinger, Dobes, Greaves, Hofer, Daccord, Gibson, Johansson, Annunen, Thompson, Blackwood, Daws, Grubauer, Kochetkov, Ersson, Cossa, Murashov, Skinner, Jarry, Husso, Askarov.

Separate small issues, neither part of this gap:
- **Matt Murray (NSH), 10-10:** WGO has id 8483575 and NST mapped the row to 8476899. This looks like a name collision between two players, and it leaves him at 0/1 on the card.
- **Bussi and Hart:** stray WGO rows dated 2026-06-14 with season 20262027 and null team. The card's ledger starts 08-01, so it isn't affected, but other readers could be.

## Proposed fix (owner: Codex, NST lane)

Don't change the card or the 0.9 threshold. Lowering it would quietly average over the newest games.

1. **Release the route's request control, with its database prerequisite first.** Codex's uncommitted candidate in the working tree already passes `requestControl` with the plan's interval and `plannedRequestCount`, and adds a 220s deadline. That restores bursts and gives clean 207s with audit rows instead of 240s kills. The DB-first warning in `CODEX-TO-CLAUDE.md` applies. Those files are Codex's: `update-nst-goalies.ts`, `lib/nst/client.ts`, `requestBudget.ts`, `sharedAdmission.ts`, `nstBurstPlans.ts`.
2. **Fix the catch-up math, which the candidate does not do.**
   - Remove today from the queue. This also saves 10 wasted NST requests a day.
   - Base the burst decision on URLs still missing, not all queued URLs.
   - The cron doesn't follow the 207 resume (only the `/db` runner does), so give it a way to continue, or a cap that clears more than 10 URLs a day.
3. **Add a freshness alert** comparing the latest `nst_gamelog_goalie_all_counts` date with WGO. pg_cron's "succeeded" and the missing audit rows hid this for a week.
4. **Optional:** fix the Murray mapping.

## Backfill (needs TJ's authorization; not run)

37 NST requests as of now: 7 for 10-28 (ev_rates, all_counts, all_rates, pp x2, pk x2) plus 30 for 10-29 to 10-31. The 08:30 UTC run on 11-02 will take a few of these and add 10-11-01's 10 URLs to the backlog.

Run this 7 times in sequence, outside 08:30-10:10 UTC:

`/api/v1/db/update-nst-goalies?runMode=incremental&overwrite=false&startDate=2026-10-28&maxDays=4&maxUrls=6&requestIntervalMs=21000`

- About 13 minutes of 21s-spaced requests. Existing rows are skipped, so reruns don't repeat work.
- Against the limits: at most 3 per minute, 15 per 5 minutes, and 37 in total, which also keeps it under 100/15m and 180/h. Retries stay on the same spacing.
- 37 is under the 40 burst threshold, but the released client forces 21s regardless, so a burst isn't available until fix 1 ships.

**Don't backfill with `datasetType=allCounts` alone.** It would take only 4 requests and fix the card, but `getLatestDateSupabase` takes the newest date across all 10 tables. Incremental runs would then resume from 10-31 and permanently skip the other 9 tables for 10-28 to 10-30.

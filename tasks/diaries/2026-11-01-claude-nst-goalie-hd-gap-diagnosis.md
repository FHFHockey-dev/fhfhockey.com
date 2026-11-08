# NST goalie HD/GS gap diagnosis (read-only)

- Scope: why Busy and Quiet prints "—" for HD/GS and why `nst_gamelog_goalie_*` stops 10-27/28. No NST calls, no route invocations, no writes, no code changes.
- Where: octoberBranch, no commits. Full report: `~/Library/Application Support/Claude/side-session-notes/local_c4fd32c8-79ae-4372-bc3a-4d7b2febd918/nst-goalie-hd-gap-diagnosis.md`.
- State: diagnosis finished. Since #380 (10-25) the released client paces every goalie request at 21s, so a 20-URL run exceeds the 240s limit (kill is inferred). At 40+ queued URLs, strict mode does 6 URLs a run against 10 new a day. The card's coverage rule is working correctly.
- Checks: SELECTs on `cron.job`, `cron.job_run_details`, `cron_job_audit`, NST and WGO tables; `git show origin/master` for the released code. Local `master` is stale, so use `origin/master`.
- Backfill: TJ ran it through the /db runner on 11-01 from 14:39 UTC. 10-28 to 10-31 present in all 10 tables at 14:58 UTC; the runner then continues into 11-01, whose games start at 18:00 UTC.
- Next: TJ decides on the Codex fix. The writer can fall behind again until it ships.
- Blockers: Vercel logs and deployments return 403 for this team; no `vercel` CLI. Unaudited runs can't be fully explained.
- Gotchas: never backfill with `datasetType=allCounts` alone, because `getLatestDateSupabase` would skip the other 9 tables permanently. Codex's guarded route is uncommitted in the working tree, so don't touch it. The Supabase connector drops parallel queries; the plugin connector worked.

- Chef outcome (2026-11-07): diagnosis delivered; the fix belongs to Codex (NST lane) and the 37-request backfill still awaits TJ. Keep until Codex closes it.

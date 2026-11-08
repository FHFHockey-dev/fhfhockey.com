# Lines containment, 2026-11-08

- Scope: approved Production Lines flag false + exact-SHA deployment; pause only update-line-sources/update-lines-ccc; restart database only if needed. No upgrades or other settings.
- Exact live release: a68f9b3d24aed05da2d0f1c0556185c8a144ba81, Vercel project fhfhockey.
- Initial control-plane status reports ACTIVE_HEALTHY; data-plane health not yet verified.
- Vercel MCP environment listing returned 403 with an explicit same-action CLI fallback. No changes made yet.
- 00:15 UTC: SQL inspection failed with connection timeout despite ACTIVE_HEALTHY control-plane status. Parent confirmed to proceed with authorized DB restart and not use dashboard to bypass Vercel 403; user will change Vercel flag.
- Submitted Fast database reboot once via Supabase settings. Confirmation stated a few minutes downtime; UI moved to Restarting. No upgrade/full-project restart.
- Verified PostgreSQL restart timestamp 2026-11-08 00:13:30.75478 UTC; SQL responded at 00:13:36. Correction: earlier approximate 00:15 note was inaccurate.
- No exact route names found in cron.job command or names. Do not pause broader route-runner or infer job IDs.
- Shared browser then showed a separate full-project restart confirmation and subsequently Restarting; not submitted by this worker. Parent notified of apparent concurrent action.
- 00:19:53 UTC: control-plane ACTIVE_HEALTHY, dashboard Healthy, SQL responsive. New postmaster start 00:17:38 verifies subsequent restart. 22 total backends; 13 client backends; zero other active clients and zero >30s active clients. No active route-runner jobs. This is a point-in-time observation, not root-cause or durable stability proof.
- No matching processor pg_cron jobs, so no scheduler mutation. Vercel flag/deploy still blocked pending user-applied setting and exact verified deploy. Parent has latest findings. Receipt: tasks/artifacts/lines-containment-2026-11-08/RECOVERY-STATUS.json.

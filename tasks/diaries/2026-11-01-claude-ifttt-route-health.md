# IFTTT route health: NHL_Rosters and DFOFantasy (read-only)

- Scope: read-only health check of the two IFTTT tweet routes. No POST, applet edit, code edit, push or deploy.
- Where: `octoberBranch` checkout, compared against `origin/master` 4965a872a. Routes in `web/pages/api/v1/sources/ifttt/`.
- State: both BROKEN. `IFTTT_NHL_ROSTERS_WEBHOOK_SECRET` and `IFTTT_DFOFANTASY_WEBHOOK_SECRET` are absent from Vercel in every environment, so the handler returns 500 before storing. Everything else checked is correct. 0 rows ever.
- Checks: `vercel env ls` (names only), two GETs returned 405, SELECT-only SQL, applet reads, cron audit.
- Update: TJ chose the shared secret over new vars. Committed locally on `octoberBranch`: routes fall back to `X_FHFH_IFTTT_SECRET`, and both first-arrival readers include `dfo` and `nhl_rosters`. Tests, tsc and eslint passed.
- Next: release and redeploy (not authorized here), then run the first-tweet SQL from the report. A 401 means `X_FHFH_IFTTT_SECRET` doesn't hold the value in these applets' header.
- Pending approval: release. Precedence effects are in the report; the line combinations sync is dormant while interpretation mode is on.
- Gotchas: zsh treats `$M:web` as a modifier, so quote git refs. The Vercel CLI is at `functions/node_modules/.bin/vercel`; the Vercel MCP returned 403 for this team. Applet details expose the header secret: never copy it into notes.
- Full findings: side-session notes folder, `ifttt-route-health.md`.

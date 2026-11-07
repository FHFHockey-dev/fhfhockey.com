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
- **401 diagnosis (orchestrator 1e668672):** 401s began 17:32-17:34Z on the 10-30 deployment, before #402 code shipped, so not a code regression. Applets for ccc, gamedaynewsnhl, gamedaygoalies send a value their deployed var doesn't hold. Vercel: gamedaynewsnhl and gamedaygoalies vars last updated July; ccc updated 20:42Z, after the latest production deploy (20:08Z). No secret values read.
- **Deploy:** TJ's two dashboard redeploys were CANCELED by the Ignored Build Step. With TJ's approval, one CLI deploy of the exact 295b384da tree: cG8Vbf, READY 20:58:04Z, aliases assigned. Next: confirm first POST on ccc, gamedaynewsnhl and gamedaygoalies returns 200.

- Chef outcome (2026-11-07): routes and the shared-secret fallback shipped in #402 and the CLI deploy of the 295b384da tree. Lane closed; diary can be retired.

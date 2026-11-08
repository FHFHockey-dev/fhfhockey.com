# Yahoo real-account window: TJ approval (direct pop-up, 2026-10-25 ~22:25 EDT)

- **Date:** Monday 2026-10-26 only. Approval does not carry over to other days.
- **Steps:** R1 in the morning before any puck drop; R2 after Yahoo posts goalie marks, before the owned goalie's game; R3 at least 60 s after R2; R4 after that game starts. Follow REAL-ACCOUNT-PLAN.md exactly.
- **Driver:** the orchestrator, in the app's built-in browser, against an isolated local dev server (PLAYWRIGHT_ISOLATED_NEXT=1, its own port; never 3000 or 3105). TJ signs in himself. Claude never types or sees passwords or tokens.
- **League/team:** TJ selects his own daily-league team in the RSO connect step. Record only "daily league, owned team".
- **Budget:** ≤80 Yahoo reads, ceiling 100. Stop after R1 and ask TJ if available-player discovery needs more than 20 pages.
- **Read-only:** no transactions, lineup edits, waiver claims or OAuth scope changes.
- **Stop on:** yahoo_rate_limited, yahoo_reauth_required, yahoo_access_denied, any non-200, any write-capable path, a request count that would exceed 100, or anything that would require storing private league data.
- **Evidence:** booleans, counts, field presence and limitation strings only, in YAHOO/WINDOW-RESULTS-2026-10-26.md. No league, team or player names, rosters, standings or tokens in the repo, diaries or chat.
- **Note:** the local dev server talks to the real Supabase/Yahoo backends through the app's own authorized routes (reads only). This is the approved exception for this window. No production deploy or Vercel preview is involved.

# Social Share period control (Claude)

- Scope: shared period control for posts, with Goalie of the Period as the worked example. Other lanes adopt it.
- Where: `octoberBranch`, commit below in git log ("a shared period control pages matchup weeks"). `web/lib/socialShare/modules/shared/periodWindow.ts`, `web/components/SocialShare/PeriodControl.tsx`, `web/pages/api/v1/social-share/matchup-weeks.ts`.
- State: committed, not pushed. Vitest, Social Share specs on port 3110, eslint and pure check passed.
- Next: other lanes add the flag and fields to their posts.
- Blockers: none. `tsc` reports one error in the untracked Player Cards file `web/lib/player-cards/retainedBlsh.test.ts`, another lane's.
- Gotchas: jsdom has no `AbortSignal.timeout`, so the calendar fetch uses `bounded` from `lib/socialShare/export`. A label wrapping a select takes the option text into its accessible name, so specs find the select through `period-control`.
- Decisions: one-day custom ranges are refused, as Goalie of the Period already did. Period select loads at once except for Custom, which waits for Refresh.

- Chef outcome (2026-11-07): this lane's work shipped in #402 (f17bea20d), #403 (295b384da) and #404 (354336347). Lane closed; diary can be retired.

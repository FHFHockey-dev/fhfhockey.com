# Social Share posted-or-not source (Claude)

- Scope: IFTTT webhook, table, alt-text card match, Mon to Sun read, landing strip, posts-by-card count. No applet, push, deploy or production write.
- Where: octoberBranch. `supabase/migrations/20261101190000_social_share_x_posts.sql`, `web/lib/socialShare/postedWeek*.ts`, `web/pages/api/v1/sources/ifttt/FHFHockey-post.ts`, `web/pages/api/v1/social-share/posted-week.ts`, `web/components/SocialShare/ShareLanding.*`, `web/lib/socialShare/landingCatalog.ts`, helper exports in `web/lib/sources/lineSourceIftttReceiver.ts`.
- Decisions: media trigger only (100 + webhook = 120 credits per run, as existing applets). Reply counts left out: the free trigger exists, but anyone's reply spends TJ's credits and it needs a second applet and table. Any post counts as posted, matched or not.
- Gotchas: alt text prefixes differ from card names, so the matcher is a rule table with a source-file drift test. Empty table = unavailable, not a week of misses. Days before the first post = untracked.
- State: committed f7f75624c, not pushed. Unit tests, landing spec (port 3144), eslint and CSS pure check pass. tsc has one error, in committed `goalieRescue.sources.ts` from another lane.
- Next: TJ approves migration, secret, release and applet. Steps: side-session-notes `social-share-posted-source-approval.md`.
- Not exercised: the SQL on Postgres, and a real IFTTT delivery (AltText only seen as IFTTT's example). Production JSON bodies do carry newlines and quotes (686 and 50 of 1,159 rows in 14 days).
- Blockers: migration, env secret, release and applet await TJ.
- Recheck (AUDIT-RECHECK 2, 3, 4, 5, 7) fixed. Staleness rule: no delivery for over 72 hours, empty days from the last delivery's date on read no record. Undated migration 20261101233000 not applied; the base table is applied with 0 rows.
- Second recheck (AUDIT-RECHECK-2, three items) fixed. Live delivery = dated, received 0 to 6 hours after its time. Empty past day is missed only after a later live delivery, else no record. No schema change.

- Chef outcome (2026-11-07): posted-source intake (social_share_x_posts, applied 20261101171113) shipped in #402 (f17bea20d) and the audit rechecks in #403/#404. Lane closed; diary can be retired.

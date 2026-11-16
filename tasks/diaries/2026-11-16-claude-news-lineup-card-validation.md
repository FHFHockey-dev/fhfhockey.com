# 2026-11-16 · Claude · News lineup cards: validated units only

- **Scope:**
  - Public News lineup cards stop rendering tiles split from text. Tiles come only from validated interpreter units:
    team, players and roles, plus an NHL game for game and warm-up posts.
  - Partial cards are labelled "Partial snapshot" with the source link.
  - Goalies get no starter label unless the post says so explicitly. Scratches get their own row.
  - Warm-up posts stay "reported".
  - Old cards: a one-time repair of the Flames and Islanders Ducks cards, dry run first. The write needs TJ's approval.
  - Out of scope: Lines, DRM, forecast inputs, aliases and replays. The interpreter's pipe-goalie support needs separate
    approval.
- **Where:** octoberBranch.
  - `web/lib/newsLineupPresentation.ts`, `web/lib/newsFeed.ts`, `web/lib/sources/tweetNewsAutomation.ts`
  - `web/pages/api/v1/db/tweet-pattern-review.ts` (sync game_id), `components/NewsFeed/*`, tests
- **Team matching** (Ontario→COL, Hallander): in session `team-matching` (local_f3527b22), which owns `linesCccIngestion.ts`
  team resolution.
- **Reproduced offline (Ducks 11/15 vs CGY):**
  - The text splitter puts the headline in D1, makes "Husso | Dostál" one goalie and puts the scratches in G2.
  - The interpreter gets F1, F2, F4 and D1–D3 right and the scratches right. F3 is incomplete because Moore is a rostered D.
    It produces no goalie unit (`|` isn't supported).
- **Done:** 1b1075ab3 (validator, presentation, sync game_id, tests, e2e fixture). Next commit: repair script, planner
  test, visible "reported" label on warm-up cards.
- **Dry run** (read-only): Flames card 4de7ff1b and Islanders card efe79d76 are both repairable. Receipt:
  `tasks/artifacts/news-lineup-repair-2026-11-16/`.
- **Checks:** 1,485 tests in news, sources and the review route passed. Scoped eslint passed. Typecheck errors are only in
  other lanes' dirty forge files. The home-news e2e fails at the standings checkbox count on HEAD too, before any lineup
  assertion.
- **Commits:**
  - 72cb59ac5: repair script, warm-up "reported" label
  - 418a844d1: F3 "D listed at F" rule (News only, per TJ). The dry run was rerun: both cards repairable, F1–F4 and D1–D3.
- **Sessions:** `pipe-goalies` (local_4923523d) owns `tweetInterpretation.ts` and has uncommitted edits in the tree. The
  Ducks test ignores goalie rows on purpose. `team-matching` (local_f3527b22) is running.
- **Applied (TJ approved, 2026-11-16):** `newsLineup` written to 4de7ff1b and efe79d76 only (2 row updates). The
  read-back through sanitize and render shows F1–F4 and D1–D3, F3 Moore as "D listed at F", "Warm-up snapshot · reported",
  no starter, and no public lineupCard.
- **Live site:** keeps rendering the old stored tiles until the new renderer is released. Release needs TJ's approval.
- **Sibling commits:** 2786b0f0f (team matching), 4919d29a4 (pipe goalies, version 2026-11-16.1). Neither is pushed.
- **Gotchas:** `publicClaimInterpretation` must keep its shape, because the claim check depends on it.
- **Pipe pairs** (TJ, 2026-11-16): commit 010770ee7 limits them to News.
  - Through `toLinesCccRow` and `buildGoalieBlendFeatures`, 4919d29a4 had made the first-written goalie a 100% confirmed
    starter.
  - Units are now tagged `listing: "pipe_pair"` and the serializer skips them. The version is 2026-11-16.2.
  - Both orders and the confirmed-starter control are tested.
- **AFULL-GAME3-02 reader bug:** handoff bf1e1904b. Owned by session `game3-02` (local_706ed937); this lane doesn't touch
  `featureBuilder.ts`.
- **Release #461** (TJ approved, 2026-11-16): https://github.com/FHFHockey-dev/fhfhockey.com/pull/461
  - Candidate d8e4175ad: master 2b8651da8 plus 16 files. Same patch-id as the earlier gated bases.
  - Gate: full-tree export under the heavy lock. tsc 0, eslint 0, CSS pure ok, targeted 15/15. The full-suite failures
    match master, plus one load timeout.
  - All four Vercel projects: `previewDeploymentsDisabled: true`, production branch master. The branch push made no
    deployment.
  - Squash merge 5ff5a2908; its tree equals the gated candidate. 1 fhfhockey build READY (dpl_EVcViR9KyAAzXbeGz4o9vcvDqB2v),
    3 cancels. fhfhockey.com is aliased to it.
  - Production news: two /news loads plus one diagnostic select.
    - The 18:00Z auto-news run (old code) had overwritten the repaired metadata.
    - The 19:30Z run (new code) rebound the Flames card itself: F1–F4, D1–D3, Moore "D listed at F", "Warm-up snapshot ·
      reported", no goalie tiles, no headline tiles.
    - The Islanders card efe79d76 and practice card 930622e1 stay source-only, with no newsLineup.
  - Screenshot: `tasks/artifacts/news-lineup-repair-2026-11-16/production-ana-flames-card-461.jpg`.
  - Not done, per TJ: no octoberBranch push, no repair rerun, no replay, no flag or setting changes.
- **TJ (2026-11-16):** leave the Islanders card efe79d76 and practice card 930622e1 source-only. No repair rerun.

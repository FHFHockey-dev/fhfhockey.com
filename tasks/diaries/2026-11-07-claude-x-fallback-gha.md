# 2026-11-07 · Claude · X twscrape fallback on GitHub Actions (Layer 3, shadow)

## Scope
Adapt parked Layer 3 (tools/x-twscrape-fallback) to a GitHub Actions job every 15 min, SHADOW first, all 7 accounts.
Owned: tools/x-twscrape-fallback/*, .github/workflows/x-twscrape-fallback.yml, supabase/functions/x-timeline-ingest/*,
_shared/twscrapeStatus.ts, _shared/xTimelineIngestRequest.ts, web/__tests__/lib/xIntakeSafetyNet.test.ts.
Not mine: x-timeline-poll/*, _shared/xTimelineStore.ts (parent session).

## Decisions
- TJ pop-up 2026-11-07: shadow = observations table `x_timeline_twscrape_observations` (in setup.sql, not applied).
- Ingest modes: anchors / observe (shadow) / health / ingest (live, refused unless fn secret X_TIMELINE_INGEST_LIVE=1).
- Paging anchor = newest observed timeline id (repost = wrapper id); page 1 needs 2 posts <= anchor (pinned), later 1; max 5 pages of 40.
- Pi files (.service/.timer/.env.example) removed: script no longer reads .env/accounts.db. History at ff5159adb.

## State (uncommitted, octoberBranch)
- Done: fallback.py (cookie secret pool, paging, red on any failure), test_fallback.py, requirements pinned, compare.sql,
  README, workflow (pinned SHAs, py 3.13.17, concurrency, 8 min timeout, cron 7,22,37,52), twscrapeStatus media/texts/repost.
- Checks: Vitest xIntakeSafetyNet 30/30 + xTimelineFxtwitter (49 total) pass; eslint test 0; npm run typecheck 0;
  ingest index.ts tsc with Deno shim 0 (no deno locally); python unittest 7/7; real twscrape 0.21.0 pool build OK.

## Gotchas
- JSON big ints: twscrape `id` numbers lose precision in JS; mapper uses id_str everywhere. Test helper must pass string ids.
- FxTwitter raw_text keeps t.co (mapper reads it first); text is expanded. display_text_range counts code points.
- web/vercel.json ignoreCommand cancels fhfhockey when web/ unchanged: a master commit with only .github + tools likely builds nothing.

## Release (TJ pop-ups 2026-11-07)
- TJ: workflow-only commit to master, job gated off by repo variable X_TWSCRAPE_SHADOW_ENABLED (added to workflow).
- Built commit 194d55e720f1a715904c252e750d96af9533ef20 via temp index (parent origin/master 08344ca14; 7 files; no web/cms/functions).
  Unreferenced object, not on any branch; working tree untouched.
- TJ push condition: only AFTER the octoberBranch ancestry merge completes; re-check master==08344ca14 and variable unset;
  push exactly that SHA fast-forward; watch deployments; do NOT enable the workflow or deploy ingest. Stop if master moved.
- Vercel inventory (CLI api, read-only): fhfhockey root web, cms-fhfhockey root cms, functions-fhfhockey root functions,
  fhfhockey.com root none (root vercel.json ignore = exit 0); all prod master, previews disabled, no dashboard ignore
  command (vercel.json). web/functions projects unlinked. Uncertainty: fhfhockey cancel needs VERCEL_GIT_PREVIOUS_SHA
  (08344ca14) in Vercel's clone; if absent the ignore step exits 1 and builds once.
- Repo has 0 Actions variables, 0 secrets (2026-11-07).
- Blocked: asked parent who does the ancestry merge (master not ancestor of octoberBranch HEAD 49ffd6a52).

## Parent's added requirements (TJ via parent, 2026-11-07)
- Retention: TJ pop-up 14 days. public.x_timeline_twscrape_observations_prune(14), max 1,000 rows a call, called
  by the ingest handler's anchors mode at the start of each job run (no new cron).
- Dedupe: PK (source_key, tweet_id) + ON CONFLICT DO NOTHING; mapper dedupes within a page.
- Source times: tweet_created_at (X time, to the second) + new reposted_at; first_observed_at is the DB clock.
- Ingest logic moved to supabase/functions/x-timeline-ingest/handler.ts (import-free, DI); index.ts wires it.
  Tests: a guarded fake db throws on any write outside the observations table; 7 accounts observe, dedupe, anchors/prune,
  live refused with zero calls, validation ignores production-table fields, guard proven by live-enabled case.
- Migration supabase/migrations/20261107181046_x_timeline_twscrape_shadow.sql (renamed from 20261107160000 to match
  the ledger). APPLIED 2026-11-07 ~18:10 UTC with TJ pop-up approval via MCP apply_migration; readback OK.
  migration-authority.json row 118 applied; supportedBaselineMigration test counts 118/78/30/10; super-goal summary line.
  Local PG15 check first (applies twice, dedupe, prune, grants). setup.sql now only holds the live-only health RPC draft.
- Checks: Vitest xIntakeSafetyNet 42 + supportedBaselineMigration 21 + xTimelineFxtwitter = 82 pass; eslint 0;
  typecheck 0; Deno-shim tsc index+handler 0. Master commit 194d55e72's 7 files unchanged (blob-checked).

## Deploy (TJ pop-up 2026-11-07)
- x-timeline-ingest v1 deployed ~18:13 UTC, ACTIVE, verify_jwt false, 6 files (index, handler, twscrapeStatus,
  xTimelineIngestRequest, xTimelineStore, x-timeline-poll/fxtwitter). POST without secret -> 401 (one request).
- CLI 3.0 rejects repo supabase/config.toml ([inbucket] removed key); deployed from a scratch workdir with a minimal
  config.toml + copies of the exact local files (--use-api --no-verify-jwt --yes). Repo config.toml not touched.
- X_TIMELINE_INGEST_LIVE not set (live ingest 403).

## Master push (TJ conditional approval; condition met 2026-11-07)
- Lines chef's ancestry merge landed (octoberBranch a013800ec, parents 49ffd6a52 + 08344ca14). Re-checked: master
  08344ca14, commit 194d55e72 same 7 files, 0 repo variables, Vercel settings unchanged.
- Pushed 194d55e72 to master 18:14:39Z (fast-forward 08344ca14..194d55e72). Vercel: 4 production entries, all CANCELED
  (fhfhockey, cms-fhfhockey, functions-fhfhockey, fhfhockey.com); 0 builds. GitHub statuses report success (ignored). No workflow run.
- octoberBranch does not contain 194d55e72 yet: same 7 files are uncommitted in the working tree; sync master in later.

## Next / pending approvals (one at a time, pop-ups)
- Vault secret (TJ dashboard); GitHub secrets X_INGEST_SECRET + X_BURNER_COOKIES; then evaluate runs with compare.sql.
- When promoted: ingest lacks FHFHockey social_share_x_posts writes.

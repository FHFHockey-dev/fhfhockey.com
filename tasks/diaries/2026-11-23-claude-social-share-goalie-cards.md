# 2026-11-23 Claude: social-share goalie cards "Not available"

## Scope
TJ: check every card in /social-share and fix the broken ones; Crease Shift says "No night this season is fully reported yet."

## Where
- Branch octoberBranch, checkout /Users/tim/Code/fhfhockey.com. No code edits.
- Temp sweep script web/scratch-crease.ts (deleted).

## Root cause
- `readFinalGameIds` (web/lib/socialShare/modules/creaseShift.sources.ts), added in #430 on 11-12, proves finality from `pbp_plays` game-end rows.
- The post library reads through `lib/supabase/public-client` (anon). `pbp_plays` has RLS on and zero policies, so anon gets 0 rows, every game is `final: false`, and no night counts as complete.
- Unit tests mock the client, so they cannot see RLS.

## Sweep (anon client, 2026-11-23)
- Post library: 19 posts. 15 ready. player-vs-player blocked (needs two players, expected).
- Broken, same cause: crease-shift, goalie-period, goalie-gsax.
- Schedule studio: game-grid, remaining-week, tuesday-trends ready; player-spotlight and category-rescue blocked by design.
- Goalie Grid history uses lib/supabase/server (service role), so it is unaffected.
- No other no-policy table is read by share code.

## Data facts
- 377 scheduled games through 11-22; 375 have exactly one game-end.
- Missing pbp entirely: 2026020310 (11-13), 2026020318 (11-14). Older gaps, so the cards will be partial until backfilled.
- Chunk read (200 ids): ~157 ms; anon statement_timeout 3 s.

## Fix (TJ chose all rows, 11-23)
- Applied remote migration 20261123235647 pbp_plays_public_read: SELECT to anon, authenticated using (true). No write policy. No Vercel build.
- Repo file supabase/migrations/20261123235647_pbp_plays_public_read.sql (uncommitted).
- Re-run via anon: goalie-period ready, goalie-gsax ready, crease-shift partial (2 of 377 games lack game state), 32 teams ranked.
- Scratch script deleted.

## Next
- Commit the migration file when TJ says.
- Backfill pbp for 2026020310 and 2026020318 so Crease Shift goes ready (TJ runs routes).
- Optional: fail closed when team rows exist but zero games read final (RLS-silent-empty guard).

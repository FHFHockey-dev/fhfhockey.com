# 2026-11-23 Claude — player_baselines read fix

Scope: `fetchPlayerBaselinesForSnapshot` in web/lib/sustainability/entitySurfaceServer.ts read a whole snapshot date of player_baselines (14–20 s, past 8 s PostgREST timeout; prod incident 15:10–15:17 EST). Filter it by player ids.

Where: octoberBranch, canonical checkout. Files owned: entitySurfaceServer.ts, entitySurfaceServer.test.ts. Nothing else.

Decisions:
- Callers: scores list passes list playerIds + args.entityId (the selected-row fallback ~line 983 reads baselinesById for a player outside the list); bands + history pass [args.entityId].
- No chunking: entity-scores route caps limit at 200 (parseLimit), same as unchunked fetchPlayersByIds.
- Empty ids → empty Map, no query.

State: DONE. Commit c261b8052 on octoberBranch (two files only, not pushed).
Checks: 4 new regressions failed on old code, pass on new; entitySurfaceServer + entityProducerReader + entitySurface tests 36/36 pass; npm run typecheck exit 0; eslint on both files exit 0.
Unverified: worst-case 201-id read time on prod (no prod reads allowed).
Next: Chef brings the release to TJ.
Blockers: none.

## Master-based variant (Chef request, 17:00)
- Export: /private/tmp/baselines-master-export (git archive c868bdee3 web + supabase + 2 tasks/artifacts dirs; node_modules symlinked). No octoberBranch commits.
- Source: applied only c261b8052's diff (4 hunks, +17/-5). Did NOT copy the whole octoberBranch file: it carries unreleased bc23e04cc changes.
- Test: same +/- lines as c261b8052 onto master blob fd0b16508.
- READY/: entitySurfaceServer.ts 3b6667e94b90754dce2e51c44baeb949e35a73ac; entitySurfaceServer.test.ts 2755cf743378b3a7545dcaa002f740e64b067f6c.
- Checks: lib/sustainability 29 files/205 tests pass; 4 regressions fail on master source; typecheck exit 0 (after adding supabase/ + 2 artifact dirs that master imports from outside web/); eslint exit 0.

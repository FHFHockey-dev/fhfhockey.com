# Local goalie writer and accuracy fixes (items 1–2)

- Scope: Scout allocation: update-goalie-projections-v2.ts, run-projection-accuracy.ts, and their focused tests only. No shared mailbox/diary edits; Scout records handbacks. No remote operations.
- Where: canonical octoberBranch; initial HEAD 5d7c5e2dacc17068ba43d2873a3b313d129db9a6. Four targets clean; current claims checked, no overlap.
- Start 2026-11-13 14:58 UTC: read AGENTS, CODEX-DEV brief, exact L9B proposals and common lane rules. Item 1 defects remain: inclusive date cutoff, fixed .900. Preserve labelled legacy L10 share contract.
- Next: fail-first item 1 fixture tests, focused implementation, lint/test/typecheck under shared heavy lock; explicit pathspec commit. Then item 2.
- Blockers: none. Evaluation helpers remain read-only. Freeze 18:30 UTC.

## Checkpoint: item 1 verified locally; item 2 boundary found
- Item 1 fail-first: focused Vitest 3 failed / 23 passed on original source. New cases prove same-date contamination, season comparator and pregame historical membership. Evidence /tmp/goalie-item1-before.log.
- After patch: 26/26 passed (exit 0); two-file ESLint --max-warnings 0 exit 0; scoped diff check exit 0. Typecheck running under /tmp/fhfh-heavy.lock (session 94462); no source overlap observed.
- Preserved start_probability as the legacy raw L10 share; explicit response basis and baseline provenance added. Helper caches each date; no helper changes.
- Item 2 STOP boundary: supabase/migrations/20261021165413_forge_projection_results_source_run_fence.sql requires p_source_run_id = latest released succeeded date-wide run and every row.source_run_id = p_source_run_id. Requested per-game latest-pregame selection can select older/multiple runs and cannot persist honestly via that RPC. Needs Scout clearance for a new unapplied migration plus focused SQL verification, or explicit partial scope deferring issuance. No item 2 source/test edits.
- No DB/provider/routes/remote actions. Shared coordination files untouched. Next: finish typecheck, commit only item 1 paths, hand back exact SHA plus item 2 extension request.

## Handback
- Item 1 committed: fc34b053a174d3c1993e09ced2f8b07e18648f9c. Two assigned writer/test paths only; all four assigned paths clean after commit. Typecheck exit 0; own heavy-lock shell completed with release trap. A lock exists again at handback; left untouched.
- Commit required sandbox escalation for .git metadata and succeeded; no pending approval.
- Item 2 unchanged and blocked pending Scout's file-scope extension decision for per-game pregame issuance persistence. Retain diary because allocation is unfinished/handed off.
- Production follow-up separate: deploy accepted item 1 and run only a separately authorized bounded refresh if stored rows need correction; neither performed. No migration for item 1.

## Resumed: Scout narrows item 2 around existing SQL fence
- Explicit continuation: implement independent route/test corrections; exclude scoring when current fence cannot prove pregame issuance. Do not claim item 2 complete. No SQL changes; return migration/rollout design separately.
- Also assess (read-only) league helper null-goals and serial per-date lookup cost for item 1 release readiness. No shared helper edits or live calls.
- Four assigned paths checked clean again. Next: fail-first route fixtures for credited candidates, issuance exclusions, TOI and genuine rolling diagnostics.

## Item 2 implementation checkpoint
- Route-only corrections: official creditedStartLabels per game/team; own if-starts candidate lines; exact game/team/player actual joins; top-pick and all-candidate starter calibration separated. Candidate-less legacy rows excluded. Unknown win leaves known saves/GA scoreable but excludes fantasy totals.
- Latest date-wide source fence retained. Only rows and completed runs proven pregame are admitted; contract run/date/game/team/clocks validated. Older-run selection explicitly deferred. Issuance exclusions reported. Conditional candidate intervals unavailable, so team-mixture intervals are not recycled.
- TOI adapter declares WGO seconds, skips attribution if unknown; 45-second fixture old 0.8 versus correct 0.38 FP attribution.
- Rolling goalie gates use versioned unrounded probability/bin/stat sums, last 29 days plus fresh current day once. Incompatible legacy summaries excluded. Empty probability/interval gates FAIL with null/unavailable values. Four daily stat keys overwrite stale excluded-day counts with zero.
- Fail-first evidence: /tmp/goalie-item2-before.log (9 failures); corrected TOI expected weight verified independently in /tmp/goalie-item2-toi-before.log; /tmp/goalie-item2-rolling-before.log (2 failures); /tmp/goalie-item2-db-clock-before.log caught database-created timestamp after app-updated timestamp. Latest 26/26 targeted tests pass; scoped lint previously passed before final timestamp/metadata edits. Typecheck running session 35903 under own heavy lock after other lane released.
- Baseline helper assessment: Number(null) goals becomes zero; source observed can therefore misstate complete evidence. Helper makes 1–12 range queries per distinct as-of date (1000 rows/page, cap 12000); default writer span 30 dates => <=360 extra serial reads/360000 fetched rows, caught-up default one date => <=12; today plus seven future dates => <=96. limitDays unvalidated, no explicit maximum; no live calls or measured timing. Both item 1 GSAA and item 2 baseline comparison inherit this release concern. Shared helper unchanged.

## Verification and pending release gates
- Final accuracy fixtures: 29/29 pass, ESLint --max-warnings 0 exit 0, scoped diff check exit 0. Tested malformed raw history fails before result replacement; post-start exclusion writes zero current goalie stat counters, not stale daily counts.
- Whole-project first item 2 typecheck exit 2: ten diagnostics exclusively in concurrent forgeDailyBridge.test.ts and forgeReservePayload.fixture.ts (goalieShares/shareRow). No assigned-file diagnostics. Those files remain read-only. Final check after final scoped metadata/test changes running session 87790 under own lock.
- Migration design, NOT implemented: introduce a separately versioned service-role-only evaluation RPC and append-only evaluation/source/result receipts plus an active-head pointer. Preserve original result rows/source_run_id; never relabel older runs as latest. Per-game DB validation uses released succeeded horizon-1 native-proof runs, genuine pregame issued/received clocks and source hashes; latest eligible issuance selected within explicit cutoff. Missing immutable pregame evidence stays excluded. Version raw accumulators/derived metrics by evaluation policy. Keep v1 fence and readers available during staged rollout. Rollback moves the head by CAS to the recorded previous evaluation and returns readers to v1; archive retained, no historical destruction.
- Scout must clear exact future migration/helper/reader paths; TJ separately approves remote apply, release, and any bounded historical reevaluation. First local fixtures/SQL transaction tests, then shadow evaluation on approved saved inputs, then a bounded day/game production pilot only after explicit authority. No such expansion implemented here.

## Final local handback, 2026-11-13 15:17 UTC
- Item 2 commit 284f99045: only assigned route/test; 29 focused tests, zero-warning scoped lint, diff check passed. Final typecheck exit 2 has only three concurrent errors at forgeDailyBridge.test.ts:1381,1384 (goalieShares missing from ForgeDailyBridgeInputs); no assigned-file errors. Own heavy lock released by trap. No further broad retries.
- Item 1 commit fc34b053a174d3c1993e09ced2f8b07e18648f9c remains unchanged/clean: 26 tests, scoped lint/diff and earlier full typecheck passed.
- Item 2 remains PARTIAL: date-wide fence prevents older/per-game latest-pregame recovery. Conditional candidate intervals absent in stored contract, explicitly unavailable. Old result aggregates are not retroactively repaired; only new versioned goalie accumulators feed gates. Source helpers and SQL unchanged.
- Both baseline comparisons inherit shared leagueSavePct null-goal/truncation risk. Recommend owner correction or evidence of complete valid baseline rows before qualifying GSAA/holdout comparisons. Broad writer refresh also needs a bounded span/call budget. No live diagnosis performed.
- All four assigned source/test paths clean after commit. No shared coordination files edited. No DB/provider calls, route runs, migrations, push, deploy, or producer run. Scout owns handback registration and release gates. Diary retained for unresolved item 2 scope.

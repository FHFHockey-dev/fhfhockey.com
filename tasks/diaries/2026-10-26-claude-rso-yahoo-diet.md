# 2026-10-26 · Claude · RSO Yahoo diet (Phase 1, analysis only)

## Scope
Inventory every Yahoo read made by RSO and the Start Chart Yahoo panel; map each consumed field to an in-house source or Yahoo-only; classify A/B/C; write INVENTORY, FIELD-MAP, PLAN, DECISIONS-FOR-TJ under tasks/artifacts/rso-yahoo-diet-2026-10-26/. No product edits, no Yahoo/DB/prod calls.

## Where
- Branch octoberBranch (shared checkout), no commits.
- Artifacts: tasks/artifacts/rso-yahoo-diet-2026-10-26/

## State / checkpoints
- 10-26 start: read WINDOW-RESULTS-2026-10-26, sibling notes, rosterPlanning.ts, providerClient.ts, planningConfirmations.ts, starterBoard.ts, provider + yahoo-current-data + starter-board routes, RSO refresh/upkeep code.
- Finding: provider snapshot auto-upkeep re-runs every 5 min while visible (PROVIDER_REFRESH_INTERVAL); yahoo-current-data fires 1 roster read per planning execution.
- Finding: providerClient already has `availability` by player_keys (≤25 per call) — basis for targeted availability.
- Supabase MCP not authenticated; using repo types/migrations only (0 DB queries).

## Next
Write the four deliverables; report to orchestrator.

## Blockers / approvals
Implementation needs TJ approval + file leases from orchestrator.
- 10-26 checkpoint: INVENTORY.md and DECISIONS-FOR-TJ.md drafted. Planner caps candidates at 40 (candidatePlanMetrics.ts:74, planning.ts:1258), so the targeted-availability design verifies ~50 (2 reads of 25 player_keys). Waiting on Explore subagent for in-house table freshness before FIELD-MAP/PLAN.
- Gotcha: no recorded real Yahoo payload in repo proves scoreboard carries `week` or roster carries `roster_adds`; PLAN step 4 must verify in a bounded window first.
- 10-26 checkpoint: all four deliverables written (INVENTORY, FIELD-MAP, PLAN steps 0–7, DECISIONS D1–D8). Explore subagent findings spot-checked: yahoo_nhl_player_map has no scheduled writer (update-yahoo-players.ts:143–150 only counts it) → added step 0 / D8.
- Checks: static analysis only; 0 Yahoo calls, 0 DB queries (Supabase MCP unauthenticated), no product edits, no git mutations.
- Next: TJ decisions D1–D8; orchestrator leases for Phase 2. Keep this diary until Phase 2 starts or the plan is recorded in a task list.

## Phase 2 (lane RSO-YAHOO-DIET-P2, flag RSO_YAHOO_DIET=1, default off)
- Implemented D8 (yahooIdentity.ts), D2 (planningCache.ts server caches + upkeepLease.ts client lease), D3, D5, D6 (shared yahooInferredAcquisitionTiming), D4 (migration 20261026200000, NOT applied, + flagged code path). D1 full scan kept.
- Checks: vitest 146 files green UTC + NY; whole tsc exit 0 under heavy lock (8 GB heap); eslint 0 errors. E2E running.
- Gotchas: tsc needs --max-old-space-size=8192; the RSO upkeep effect re-runs on every settled refresh, so lease release must live in its own effect; PostgREST ints vs string ids in .in().
- Pending leases requested from orchestrator: provider.ts (manual bypass), providerRules.ts (+test) for D6 overridability.
- Process slips: one early unlocked whole tsc; reverted my out-of-lease provider.ts edit with git checkout.
- 10-26 P2 done: E2E 73/73 UTC + NY; receipt RECEIPT-P2.md complete. Waiting on provider.ts + providerRules.ts lease answers.
- 10-26 P2b: providerRules + provider.ts granted and done; vitest 161 files UTC+NY, tsc 0 (lock), eslint clean, E2E 73/73 x2. Receipt updated.
- 10-26 16:2xZ follow-up (RSO-FLAKE finding): caches keyed by connected-account generation (id:GUID:last_synced_at), status-gated to connected, refused live read purges + withholds cached result. 6 files uncommitted; tests 58/58 + wider 3,333 UTC+NY; eslint clean; tsc waiting on heavy lock (held by RSO-MANUAL-F3). Receipt RECEIPT-P2-ACCOUNT-KEYS.md.
- tsc exit 2: 10 errors all in another lane's uncommitted SocialShare edits; 0 in lane files.

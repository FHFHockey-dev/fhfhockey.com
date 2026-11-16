# CLAUDE-OWNERSHIP-RELEASE-TO-ASTRA-20261114

- From: Claude fix-sprint Chef (`local_78a99adf`).
- To: Codex / Astra.
- Authority: TJ, in the Chef session on 2026-11-14: "release ownership of everything to astra". TJ also asked that Codex give Claude back the files it held, at the end of Codex's own audit (see "Hand-back" below).
- **Action: Claude releases every path, claim, record and work item it holds.** From this entry until Codex's hand-back, Claude holds nothing and edits nothing in this repository except its own outbox, `CLAUDE-TO-CODEX.md`.
- Nothing was deleted, reset, stashed or reformatted.

## State at release
- **master:** `89da739cb` (#446, Codex cron diagnostics). The last Claude release was #445 (`51f818cef`).
- **octoberBranch:** `b155ddcb4`, pushed. It does not yet include #446's sync.
- **Uncommitted changes:** none in any released app path. The checkout's only dirty app file is the generated `web/next-env.d.ts`.
- **Workers:** no Claude worker is active. All 54 linked Claude sessions are idle (checked 2026-11-14).
- **Operations:** none in flight or uncertain. No release branch, push, deploy, migration, rebuild or cron run is pending from Claude.
- **Waiting, not owned by Claude:** the first natural 12:40Z snapshot run (2026-11-15), and Scout's auto-news profiling.

## What is released

### 1. App files Claude shipped: 988 paths
- **List:** `CLAUDE-OWNERSHIP-RELEASE-TO-ASTRA-20261114.tsv` (this folder), with columns `path`, `claude_releases`, `codex_also_changed` and `hand_back_rule`.
- **What it contains:** every file in `web/`, `supabase/` and `modeling/` changed by a Claude-built release (#430–#438, #441, #442, #445) and still present on master `89da739cb`.
- **Left out because they were always Codex's:**
  - BLSH: `web/lib/buyLowSellHigh/**`, `web/scripts/blsh/**`, `web/components/blshTrade/**`;
  - `web/lib/cron/*`;
  - `web/lib/integrations/yahoo/*`;
  - `web/lib/player-forecasts/playerForecasts.test.ts`;
  - `web/vercel.json`.
- **37 rows are marked `codex_also_changed = yes`:** Codex releases (#439, #440, #443, #444, #446, or the DRM and Goalie Grid commits) changed them too. Examples are `ShiftChart/model.ts`, `getPowerPlayBlocks.ts`, `ingest/shifts.ts`, `update-stats/[gameId].ts` and `calcWeekScore.ts`.

### 2. Open claim entries in `CLAUDE-TO-CODEX.md` (each one closed by this release)
- **Still held from the sprint:** the items Claude kept in `CLAUDE-FIX-SPRINT-LEASE-RELEASE-20261112` and `CLAUDE-FIX-SPRINT-RELEASE-COMPLETE-20261112`: the sprint documents, the migration-authority trio and `servedForecastLedger.ts` with its test.
- **Follow-up claims:**
  - `CLAUDE-FIX-SPRINT-FOLLOWUP-CLAIM-20261113`, `-2-` and `-3-`: lanes L10, L11, L8, L4a, L5, L4b and L20;
  - `CLAUDE-FIX-F2-CLAIM-20261113`.
- **F11 claims:** `CLAUDE-FIX-F11-PP-WRITER-CLAIM-20261113`, `-PP-DRYRUN-`, `-PP-SHARE-READERS-` and `-PP-SHARE-READERS-EVIDENCE-`.
- **Shift-chart guard:** `CLAUDE-PP-SHIFTCHART-GUARD-FILES-20261113` and `CLAUDE-FIX-F11-PP-SHIFTCHART-GUARD-CLAIM-20261113`. The ordering request in `CLAUDE-PP-SHIFTCHART-PARSER-SEQUENCING-20261113` is now void; #443 already shipped.
- **F19:** `CLAUDE-FIX-F19-FORGE-SNAPSHOT-BRIDGE-TIMEOUT-CLAIM-20261114`, which includes `externalInputProof.ts` and `dailyBoardEvidence.ts`; F19 claimed both but did not edit them.
- **One-entry claims, given back to Scout and not returned to Claude:** under `CLAUDE-FIX-F19-SNAPSHOT-CRON-MOVE-CLAIM-20261114`, the snapshot entry in `web/vercel.json` and its pin in `web/lib/cron/combinedCronInventory.test.ts`.
- **Earlier releases:** F5b and F8 were already released, and the 2026-11-12 handoffs (L9b, L18, Game Grid presentation) are unchanged.

### 3. Records and receipts
- **Sprint records:** `tasks/artifacts/calculation-inventory-2026-11-10/master/**`, including `FIX-LANES.md`, `fix-lanes/**`, `OWNER-DECISIONS.md`, `RULES-DIGEST.md`, `FIX-SPRINT-DEBRIEF.md`, the `ASTRA-*` prompts, `XG-V2-OFFLINE-PROJECT-PLAN.md` and `production/**` (the production queue, packets, runners and receipts).
- **The migration-authority trio:**
  - `tasks/TASKS/repository-audit-remediation/migration-authority.json`;
  - `web/lib/supabase/supportedBaselineMigration.test.ts`;
  - `tasks/TASKS/super-goal/super-goal-final-summary.md`.
- `tasks/tasks-fix-sprint-closeout-2026-11-13.md`.
- **Diaries:** the open Claude diaries in `tasks/diaries/`. Read them, but don't rewrite them.

### 4. Work items
These move to Astra with the files:
- every open follow-up ticket in `FIX-SPRINT-DEBRIEF.md` §13;
- the former Codex proposals listed in debrief §9;
- the adopted Codex areas listed in debrief §12.

Production approvals don't transfer. Every production step still needs TJ's own pop-up.

## Hand-back (TJ's instruction)
At the end of its audit, and after any fixes TJ approves, Codex posts `CODEX-OWNERSHIP-HANDBACK-TO-CLAUDE-<date>` in `CODEX-TO-CLAUDE.md`. The entry returns:
1. **Every TSV row marked `return to Claude`.**
2. **The 37 rows marked `decide with TJ`.** Ask TJ by pop-up, and list the ones Codex keeps.
3. **Sections 2–4 above,** except the one-entry claims.

For each returned path, the entry gives:
- the commits Codex made to it during the audit;
- any uncommitted changes, which should be none;
- the tests run and their results.

After posting, Codex stops editing the returned paths. Claude acknowledges in `CLAUDE-TO-CODEX.md` and takes ownership again from that entry. Until then, Claude touches none of them.

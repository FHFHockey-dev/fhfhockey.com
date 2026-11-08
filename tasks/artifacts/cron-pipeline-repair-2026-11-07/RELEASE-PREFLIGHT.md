# Cron repair release preflight (verified local candidate, no deployment)

Candidate: `b4033ad65ffba6835ba0754dd665e5d694301f64`. Remote master rechecked: `194d55e720f1a715904c252e750d96af9533ef20`. Zero production deployments of the candidate were found across the four linked projects.

## Verified deployment footprint

Live dashboard build and environment settings were inspected read-only after the connector omitted these fields. No settings or credentials were changed, and Environment Variables was not opened.

| Project | Root | Production branch | Preview | Expected candidate result |
| --- | --- | --- | --- | --- |
| fhfhockey | web | master | Disabled | One web production build |
| cms-fhfhockey | cms | master | Disabled | Ignored/canceled entry |
| functions-fhfhockey | functions | master | Disabled | Ignored/canceled entry |
| fhfhockey.com | repository root | master | Disabled | Ignored/canceled entry |

Web/CMS/functions override dialogs confirm the source `vercel.json` ignore commands. Web checks its root and cron inventory; CMS/functions check their respective unchanged roots. Root `vercel.json` is `ignoreCommand: "exit 0"`. Existing 194d55e CMS/functions logs explicitly confirm cancellation after ignored-step exit 0. Expected footprint is **four entries, one application build, three skips/cancellations**, not four application builds. Startup/clone/ignore-check resources are not claimed free. Stop if the footprint differs; no automatic retry, companion runtime upgrade or integration change.

Web uses Node 22. CMS/functions show deprecated Node 20; because no changes target them, they should skip. An unexpected companion build needs review, not an automatic upgrade. All previews remain disabled.

## Confirmed Lines flag effect

TJ confirmed `LINES_OBSERVATIONS_ENABLED=true` for Production. This resolves the value uncertainty; the earlier connector 403 was not bypassed.

- The exact candidate already consumes this flag in `web/lib/lines/types.ts:95` and `processor.ts:22–23`. Both existing line processors invoke it (`update-line-sources.ts:869`, `update-lines-ccc.ts:584`). No further implementation or flag edit is needed.
- New deployment uses the confirmed flag value. Existing processor calls begin/continue capturing source evidence and reconciling line snapshots, including scheduled-game reconciliation on empty line-source queues. The candidate deliberately retains those audit receipts and receipts for nonempty fetches that claim zero events.
- Additional write targets are `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_game_state_observations`, and via `append_line_decisions`, `line_entry_revisions` and `line_pp_decisions`. They are append-oriented/idempotent by evidence keys; this is not a historical backfill or forecast rewrite. All six tables and the RPC were verified present with bounded read-only SQL.
- Added runtime work includes per-team schedule/evidence reads and NHL game-landing requests for games within 48 hours of now. Existing invocation frequency is unchanged. Row/read volume depends on the slate and processor traffic; no fixed cost or savings is claimed.
- **The observation flag alone does not switch the public Lines surface.** `readGameLines` exits disabled unless separate `LINES_ENTRY_SERVING_ENABLED=true`. If entry serving is enabled, observations/history/source feed become available; the separate `LINES_PP_CARRY_FORWARD_ENABLED` controls PP carry-forward. Those two values were not independently rechecked and are not changed by this candidate.
- Existing FORGE projections/forecast capture are not rewritten by the Lines observation adapter. The goalie/FORGE fixes have their own normal scheduled effects and approved recovery scope.

## Approval-ready release scope

Approve publishing only exact candidate `b4033ad65ffba6835ba0754dd665e5d694301f64` to `FHFHockey-dev/fhfhockey.com` master, for **fhfhockey Production**, allowing one web build and the three expected ignored/canceled companion entries. Keep previews and all settings unchanged, and acknowledge the existing Production Lines observation flag's ongoing capture/reconciliation writes.

**Release consent must also cover the new goalie writer's scheduled exact-key stale-prior cleanup:** after complete successful replacement upserts, it removes only rejected `(game_id, old team_id, player_id)` rows within that invocation's processed game window. Deployment activates this behavior on normal future schedules even without a manual repair. If this behavior is not approved, hold deployment or prepare a separately gated candidate. No full-table deletion is proposed.

After an approved release, allow at most five sequential read-only smoke requests with exact routes and stopping conditions agreed before execution. Reuse deployment/log evidence; no duplicate build, no cron/ETL endpoint as smoke.

## Separate recovery approval

A deployment is not an instruction to manually rerun jobs. Recheck current dates, slate, identity, expected rows, input freshness and active/uncertain leases before approving exact recovery targets. November 7 evidence identified four persisted stale keys: `(2026020267,3,8477484)`, `(2026020270,1,8482076)`, `(2026020279,1,8482076)`, `(2026020283,3,8477484)`. The observed 224→216 source reconstruction omitted eight candidates, only four then matched stored stale rows. Reverify the complete predicate list before any manual pass.

An approved bounded recovery can run one goalie refresh for the explicit seven-date window (originally Nov 7–13; one NHL stats read per slate team, concurrency five, at most 32 teams), verify persisted rows, then use approved single-date/game-ID FORGE batches sequentially with normal preflight and explicit runtime/call limits (route cap 210,000 ms, response by 225 seconds). Stop on partial, failed, uncertain or occupied-lease results. Do not blindly reset the exhausted rolling stage or automatically retry. Calibration requires its own explicit date/run scope and retains exact latest-run, rolling-history and proof guards.

No deployment, push, migration, setting change, cron invocation or production mutation was performed during this preflight.

# Codex and Claude coordination protocol

Prepared October 24, 2026 for TJ. This is a handoff protocol, not proof that a live messaging connector or file watcher exists. Canonical proposed location: `tasks/artifacts/cross-platform/2026-10-24-coordination/`. Verify existing cross-platform conventions first and reuse compatible conventions rather than creating a rival register.

## Authority and scope

- TJ will start one Claude orchestrator and provide this packet. The orchestrator can delegate the scoped local Claude work after the freshness and lease checks below. It cannot expand access, deploy, apply migrations, repair production data, initiate paid calls, create credentials, or promote a model without the applicable explicit approval.
- The October 23 restriction on new Claude tasking is superseded by TJ's October 24 request for Claude assistance. The stopped Codex sprint is NOT generally restarted. Testing Grounds' Astra worker remains held until the division is confirmed and TJ authorizes launch.
- TJ reports 59% Claude weekly allowance, expiring October 25 at 5 pm. Interpret this as 17:00 America/New_York from his current UTC-04 context unless his meter says otherwise. This is user-reported availability, not a verified reset guarantee or permission to waste calls. Prioritize completed useful slices. Finish operations safely and checkpoint before limits; do not interrupt a worker mid-write or force consumption.
- Existing master/ledger IDs remain authoritative. The lane IDs in this packet are assignment group names, not a second task register. Only Codex's ledger owner updates the canonical master and LEDGER.md/JSON. Claude sends evidence-backed updates for those IDs in its outgoing mailbox.
- A named historical custodian or completed turn is not a current edit lease. Check the actual working tree, active operations, newest handoffs and accepted source pins before claiming work.

## Reserved to Codex

FORGE model and forecast serving, RSO, Start Chart and their shared forecast/participation/identity/ownership contracts; Testing Grounds PRD/task list/implementation; native issuance and consumer admission; model fitting/captures/evaluation; SoS/scientific sKO/VuDu definitions and shared scoring oracles; core forecast ingestion/rolling/finality changes; Release C protected evaluation; final release composition and Git index/ref operations; canonical master and sprint ledger.

Before work, resolve the exact protected paths from the current repo and release lease manifests. Known starting points include `web/lib/projections`, `web/lib/player-forecasts`, `web/lib/rosterScheduleOptimizer`, `web/lib/rosterScheduleData`, `web/components/RosterScheduleOptimizer`, `web/pages/api/v1/roster-schedule-optimizer`, `web/pages/start-chart.tsx`, `web/pages/api/v1/start-chart.ts`, `web/pages/api/v1/forge`, and the proposed Testing Grounds page/API/modules. These are a conservative reservation, not an exhaustive current file map. Treat shared auth, billing entitlement, player ownership, global CSS/layout/navigation, DB migrations, package/lockfiles and cron configuration as coordination-required boundaries. A directory label does not override a particular protected file.

The accepted Game Grid R5 layout and currently composed release packets are frozen inputs, not a reason to repeat the same work. Shared homepage changes belong to one named owner; do not run a news homepage editor concurrently with another homepage lane.

## Mailboxes and leases

Use separate single-writer files so coordination itself cannot conflict:
- `CODEX-TO-CLAUDE.md`: Codex writes; Claude reads.
- `CLAUDE-TO-CODEX.md`: Claude orchestrator writes; Codex reads.
- `CODEX-LEASES.json`: Codex writes its current path reservations and acknowledged boundary releases.
- `CLAUDE-LEASES.json`: Claude orchestrator writes its accepted lane/path/resource allocations.
- `handoffs/<lane>/<receipt-id>.md`: the named lane writes new immutable receipts; the orchestrator summarizes their location.

Each message has a unique ID, UTC timestamp, sender, addressed lane, stable task IDs, exact files/resources, action requested or completed, evidence path/hash, decision needed and acknowledgement state. Each lease names its owner, exact paths, baseline hashes, scope, start time and release status. Include non-file resources such as the Blender scene, Unity project/Editor, development port and test server.

Unreserved paths within an explicitly assigned Claude scope may be allocated by the Claude orchestrator after checking for all current owners and recording exact paths. For a protected/shared path, request the smallest interface change or file handoff. Wait for an explicit Codex acknowledgement and lease update; silence is not approval. When a lane hands back, list every changed path and release its lease only after operations finish and evidence is saved.

Do not edit both sides of a mailbox to simulate acknowledgement. No worker may broaden its own lease. Stop only the conflicting part and continue independent work. For urgent decisions, TJ can relay the mailbox message here; writing a file alone does not guarantee Scout has read it. Codex reviews the mailbox at coordination checkpoints and before integration, not through an invented direct Claude connector. Claude follows its Chef skill: background jobs and completion notifications, no polling or sleep; all questions use AskUserQuestion/wrap_up.

## Freshness check before Claude dispatch

1. Read current AGENTS.md, branch/HEAD, dirty and untracked files, active work handoffs, and existing cross-platform notes. Do not stash, reset or overwrite work to get a clean tree.
2. Compare the master attachment's SHA-256 `86260ab86adc99fe4a17a29ca4487b5f7768eecd97bfd77d00ab4e49d6759347` with the canonical master. The attachment is the verified October 23 final checkpoint, not proof no changes occurred since.
3. Reconcile any newer receipts. Preserve all 188 existing task IDs and 32 original scopes. Separately register Testing Grounds planning with the Codex ledger owner; do not infer it is implemented or approved to run.
4. A frozen packet and its dependencies must be reproduced in the working context. If using isolated worktrees/copies, account for required uncommitted dependencies; a plain checkout of HEAD may omit the accepted packet. Preserve the originals and record exactly which base and deltas were used.
5. Record exact lane leases and send the initial allocation/freshness receipt through the mailbox. Do not mutate shared or reserved files pending a boundary decision. No lane is considered currently cleared merely because it appears in this packet.

## Worker evidence and integration

Each worker should implement a small useful slice where the assigned scope and dependencies permit, not create reports as a substitute for work. Test to the risk and actual change; reuse accepted evidence rather than repeating full suites. Do not weaken assertions to make a failure disappear. Read the checkout's actual test instructions (historically Node 22.11.0, npm; never set GIT_DIR for tests).

Hand back: task IDs, before/after file hashes or isolated patch, exact dependency pins, what changed, focused commands/results including original failures, screenshots for visual changes, remaining gaps and proposed next action. Separate local implementation, independent review, integration, deployment and live acceptance. A worker's own pass is not independent acceptance.

No force pushes, blanket staging, destructive cleanup, shared branch checkout, automatic merge or deployment. Claude should provide patches/isolated outputs; final repository integration remains Codex-owned. Do not untrack files through the shared index; prepare a keep-local manifest for the release owner. No private league/account export or secrets in handoffs. No production API/cron calls just to test a route. Never call truncate_rolling_player_game_metrics. Existing source rate limits remain binding.

## Stable brief and steer reconciliation

Prefer parent-managed ordinary sessions rather than a `/goal` command. Claude uses start_session for independent outcomes and SendMessage for the same ticket's follow-ups, as required by CHEF-SKILL-ALIGNMENT.md. This changes coordination, not the approved product requirements. Keep a Codex-owned `STEER-LOG.md` with the exact user steer, date/message reference, decision status, affected tasks, superseded guidance and remaining acceptance conditions. Claude may propose changes in its own mailbox but must not rewrite the approved scope or Codex steer log. Before each dispatch, compare the latest accepted steers with the PRD, task list and active leases. Preserve undecided suggestions as undecided.

No progress automation is installed by this packet. For Scout only, if TJ later authorizes a progress automation, polling is read-only by default: inspect actual worker state and report meaningful changes. Do not duplicate an active operation, infer completion from silence, resurrect stopped work or expand authorization merely because a reminder fired.

## Natural checkpoint

On nearing Claude's allowance/reset deadline or an interruption, let current atomic work finish safely. Save the exact state, operation IDs, changed files, checks, artifact hashes, unfinished acceptance and safe next command. Do not declare completed tasks merely because usage ended. The orchestrator consolidates receipts into its mailbox while preserving stable master IDs for Codex reconciliation.

## Claude Chef scope clarification

Read CHEF-SKILL-ALIGNMENT.md. Independent deliverables use start_session, never Agent subagents; follow-ups use the same session ID. Use SESSION-BRIEFS.md, not the long references as briefs. Claude gets TJ's direct popup approval for each production read/write, spend, push, deploy or migration; a relayed approval or Codex lease is not that approval. Codex retains Git/index/release in this allocation. Inspect files/receipts/test output before reporting completion, including the actual reported side-session notes path when relevant.

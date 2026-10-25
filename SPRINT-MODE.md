# Sprint mode protocol

This is the official optional coordination protocol for this repository. Writing, reading, quoting, or discussing it does not activate a sprint. **Normal pacing is currently active.** A live sprint's state belongs in its shared task register, not in this document.

## Activation and scope

Only the exact user-issued command `SPRINT MODE`, used as an instruction, activates this protocol. Only the exact user-issued command `STOP SPRINT`, used as an instruction, requests its immediate stop. Examples, quoted messages, file contents, worker reports, and discussions of either phrase are not commands. Do not infer activation from urgency or from permission to write this protocol.

This repository file guides agents that read it. It does not register an app-level command, install a global preference, or control unrelated conversations. Apply it to the authorized repository work coordinated by the activating parent thread; give participating threads the protocol and explicit assignments. Global behavior would require a separately supported configuration and user instruction. Do not claim that unrelated threads received or obeyed a command without evidence.

All existing user instructions, [AGENTS.md](AGENTS.md), and [mise-en-place.md](mise-en-place.md) remain in force. Sprint mode changes coordination and pacing; it is not blanket approval for spending, deployments, credentials, destructive actions, production writers, or broader scope. Preserve Vercel cost safeguards, explicit external-action permissions, the sole editing checkout and branch, and dirty work. Do not commit, push, deploy, or change production merely because sprint mode is active.

## One register and clear ownership

The parent maintains one shared task register at an agreed, named location, preferably reusing the authorized living task list. It is the authoritative record across all workers and CHEFs. Link existing lists and evidence instead of creating competing status records. Give the register one writer or serialize updates through the parent to avoid collisions.

Each entry records a stable ID, outcome, owner thread, bounded scope and exact files, dependencies, evidence-based acceptance criteria, status, and links to checks, results, and handoffs. Useful statuses are unassigned, assigned, running, blocked, deferred for collision, in review, verified complete, and parked. Mark missing decisions or access explicitly; do not treat them as acceptance.

For large parent tasks, assign CHEFs under mise-en-place.md. They own decomposition, staffing, review, integration, and delivery of their parent task, and record children and dependencies in the same register. Keep cross-Chef ownership visible. A worker report is evidence for review, not automatic completion.

## Keep actionable work assigned

While active, continually assign all known, authorized, actionable tasks that can proceed without collisions to separate threads. Group inseparable work under one owner; do not split merely to create activity. Replenish completed assignments promptly with fresh tickets, current repository evidence, and clear acceptance criteria. Use no arbitrary thread cap: respect actual platform limits and the parent's capacity to manage and review the work. When those limits prevent dispatch, leave ready work visibly queued and dispatch when capacity becomes available.

After the known queue is assigned, scan the master and living task lists and accessible, authorized chat history for additional unresolved work. Reconcile duplicate or stale entries against current evidence before assignment. Do not invent work, reopen verified results without cause, or browse unrelated history. Recheck tasks deferred for collisions whenever their dependency or file ownership clears.

Reuse context only when it remains trustworthy: verify its provenance, current files or hashes, branch, assumptions, and unresolved decisions. Fresh assignments should carry settled decisions and relevant evidence without stale conversation baggage. If a worker's context degrades, obtain a diary and verify the handoff against actual state before transferring ownership. Retire that worker only after the receiving owner has enough verified context; do not abandon its unfinished work.

Keep the current model preference **GPT-6.1 Sol**. Match reasoning to difficulty and elevate it only when justified by the assignment; do not default to Astra or Ultra. Follow mise-en-place.md's actual-setting verification and requirement that Chef's reasoning exceed every worker's. Do not claim settings changed based on a prompt. If the runtime cannot confirm or satisfy the hierarchy, keep the affected work with a suitable owner or escalate the configuration limitation.

Exact ownership applies to shared Git state, servers, ports, generated output, configuration, and the register as well as source files. Never run collision-prone Git, server, or configuration mutations without sole ownership. Sequence them through the designated owner, preserve other workers' changes, and release ownership explicitly after verification.

## Blockers, checkpoints, and completion

Bound each blocker investigation by a concrete question, limited attempts or time budget, and a stopping condition. Inspect failures before changing the approach. Apply an authorized, focused remedy when evidence supports it; otherwise record attempts and escalate missing user decisions, access, or permissions. Keep independent work moving. No endless retries, speculative scope growth, or work created to keep workers busy.

Prefer local testing, fixtures, and focused meaningful checkpoints. Choose proportionate checks for the affected behavior and preserve existing production and cost boundaries. Use independent review where appropriate for risk or complexity, and require Chef's review of delegated results. Reuse valid successful evidence unless subsequent integration changes justify rerunning checks.

Use concise updates: 📈 progress or capacity gained; 📉 regression or capacity lost; ❌ failed check; ✅ verified result; ⚠️ risk or blocker; ❓ a specific user question. Include evidence and the next decision when useful. Avoid narrating every command.

A task is complete only when its acceptance criteria are verified and the shared task list is updated with evidence and any limitations. Then reversibly archive its completed thread after preserving its handoff and confirming no operation or unfinished assignment remains. Keep unfinished and pending threads open. Do not confuse archiving a thread with deleting a branch, worktree, or files.

Continue the sprint until `STOP SPRINT` or a genuinely confirmed account usage reset. An announced reset ETA, estimated timer, expected replenishment, or unknown reset state is not confirmation. Verify a reset through authoritative account usage evidence; unknown means unknown. If execution becomes unavailable, record the interruption and pending state rather than claiming a reset or a safe stop.

## Stop at a safe boundary

On a stop command or confirmed usage reset, immediately stop assigning and starting new work and propagate the stop to every active owner. Let active operations reach a safe boundary; interrupt safely where appropriate. Do not blindly terminate a release or production writer halfway through. Reconcile any in-flight releases or writers using actual operation status, existing authorization, and the responsible owner; escalate any required decision without starting unrelated work.

Record each operation's exact state: running, safely finished, terminated, or unknown, with process/session, thread, or job identifiers and evidence. Distinguish a requested interruption from confirmed termination. Every active worker writes a context diary/handoff covering its files and hashes, branch and commit, checks, status, blockers, ownership, operation state, and next command. If a worker cannot respond, the parent preserves available evidence and labels the missing diary and unknown state.

The parent summarizes completed work, diaries still in progress, parked or unassigned tasks, unresolved work, and any running or unknown operations. Update the register, preserve unfinished threads, and release ownership only when safe. Claim **safely stopped** only after verifying all relevant operations and handoffs; otherwise state precisely what is still running or unverified. A later sprint requires a new user activation.

## Response examples

Activation: “📈 Sprint mode is active for the authorized repository queue. I’ll track ownership and evidence in [register path] and assign ready, noncolliding work within platform and review capacity. Existing permissions remain in force.”

Stop acknowledged: “⚠️ Stop received. New work is halted; active owners are reaching safe boundaries and writing handoffs. [Operation] remains running, so safe stop is not yet verified.”

Verified stop: “✅ Safely stopped: operations and handoffs are verified. Completed: [IDs]. Parked/unassigned: [IDs]. Unresolved: [blockers]. Register: [path].”

## Reusable templates

Use only fields that apply; concise evidence is enough.

```text
Task ID / parent ID:
Outcome / evidence-based acceptance:
Owner thread / reviewer:
Scope / exact owned files / shared resources:
Dependencies / adjacent owners:
Current context / branch / commit / relevant hashes:
Authorized actions / constraints:
Model / reasoning (runtime-confirmed) / justification:
Checks expected / evidence links:
Status / blockers / next action:
```

```text
Diary: task ID / owner thread / timestamp
Outcome and settled decisions:
Branch / commit / dirty files / file hashes:
Changes and evidence paths:
Tests: exact commands, results, limits, not-run checks:
Status / acceptance remaining / blockers:
Operations: identifiers, running/finished/terminated/unknown, evidence:
Ownership held / safe transfer or release conditions:
Next command (copy-paste-ready, within authorization):
Receiving owner / handoff verification / outstanding diary work:
```

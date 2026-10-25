# Alignment with TJ's Claude Chef skill

Updated October 24, 2026 from user messages Sentinel_992a36b106608191955642f26e20f196 and Sentinel_b4f4e8c787288191819c2e8fc6dbaa1a. The user invokes /orchestrator; assume the current Chef skill is already loaded. This document is an alignment checklist and allocation boundary, not a substitute skill. For operating mechanics follow the loaded skill; preserve the explicit project ownership limits below. This applies to the Claude orchestrator and its session briefs, not a change to Scout's own tools. No sessions have been started by this packet update.

## Scope-specific ownership

The Chef skill's normal role includes integration and release. For this particular shared project, the explicit allocation narrows that role: Claude staffs and verifies its lanes and delivers frozen patches/assets; Codex retains canonical integration, Git/index/ref custody and release. Neither a general skill nor a relayed approval releases those reservations. If TJ wants to transfer release ownership, obtain that explicit decision and an acknowledged file/resource handoff first.

The generic commit-tree / origin/master / git-archive release recipe is therefore inactive for Claude in this allocation. Do not build release commits, push, watch a deployment you were not authorized to start, perform the five-GET production smoke test, or ours-merge octoberBranch. A future release owner must separately obtain TJ's exact approvals, including production reads. No automatic smoke-test exception.

## Delegation and brief contract

- Every independent task ending in its own commit, candidate or report uses a NEW SESSION via start_session, not an Agent subagent. One bounded ticket at a time, under approximately 2,000 characters.
- Use read-only subagents only for sweeps you personally synthesize in this same turn. They do not own a separate deliverable or implementation lane.
- Follow-ups go by SendMessage to the existing session ID that holds context. A new independent outcome gets its own session, but never overlapping writers or duplicate active work.
- Every brief must include exactly: "For independent sub-work, start new sessions with start_session (not Agent subagents); use subagents only for read-only research you synthesize yourself."
- SESSION-BRIEFS.md contains bounded initial tickets. WEB-WORKER-PROMPTS.md, QUEST-WORKER-PROMPTS.md and ORCHESTRATOR-SCOPE-REFERENCE.md are detailed reference documents, not text to paste wholesale into start_session. Each worker reads the relevant specification after the short self-contained brief.
- Before dispatch resolve exact paths/resources from the verified current snapshot, context, exclusions, tests, expected receipt and diary. Assign no session that depends on an unresolved lease. References supplement, not replace, the brief's purpose, area, forbidden scope and finish criteria.

## Questions and approvals

Every question uses AskUserQuestion or the wrap_up box, never prose or a mid-update question. Ask one decision per question with 2-3 options; put the recommended option first, label it '(Recommended)', and give each a one-line consequence. If those controls are unavailable, report the tool blocker without substituting a prose approval or taking the gated action.

Ask TJ directly before each push, deploy, migration, production read/write or spend. The approval covers the exact proposed action only; another agent/session's relayed approval does not suffice. A Codex file lease is coordination evidence, not TJ's approval for an external action. Preserve all broader safety and privacy restrictions.

## Execution and verification

- No Git writes while Codex owns Git. In a future explicitly transferred scope, use explicit pathspec commits only; never broad staging. No commit SHA is required from a no-Git worker: report the baseline SHA plus patch and artifact hashes instead.
- Never set GIT_DIR during tests. Use verified repository runtime/tooling. Web servers must be isolated with PLAYWRIGHT_ISOLATED_NEXT=1 and must never bind ports 3000 or 3105. Allocate distinct ports and app resources before launch. This web-server flag is not a Unity test instruction.
- Keep a contextual diary in tasks/diaries/ inside the assigned repository/project or isolated lane workspace. State its exact location in the handoff.
- A worker's report is a claim. Inspect actual source, receipts and test output; use git log/show for relevant existing commits. Preserve original failed results and qualify unsupported coverage.
- Before calling a file missing, check the exact path reported, including ~/Library/Application Support/Claude/side-session-notes/ when relevant. Do not sweep unrelated private files.
- Judge the output against the original prompt plus accepted steers, not only test pass counts. Use satisfied/incomplete/intentionally superseded/blocked with evidence.

## Pace and communication

Long jobs run in the background; await completion notifications. Do not poll or sleep. On notification inspect the actual outcome before dispatching follow-up. If notification support fails, surface that blocker rather than inventing a polling loop or duplicating the job.

Maintain the Claude-owned lane ledger/mailbox, not Codex's canonical master. Use short status lines and one wrap_up at the end of each turn. When a session finishes, report it in one or two lines with a verified session link; explicitly name sessions waiting on TJ. Never construct a fake link.

The file mailbox remains a durable handoff, not an automatic notification transport. Read it on task/notification/owner-driven coordination events, not scheduled polling. TJ can relay urgent questions; Claude still asks TJ directly through its required popup for gated actions. This Claude no-poll policy does not install or cancel a Scout automation.

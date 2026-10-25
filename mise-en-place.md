# Mise en place: the Chef workflow

This is the working agreement for a lead Codex agent (Chef) and any delegated agents (Sous, LineCook, or Commis). Follow `AGENTS.md` and the user's instructions first. A role is an assignment of responsibility, not a claim about an agent's actual model, permissions, or authority. This agreement does not override platform policy or grant expanded permissions.

## Chef owns the dish

Chef owns both delivery quality and labor cost: the reasoning, context, coordination, retries, and verification spent to deliver the result. Chef interprets the request, defines what finished means, chooses whether to delegate, assigns bounded work, monitors progress, reconciles contributions, verifies the result, and answers to the user. Chef may take on the hardest or most coupled part of the work, but must reserve time and attention for oversight. No delegated result is considered complete until Chef has reviewed it.

Before dispatching work, Chef checks the relevant repository state and existing user changes, identifies dependencies and risks, and separates tasks only where ownership is clear. Run workers in parallel only for genuinely independent work without shared-write or rate-limit collisions. If tasks must edit the same code, sequence them or give one agent ownership of that code. Agents sharing a checkout must preserve one another's changes. Sequence work for real input dependencies or resource constraints, not merely because tasks were listed in that order.

For a substantial feature with a PRD, use `tasks/TASKS/rules/generate-tasks.mdc` to create a reviewable task list. If no PRD exists, first capture the requirements in a brief PRD or resolve the few questions that materially affect the design. Treat task numbers as identifiers: mark real dependencies, assign independent tasks concurrently where useful, and keep each task's status and owner current. A task list does not require Chef to wait for one worker to finish before starting unrelated work. Do not create a PRD or task list for a straightforward fix that does not need one.

## Plan the mise en place

Planning is part of labor cost. For a small fix, a short checklist in the working context is enough; use deeper design only when concrete uncertainty or risk justifies it. Do not create planning committees or recursive plans by default.

Before execution, establish:

1. The desired outcome and the evidence that will satisfy acceptance.
2. The relevant current state, existing changes, completed work, and accepted evidence that can be reused.
3. Actual input dependencies and any shared-file, resource, or rate-limit collisions.
4. The smallest useful work breakdown, with owners, input/output interfaces, and task-appropriate model capability and reasoning.
5. A bounded worker, retry, review, and verification budget, including necessary gates and stop conditions.
6. Unresolved decisions and permissions, separated from work that can already proceed safely. Gate only the dependent work; do not treat the plan as authorization.

Finish planning when executable bounded tasks and necessary gates are clear, not when every hypothetical has been enumerated. Revisit only the affected part when new evidence changes an assumption, dependency, or risk.

## Staff the task, not the title

Use the least costly model and reasoning effort that can meet the quality bar. These are starting points, not fixed entitlements; confirm the **actual** model and reasoning effort shown by the runtime before assigning work. A role name or prompt saying "use high reasoning" does not change the running task's settings.

| Task | Typical owner | Starting reasoning when available |
| --- | --- | --- |
| Mechanical edits, documentation, narrow searches, and reproducible evidence gathering | Chef alone or Commis | Low; medium when interpretation or consistency needs it |
| Ordinary scoped implementation and related tests with clear boundaries | Chef alone, LineCook, or Sous | Medium |
| Complex cross-system reasoning, security, or concurrency work | Chef or a qualified Sous | High when the concrete complexity or risk warrants it |
| Decomposition, integration, review, and final delivery | Chef | Sufficient to review the hardest assignment, with reasoning effort **higher than every delegated worker** |

These examples describe tasks, not model-brand assignments or entitlements attached to a title. Choose the lowest sufficient model capability and reasoning for each Sous, LineCook, or Commis: neither underpower the assignment nor elevate it automatically. The highest supported effort is exceptional, not the default. Escalate only for concrete complexity, risk, or a failed bounded attempt whose cause calls for more capability; reduce the assignment's settings again when the hard part is resolved, where controls permit.

Start with one working agent, Chef, for a small job. Add a worker only when its bounded contribution should improve quality, speed, or total cost after accounting for briefing and review. Use deterministic code for simple deduplication or counting. Reuse accepted results instead of commissioning duplicate research, recursive delegation, or redundant reviews by habit.

Before spawning, record the Chef's actual model and reasoning effort. Choose each worker's model and effort explicitly in the agent-creation controls, then verify the returned assignment. Do not rely on defaults: a sub-agent may inherit Chef's model and reasoning effort if no override is supplied. If an override requires a limited-context fork, give the worker a self-contained ticket with the necessary context.

Keep Chef's reasoning effort **strictly above** every worker's, and Chef's model capable of independently reviewing the hardest delegated work. Do not raise the whole team's settings just to preserve a delegation plan. If a worker's justified effort would violate that hierarchy, keep the hard work with a suitably capable Chef or use a supported configuration change only when the work warrants its cost. If the runtime cannot verify or apply the ideal assignment, state the constraint and use a feasible assignment; request a suitably configured task only when necessary. Never claim a setting changed unless the runtime confirms it. Do not substitute a specialist's confidence for independent review.

## Set a labor budget

Before substantial delegation, set task-appropriate caps for total agents used, model and reasoning levels, retries, and verification work. A concurrency limit alone does not bound labor cost. Include Chef's planning, coordination, and review effort, and reserve room for essential checks. Keep this brief and record it with the task or handoff rather than creating a separate planning artifact by default.

At a cap, account for completed work and remaining risk, then narrow, reassign, or report the blocker instead of silently adding workers or repeating attempts. Change a budget only with a concrete reason, within the user's constraints; if it cannot support essential acceptance evidence, report the shortfall rather than lowering the quality bar. Report observed work and available usage evidence honestly; do not invent token counts, monetary savings, or other usage telemetry.

## Chef's P&L: return on effort

Chef oversees the kitchen's return on effort. Profit means accepted task outcomes, verified blockers removed, or uncertainty reduced enough to support a decision. Lines of code, generated documents, activity, test counts, and agent agreement do not establish profit by themselves. Labor includes model and reasoning time, tokens when exposed, delegation, review, and rework. Food cost means relevant tool, API, and compute costs when known; do not invent dollar estimates.

Use a compact progress note in the existing task or handoff: elapsed time, attempts, last meaningful outcome, next bounded result, remaining prep list, and actual usage metrics if supplied. Missing per-thread attribution to the weekly quota remains unknown. Neither wall-clock time nor token counts establish an exact quota percentage; do not present them as one.

At meaningful checkpoints or when effort grows without proportionate progress, compare the expected value of the next bounded attempt with its cost and the higher-value unfinished tasks. Diagnose the stall, narrow the question, reuse accepted evidence, choose a lower-cost assignment where sufficient, or escalate only when concrete evidence justifies it. Stop wasteful loops and report the concrete blocker with an explicit next step. Keep automatic retries within the agreed cap; another attempt needs a changed approach or relevant new evidence.

Stop repeated identical tests, perfection chasing, and minor polish that displaces the remaining prep list, while retaining essential safety and data-integrity checks. Stopping a loop does not mean silently abandoning the requested outcome or concealing blocked work. Use normal handoffs and meaningful checkpoints for oversight; avoid frequent polling or elaborate cost ledgers that themselves consume the budget.

## The handoff ticket

Each assignment tells the worker:

1. The bounded task, expected output or artifact, and acceptance criteria.
2. The named owner, exact files or subsystem it owns, required inputs, and relevant context and constraints.
3. What it may change, what it must leave alone, and which other worker owns adjacent code.
4. The narrow checks or evidence expected, including what cannot be verified locally.
5. The chosen model and reasoning effort, with a short justification when those controls are available.
6. Real dependencies, applicable labor and retry limits, and a stop condition for success or blocked progress.

Keep tickets and return handoffs compact and self-contained. Link the necessary requirements, files, and accepted evidence instead of copying an entire conversation. Return artifact locations, checks and outcomes, unresolved issues, and missing or failed deliverables explicitly; silence is not completion.

Workers must report a blocker as soon as it prevents useful progress. They must not broaden scope, start another worker, contact third parties, deploy, merge, or perform irreversible external actions unless Chef explicitly delegates an action already authorized by the user. They report their changes, checks, uncertainties, and any uncommitted work to Chef when finished, then wait for a new assignment if the platform keeps them available. They do not declare the whole project done.

## Chef's pass

Chef reads each report, inspects the actual diff or artifact, checks the result against the original request, and confirms that workers did not overwrite user work or expand scope. Chef resolves overlap and integration issues, runs proportionate verification, and assigns corrections when needed. A worker's passing test report does not replace Chef's review; Chef may reuse the evidence without rerunning a successful check unless integration changes justify it.

Use actual tests and artifacts as acceptance evidence, not agreement between agents. For risk that warrants independent review, use a fresh-context reviewer with the requirements, relevant constraints, and actual artifacts or test evidence. Do not seed that review with the implementer's endorsement of its own work. An additional reviewer is not a mandatory multiplier for a trivial edit.

Match testing to changed behavior and blast radius. Start with the narrow regression check, then use affected integration, type, or lint checks as needed; run broader suites only for a specific justified risk or required gate. Preserve essential security, data-integrity, and release gates. Avoid repeating unchanged suites, speculative edge cases unrelated to the change, audits repeated until nothing new appears, or tests added merely to inflate counts. For documentation-only edits, inspect the content and diff and validate any changed command references; application suites are not warranted solely because Markdown changed.

If a worker is stuck, Chef narrows the question, changes the approach or assignment, or takes over within the agreed budget. Account explicitly for missing and failed work before deciding what can be delivered. Do not let an idle or blocked worker silently consume the schedule. Stop when the agreed acceptance evidence passes; do not gold-plate, expand scope, or pursue optional improvements merely for more confidence.

Chef gives the final nod before delivery. The user receives a concise account of the result, meaningful verification, and material limits. Production pushes, deployments, migrations, and other external actions follow the user's authorization and `AGENTS.md` boundaries.

## Starting a new Chef task

Open a new Codex task in this repository, select the Chef's model and reasoning effort in the task controls **before starting**, and describe the desired outcome. Check the settings once the task starts; the prompt alone cannot set them. Choose settings for the actual complexity and planned staffing, then use a prompt such as:

> Act as Chef for a Fantrax traded-pick sync improvement. First inspect the current `getDraftResults` integration and the documented `getDraftPicks` response. Determine whether current and future pick ownership can be imported safely without erasing manual keeper assignments. Delegate only independent, bounded work to Sous or Commis agents, choosing model and reasoning effort to fit each task. Review and integrate every contribution yourself, run focused checks, and report what was verified. Implement the smallest complete local change. Do not push, deploy, or change production data unless I authorize it in this task.

For a small request, the same Chef should simply do the work without staffing a team.

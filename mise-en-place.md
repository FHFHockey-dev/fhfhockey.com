# Mise en place: the Chef workflow

This is the working agreement for a lead Codex agent (Chef) and any delegated agents (Sous or Commis). Follow `AGENTS.md` and the user's instructions first. A role is an assignment of responsibility, not a claim about an agent's actual model, permissions, or authority.

## Chef owns the dish

Chef interprets the request, defines what finished means, chooses whether to delegate, assigns bounded work, monitors progress, reconciles contributions, verifies the result, and answers to the user. Chef may take on the hardest or most coupled part of the work, but must reserve time and attention for oversight. No delegated result is considered complete until Chef has reviewed it.

Before dispatching work, Chef checks the relevant repository state and existing user changes, identifies dependencies and risks, and separates tasks only where ownership is clear. If tasks must edit the same code, sequence them or give one agent ownership of that code. Agents sharing a checkout must preserve one another's changes.

For a substantial feature with a PRD, use `tasks/TASKS/rules/generate-tasks.mdc` to create a reviewable task list. If no PRD exists, first capture the requirements in a brief PRD or resolve the few questions that materially affect the design. Treat task numbers as identifiers: mark real dependencies, assign independent tasks concurrently where useful, and keep each task's status and owner current. A task list does not require Chef to wait for one worker to finish before starting unrelated work. Do not create a PRD or task list for a straightforward fix that does not need one.

## Staff the task, not the title

Use the least costly model and reasoning effort that can meet the quality bar. These are starting points, not fixed entitlements; confirm the **actual** model and reasoning effort shown by the runtime before assigning work. A role name or prompt saying "use high reasoning" does not change the running task's settings.

| Assignment | Suitable work | Starting point when available |
| --- | --- | --- |
| Commis | Narrow searches, reproducible checks, small isolated edits, and evidence gathering with clear acceptance criteria | A fast model such as GPT-6 Luna at low reasoning |
| Sous | Multi-file implementation, tricky tests, ambiguous behavior, and focused design or integration analysis | A workhorse model such as GPT-6 Sol at medium reasoning; raise it only when the work demands it |
| Chef | Decomposition, architectural and risk decisions, conflict resolution, integration, independent review, and final delivery | A model capable of reviewing the hardest assignment, with reasoning effort **higher than every delegated worker**; for example, GPT-6 Sol at high when Sous uses Sol at medium |

Start with no workers for a straightforward task. Add a worker only when its bounded contribution should improve quality, speed, or total cost. Do not give an expensive model an easy task, or a cheap model a task it cannot reliably solve. Adjust an assignment when evidence shows it is harder or easier than expected.

Before spawning, record the Chef's actual model and reasoning effort. Choose each worker's model and effort explicitly in the agent-creation controls, then verify the returned assignment. Do not rely on defaults: a sub-agent may inherit Chef's model and reasoning effort if no override is supplied. If an override requires a limited-context fork, give the worker a self-contained ticket with the necessary context.

Keep Chef's reasoning effort **strictly above** every worker's, and Chef's model capable of independently reviewing the hardest delegated work. For example: Chef Sol/high, Sous Sol/medium, Commis Luna/low. If a Sous needs high, raise Chef to a higher supported effort such as xhigh before assigning it; if that cannot be done in the running task, keep the hard work with Chef or have the user start a suitably configured Chef task. Never claim a setting changed unless the runtime confirms it. Do not substitute a specialist's confidence for independent review.

## The handoff ticket

Each assignment tells the worker:

1. The specific outcome and acceptance criteria.
2. The files or subsystem it owns, plus relevant existing context and constraints.
3. What it may change, what it must leave alone, and which other worker owns adjacent code.
4. The narrow checks or evidence expected, including what cannot be verified locally.
5. The chosen model and reasoning effort, with a short justification when those controls are available.

Workers must report a blocker as soon as it prevents useful progress. They must not broaden scope, start another worker, contact third parties, deploy, merge, or perform irreversible external actions unless Chef explicitly delegates an action already authorized by the user. They report their changes, checks, uncertainties, and any uncommitted work to Chef when finished, then wait for a new assignment if the platform keeps them available. They do not declare the whole project done.

## Chef's pass

Chef reads each report, inspects the actual diff or artifact, checks the result against the original request, and confirms that workers did not overwrite user work or expand scope. Chef resolves overlap and integration issues, runs proportionate verification, and assigns corrections when needed. A worker's passing test report does not replace Chef's review; Chef may reuse the evidence without rerunning a successful check unless integration changes justify it.

If a worker is stuck, Chef narrows the question, changes the approach or assignment, or takes over. Do not let an idle or blocked worker silently consume the schedule. Stop work when the requested outcome is complete, not when every optional improvement has been attempted.

Chef gives the final nod before delivery. The user receives a concise account of the result, meaningful verification, and material limits. Production pushes, deployments, migrations, and other external actions follow the user's authorization and `AGENTS.md` boundaries.

## Starting a new Chef task

Open a new Codex task in this repository, select the Chef's model and reasoning effort in the task controls **before starting**, and describe the desired outcome. Check the settings once the task starts; the prompt alone cannot set them. For example, select GPT-6 Sol at high reasoning for a substantive integration, then use this prompt:

> Act as Chef for a Fantrax traded-pick sync improvement. First inspect the current `getDraftResults` integration and the documented `getDraftPicks` response. Determine whether current and future pick ownership can be imported safely without erasing manual keeper assignments. Delegate only independent, bounded work to Sous or Commis agents, choosing model and reasoning effort to fit each task. Review and integrate every contribution yourself, run focused checks, and report what was verified. Implement the smallest complete local change. Do not push, deploy, or change production data unless I authorize it in this task.

For a small request, the same Chef should simply do the work without staffing a team.

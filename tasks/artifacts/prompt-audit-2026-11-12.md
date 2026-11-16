# Prompt audit: Claude Code configuration for fhfhockey.com (2026-11-12)

Proposed diff: [prompt-audit-2026-11-12.patch](prompt-audit-2026-11-12.patch). No edits were applied.

## Assumptions

- **Scope:** the Claude Code configuration that loads into sessions in this project:
  - `AGENTS.md` (project root)
  - `.claude/worktrees/agent-a545cf8708ec4d090/AGENTS.md` (nested; it loads only in sessions that run inside that worktree)
  - `~/.claude/CLAUDE.md`
  - `~/.claude/skills/*`: orchestrator, superstyle (with `references/`), unslopify, unslop, craft-anything and reverse-engineer-anything
  - Report only, with no edits proposed: the synced Anthropic skills under `~/.claude/skills/synced/` and the plugin-provided skills, commands and agents (codex@openai-codex, rea, and the synced design, supabase, frontend-design and axe-accessibility plugins).
- **Not found:**
  - no ancestor `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` above the project
  - no `CLAUDE.local.md`
  - no `.claude/CLAUDE.md`, `.claude/AGENTS.md`, `.claude/rules`, `.claude/skills`, `.claude/commands` or `.claude/agents` in the project
  - no `~/.claude/rules`, `~/.claude/commands`, `~/.claude/agents` or `~/.claude/output-styles`
  - no managed-policy `CLAUDE.md`
- **Not read:**
  - Settings files, `.mcp.json` and `~/.claude.json`, as instructed.
  - The auto-memory folder (`MEMORY.md` and its files), which the requested scope does not list.
  - `mise-en-place.md` and `SPRINT-MODE.md`: `AGENTS.md` links to them as Markdown links, not `@` imports, so they don't load automatically. I only checked that they exist.
- **Target model:** `claude-opus-5-5` (the model running this audit). These files are not application prompts, so Group 4 (request config) is **not applicable**.
- **Other providers:** the codex plugin's `gpt-5-4-prompting` skill writes prompts for OpenAI's GPT-5.4, not for Claude. It is recorded here and not audited against Claude behaviour. `AGENTS.md` is also read by Codex, so changes to its wording affect both agents.
- **Provenance:** `git blame` is available for `AGENTS.md`. `~/.claude` is not a git repository, so the user-level files can't be dated.
- **Edits under `~/.claude` affect every project.**

## Summary

Overall the setup is in good shape. The prompt text has almost no dated wording: no capitalised MUST/NEVER pile-ups, no "think step by step", no hold-your-updates rules and no retired model names. The guardrails that matter (Vercel cost, NST rate limits, asking before production actions) give their reasons and stay. The findings are mostly Group 2: facts in the files that the repository has since outgrown.

1. **`AGENTS.md` still describes a `webhooks/` service that was removed on 2026-07-30** (commit `5bad4445a`, "retire standalone webhook service"). It is named in three places, one of them a test-script warning about a directory that no longer exists. *High.*
2. **`AGENTS.md` gives `npx tsc --noEmit` as the type-check command.** Since 2026-10-18, `web/package.json` has had a `typecheck` script that runs the same check with an 8 GB heap, and TJ's superstyle skill says a plain `npx tsc` run can run out of memory and look clean. *Medium.*
3. **The superstyle skill's description rides in every session in every project,** and it carries a pass list and six near-synonym trigger phrases. A shorter, intent-based description would route just as well. *Medium.*

Counts by group:

| Group | High | Medium | Low / flag |
|---|---|---|---|
| Group 1 (dated prompt text) | 0 | 0 | 1 |
| Group 2 (brittle configuration) | 1 | 3 | 3 |
| Group 3 (tool descriptions) | not applicable (no tool definitions in scope) | | |
| Group 4 (request config) | not applicable | | |

## Findings

### F1: retired `webhooks/` directory still documented (High)

- **Location:** [AGENTS.md:41](../../AGENTS.md#L41), [AGENTS.md:73](../../AGENTS.md#L73), [AGENTS.md:112](../../AGENTS.md#L112)
- **Evidence:**
  - "`webhooks/`: standalone webhook service for long-running/browser-backed tasks."
  - "`webhooks/` has no functional test script; its current `npm test` intentionally exits with an error."
  - "...boundaries among the web app, CMS, functions, webhooks, and database assets."
- **Pattern:** Group 2, volatile specifics.
- **Why obsolete:** `webhooks/` does not exist, and git tracks no files under it. Commit `5bad4445a` (2026-07-30) retired the service three days after these lines were written (`a13dd0175c`, 2026-07-27). Agents get sent to a path and a test warning that refer to nothing.
- **Action:** remove lines 41 and 73; rewrite line 112 without "webhooks" (hunks 1, 3 and 5).

### F2: type-check command older than the repository's own script (Medium)

- **Location:** [AGENTS.md:58](../../AGENTS.md#L58), [AGENTS.md:89](../../AGENTS.md#L89)
- **Evidence:** "Type-check: `npx tsc --noEmit`." and "...then `npx tsc --noEmit` and/or `npm run lint`..."
- **Pattern:** Group 2, volatile specifics, plus a conflict between instruction files.
- **Why obsolete:** `web/package.json` defines `typecheck: NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit`, added in `317f8f57e` (2026-10-18). That is after these lines (`a13dd0175c`, 2026-07-27; `15caa26eac`, 2026-08-01). The user-level superstyle skill (`references/gotchas.md:36`) says "`npm run typecheck`, not `npx tsc`", so the two files disagree on the same step. `npx tsc --noEmit` still runs, so this is not a hard contradiction. The evidence for the change is the project's own manifest, not the user-level skill.
- **Action:** rewrite both lines to `npm run typecheck` (hunks 2 and 4). This is proposed only: confirm before applying.

### F3: superstyle description lists trigger phrases and procedure (Medium, affects all projects)

- **Location:** `~/.claude/skills/superstyle/SKILL.md:3`
- **Evidence:** "...in a fixed order (design-critique, design-system, accessibility-review, ux-copy, unslop, frontend-design, dataviz)... asks for a "style pass", "UX/UI pass", "taste pass", "design pass", "polish pass" or "visual audit"..."
- **Pattern:** Group 2, trigger-case enumeration.
- **Why obsolete:** the description is sent with every request in every project, while the pass order already lives in the body. Six near-synonymous phrases generalise worse than one intent category. The calibrated urgency is fine for trigger text, and the rewrite keeps it ("even for one page or only some of the skills").
- **Action:** rewrite to intent categories (hunk 6).

### F4: history narrative in superstyle (Medium, affects all projects)

- **Location:** `~/.claude/skills/superstyle/SKILL.md:8, 23, 29, 90`
- **Evidence:**
  - "It encodes the process that ran across the toenail pages on 2026-11-04/05"
  - "(TJ, 2026-11-07, Game Grid week nav and 7/10-day toggle)"
  - "(TJ, 2026-11-12, /drm)"
  - "(TJ's rule, 2026-11-03)"
- **Pattern:** Group 2, history narratives.
- **Why obsolete:** a rule's authority is the behaviour it prescribes. The dates and incident tags add nothing the model acts on, and they make the rules read as session notes. The reasons that follow from past runs stay ("The first run skipped four pages...", "The first run found one..."), because they explain why a check exists.
- **Action:** remove the dated tags (hunks 7 to 10).

### F5: delegation rules in the root AGENTS.md vs the orchestrator skill (Low, flag)

- **Location:** [AGENTS.md:13](../../AGENTS.md#L13) vs `~/.claude/skills/orchestrator/SKILL.md:11-16` and `~/.claude/CLAUDE.md`
- **Evidence:** `AGENTS.md` says to follow `mise-en-place.md` for delegation, and "Chef's reasoning effort must be higher than every worker's". The user-level files say to delegate to `start_session` threads, never Agent subagents.
- **Pattern:** Group 2, possible conflict between instruction files.
- **Why flagged:** the two loaded texts don't contradict each other. Whether `mise-en-place.md` (not read, per scope) prescribes a different worker mechanism is unchecked. A project file can't justify editing user-level files, and vice versa.
- **Decision for TJ:** whether `mise-en-place.md` should defer to the orchestrator skill on how workers are started.

### F6: superstyle is project-specific but installed at user level (Low, flag)

- **Location:** `~/.claude/skills/superstyle/`
- **Why flagged:** it applies only to this repository (it uses `FHFH_WEB`, `tasks/TASKS/rules/...` and the `:3000` dev server), yet its description loads in every project. Moving it to `.claude/skills/superstyle/` in this repository would scope it. No pattern row covers this, so no edit is proposed.

### F7: two identical copies of reverse-engineer-anything (Low, flag)

- **Location:** `~/.claude/skills/reverse-engineer-anything/SKILL.md` (506 lines) and the rea plugin's `skills/reverse-engineer-anything/SKILL.md`
- **Evidence:** the files are byte-identical (version 49, `tool_count: 229`).
- **Pattern:** Group 2, time-sensitive content: duplicates drift apart.
- **Why flagged:** they agree today (keep-list item 8), but the next plugin update will change only one copy. Both are vendor-installed, so no edit is proposed. Consider removing the user-level copy if the rea installer doesn't need it.

### F8: scope and verification limits in AGENTS.md (Low, flag)

- **Location:** [AGENTS.md:5-9](../../AGENTS.md#L5)
- **Evidence:** "Stop when the requested outcome is complete and proportionate verification has passed. Do not continue with optional cleanup, broader checks, or extra improvements merely for additional confidence."
- **Pattern:** Group 1d, model-era mitigations. These are the scope and over-verification instructions that the Claude Opus 5.5 migration guidance names as re-test candidates.
- **Why flagged:** the guidance is to keep them as the starting point and re-test, not to delete them. They also steer Codex, which reads this file.

### Clean

- **`~/.claude/CLAUDE.md`:** two personal defaults, each with a clear purpose. No findings.
- **orchestrator:** the rules give their reasons and are specific (pop-ups, verify-don't-relay, gated releases). No findings.
- **unslopify:** user-invoked only (`disable-model-invocation`). The rules are the product (a writing rubric), not model steering.
- **unslop:** a named list of styles to avoid is the form that works for frontend direction on Claude Opus 5.5. Keep it.
- **craft-anything:** no signal hits.
- **superstyle `references/passes.md` and `gotchas.md`:** calibration examples are labelled and varied. Keep them.
- **Worktree `AGENTS.md`:** it differs from the root file only by naming Node 22.11.0. That matches its own `web/.nvmrc` at its commit, so it isn't stale within its checkout. The root `AGENTS.md` also says to preserve historical worktrees without further edits.

### Plugin and synced skills (report only, no edits proposed)

The greppable signals were run over:

- codex@openai-codex (8 commands, 1 agent, 3 skills)
- the rea plugin skill
- the synced design (7), supabase (2 plus a `CLAUDE.md`), frontend-design and axe-accessibility (4) skills
- the 13 synced Anthropic skills

Nothing matched the dated-idiom patterns. Capitalised emphasis is sparse (at most 3 per file, in supabase-postgres-best-practices and skill-creator). Two notes:

- codex `gpt-5-4-prompting` targets another provider's model and is outside this audit's target.
- The supabase plugin's `CLAUDE.md` sits at the plugin root and is not loaded as a session instruction file.

## How to verify

- **F1 and F2:** recheck in the repository (`ls webhooks`, the `typecheck` script in `web/package.json`). No behaviour test is needed.
- **F3:** after applying, check that `/superstyle` and a plain "do a polish pass on /stats" in this project still pick the skill.
- **F8:** if you remove anything there, try a few representative tasks before and after, one change at a time.
